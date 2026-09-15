# NoConnectionNeeded — Avalanche Branch

**Offline P2P Wallet for EVM-compatible Chains.** Send and receive USDC with zero gas cost for users, working even without internet connection. Deployed on Avalanche Fuji C-Chain Testnet.

> Active branch: `Bounty-Avalanche`
> Network: Avalanche Fuji C-Chain (chainId 43113)
> Chain: EVM-compatible

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Multi-Chain Support](#multi-chain-support)
4. [System Flow](#system-flow)
5. [Smart Contracts](#smart-contracts)
6. [Relayer API](#relayer-api)
7. [Gasless Features](#gasless-features)
8. [Configuration](#configuration)
9. [Execution](#execution)
10. [Project Structure](#project-structure)

---

## Architecture

This branch runs on **EVM-compatible chains** with a custom Node.js relayer for gasless meta-transactions. Unlike the Pollar branch (Stellar), this uses Solidity smart contracts, ERC-2771, and secp256k1 cryptography.

```
┌──────────────────────────────────────────────────────────────┐
│                    LAYER 1 — Android Device                  │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │ WalletContext│  │ transactions[]│  │  EIP-712 Signer│   │
│  │ (provider,   │  │  (offline     │  │  (Secp256k1    │   │
│  │  evmWallet,  │  │   queue in    │  │   EIP-191)     │   │
│  │  isOnline)   │  │   localStorage)│  │                │   │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │ SyncManager  │  │ Online/Offline│  │    P2P UI      │   │
│  │ (settle on-  │  │   Toggle      │  │  (BT/NFC/QR   │   │
│  │  chain)      │  │               │  │   - active)    │   │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │  evmCrypto   │  │  EVM Networks │  │  Go WASM Core  │   │
│  │  (Keccak-256 │  │  (Avalanche,  │  │  (high-perf    │   │
│  │  Secp256k1)  │  │   Sepolia)    │  │   fallback)    │   │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
└────────────────────────────┬─────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐
│   EVM RPC       │  │ localStorage │  │  Relayer        │
│   (Fuji/Sepolia)│  │ transactions │  │  localhost:3001 │
│                 │  │ wallet.json  │  │  Node.js        │
└────────┬────────┘  └──────────────┘  └────────┬────────┘
         │                                        │
         └──────────────┬────────────────────────┘
                        ▼
         ┌──────────────────────────────┐
         │      EVM BLOCKCHAIN          │
         │   (Avalanche Fuji C-Chain)   │
         │        chainId: 43113        │
         │                              │
         │  ┌──────────────────────┐    │
         │  │  PollarForwarder    │    │
         │  │  ERC-2771           │    │
         │  │  0x54ffCA...454f    │    │
         │  └──────────────────────┘    │
         │  ┌──────────────────────┐    │
         │  │  PollarVault        │    │
         │  │  ERC-20 Custody     │    │
         │  │  0xbBB746...85eAa   │    │
         │  └──────────────────────┘    │
         │  ┌──────────────────────┐    │
         │  │  MockUSDC           │    │
         │  │  0x542589...Bc65    │    │
         │  └──────────────────────┘    │
         └──────────────────────────────┘
```

### Layer 1 — Android Device

The app runs in a WebView (Capacitor) inside an Android APK. All wallet logic lives on the device.

- **WalletContext**: Global React state holding the `evmWallet`, `transactions[]` queue, `isOnline` flag, and Merkle tree state.
- **transactions[]**: Array of pending offline transactions stored in `localStorage`. Each entry contains `payload`, `txHash`, `payerSignature`, `payeeSignature`, and `status`.
- **EIP-712 Signer**: Signs transactions using `ethers.js` with secp256k1 (EIP-191 personal sign).
- **SyncManager**: Component that settles pending transactions on-chain via Relayer when online.
- **evmCrypto**: Keccak-256 hashing, secp256k1 signing/verification, Merkle tree construction, multi-network RPC queries.

### Layer 2 — Relayer (Backend)

Node.js server listening on port 3001. Does not custody funds; only pays gas on behalf of users.

- **ERC-2771 Meta-Transactions**: Verifies EIP-712 signatures and forwards calldata with user address appended.
- **Gasless Deposits**: EIP-3009 (`receiveWithAuthorization`) and EIP-2612 (`permit`) for zero-gas vault funding.
- **Batch Settlement**: Calls `settleTokenBatch()` on PollarVault contract with Merkle root.
- **P2P Terminal**: Merchant POS terminal simulation with voucher exchange.

### Layer 3 — EVM Blockchain

Avalanche Fuji C-Chain (EVM-compatible). ChainId 43113.

- **RPC**: `https://api.avax-test.network/ext/bc/C/rpc`
- **Block Explorer**: `https://testnet.snowtrace.io`
- **Faucet**: `https://core.app/tools/testnet-faucet/?subnet=c&token=c`

---

## Tech Stack

| Layer            | Technology              | Version   | Role                                           |
|-----------------|------------------------|-----------|-----------------------------------------------|
| **Frontend**    | React                   | 19.x      | UI, wallet signing, offline queue             |
| **Build**       | Vite                    | 8.x       | Development and production bundler            |
| **Mobile**      | Capacitor               | 8.x       | Native Android APK compilation                |
| **Blockchain**  | ethers.js               | 6.x       | RPC connection, EIP-712 signing, contract interaction |
| **Backend**     | Node.js + Express       | 5.x       | Relayer, REST endpoints                       |
| **Contracts**   | Solidity                | 0.8.20    | PollarForwarder, PollarVault, MockUSDC        |
| **UI**          | Tailwind CSS            | 4.x       | Styling                                       |
| **Testing**     | Playwright              | —         | End-to-end tests                              |

---

## Multi-Chain Support

This branch supports multiple EVM-compatible networks:

| Network                    | Chain ID | Native Token | USDC Address                              | Status      |
|---------------------------|----------|-------------|-------------------------------------------|-------------|
| **Avalanche Fuji**        | 43113    | AVAX        | `0x5425890298aed601595a70AB815c96711a31Bc65` | Deployed ✅ |
| **Ethereum Sepolia**      | 11155111 | ETH         | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Deployed ✅ |
| **HashKey Chain Testnet** | 133      | HSK         | —                                         | Planned     |
| **Base Sepolia**          | 84532    | ETH         | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Planned     |

### Network Configuration

```javascript
// src/services/evmCrypto.js
export const EVM_NETWORKS = {
  avalancheFuji: {
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    symbol: 'AVAX',
    usdcAddress: '0x5425890298aed601595a70AB815c96711a31Bc65',
    vaultAddress: '0xbBB74646C9F5786A39E22f57d3a3e23a47d85eAa',
    forwarderAddress: '0x54ffCA414fA2D5bEe30088a7EC99887ea19B454f',
  },
  sepolia: { /* ... */ },
  hskTestnet: { /* ... */ },
  baseSepolia: { /* ... */ },
};
```

---

## System Flow

### Online Flow (Gasless via Relayer)

```
User opens the app
        │
        ▼
WalletContext detects isOnline = true
        │
        ▼
User enters amount + destination address (0x...)
        │
        ▼
App generates EIP-712 ForwardRequest
        │
        ▼
User signs with private key (EIP-191 personal sign)
        │
        ▼
App sends { forwardRequest, signature } to Relayer
        │
        ▼
Relayer verifies signature + nonce via PollarForwarder
        │
        ▼
Relayer executes on-chain (pays gas with its wallet)
        │
        ▼
Relayer returns txHash to frontend
        │
        ▼
WalletContext updates balances via RPC
```

### Offline Flow (Dual-Signature + Merkle)

```
User activates Offline mode (manual toggle)
        │
        ▼
WalletContext.setIsSimulatingOffline(true)
        │
        ▼
User enters amount + destination address
        │
        ▼
App generates payload with Keccak-256 canonical hash
        │
        ▼
Payer signs with Secp256k1 (EIP-191 personal sign)
        │
        ▼
Transaction saved to localStorage.transactions[]
        │
        ▼
UI shows "Guardado offline" + Merkle leaf computed
        │
        ▼
[User reconnects]
        │
        ▼
SyncManager detects isOnline = true
        │
        ▼
User presses "Sync Now" → syncToEvmNetwork()
        │
        ▼
Relayer settles batch on-chain via PollarVault
        │
        ▼
Merkle root anchored in transaction calldata
        │
        ▼
All pending transactions marked SYNCED_ONCHAIN
```

### P2P Flow (QR / Bluetooth / NFC)

```
User A generates offline payment
        │
        ▼
Payload serialized as compact JSON
        │
        ▼
QR code generated (error correction 'M')
        │
        ▼
User B scans QR code
        │
        ▼
App parses payment payload
        │
        ▼
User B counter-signs receipt (Secp256k1)
        │
        ▼
Transaction saved to both devices (Merkle leaf)
        │
        ▼
First connected device syncs batch to chain
```

---

## Smart Contracts

All contracts are Solidity 0.8.20, deployed on Avalanche Fuji C-Chain.

### PollarForwarder (ERC-2771)

**Address**: `0x54ffCA414fA2D5bEe30088a7EC99887ea19B454f`

Standard ERC-2771 Trusted Forwarder for gasless meta-transactions.

```solidity
struct ForwardRequest {
    address from;
    address to;
    uint256 value;
    uint256 gas;
    uint256 nonce;
    uint256 deadline;
    bytes data;
}

function getNonce(address from) external view returns (uint256);
function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool);
function execute(ForwardRequest calldata req, bytes calldata signature)
    public payable returns (bool success, bytes memory returnData);
function executeBatch(ForwardRequest[] calldata reqs, bytes[] calldata signatures)
    external payable returns (bool[] memory successes, bytes[] memory returnDatas);
```

**Security**: Validates EIP-712 signature, nonce (idempotency), deadline (expiration). Appends `req.from` to calldata per ERC-2771.

### PollarVault (Dual-Asset Escrow)

**Address**: `0xbBB74646C9F5786A39E22f57d3a3e23a47d85eAa`

Custodies both native ETH and ERC-20 tokens (USDC) for offline payments.

```solidity
// Native ETH vault
function depositVault() public payable;
function withdrawVault(uint256 amount) external;
function settleBatch(address payer, address payable payee, uint256 settleAmount,
    bytes32 merkleRoot, uint64 batchNonce) external;

// ERC-20 Token vault
function depositTokenVault(address token, uint256 amount) external;
function depositTokenWithAuthorization(...) external;  // EIP-3009 gasless
function depositTokenWithPermit(...) external;         // EIP-2612 gasless
function withdrawTokenVault(address token, uint256 amount) external;
function settleTokenBatch(address payer, address payee, address token,
    uint256 settleAmount, bytes32 merkleRoot, uint64 batchNonce) external;

// View queries
function getVault(address payer) external view returns (...);
function getTokenVault(address payer, address token) external view returns (...);
```

**Features**:
- Reentrancy guard (`nonReentrant`)
- ERC-2771 context (`_msgSender()` extracts from calldata)
- Dual-asset: native ETH + ERC-20 tokens
- Nonce-based idempotency for batch settlements

### MockUSDC

**Address**: `0x5425890298aed601595a70AB815c96711a31Bc65`

Full-featured ERC-20 test token with gasless transfer support.

```solidity
function mint(address to, uint256 amount) external;
function faucet() external;  // Mint 100 USDC to caller

// EIP-2612 Permit
function permit(address owner, address spender, uint256 value,
    uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;

// EIP-3009 Authorizations
function receiveWithAuthorization(address from, address to, uint256 value,
    uint256 validAfter, uint256 validBefore, bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s) external;
function transferWithAuthorization(...) external;
function cancelAuthorization(...) external;
```

**Features**: 6 decimals (identical to Circle USDC), 1,000,000 initial supply, EIP-2612 + EIP-3009 for gasless operations.

---

## Relayer API

The relayer runs on `http://localhost:3001`.

### GET /api/status

System status and configuration.

```json
{
  "status": "online",
  "network": "Avalanche Fuji",
  "chainId": 43113,
  "relayerAddress": "0x73585ded2E86D584eaf2fcB8e62A7803910c146B",
  "relayerBalanceEth": "0.1",
  "forwarderAddress": "0x54ffCA414fA2D5bEe30088a7EC99887ea19B454f",
  "vaultAddress": "0xbBB74646C9F5786A39E22f57d3a3e23a47d85eAa",
  "usdcAddress": "0x5425890298aed601595a70AB815c96711a31Bc65"
}
```

### GET /api/forwarder/nonce/:address

Query current nonce for a user on PollarForwarder.

```bash
curl http://localhost:3001/api/forwarder/nonce/0x...
# { "address": "0x...", "nonce": 0 }
```

### POST /api/relay/forward

Execute ERC-2771 meta-transaction.

```json
{
  "forwardRequest": {
    "from": "0x...user...",
    "to": "0x...recipient...",
    "value": "0",
    "gas": "100000",
    "nonce": 0,
    "deadline": 1730000000,
    "data": "0xa9059cbb..."
  },
  "signature": "0x...EIP-712 signature..."
}
```

Response:
```json
{
  "success": true,
  "txHash": "0x...",
  "blockNumber": 12345,
  "gasUsed": "21000",
  "explorerUrl": "https://testnet.snowtrace.io/tx/0x..."
}
```

### POST /api/relay/deposit-authorization

100% gasless deposit via EIP-3009 (`receiveWithAuthorization`).

### POST /api/relay/deposit-permit

100% gasless deposit via EIP-2612 (`permit`).

### POST /api/relay/settle-batch

Gasless offline batch settlement via PollarVault.

### POST /api/terminal/active

Merchant registers active POS terminal.

### GET /api/terminal/active

Customer checks for active POS terminal.

### POST /api/terminal/voucher

Customer submits signed offline voucher.

### GET /api/terminal/poll-voucher/:merchantAddress

Merchant polls for incoming vouchers.

---

## Gasless Features

This branch provides multiple gasless mechanisms:

### 1. ERC-2771 Meta-Transactions

User signs `ForwardRequest` off-chain. Relayer broadcasts and pays gas.

```
User → Sign ForwardRequest → Relayer → PollarForwarder.execute() → Target Contract
```

### 2. EIP-3009 (receiveWithAuthorization)

User signs authorization for USDC transfer. Relayer broadcasts to pull funds directly.

```
User → Sign ReceiveWithAuthorization → Relayer → MockUSDC.receiveWithAuthorization() → Vault
```

### 3. EIP-2612 (permit)

User signs permit for USDC approval. Relayer broadcasts approve + transferFrom.

```
User → Sign Permit → Relayer → MockUSDC.permit() → MockUSDC.transferFrom() → Vault
```

### 4. Direct Vault Deposit

User with gas balance can deposit directly to vault.

```
User → MockUSDC.approve() → PollarVault.depositTokenVault() → Vault
```

---

## Configuration

### Environment Variables (Relayer)

```bash
# Server
PORT=3001
BACKEND_URL=http://localhost:3001

# Relayer Private Key (pays gas)
RELAYER_PRIVATE_KEY=0x...

# Contract Addresses (Avalanche Fuji)
FORWARDER_ADDRESS=0x54ffCA414fA2D5bEe30088a7EC99887ea19B454f
VAULT_ADDRESS=0xbBB74646C9F5786A39E22f57d3a3e23a47d85eAa
USDC_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65
```

> **Security**: Never commit `.env` files. Use `.env.example` as template.

### Network Endpoints

| Resource          | Avalanche Fuji Testnet                    |
|-------------------|-------------------------------------------|
| RPC URL           | `https://api.avax-test.network/ext/bc/C/rpc` |
| Backup RPC        | `https://avalanche-fuji-c-chain-rpc.publicnode.com` |
| Block Explorer    | `https://testnet.snowtrace.io`            |
| Faucet            | `https://core.app/tools/testnet-faucet/?subnet=c&token=c` |

---

## Execution

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your relayer private key and contract addresses
```

### 3. Start the Relayer

```bash
npm run relay
# Or: node server/index.js
```

Verify status:
```bash
curl http://localhost:3001/api/status
```

### 4. Web development server

```bash
npm run dev
# Opens at http://localhost:5173
```

### 5. Build Android APK

```bash
npm run build
npx cap sync android
cd android
JAVA_HOME=/usr/lib/jvm/java-21 ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 6. Compile and deploy contracts (only if modified)

```bash
# Compile
node contracts/evm/compile.mjs

# Deploy to Avalanche Fuji
node contracts/evm/deploy.mjs --network avalancheFuji --private-key <KEY> --contract all
```

---

## Project Structure

```
NCN-Pollar/ (Bounty-Avalanche branch)
├── src/
│   ├── components/              # React UI components
│   │   ├── WalletVault.jsx              # Main wallet UI
│   │   ├── SyncManager.jsx              # On-chain settlement
│   │   ├── P2PPaymentTerminal.jsx       # POS terminal UI
│   │   ├── MerkleVisualizer.jsx         # Merkle tree visualization
│   │   ├── AvalancheLogo.jsx            # Avalanche branding
│   │   └── ...
│   ├── context/
│   │   └── WalletContext.jsx            # Global wallet state (multi-chain)
│   ├── services/                # Blockchain interaction logic
│   │   ├── evmCrypto.js                 # EVM signing, Merkle, RPC queries
│   │   ├── stellarCrypto.js             # Stellar support (legacy)
│   │   ├── pollarEngine.js              # Pollar core engine (WASM)
│   │   ├── sorobanVault.js              # Soroban contract client (legacy)
│   │   └── ...
│   └── styles/                  # Tailwind CSS styles
├── contracts/
│   └── evm/                     # Solidity smart contracts
│       ├── PollarForwarder.sol          # ERC-2771 Trusted Forwarder
│       ├── PollarVault.sol              # Dual-asset escrow vault
│       ├── MockUSDC.sol                 # ERC-20 test token
│       ├── compile.mjs                  # Contract compiler
│       ├── deploy.mjs                   # Deployment script
│       └── deploy_info.json             # Network configurations
├── server/
│   └── index.js                 # Relayer backend (Node.js + Express)
├── core-go/                     # Go WebAssembly core
├── android/                     # Capacitor Android project
├── scripts/                     # Deployment scripts
└── public/
    └── pollar_core.wasm         # Compiled Go WASM (optional)
```

---

## Key Differences from Pollar Branch

| Feature                     | Avalanche (EVM)            | Pollar (Stellar)           |
|----------------------------|----------------------------|----------------------------|
| Blockchain                 | EVM-compatible             | Stellar (non-EVM)          |
| Native Token               | AVAX                       | XLM                        |
| Contract Language          | Solidity                   | Rust (Soroban)             |
| Cryptography               | Secp256k1 (EIP-712)        | Ed25519                    |
| Account Format             | 0x...                      | G... / S...                |
| RPC Protocol               | JSON-RPC                   | Horizon + Soroban RPC      |
| Relayer                    | Custom Node.js + Express    | Pollar Core (custodial)    |
| Gasless Mechanisms         | ERC-2771, EIP-3009, EIP-2612 | Pollar Core SDK          |
| Multi-chain Support        | ✅ (Avalanche, Sepolia, HSK, Base) | ❌ (Stellar only)     |
| Token Standard             | ERC-20 (USDC)              | Native XLM                 |
| Testnet Faucet             | Manual (Avalanche Core)    | Friendbot (automatic)      |

---

## Links

- **Repository**: github.com/SebasMjz/NoConnectionNeeded
- **Branch**: `Bounty-Avalanche`
- **Avalanche Testnet Explorer**: testnet.snowtrace.io
- **Avalanche Faucet**: core.app/tools/testnet-faucet

---

## License

MIT
