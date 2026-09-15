# NoConnectionNeeded

**Offline P2P Wallet for EVM-compatible Chains.** Send and receive USDC with zero gas cost for users, working even without internet connection.

> Active branch: `master` (base)
> Chains: Avalanche | Pollar | HashKey Chain

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Branch Strategy](#branch-strategy)
4. [System Flow](#system-flow)
5. [Smart Contracts](#smart-contracts)
6. [Relayer API](#relayer-api)
7. [Configuration](#configuration)
8. [Execution](#execution)

---

## Architecture

The system consists of three layers:

```
┌──────────────────────────────────────────────────────────────┐
│                    LAYER 1 — Android Device                  │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │ WalletContext│  │  pendingTx[]  │  │  EIP-712 Signer│   │
│  │ (provider,   │  │  (offline     │  │  (signs with   │   │
│  │  signer,     │  │   queue in    │  │   private key) │   │
│  │  isOnline)   │  │   localStorage)│  │                │   │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │ SyncManager  │  │ Online/Offline│  │    P2P UI      │   │
│  │ (executes    │  │   Toggle      │  │  (BT/NFC/QR   │   │
│  │   queue)     │  │               │  │   - mocked)    │   │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
└────────────────────────────┬─────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐
│   Chain RPC     │  │ localStorage  │  │  Relayer        │
│   (per branch)  │  │ pendingTx[]  │  │  localhost:3001 │
│                 │  │ wallet.json  │  │  Node.js        │
└────────┬────────┘  └──────────────┘  └────────┬────────┘
         │                                        │
         └──────────────┬────────────────────────┘
                        ▼
         ┌──────────────────────────────┐
         │      EVM BLOCKCHAIN          │
         │   (chainId varies by branch) │
         │                              │
         │  ┌──────────────────────┐    │
         │  │  PollarForwarder    │    │
         │  │  ERC-2771           │    │
         │  └──────────────────────┘    │
         │  ┌──────────────────────┐    │
         │  │  PollarVault        │    │
         │  │  ERC-20 Custody     │    │
         │  └──────────────────────┘    │
         │  ┌──────────────────────┐    │
         │  │  USDC Token         │    │
         │  │  (native or mock)   │    │
         │  └──────────────────────┘    │
         └──────────────────────────────┘
```

### Layer 1 — Android Device

The app runs in a WebView (Capacitor) inside an Android APK. There is no backend server; all wallet logic lives on the device.

- **WalletContext**: Global React state holding the `JsonRpcProvider`, `signer` (Wallet), `isOnline` flag, and `pendingTx[]` queue.
- **pendingTx[]**: Array of pending transactions stored in browser `localStorage`. Each entry contains `id`, `type`, `to`, `from`, `amount`, `synced`, and `timestamp`.
- **EIP-712 Signer**: Signs meta-transactions using `ethers.js` with the EIP-712 standard (typed data), more secure than raw transactions.
- **SyncManager**: Component that detects reconnection and executes `POST /api/relay/forward` for each pending unsynced transaction.
- **Online/Offline Toggle**: Overrides automatic connectivity detection and forces manual offline mode.

### Layer 2 — Relayer (Backend)

Node.js server listening on port 3001. Does not custody funds; only pays gas on behalf of users.

- Receives signed meta-transactions via `POST /api/relay/forward`.
- Verifies the EIP-712 signature and user nonce on the `PollarForwarder` contract.
- Executes the transaction on the target chain using its own wallet with native token balance.
- Returns `txHash` to the frontend for confirmation.

### Layer 3 — Blockchain

EVM-compatible chain where contracts are deployed. Chain ID and RPC vary by branch (see [Branch Strategy](#branch-strategy)).

---

## Tech Stack

| Layer            | Technology              | Version   | Role                                           |
|-----------------|------------------------|-----------|-----------------------------------------------|
| **Frontend**    | React                   | 19.x      | UI, wallet signing, offline queue             |
| **Build**       | Vite                    | 8.x       | Development and production bundler            |
| **Mobile**      | Capacitor               | 8.x       | Native Android APK compilation                |
| **Blockchain**  | ethers.js               | 6.x       | RPC connection, EIP-712 signing, contract interaction |
| **Backend**     | Node.js + Express       | 18.x      | Relayer, REST endpoints                       |
| **Contracts**   | Solidity                | 0.8.x     | PollarForwarder, PollarVault, USDC Token      |
| **UI**          | Tailwind CSS            | 4.x       | Styling                                       |
| **Stellar**     | Stellar SDK             | 17.x      | Stellar network integration (legacy)          |

---

## Branch Strategy

This project uses a **multi-branch architecture** to support multiple EVM-compatible blockchains. Each chain has its own branch with chain-specific configurations, contracts, and RPC endpoints.

### Branch Map

| Branch                          | Chain            | Chain ID | RPC URL                              | Token          |
|---------------------------------|------------------|----------|--------------------------------------|----------------|
| `master`                        | Base (shared)    | —        | —                                    | —              |
| `Bounty-Avalanche`              | Avalanche C-Chain| 43113    | `https://api.avax-test.network/ext/bc/C/rpc` | USDC (native)  |
| `Bounty-Pollar`                 | Pollar           | TBD      | TBD                                  | MockUSDC       |
| `feature/hsk-compatibility`     | HashKey Chain    | 133      | `https://testnet.hsk.xyz`            | MockUSDC       |
| `feature/evm-compatibility`     | EVM Generic      | —        | —                                    | —              |

### How It Works

```
master (base)
  │
  ├─── Bounty-Avalanche      → Avalanche C-Chain testnet
  ├─── Bounty-Pollar          → Pollar chain
  ├─── feature/hsk-compatibility → HashKey Chain testnet
  └─── feature/evm-compatibility → Generic EVM compatibility layer
```

- **`master`**: Contains the shared core code (React UI, wallet logic, Capacitor config). No chain-specific code.
- **Chain branches**: Fork from `master` and add chain-specific RPC, contract addresses, and configuration.
- **Each branch is independent**: Contracts, relayer config, and demo wallets are specific to each chain.

### Per-Branch Differences

| Feature                     | master | Avalanche | Pollar | HSK Chain |
|----------------------------|--------|-----------|--------|-----------|
| Core UI & wallet logic     | ✅     | ✅        | ✅     | ✅        |
| Chain-specific RPC config  | ❌     | ✅        | ✅     | ✅        |
| Deployed contract addresses| ❌     | ✅        | ✅     | ✅        |
| Relayer with funded wallet | ❌     | ✅        | ✅     | ✅        |
| Demo wallet + faucet       | ❌     | ✅        | ✅     | ✅        |

---

## System Flow

### Online Flow (Gasless)

```
User opens the app
        │
        ▼
WalletContext detects isOnline = true
        │
        ▼
User enters amount + destination address
        │
        ▼
App generates EIP-712 ForwardRequest
        │
        ▼
User signs with private key (sign only, does not broadcast)
        │
        ▼
App sends { forwardRequest, signature } to Relayer
        │
        ▼
Relayer verifies signature + nonce
        │
        ▼
Relayer executes on-chain (pays gas with its wallet)
        │
        ▼
Relayer returns txHash to frontend
        │
        ▼
WalletContext updates balances
```

### Offline Flow

```
User activates Offline mode (manual toggle)
        │
        ▼
WalletContext.setOnline(false)
        │
        ▼
User enters amount + destination address
        │
        ▼
App generates ForwardRequest and signs locally
        │
        ▼
Transaction saved to localStorage.pendingTx[]
        │
        ▼
UI shows "Saved offline" + visual indicator
        │
        ▼
[User reconnects]
        │
        ▼
SyncManager detects isOnline = true
        │
        ▼
For each tx in pendingTx[] where synced = false:
        │   POST /api/relay/forward
        │   Relayer executes on-chain
        │   WalletContext.markSynced(txHash)
        ▼
Queue cleared, balances updated
```

### P2P Flow (mocked)

```
User A generates offline transaction
        │
        ▼
Transaction payload exported as JSON
        │
        ▼
Transfer via Bluetooth / NFC / QR
        │
        ▼
User B imports payload into their app
        │
        ▼
User B presses "Sync Now"
        │
        ▼
First connected device executes on-chain
        │
        ▼
Second connected device validates idempotency (nonce already used)
        │
        ▼
Both balances updated
```

---

## Smart Contracts

All contracts are deployed per-chain in their respective branches.

### PollarForwarder

Implements **ERC-2771** for gasless meta-transactions. Allows an authorized account (the relayer) to execute transactions on behalf of a user without the user paying gas.

```solidity
function getNonce(address from) external view returns (uint256);
function execute(
    tuple(address from, address to, uint256 value, uint256 gas,
           uint256 nonce, uint256 deadline, bytes data) req,
    bytes signature
) external payable returns (bool, bytes memory);
```

**Security**: The contract validates `nonce` (idempotency), `deadline` (expiration), and the user's EIP-712 signature before execution.

### PollarVault

Custodies ERC-20 deposits from users.

```solidity
function depositTokenVault(address token, uint256 amount) external;
function withdrawTokenVault(address token, uint256 amount) external;
function getTokenVault(address payer, address token) external view returns (
    address token,
    uint256 balance,
    uint256 totalDeposited,
    uint256 totalWithdrawn,
    bytes32 merkleRoot,
    uint64 lastUpdate
);
```

### USDC Token

- **Avalanche**: Native USDC (no mock needed)
- **Pollar / HSK Chain**: MockUSDC with public `mint()` for demo purposes, 6 decimals

```solidity
function mint(address to, uint256 amount) external;
function balanceOf(address) view returns (uint256);
function decimals() view returns (uint8);  // returns 6
```

---

## Relayer API

The relayer runs on `http://localhost:3001`. Exposes the following REST endpoints.

### GET /api/status

System status.

```json
{
  "status": "online",
  "network": "avalancheTestnet",
  "chainId": 43113,
  "relayerAddress": "0x...",
  "relayerBalance": "0.1",
  "forwarderAddress": "0x...",
  "vaultAddress": "0x...",
  "usdcAddress": "0x..."
}
```

### GET /api/forwarder/nonce/:address

Query the current nonce for a user on the `PollarForwarder`.

```bash
curl http://localhost:3001/api/forwarder/nonce/0x...
# { "nonce": 0 }
```

### POST /api/relay/forward

Execute a gasless meta-transaction via `PollarForwarder`.

```json
{
  "forwardRequest": {
    "from":    "0x...user...",
    "to":      "0x...recipient...",
    "value":   "0",
    "gas":     "100000",
    "nonce":   0,
    "deadline": 1730000000,
    "data":    "0xa9059cbb..."
  },
  "signature": "0x...EIP-712 signature..."
}
```

Response:
```json
{ "success": true, "txHash": "0x...", "gasUsed": "21000" }
```

### POST /api/relay/deposit-authorization

Deposit using EIP-3009 (`transferFromWithAuthorization`).

### POST /api/relay/deposit-permit

Deposit using EIP-2612 (`permit`).

### POST /api/relay/settle-batch

Batch settlement with Merkle proofs.

### GET /api/usdc/balance/:address

Query USDC balance for an address.

```bash
curl http://localhost:3001/api/usdc/balance/0x...
# { "balance": "1000000000", "decimals": 6 }
```

---

## Configuration

### Environment Variables (Relayer)

```bash
RELAYER_PRIVATE_KEY=0x...
FORWARDER_ADDRESS=0x...
VAULT_ADDRESS=0x...
NETWORK=avalancheTestnet
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
PORT=3001
```

### Demo Wallet (Auto-login)

```
Address:     0x...
Private Key: 0x...
Balance:     ~0.1 NATIVE (testnet faucet)
Balance USDC: 1000 USDC (mint via faucet)
```

> **Note**: Exact values vary per chain branch. Check the README in each branch for specific addresses.

### Network Endpoints

| Resource          | Avalanche Testnet | HashKey Testnet |
|-------------------|-------------------|-----------------|
| RPC URL           | `https://api.avax-test.network/ext/bc/C/rpc` | `https://testnet.hsk.xyz` |
| Explorer          | `https://testnet.snowtrace.io` | `https://hashkeychain-testnet-explorer.alt.technology` |
| Faucet            | `https://faucet.avax.network` | `https://faucet.hskchain.net/faucet` |

---

## Execution

### 1. Install dependencies

```bash
npm install
```

### 2. Start the Relayer

```bash
RELAYER_PRIVATE_KEY=0x... \
FORWARDER_ADDRESS=0x... \
VAULT_ADDRESS=0x... \
NETWORK=avalancheTestnet \
node server/hsk_relayer.js
```

Verify status:
```bash
curl http://localhost:3001/api/status
```

### 3. Web development server

```bash
npm run dev
# Opens at http://localhost:5173
```

### 4. Build Android APK

```bash
npm run build
npx cap sync android
cd android
JAVA_HOME=/usr/lib/jvm/java-21 ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 5. Build and deploy contracts (only if modified)

```bash
# Compile
node contracts/evm/compile.mjs

# Deploy to testnet
node contracts/evm/deploy_hsk.cjs --network hskTestnet --private-key <KEY>
```

---

## Project Structure

```
NCN-Pollar/
├── src/
│   ├── components/          # React UI components
│   │   ├── WalletVault.jsx          # Main wallet UI
│   │   ├── SyncManager.jsx          # Offline queue sync
│   │   ├── P2PPaymentTerminal.jsx   # P2P transfer UI
│   │   └── ...
│   ├── context/
│   │   └── WalletContext.jsx        # Global wallet state
│   ├── services/            # Blockchain interaction logic
│   └── styles/              # Tailwind CSS styles
├── contracts/               # Solidity smart contracts
│   └── pollar_vault/        # Contract sources & build artifacts
├── server/                  # Relayer backend (Node.js)
├── android/                 # Capacitor Android project
├── scripts/                 # Deployment & utility scripts
└── core-go/                 # Go core utilities (if applicable)
```

---

## Links

- **Repository**: github.com/SebasMjz/NoConnectionNeeded
- **Base branch**: `master`
- **Chain branches**: `Bounty-Avalanche` | `Bounty-Pollar` | `feature/hsk-compatibility`
- **APK**: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## License

MIT
