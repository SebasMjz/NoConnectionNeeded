import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// CONFIGURATION
// ==========================================
const PORT = process.env.PORT || 3001;
const NETWORK = process.env.NETWORK || 'hskTestnet';

// Network configs
const NETWORKS = {
  hskTestnet: {
    name: 'HashKey Chain Testnet',
    chainId: 133,
    rpcUrls: [
      'https://testnet.hsk.xyz',
    ],
    blockExplorer: 'https://testnet.hsk.xyz',
    usdcAddress: '0x788952C55A04F32C4dC26dEd4858f5D6259f2F15',
  },
  hskMainnet: {
    name: 'HashKey Chain Mainnet',
    chainId: 177,
    rpcUrls: [
      'https://mainnet.hsk.xyz',
      'https://hsk.rpc.chain.com',
    ],
    blockExplorer: 'https://explorer.hsk.xyz',
    usdcAddress: process.env.USDC_ADDRESS || '0x8845E8C74cE5dF8E0d37bf0fe57dc5E0ddD8021b',
  },
  sepolia: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcUrls: [
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia-rpc.publicnode.com',
    ],
    blockExplorer: 'https://sepolia.etherscan.io',
    usdcAddress: process.env.USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
};

const networkConfig = NETWORKS[NETWORK] || NETWORKS.hskTestnet;

// Relayer key
const rawPrivateKey = process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!rawPrivateKey) {
  console.error('[FATAL] RELAYER_PRIVATE_KEY or PRIVATE_KEY env var required');
  process.exit(1);
}
const RELAYER_PRIVATE_KEY = rawPrivateKey.startsWith('0x') ? rawPrivateKey : `0x${rawPrivateKey}`;

// Contract addresses
const FORWARDER_ADDRESS = process.env.FORWARDER_ADDRESS || '';
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || '';
const USDC_ADDRESS = networkConfig.usdcAddress;

// Setup provider with fallback
let provider;
let relayerWallet;

for (const rpc of networkConfig.rpcUrls) {
  try {
    provider = new ethers.JsonRpcProvider(rpc, networkConfig.chainId, { staticNetwork: true });
    relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    console.log(`[Relayer] Connected to ${rpc}`);
    break;
  } catch (e) {
    console.warn(`[Relayer] Failed ${rpc}: ${e.message}`);
  }
}

if (!relayerWallet) {
  console.error('[FATAL] Could not connect to any RPC');
  process.exit(1);
}

// ==========================================
// CONTRACT ABIs
// ==========================================
const FORWARDER_ABI = [
  'function getNonce(address from) external view returns (uint256)',
  'function verify((address from, address to, uint256 value, uint256 gas, uint256 nonce, uint256 deadline, bytes data) req, bytes signature) external view returns (bool)',
  'function execute((address from, address to, uint256 value, uint256 gas, uint256 nonce, uint256 deadline, bytes data) req, bytes signature) external payable returns (bool, bytes)'
];

const VAULT_ABI = [
  'function depositVault() public payable',
  'function depositTokenVault(address token, uint256 amount) external',
  'function depositTokenWithAuthorization(address token, address from, uint256 amount, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external',
  'function depositTokenWithPermit(address token, address from, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'function withdrawVault(uint256 amount) external',
  'function withdrawTokenVault(address token, uint256 amount) external',
  'function settleBatch(address payer, address payable payee, uint256 settleAmount, bytes32 merkleRoot, uint64 batchNonce) external',
  'function settleTokenBatch(address payer, address payee, address token, uint256 settleAmount, bytes32 merkleRoot, uint64 batchNonce) external',
  'function getVault(address payer) external view returns (address, uint256, uint256, uint256, bytes32, uint64)',
  'function getTokenVault(address payer, address token) external view returns (address, uint256, uint256, uint256, bytes32, uint64)',
  'function isTrustedForwarder(address forwarder) external view returns (bool)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'function nonces(address owner) external view returns (uint256)',
  'function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external'
];

const forwarderContract = FORWARDER_ADDRESS ? new ethers.Contract(FORWARDER_ADDRESS, FORWARDER_ABI, relayerWallet) : null;
const vaultContract = VAULT_ADDRESS ? new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, relayerWallet) : null;
const usdcContract = USDC_ADDRESS ? new ethers.Contract(USDC_ADDRESS, ERC20_ABI, relayerWallet) : null;

// ==========================================
// ROUTES
// ==========================================

