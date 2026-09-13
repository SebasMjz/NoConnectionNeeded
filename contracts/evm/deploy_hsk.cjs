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

  // Get initial nonce from chain
  let currentNonce = await provider.getTransactionCount(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Starting nonce: ${currentNonce}`);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} HSK`);

  if (balance === 0n) {
    console.error('ERROR: Deployer has 0 balance.');
    process.exit(1);
  }

  const deployed = {};

  // Helper: deploy with manual nonce management
  async function deployContract(name, factory, ...args) {
    console.log(`\n--- Deploying ${name} (nonce ${currentNonce}) ---`);
    
    // Get fresh nonce from chain before each deploy
    const chainNonce = await provider.getTransactionCount(wallet.address);
    if (chainNonce > currentNonce) {
      currentNonce = chainNonce;
      console.log(`  Nonce synced from chain: ${currentNonce}`);
    }
    
    const contract = await factory.deploy(...args, { nonce: currentNonce });
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    // Increment local nonce
    currentNonce++;
    
    console.log(`✓ ${name} deployed: ${address}`);
    return address;
  }

  // 1. Deploy PollarForwarder
  const forwarderArtifact = loadArtifact('PollarForwarder.json');
  const forwarderFactory = new ethers.ContractFactory(forwarderArtifact.abi, forwarderArtifact.bytecode, wallet);
  deployed.forwarder = await deployContract('PollarForwarder', forwarderFactory);

  // 2. Deploy PollarVault
  const vaultArtifact = loadArtifact('PollarVault.json');
  const vaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
  deployed.vault = await deployContract('PollarVault', vaultFactory, deployed.forwarder);

  // 3. MockUSDC (testnet only)
  if (networkName.includes('testnet') || networkName.includes('Testnet')) {
    const mockArtifact = loadArtifact('MockUSDC.json');
    const mockFactory = new ethers.ContractFactory(mockArtifact.abi, mockArtifact.bytecode, wallet);
    deployed.mockUSDC = await deployContract('MockUSDC', mockFactory);
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
