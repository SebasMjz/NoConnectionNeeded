import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read arguments: --network <name> --private-key <key> --contract <vault|forwarder|usdc|all>
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
}

const networkName = getArg('--network', 'sepolia');
const privateKey = getArg('--private-key', process.env.PRIVATE_KEY);
const targetContract = getArg('--contract', 'all');

// 1. Load deploy config
const configPath = path.resolve(__dirname, 'deploy_info.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const networkConfig = config.networks[networkName];
if (!networkConfig) {
  console.error(`[ERROR] Network '${networkName}' not found in deploy_info.json.`);
  console.log('Available networks:', Object.keys(config.networks).join(', '));
  process.exit(1);
}

function loadArtifact(fileName) {
  const artifactPath = path.resolve(__dirname, 'build', fileName);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Build artifact ${fileName} not found. Please run: node contracts/evm/compile.mjs`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

async function main() {
  console.log('========================================================');
  console.log(`Desplegando contratos en: ${networkConfig.name}`);
  console.log(`RPC URL: ${networkConfig.rpcUrl}`);
  console.log(`Chain ID: ${networkConfig.chainId}`);
  console.log(`Target: ${targetContract}`);
  console.log('========================================================\n');

  if (!privateKey) {
    console.error('[ERROR] No se especificó Private Key.');
    console.log('\nUso:');
    console.log('  node contracts/evm/deploy.mjs --network hskTestnet --private-key 0xTU_CLAVE_PRIVADA --contract all');
    console.log('O configura la variable de entorno:');
    console.log('  $env:PRIVATE_KEY="0xTU_CLAVE_PRIVADA"');
    console.log('  node contracts/evm/deploy.mjs --network hskTestnet');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const address = await wallet.getAddress();
  console.log(`Deployer Address: ${address}`);

  const balanceWei = await provider.getBalance(address);
  const balanceEth = ethers.formatEther(balanceWei);
  console.log(`Saldo de la cuenta: ${balanceEth} ${networkConfig.nativeToken}\n`);

  if (balanceWei === 0n) {
    console.error(`[ERROR] La cuenta no tiene saldo para pagar el gas en ${networkConfig.name}.`);
    console.log(`Puedes obtener tokens de prueba gratis en el faucet: ${networkConfig.faucetUrl}`);
    process.exit(1);
  }

  let forwarderAddress = networkConfig.forwarderAddress;
  let usdcAddress = networkConfig.usdcAddress;
  let vaultAddress = networkConfig.vaultAddress;

  // 1. Deploy PollarForwarder if needed
  if (targetContract === 'all' || targetContract === 'forwarder') {
    console.log('\n[1/3] Desplegando PollarForwarder (ERC-2771 Relayer)...');
    const { abi, bytecode } = loadArtifact('PollarForwarder.json');
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const forwarder = await factory.deploy();
    console.log(`Tx enviada: ${forwarder.deploymentTransaction().hash}`);
    await forwarder.waitForDeployment();
    forwarderAddress = await forwarder.getAddress();
    console.log(`✓ PollarForwarder desplegado en: ${forwarderAddress}`);
    networkConfig.forwarderAddress = forwarderAddress;
  }

  // 2. Deploy MockUSDC if on HSK or requested
  if (targetContract === 'all' || targetContract === 'usdc') {
    if (!usdcAddress || targetContract === 'usdc' || networkName === 'hskTestnet') {
      console.log('\n[2/3] Desplegando MockUSDC (EIP-3009 + EIP-2612)...');
      const { abi, bytecode } = loadArtifact('MockUSDC.json');
      const factory = new ethers.ContractFactory(abi, bytecode, wallet);
      const usdc = await factory.deploy();
      console.log(`Tx enviada: ${usdc.deploymentTransaction().hash}`);
      await usdc.waitForDeployment();
      usdcAddress = await usdc.getAddress();
      console.log(`✓ MockUSDC desplegado en: ${usdcAddress}`);
      networkConfig.usdcAddress = usdcAddress;
    } else {
      console.log(`\n[2/3] Usando USDC existente en ${networkName}: ${usdcAddress}`);
    }
  }

  // 3. Deploy PollarOfflineVault
  if (targetContract === 'all' || targetContract === 'vault') {
    console.log('\n[3/3] Desplegando PollarOfflineVault (con forwarder y soporte gasless)...');
    const { abi, bytecode } = loadArtifact('PollarVault.json');
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const vault = await factory.deploy(forwarderAddress || ethers.ZeroAddress);
    console.log(`Tx enviada: ${vault.deploymentTransaction().hash}`);
    await vault.waitForDeployment();
    vaultAddress = await vault.getAddress();
    console.log(`✓ PollarOfflineVault desplegado en: ${vaultAddress}`);
    networkConfig.vaultAddress = vaultAddress;
  }

  // Save config
  config.networks[networkName] = networkConfig;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n✓ Configuración actualizada en contracts/evm/deploy_info.json`);

  // Update src/services/evmCrypto.js
  const evmCryptoPath = path.resolve(__dirname, '../../src/services/evmCrypto.js');
  if (fs.existsSync(evmCryptoPath)) {
    let evmCode = fs.readFileSync(evmCryptoPath, 'utf8');
    if (vaultAddress) {
      const vRegex = new RegExp(`(${networkName}:[\\s\\S]*?vaultAddress:\\s*')0x[a-fA-F0-9]{40}(')`);
      if (vRegex.test(evmCode)) {
        evmCode = evmCode.replace(vRegex, `$1${vaultAddress}$2`);
      }
    }
    if (usdcAddress) {
      const uRegex = new RegExp(`(${networkName}:[\\s\\S]*?usdcAddress:\\s*')[^']*(')`);
      if (uRegex.test(evmCode)) {
        evmCode = evmCode.replace(uRegex, `$1${usdcAddress}$2`);
      }
    }
    fs.writeFileSync(evmCryptoPath, evmCode);
    console.log(`✓ src/services/evmCrypto.js actualizado.`);
  }

  console.log('\n========================================================');
  console.log('🎉 Despliegue completado con éxito!');
  console.log(`- Forwarder (ERC-2771): ${forwarderAddress || 'No desplegado'}`);
  console.log(`- USDC Token:          ${usdcAddress || 'N/A'}`);
  console.log(`- Pollar Vault:        ${vaultAddress || 'N/A'}`);
  console.log('========================================================\n');
}

main().catch((err) => {
  console.error('\n[ERROR] Falló el despliegue:', err.message);
  process.exit(1);
});
