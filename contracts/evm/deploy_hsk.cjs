const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) return args[index + 1];
  return defaultValue;
}

const networkName = getArg('--network', 'hskTestnet');
const privateKey = getArg('--private-key', process.env.PRIVATE_KEY);

const NETWORKS = {
  hskTestnet: {
    name: 'HashKey Chain Testnet',
    chainId: 133,
    rpcUrl: 'https://testnet.hsk.xyz',
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

const buildDir = path.resolve(__dirname, 'build');
function loadArtifact(name) {
  const p = path.resolve(buildDir, name);
  if (!fs.existsSync(p)) throw new Error(`Artifact ${name} not found. Run: node compile.cjs`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function deploy() {
  console.log('='.repeat(60));
  console.log(`Deploying to: ${network.name}`);
  console.log(`RPC: ${network.rpcUrl}`);
  console.log(`Chain ID: ${network.chainId}`);
  console.log('='.repeat(60));

  const provider = new ethers.JsonRpcProvider(network.rpcUrl, network.chainId);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Deployer: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} HSK`);

  if (balance === 0n) {
    console.error('ERROR: Deployer has 0 balance.');
    process.exit(1);
  }

  const deployed = {};

  // 1. Deploy PollarForwarder
  console.log('\n--- Deploying PollarForwarder ---');
  const forwarderArtifact = loadArtifact('PollarForwarder.json');
  const forwarderFactory = new ethers.ContractFactory(forwarderArtifact.abi, forwarderArtifact.bytecode, wallet);
  const forwarder = await forwarderFactory.deploy();
  await forwarder.waitForDeployment();
  const forwarderAddress = await forwarder.getAddress();
  deployed.forwarder = forwarderAddress;
  console.log(`✓ PollarForwarder deployed: ${forwarderAddress}`);

  // 2. Deploy PollarVault
  console.log('\n--- Deploying PollarVault ---');
  const vaultArtifact = loadArtifact('PollarVault.json');
  const vaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
  const vault = await vaultFactory.deploy(forwarderAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  deployed.vault = vaultAddress;
  console.log(`✓ PollarVault deployed: ${vaultAddress}`);

  // 3. MockUSDC (testnet only)
  if (networkName.includes('testnet') || networkName.includes('Testnet')) {
    console.log('\n--- Deploying MockUSDC (testnet only) ---');
    const mockArtifact = loadArtifact('MockUSDC.json');
    const mockFactory = new ethers.ContractFactory(mockArtifact.abi, mockArtifact.bytecode, wallet);
    const mock = await mockFactory.deploy();
    await mock.waitForDeployment();
    const mockAddress = await mock.getAddress();
    deployed.mockUSDC = mockAddress;
    console.log(`✓ MockUSDC deployed: ${mockAddress}`);
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

  const outputPath = path.resolve(__dirname, `deploy_${networkName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deployInfo, null, 2));
  console.log(`\n✓ Deployment info saved: ${outputPath}`);

  console.log('\n' + '='.repeat(60));
  console.log('DEPLOYMENT SUCCESSFUL');
  console.log('='.repeat(60));
  console.log(JSON.stringify(deployed, null, 2));
}

deploy().catch(err => {
  console.error('\nDEPLOYMENT FAILED:', err.message);
  process.exit(1);
});