app.get('/api/status', async (req, res) => {
  try {
    const balance = await provider.getBalance(relayerWallet.address);
    res.json({
      status: 'online',
      network: NETWORK,
      chainId: networkConfig.chainId,
      networkName: networkConfig.name,
      relayerAddress: relayerWallet.address,
      relayerBalance: ethers.formatEther(balance),
      forwarderAddress: FORWARDER_ADDRESS || 'NOT SET',
      vaultAddress: VAULT_ADDRESS || 'NOT SET',
      usdcAddress: USDC_ADDRESS || 'NOT SET',
      timestamp: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/forwarder/nonce/:address', async (req, res) => {
  try {
    if (!forwarderContract) throw new Error('Forwarder not configured');
    const nonce = await forwarderContract.getNonce(req.params.address);
    res.json({ address: req.params.address, nonce: Number(nonce) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vault/:address', async (req, res) => {
  try {
    if (!vaultContract) throw new Error('Vault not configured');
    const vault = await vaultContract.getVault(req.params.address);
    res.json({
      payer: vault[0],
      lockedAmount: vault[1].toString(),
      totalSettled: vault[2].toString(),
      availableToSpend: vault[3].toString(),
      lastMerkleRoot: vault[4],
      nonce: Number(vault[5]),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/usdc/balance/:address', async (req, res) => {
  try {
    if (!usdcContract) throw new Error('USDC not configured');
    const balance = await usdcContract.balanceOf(req.params.address);
    const decimals = await usdcContract.decimals();
    res.json({
      address: req.params.address,
      balance: ethers.formatUnits(balance, decimals),
      rawBalance: balance.toString(),
      decimals: Number(decimals),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ERC-2771 Meta-Transaction Forwarding
app.post('/api/relay/forward', async (req, res) => {
  try {
    if (!forwarderContract) throw new Error('Forwarder not configured');
    const { forwardRequest, signature } = req.body;
    if (!forwardRequest || !signature) throw new Error('Missing forwardRequest or signature');

    const isValid = await forwarderContract.verify(forwardRequest, signature);
    if (!isValid) throw new Error('Invalid EIP-712 signature');

    const tx = await forwarderContract.execute(forwardRequest, signature);
    const receipt = await tx.wait(1);

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: `${networkConfig.blockExplorer}/tx/${tx.hash}`,
    });
  } catch (err) {
    console.error('[Relay Forward Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Gasless Deposit via EIP-3009
app.post('/api/relay/deposit-authorization', async (req, res) => {
  try {
    if (!vaultContract || !usdcContract) throw new Error('Contracts not configured');
    
    const { token = USDC_ADDRESS, from, amount, validAfter = 0, validBefore, nonce, v, r, s } = req.body;
    if (!from || !amount || !nonce || v === undefined || !r || !s) {
      throw new Error('Missing EIP-3009 parameters');
    }

    const deadline = validBefore || Math.floor(Date.now() / 1000) + 3600;
    const decimals = await usdcContract.decimals();
    const amountUnits = ethers.parseUnits(amount.toString(), decimals);

    console.log(`[EIP-3009] Depositing ${amount} from ${from}`);
    const tx = await vaultContract.depositTokenWithAuthorization(token, from, amountUnits, validAfter, deadline, nonce, v, r, s);
    const receipt = await tx.wait(1);

    res.json({ success: true, txHash: tx.hash, amount, depositor: from, explorerUrl: `${networkConfig.blockExplorer}/tx/${tx.hash}` });
  } catch (err) {
    console.error('[EIP-3009 Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Gasless Deposit via EIP-2612
app.post('/api/relay/deposit-permit', async (req, res) => {
  try {
    if (!vaultContract || !usdcContract) throw new Error('Contracts not configured');
    
    const { token = USDC_ADDRESS, from, amount, deadline, v, r, s } = req.body;
    if (!from || !amount || !deadline || v === undefined || !r || !s) {
      throw new Error('Missing EIP-2612 parameters');
    }

    const decimals = await usdcContract.decimals();
    const amountUnits = ethers.parseUnits(amount.toString(), decimals);

    console.log(`[EIP-2612] Depositing ${amount} from ${from}`);
    const tx = await vaultContract.depositTokenWithPermit(token, from, amountUnits, deadline, v, r, s);
    const receipt = await tx.wait(1);

    res.json({ success: true, txHash: tx.hash, amount, depositor: from, explorerUrl: `${networkConfig.blockExplorer}/tx/${tx.hash}` });
  } catch (err) {
    console.error('[EIP-2612 Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Batch Settlement
app.post('/api/relay/settle-batch', async (req, res) => {
  try {
    if (!vaultContract) throw new Error('Vault not configured');
    
    const { payer, payee, token, amount, merkleRoot, batchNonce } = req.body;
    if (!payer || !payee || !amount || !merkleRoot || batchNonce === undefined) {
      throw new Error('Missing settlement parameters');
    }

    let tx;
    if (token && token !== ethers.ZeroAddress) {
      tx = await vaultContract.settleTokenBatch(payer, payee, token, amount, merkleRoot, batchNonce);
    } else {
      tx = await vaultContract.settleBatch(payer, payee, amount, merkleRoot, batchNonce);
    }

    const receipt = await tx.wait(1);
    res.json({ success: true, txHash: tx.hash, explorerUrl: `${networkConfig.blockExplorer}/tx/${tx.hash}` });
  } catch (err) {
    console.error('[Settle Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`Pollar Relayer v3.0 - ${networkConfig.name}`);
  console.log(`Chain ID: ${networkConfig.chainId}`);
  console.log(`RPC: ${provider.connection.url}`);
  console.log(`Port: ${PORT}`);
  console.log(`Relayer: ${relayerWallet.address}`);
  console.log(`Forwarder: ${FORWARDER_ADDRESS || 'NOT SET'}`);
  console.log(`Vault: ${VAULT_ADDRESS || 'NOT SET'}`);
  console.log(`USDC: ${USDC_ADDRESS || 'NOT SET'}`);
  console.log('='.repeat(60));
});
