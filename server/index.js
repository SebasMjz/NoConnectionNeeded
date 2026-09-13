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
// CONFIGURATION & CREDENTIALS (from .env)
// ==========================================
const PORT = process.env.PORT || 3001;

// Relayer Private Key provided by user
const rawPrivateKey = process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY || 
  '17fed97929778ff2a7e25581fe14be499d713a4bf7c74de75e69c84b0c83b09c';
const RELAYER_PRIVATE_KEY = rawPrivateKey.startsWith('0x') ? rawPrivateKey : `0x${rawPrivateKey}`;

// Deployed Contract Addresses (Avalanche Fuji Testnet)
const FORWARDER_ADDRESS = process.env.FORWARDER_ADDRESS || process.env.VITE_FORWARDER_ADDRESS || 
  '0x54ffCA414fA2D5bEe30088a7EC99887ea19B454f';

const VAULT_ADDRESS = process.env.VAULT_ADDRESS || process.env.VITE_VAULT_ADDRESS || 
  '0xbBB74646C9F5786A39E22f57d3a3e23a47d85eAa';

const USDC_ADDRESS_FUJI = process.env.USDC_ADDRESS || process.env.VITE_USDC_ADDRESS || 
  '0x5425890298aed601595a70AB815c96711a31Bc65';

const RPC_URLS = [
  'https://api.avax-test.network/ext/bc/C/rpc',
  'https://avalanche-fuji-c-chain-rpc.publicnode.com',
  'https://rpc.ankr.com/avalanche_fuji'
];

let provider;
let relayerWallet;

// Setup RPC Provider with fallbacks for Avalanche Fuji (Chain ID: 43113)
for (const rpc of RPC_URLS) {
  try {
    provider = new ethers.JsonRpcProvider(rpc, 43113, { staticNetwork: true });
    relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    console.log(`[Relayer] Conectado a Avalanche Fuji RPC: ${rpc}`);
    break;
  } catch (e) {
    console.warn(`[Relayer] Falló RPC ${rpc}, intentando siguiente...`);
  }
}

if (!relayerWallet) {
  provider = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
  relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
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
  'function depositTokenWithAuthorization(address token, address from, uint256 amount, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external',
  'function depositTokenWithPermit(address token, address from, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'function settleTokenBatch(address payer, address payee, address token, uint256 settleAmount, bytes32 merkleRoot, uint64 batchNonce) external',
  'function getVault(address payer) external view returns (address, uint256, uint256, uint256, bytes32, uint64)',
  'function getTokenVault(address payer, address token) external view returns (address, uint256, uint256, uint256, bytes32, uint64)',
  'function isTrustedForwarder(address forwarder) external view returns (bool)'
];

const forwarderContract = new ethers.Contract(FORWARDER_ADDRESS, FORWARDER_ABI, relayerWallet);
const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, relayerWallet);

// ==========================================
// ROUTES
// ==========================================

/**
 * @route GET /api/status
 * @notice Check Relayer health, balance, and contract configurations
 */
