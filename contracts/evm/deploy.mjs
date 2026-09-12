import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read arguments: --network <name> --private-key <key>
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

// 1. Load deploy config
const configPath = path.resolve(__dirname, 'deploy_info.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const networkConfig = config.networks[networkName];
if (!networkConfig) {
  console.error(`[ERROR] Network '${networkName}' not found in deploy_info.json.`);
  console.log('Available networks:', Object.keys(config.networks).join(', '));
  process.exit(1);
}

// 2. Load compiled artifact
const artifactPath = path.resolve(__dirname, 'build', 'PollarVault.json');
if (!fs.existsSync(artifactPath)) {
  console.error('[ERROR] Build artifact not found. Please run: node contracts/evm/compile.mjs');
  process.exit(1);
}

const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function main() {
  console.log('========================================================');
  console.log(`Desplegando PollarOfflineVault en: ${networkConfig.name}`);
  console.log(`RPC URL: ${networkConfig.rpcUrl}`);
  console.log(`Chain ID: ${networkConfig.chainId}`);
  console.log('========================================================\n');

  if (!privateKey) {
    console.error('[ERROR] No se especificó Private Key.');
    console.log('\nUso:');
    console.log('  node contracts/evm/deploy.mjs --network sepolia --private-key 0xTU_CLAVE_PRIVADA');
    console.log('O configura la variable de entorno:');
    console.log('  $env:PRIVATE_KEY="0xTU_CLAVE_PRIVADA"');
    console.log('  node contracts/evm/deploy.mjs --network sepolia');
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

  console.log('Transmitiendo contrato PollarOfflineVault a la blockchain...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();

  console.log(`Transacción de despliegue enviada: ${contract.deploymentTransaction().hash}`);
  console.log('Esperando confirmación on-chain (1 bloque)...');

  await contract.waitForDeployment();
  const deployedAddress = await contract.getAddress();

  console.log('\n========================================================');
  console.log('[ÉXITO] ¡Contrato Desplegado Exitosamente!');
  console.log(`Dirección del Contrato: ${deployedAddress}`);
  console.log(`Explorer: ${networkConfig.blockExplorer}/address/${deployedAddress}`);
  console.log('========================================================\n');

  // Update deploy_info.json
  config.networks[networkName].vaultAddress = deployedAddress;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✓ Actualizado contracts/evm/deploy_info.json con la nueva dirección.`);

  // Update src/services/evmCrypto.js
  const evmCryptoPath = path.resolve(__dirname, '../../src/services/evmCrypto.js');
  if (fs.existsSync(evmCryptoPath)) {
    let evmCode = fs.readFileSync(evmCryptoPath, 'utf8');
    const regex = new RegExp(`(${networkName}:[\\s\\S]*?vaultAddress:\\s*')0x[a-fA-F0-9]{40}(')`);
    if (regex.test(evmCode)) {
      evmCode = evmCode.replace(regex, `$1${deployedAddress}$2`);
      fs.writeFileSync(evmCryptoPath, evmCode);
      console.log(`✓ Actualizado src/services/evmCrypto.js con la nueva dirección.`);
    }
  }
}

main().catch((err) => {
  console.error('\n[ERROR] Falló el despliegue:', err.message);
  process.exit(1);
});
