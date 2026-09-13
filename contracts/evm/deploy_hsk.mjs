/**
 * Deployment script for HashKey Chain (HSK)
 * Deploys PollarVault, PollarForwarder, and MockUSDC
 * 
 * Usage:
 *   node contracts/evm/deploy_hsk.mjs --network hskTestnet --private-key <KEY>
 *   node contracts/evm/deploy_hsk.mjs --network hskMainnet --private-key <KEY>
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Read args
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) return args[index + 1];
  return defaultValue;
}

const networkName = getArg('--network', 'hskTestnet');
const privateKey = getArg('--private-key', process.env.PRIVATE_KEY);

// Network config
const NETWORKS = {
  hskTestnet: {
    name: 'HashKey Chain Testnet',
    chainId: 133,
    rpcUrl: 'https://hashkeychain-testnet.alt.technology',
    blockExplorer: 'https://hashkeychain-testnet-explorer.alt.technology',
  },
  hskMainnet: {
    name: 'HashKey Chain Mainnet',
    chainId: 177,
    rpcUrl: 'https://mainnet.hsk.xyz',
    blockExplorer: 'https://explorer.hsk.xyz',
  },
};

const network = NETWORKS[networkName];
if (!network) {
  console.error(`Network ${networkName} not found. Available: ${Object.keys(NETWORKS).join(', ')}`);
  process.exit(1);
}

if (!privateKey) {
  console.error('Private key required. Use --private-key or set PRIVATE_KEY env var.');
  process.exit(1);
}

// Load compiled contracts
const buildDir = path.resolve('./contracts/evm/build');
function loadArtifact(name) {
  const artifactPath = path.resolve(buildDir, name);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact ${name} not found. Run: node contracts/evm/compile.mjs`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

async function deploy() {
  console.log('='.repeat(60));
  console.log(`Deploying to: ${network.name}`);
  console.log(`RPC: ${network.rpcUrl}`);
  console.log(`Chain ID: ${network.chainId}`);
  console.log('='.repeat(60));

  // Load ethers dynamically
  const ethers = await import('ethers');
  
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(network.rpcUrl, network.chainId);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Deployer: ${wallet.address}`);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} HSK`);

  if (balance === 0n) {
    console.error('ERROR: Deployer has 0 balance. Fund the account first.');
    process.exit(1);
  }

  const deployed = {};

  try {
    // 1. Deploy PollarForwarder
    console.log('\n--- Deploying PollarForwarder ---');
    const forwarderArtifact = loadArtifact('PollarForwarder.json');
    const forwarderFactory = new ethers.ContractFactory(
      forwarderArtifact.abi,
      forwarderArtifact.bytecode,
      wallet
    );
    const forwarder = await forwarderFactory.deploy();
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();
    deployed.forwarder = forwarderAddress;
    console.log(`✓ PollarForwarder deployed: ${forwarderAddress}`);
    console.log(`  Explorer: ${network.blockExplorer}/address/${forwarderAddress}`);

    // 2. Deploy PollarVault (with forwarder address)
    console.log('\n--- Deploying PollarVault ---');
    const vaultArtifact = loadArtifact('PollarVault.json');
    const vaultFactory = new ethers.ContractFactory(
      vaultArtifact.abi,
      vaultArtifact.bytecode,
      wallet
    );
    const vault = await vaultFactory.deploy(forwarderAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    deployed.vault = vaultAddress;
    console.log(`✓ PollarVault deployed: ${vaultAddress}`);
    console.log(`  Explorer: ${network.blockExplorer}/address/${vaultAddress}`);

    // 3. Deploy MockUSDC (only for testnet)
    if (networkName.includes('testnet') || networkName.includes('Testnet')) {
      console.log('\n--- Deploying MockUSDC (testnet only) ---');
      const mockArtifact = loadArtifact('MockUSDC.json');
      const mockFactory = new ethers.ContractFactory(
        mockArtifact.abi,
        mockArtifact.bytecode,
        wallet
      );
      const mock = await mockFactory.deploy();
      await mock.waitForDeployment();
      const mockAddress = await mock.getAddress();
      deployed.mockUSDC = mockAddress;
      console.log(`✓ MockUSDC deployed: ${mockAddress}`);
      console.log(`  Explorer: ${network.blockExplorer}/address/${mockAddress}`);
    }

    // Save deployment info
    const deployInfo = {
      network: networkName,
      chainId: network.chainId,
      deployer: wallet.address,
      deployedAt: new Date().toISOString(),
      contracts: deployed,
      explorer: network.blockExplorer,
    };

    const outputPath = path.resolve(`contracts/evm/deploy_${networkName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(deployInfo, null, 2));
    console.log(`\n✓ Deployment info saved: ${outputPath}`);

    console.log('\n' + '='.repeat(60));
    console.log('DEPLOYMENT SUCCESSFUL');
    console.log('='.repeat(60));
    console.log(JSON.stringify(deployed, null, 2));
    console.log('\nNext steps:');
    console.log('1. Update deploy_info.json with these addresses');
    console.log('2. Start the relayer with these contract addresses');
    console.log('3. Update app config with HSK network');

  } catch (err) {
    console.error('\nDEPLOYMENT FAILED:', err.message);
    process.exit(1);
  }
}

deploy().catch(err => {
  console.error(err);
  process.exit(1);
});