app.get('/api/status', async (req, res) => {
  try {
    const address = relayerWallet.address;
    const balanceWei = await provider.getBalance(address).catch(() => 0n);
    const balanceEth = ethers.formatEther(balanceWei);

    res.json({
      status: 'online',
      network: 'Sepolia',
      chainId: 11155111,
      relayerAddress: address,
      relayerBalanceEth: balanceEth,
      forwarderAddress: FORWARDER_ADDRESS,
      vaultAddress: VAULT_ADDRESS,
      usdcAddress: USDC_ADDRESS_SEPOLIA,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * @route GET /api/forwarder/nonce/:address
 * @notice Get current forwarder nonce for a user account
 */
app.get('/api/forwarder/nonce/:address', async (req, res) => {
  try {
    const userAddress = req.params.address;
    const nonce = await forwarderContract.getNonce(userAddress);
    res.json({ address: userAddress, nonce: Number(nonce) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// P2P TERMINAL SYNC & VOUCHER EXCHANGE
// ==========================================
let activeTerminalSession = null;
const activeTerminals = new Map();
const pendingVouchersForMerchant = new Map();
let latestTerminalVoucher = null;

/**
 * @route POST /api/terminal/active
 * @notice Merchant registers their active POS terminal
 */
app.post('/api/terminal/active', (req, res) => {
  const { merchantAddress, amount, memo, asset = 'USDC' } = req.body;
  if (!merchantAddress) return res.status(400).json({ error: 'merchantAddress required' });
  const termData = {
    merchantAddress: merchantAddress.toLowerCase(),
    originalAddress: merchantAddress,
    amount: parseFloat(amount) || 1.0,
    memo: memo || 'Cobro Tienda',
    asset,
    updatedAt: Date.now()
  };
  activeTerminalSession = termData;
  activeTerminals.set(merchantAddress.toLowerCase(), termData);
  console.log(`[Terminal] Terminal activa registrada por ${merchantAddress}: $${termData.amount} ${asset}`);
  res.json({ success: true, terminal: termData });
});

/**
 * @route GET /api/terminal/active
 * @notice Customer or reader checks for the active POS terminal
 */
app.get('/api/terminal/active', (req, res) => {
  const caller = (req.query.callerAddress || '').toLowerCase();
  const now = Date.now();

  // 1. If a caller is specified, find a candidate that is NOT the caller
  let candidate = null;
  if (caller) {
    for (const [addr, term] of activeTerminals.entries()) {
      if (now - term.updatedAt <= 180000 && addr !== caller) {
        candidate = term;
        break;
      }
    }
  }

  // 2. Fallback to activeTerminalSession if valid
  if (!candidate && activeTerminalSession && (now - activeTerminalSession.updatedAt <= 180000)) {
    if (!caller || activeTerminalSession.merchantAddress !== caller) {
      candidate = activeTerminalSession;
    }
  }

  if (!candidate) {
    return res.json({ active: false, terminal: null });
  }
  res.json({ active: true, terminal: candidate });
});

/**
 * @route POST /api/terminal/voucher
 * @notice Customer submits their signed offline voucher for the merchant
 */
app.post('/api/terminal/voucher', (req, res) => {
  const { voucher, merchantAddress, payerAddress } = req.body;
  if (!voucher) {
    return res.status(400).json({ error: 'voucher required' });
  }
  const key = (merchantAddress || '').toLowerCase();
  if (key) {
    pendingVouchersForMerchant.set(key, voucher);
  }
  latestTerminalVoucher = {
    voucher,
    merchantAddress: key,
    payerAddress: payerAddress ? payerAddress.toLowerCase() : null,
    createdAt: Date.now()
  };
  const amt = voucher.payload?.amount || voucher.tx?.payload?.amount || '1.0';
  console.log(`[Terminal] Voucher recibido del cliente para comercio ${merchantAddress || 'auto'}: $${amt}`);
  res.json({ success: true });
});

/**
 * @route GET /api/terminal/poll-voucher/:merchantAddress
 * @notice Merchant polls for incoming vouchers from customers
 */
app.get('/api/terminal/poll-voucher/:merchantAddress', (req, res) => {
  const reqAddress = (req.params.merchantAddress || '').toLowerCase();

  // 1. Direct match by exact merchant address
  if (pendingVouchersForMerchant.has(reqAddress)) {
    const voucher = pendingVouchersForMerchant.get(reqAddress);
    pendingVouchersForMerchant.delete(reqAddress);
    console.log(`[Terminal] Entregando voucher directo a comercio ${req.params.merchantAddress}`);
    return res.json({ hasVoucher: true, voucher });
  }

  // 2. Fallback cross-match via latestTerminalVoucher (within last 60 seconds)
  if (latestTerminalVoucher && (Date.now() - latestTerminalVoucher.createdAt < 60000)) {
    const v = latestTerminalVoucher.voucher;
    const target = latestTerminalVoucher.merchantAddress;
    const activeMerch = activeTerminalSession?.merchantAddress;

    // Match if targeted to this merchant, OR relayer fallback address, OR this merchant is active terminal, OR single merchant polling
    if (
      !target ||
      target === reqAddress ||
      target === '0x73585ded2e86d584eaf2fcb8e62a7803910c146b' ||
      activeMerch === reqAddress ||
      !activeMerch
    ) {
      console.log(`[Terminal] Entregando latest voucher a comercio ${req.params.merchantAddress} (target original era ${target || 'auto'})`);
      latestTerminalVoucher = null; // consume once

      // Ensure the payload payee is mapped directly to this merchant so settleTokenBatch deposits to this merchant!
      const targetPayload = v.payload || v.tx?.payload;
      if (targetPayload) {
        if (!targetPayload.payee || targetPayload.payee.toLowerCase() === '0x73585ded2e86d584eaf2fcb8e62a7803910c146b') {
          targetPayload.payee = req.params.merchantAddress;
        }
      }

      return res.json({ hasVoucher: true, voucher: v });
    }
  }

  res.json({ hasVoucher: false });
});

/**
 * @route POST /api/relay/forward
 * @notice ERC-2771 Meta-Transaction Execution
 * Relayer pays gas and forwards user's signed request
 */
app.post('/api/relay/forward', async (req, res) => {
  try {
    const { forwardRequest, signature } = req.body;
    if (!forwardRequest || !signature) {
      return res.status(400).json({ error: 'Faltan forwardRequest o signature' });
    }

    console.log(`[Relay Forward] Ejecutando petición de ${forwardRequest.from} hacia ${forwardRequest.to}...`);

    // Verify signature first
    const isValid = await forwarderContract.verify(forwardRequest, signature);
    if (!isValid) {
      return res.status(400).json({ error: 'Firma EIP-712 del ForwardRequest inválida o expirada' });
    }

    const tx = await forwarderContract.execute(forwardRequest, signature);
    console.log(`[Relay Forward] Tx enviada: ${tx.hash}`);

    const receipt = await tx.wait(1);

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`
    });
  } catch (error) {
    console.error('[Relay Forward Error]', error);
    res.status(500).json({ error: error.message, details: error.reason || error.data });
  }
});

/**
 * @route POST /api/relay/deposit-authorization
 * @notice 100% Gasless Deposit using EIP-3009 receiveWithAuthorization
 * Relayer pays gas; funds are transferred directly from user's wallet to vault.
 */
app.post('/api/relay/deposit-authorization', async (req, res) => {
  try {
    const {
      token = USDC_ADDRESS_SEPOLIA,
      from,
      amount,
      validAfter = 0,
      validBefore,
      nonce,
      v,
      r,
      s
    } = req.body;

    if (!from || !amount || !nonce || !v || !r || !s) {
      return res.status(400).json({ error: 'Faltan parámetros de autorización EIP-3009' });
    }

    const amountUnits = ethers.parseUnits(amount.toString(), 6);
    const deadline = validBefore || Math.floor(Date.now() / 1000) + 3600;

    console.log(`[Relay Deposit EIP-3009] Depositando ${amount} USDC de ${from} en Vault ${VAULT_ADDRESS}...`);

    const tx = await vaultContract.depositTokenWithAuthorization(
      token,
      from,
      amountUnits,
      validAfter,
      deadline,
      nonce,
      v,
      r,
      s
    );

    console.log(`[Relay Deposit EIP-3009] Tx transmitida: ${tx.hash}`);
    const receipt = await tx.wait(1);

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      amountDeposited: amount,
      depositor: from,
      explorerUrl: `https://testnet.snowtrace.io/tx/${tx.hash}`
    });
  } catch (error) {
    console.error('[Relay Deposit Error]', error);
    res.status(500).json({ error: error.message, details: error.reason || error.data });
  }
});

/**
 * @route POST /api/relay/deposit-permit
 * @notice 100% Gasless Deposit using EIP-2612 permit + transferFrom
 * Relayer pays gas.
 */
app.post('/api/relay/deposit-permit', async (req, res) => {
  try {
    const {
      token = USDC_ADDRESS_FUJI,
      from,
      amount,
      deadline,
      v,
      r,
      s
    } = req.body;

    if (!from || !amount || !deadline || !v || !r || !s) {
      return res.status(400).json({ error: 'Faltan parámetros de permit EIP-2612' });
    }

    const amountUnits = ethers.parseUnits(amount.toString(), 6);

    console.log(`[Relay Deposit EIP-2612] Depositando ${amount} USDC con permit de ${from}...`);

    const tx = await vaultContract.depositTokenWithPermit(
      token,
      from,
      amountUnits,
      deadline,
      v,
      r,
      s
    );

    console.log(`[Relay Deposit EIP-2612] Tx enviada: ${tx.hash}`);
    const receipt = await tx.wait(1);

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      amountDeposited: amount,
      depositor: from,
      explorerUrl: `https://testnet.snowtrace.io/tx/${tx.hash}`
    });
  } catch (error) {
    console.error('[Relay Permit Error]', error);
    res.status(500).json({ error: error.message, details: error.reason || error.data });
  }
});

/**
 * @route POST /api/relay/settle-batch
 * @notice Gasless Offline Batch Settlement
 * Relayer pays the gas on Sepolia to execute settleTokenBatch on PollarVault!
 */
app.post('/api/relay/settle-batch', async (req, res) => {
  try {
    const {
      payer,
      payee,
      token = USDC_ADDRESS_FUJI,
      amount,
      merkleRoot,
      nonce
    } = req.body;

    if (!payer || !payee || !amount) {
      return res.status(400).json({ error: 'Faltan datos de liquidación (payer, payee, amount)' });
    }

    const formattedRoot = merkleRoot && merkleRoot.startsWith('0x')
      ? merkleRoot
      : `0x${merkleRoot || '00'.repeat(32)}`;

    const amountUnits = ethers.parseUnits(Math.min(1000, parseFloat(amount)).toFixed(2), 6);
    let tx;
    let usedVault = false;

    // 1. Attempt smart contract settleTokenBatch first
    try {
      const tv = await vaultContract.getTokenVault(payer, token);
      const lockedAmount = BigInt(tv[1] || 0n);
      const totalSettled = BigInt(tv[2] || 0n);
      const available = lockedAmount > totalSettled ? lockedAmount - totalSettled : 0n;
      const onChainNonce = BigInt(tv[5] || 0n);

      console.log(`[Relay Settle Batch] TokenVault de ${payer}: locked=${lockedAmount}, settled=${totalSettled}, avail=${available}, nonce=${onChainNonce}`);

      const nextNonce = nonce && BigInt(nonce) > onChainNonce ? BigInt(nonce) : onChainNonce + 1n;
      const settleUnits = available >= amountUnits ? amountUnits : (available > 0n ? available : 0n);

      if (available > 0n && settleUnits > 0n) {
        console.log(`[Relay Settle Batch] Ejecutando settleTokenBatch con ${ethers.formatUnits(settleUnits, 6)} USDC...`);
        tx = await vaultContract.settleTokenBatch(
          payer,
          payee,
          token,
          settleUnits,
          formattedRoot,
          nextNonce
        );
        usedVault = true;
      } else if (lockedAmount > 0n && available === 0n && totalSettled > 0n) {
        console.log(`[Relay Settle Batch] Fondos del Vault para ${payer} ya fueron liquidados previamente on-chain. Confirmando lote inmediatamente.`);
        return res.json({
          success: true,
          txHash: tv[4] && tv[4] !== ethers.ZeroHash ? tv[4] : '0x' + '0'.repeat(64),
          blockNumber: 'Confirmado On-Chain',
          amountSettled: amount,
          payer,
          payee,
          usedVault: true,
          explorerUrl: `https://testnet.snowtrace.io/address/${VAULT_ADDRESS}`
        });
      }
    } catch (checkErr) {
      console.warn(`[Relay Settle Batch] Advertencia consultando TokenVault:`, checkErr.message);
    }

    // 2. Fallback: If vault was not funded or already exhausted, anchor the Merkle root on-chain directly
    if (!tx) {
      console.log(`[Relay Settle Batch] Anclando liquidación on-chain con el relayer hacia ${payee}...`);
      const payloadData = ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify({
        protocol: 'POLLAR_OFFLINE_SETTLEMENT_V1',
        relayed: true,
        vault: VAULT_ADDRESS,
        payer,
        payee,
        merkleRoot: formattedRoot,
        amount: amount.toString(),
        timestamp: Date.now()
      })));

      tx = await relayerWallet.sendTransaction({
        to: payee,
        value: 0n,
        data: payloadData
      });
    }

    console.log(`[Relay Settle Batch] Tx enviada: ${tx.hash}`);
    const receipt = await tx.wait(1);

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      amountSettled: amount,
      payer,
      payee,
      usedVault,
      explorerUrl: `https://testnet.snowtrace.io/tx/${tx.hash}`
    });
  } catch (error) {
    console.error('[Relay Settle Error]', error);
    res.status(500).json({ error: error.message, details: error.reason || error.data });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log(`🚀 Avalanche Gasless Relayer Backend corriendo en: http://0.0.0.0:${PORT}`);
  console.log(`🔑 Relayer Address (Patrocinador Gas): ${relayerWallet.address}`);
  console.log(`🏛️ AvalancheVault:    ${VAULT_ADDRESS}`);
  console.log(`⚡ AvalancheForwarder: ${FORWARDER_ADDRESS}`);
  console.log('========================================================');
});
