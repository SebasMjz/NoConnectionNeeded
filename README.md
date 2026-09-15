# NoConnectionNeeded — Pollar Branch

**Offline P2P Wallet for Stellar Network.** Send and receive XLM with zero gas cost for users, working even without internet connection. Powered by Pollar Core SDK (Wallet-as-a-Service).

> Active branch: `Bounty-Pollar`
> Network: Stellar Testnet (Horizon + Soroban)
> Chain: Stellar (non-EVM)

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [System Flow](#system-flow)
4. [Smart Contract (Soroban)](#smart-contract-soroban)
5. [Pollar Core SDK Integration](#pollar-core-sdk-integration)
6. [Cryptography & Merkle Tree](#cryptography--merkle-tree)
7. [Configuration](#configuration)
8. [Execution](#execution)
9. [Testing](#testing)
10. [Project Structure](#project-structure)

---

## Architecture

This branch runs on **Stellar Network** (non-EVM). Unlike other branches that use EVM-compatible chains, Pollar leverages Stellar's native features: Horizon API, Soroban smart contracts, and Ed25519 cryptography.

```
┌──────────────────────────────────────────────────────────────┐
│                    LAYER 1 — Android Device                  │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │ WalletContext│  │ transactions[]│  │  Ed25519 Signer│   │
│  │ (provider,   │  │  (offline     │  │  (Stellar      │   │
│  │  activeWallet│  │   queue in    │  │   Keypair)     │   │
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
│  │ PollarEngine │  │ StellarCrypto │  │  Go WASM Core  │   │
│  │ (SHA-256,    │  │ (Ed25519,     │  │  (high-perf    │   │
│  │  Merkle)     │  │  Horizon)     │  │   fallback)    │   │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
└────────────────────────────┬─────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐
│  Stellar Horizon│  │  localStorage│  │  Pollar Core    │
│  horizon-testnet│  │  transactions│  │  api.pollar.io  │
│  .stellar.org   │  │  wallet.json │  │  (WaaS)         │
└────────┬────────┘  └──────────────┘  └────────┬────────┘
         │                                        │
         └──────────────┬────────────────────────┘
                        ▼
         ┌──────────────────────────────┐
         │      STELLAR NETWORK         │
         │     (Testnet / Mainnet)       │
         │                              │
         │  ┌──────────────────────┐    │
         │  │  PollarOfflineVault  │    │
         │  │  Soroban Contract    │    │
         │  │  (Rust, compiled)    │    │
         │  └──────────────────────┘    │
         │                              │
         │  ┌──────────────────────┐    │
         │  │  Native XLM          │    │
         │  │  (or custom assets)  │    │
         │  └──────────────────────┘    │
         └──────────────────────────────┘
```

### Layer 1 — Android Device

The app runs in a WebView (Capacitor) inside an Android APK. All wallet logic lives on the device. No EVM — uses Stellar's native Ed25519 keypairs.

- **WalletContext**: Global React state holding the active wallet, `transactions[]` queue, `isOnline` flag, and Merkle tree state.
- **transactions[]**: Array of pending offline transactions stored in `localStorage`. Each entry contains `payload`, `txHash`, `payerSignature`, `payeeSignature`, and `status`.
- **Ed25519 Signer**: Signs transactions using Stellar Keypairs (`@stellar/stellar-sdk`). Real Ed25519 cryptographic signatures.
- **SyncManager**: Component that settles pending transactions on-chain via Pollar Core SDK when online.
- **PollarEngine**: Pure JS SHA-256 implementation with Go WASM fallback for high-performance hashing and Merkle tree construction.
- **StellarCrypto**: Ed25519 key generation, signing, verification, Horizon account queries, and Friendbot testnet funding.

### Layer 2 — Pollar Core SDK (WaaS)

Wallet-as-a-Service provided by Pollar. Handles custody, signing, and on-chain settlement without exposing private keys to the frontend.

- **Custodial signing**: Pollar Core signs Stellar transactions on behalf of the user.
- **API Gateway**: `https://api.pollar.io/v1`
- **No private key exposure**: Users never handle raw secret keys for on-chain operations.
- **Integration**: `@pollar/react` hook provides `sendPayment()`, `refreshWalletBalance()`, `openSendModal()`.

### Layer 3 — Stellar Network

Non-EVM blockchain using Horizon API for account queries and Soroban for smart contracts.

- **Horizon API**: `https://horizon-testnet.stellar.org` — account balances, transaction submission, ledger queries.
- **Soroban RPC**: `https://soroban-testnet.stellar.org` — smart contract invocation.
- **Network Passphrase**: `Test SDF Network ; September 2015` (testnet) or `Public Global Stellar Network ; September 2015` (mainnet).
- **Friendbot**: Automatic testnet account funding via `https://friendbot.stellar.org`.

---

## Tech Stack

| Layer            | Technology              | Version   | Role                                           |
|-----------------|------------------------|-----------|-----------------------------------------------|
| **Frontend**    | React                   | 19.x      | UI, wallet signing, offline queue             |
| **Build**       | Vite                    | 8.x       | Development and production bundler            |
| **Mobile**      | Capacitor               | 8.x       | Native Android APK compilation                |
| **Blockchain**  | Stellar SDK             | 17.x      | Horizon queries, Soroban contract invocation, Ed25519 crypto |
| **WaaS**        | Pollar Core SDK         | —         | Custodial signing, payment processing         |
| **Backend**     | Core-Go (WASM)          | —         | High-performance cryptographic operations     |
| **Contracts**   | Soroban (Rust)          | 21.x      | PollarOfflineVaultContract                    |
| **UI**          | Tailwind CSS            | 4.x       | Styling                                       |
| **Testing**     | Playwright              | —         | End-to-end tests                              |

---

## System Flow

### Online Flow (Gasless via Pollar Core)

```
User opens the app
        │
        ▼
WalletContext detects isOnline = true
        │
        ▼
User enters amount + destination address (G...)
        │
        ▼
App calls pollar.sendPayment() via Pollar Core SDK
        │
        ▼
Pollar Core signs and submits to Stellar Horizon
        │
        ▼
Transaction confirmed on Stellar Ledger
        │
        ▼
WalletContext updates balances via Horizon API
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
App generates payload with canonical hash
        │
        ▼
Payer signs with Ed25519 (Stellar Keypair or device key)
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
User presses "Sync Now" → syncToStellarNetwork()
        │
        ▼
Pollar Core SDK submits batch settlement to Stellar
        │
        ▼
Merkle root included in transaction memo
        │
        ▼
All pending transactions marked SYNCED_ONCHAIN
```

### P2P Flow (QR / Bluetooth / NFC)

```
User A generates offline payment
        │
        ▼
Payload serialized as compact JSON (v2 format)
        │
        ▼
QR code generated (error correction 'L' for readability)
        │
        ▼
User B scans QR code
        │
        ▼
App parses compact payment payload
        │
        ▼
User B counter-signs receipt (Ed25519)
        │
        ▼
Transaction saved to both devices (Merkle leaf)
        │
        ▼
First connected device syncs batch to Stellar
```

---

## Smart Contract (Soroban)

Contract: **PollarOfflineVaultContract** (Rust, compiled to WASM for Soroban)

**Contract ID**: `CAAHWULOEDYMVONYFXFSUZOJYO7ET4V3AQFMIMARRBKEHNUNSF5P2D73`
**Network**: Stellar Testnet

### Contract Functions

```rust
// Initialize vault and lock funds
pub fn init_vault(env: Env, payer: Address, initial_amount: i128)

// Settle offline batch with Merkle root verification
pub fn settle_batch(
    env: Env,
    submitter: Address,
    payee: Address,
    settle_amount: i128,
    merkle_root: BytesN<32>,
    batch_nonce: u64,
)

// Allocate or increment locked balance
pub fn allocate_funds(env: Env, payer: Address, amount: i128)

// Reclaim unspent offline funds
pub fn reclaim_funds(env: Env, payer: Address, amount: i128)

// Query current vault state
pub fn get_vault(env: Env) -> VaultState
```

### Vault State

```rust
pub struct VaultState {
    pub payer: Address,           // Vault owner
    pub locked_amount: i128,      // Total locked for offline use
    pub last_merkle_root: BytesN<32>, // Last settled Merkle root
    pub total_settled: i128,      // Amount already settled
    pub nonce: u64,               // Batch nonce for idempotency
}
```

### Security

- **Self-send prevention**: Cannot settle to the same wallet that owns the vault.
- **Amount validation**: Settled amount cannot exceed locked balance.
- **Nonce-based idempotency**: Prevents double-spending via batch nonce.
- **Auth required**: `payer.require_auth()` for all state-modifying operations.

---

## Pollar Core SDK Integration

The Pollar branch integrates with **Pollar Core** (Wallet-as-a-Service) for custodial operations.

### Environment Variables

```bash
VITE_POLLAR_API_KEY=pub_testnet_pollar_development
VITE_POLLAR_GATEWAY_URL=https://api.pollar.io/v1
```

### SDK Usage (via @pollar/react)

```javascript
import { usePollar } from '@pollar/react';

const pollar = usePollar();

// Send payment (custodial — no private key needed)
await pollar.sendPayment({
  destination: 'G...',
  amount: '10.0000000',
  asset: { type: 'native' },
});

// Refresh wallet balance
await pollar.refreshWalletBalance();

// Open Pollar send modal
pollar.openSendModal();

// Get internal client
const client = pollar.getClient();
```

### Custodial vs Non-Custodial

| Feature                     | Pollar Core (WaaS)  | Direct Stellar SDK     |
|----------------------------|---------------------|------------------------|
| Private key handling       | Server-side (hidden)| Client-side (exposed)   |
| On-chain signing           | Pollar Core         | User's device          |
| Offline P2P signing        | Device keypair      | Device keypair         |
| Batch settlement           | Pollar Core API     | Direct Horizon submit  |

---

## Cryptography & Merkle Tree

### Ed25519 Signatures (Stellar Native)

All offline transactions use real Ed25519 signatures via `@stellar/stellar-sdk`:

```javascript
import { Keypair } from '@stellar/stellar-sdk';

// Generate keypair
const kp = Keypair.random();
kp.publicKey();  // G...
kp.secret();     // S...

// Sign
const signature = kp.sign(hashBytes);

// Verify
kp.verify(hashBytes, signatureBytes); // boolean
```

### Canonical Transaction Hash

Deterministic SHA-256 hash computed from sorted payload fields:

```javascript
parts = [id, payer, payee, amount, asset, nonce, timestamp, memo];
hash = SHA256(parts.join('|'));
```

### Dual-Signature Protocol

1. **Payer signs** the payment commitment (Ed25519)
2. **Payee counter-signs** the receipt upon validation
3. Both signatures stored in the transaction record
4. Merkle leaf hash computed from both signatures

### Merkle Tree Construction

- **Leaf Hash**: `SHA256(txHash:payer:payee:amount:nonce:payerSignature:payeeSignature)`
- **Parent Hash**: `SHA256(left + right)`
- **Root Hash**: Stored in Stellar transaction memo for on-chain verification
- **Audit Proof**: Generate/verify inclusion proof for any transaction

### Go WASM Core

High-performance cryptographic operations via Go WebAssembly (fallback to WebCrypto):

- SHA-256 hashing
- Key generation (Ed25519 / HMAC)
- Merkle tree construction
- Load from `/pollar_core.wasm`

---

## Configuration

### Environment Variables

```bash
# Pollar SDK
VITE_POLLAR_API_KEY=pub_testnet_pollar_development
VITE_POLLAR_GATEWAY_URL=https://api.pollar.io/v1

# Stellar Network
VITE_STELLAR_NETWORK=testnet
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Soroban Contract
VITE_VAULT_CONTRACT_ID=CAAHWULOEDYMVONYFXFSUZOJYO7ET4V3AQFMIMARRBKEHNUNSF5P2D73
```

### Network Endpoints

| Resource          | Testnet                              | Mainnet                          |
|-------------------|--------------------------------------|----------------------------------|
| Horizon API       | `https://horizon-testnet.stellar.org`| `https://horizon.stellar.org`    |
| Soroban RPC       | `https://soroban-testnet.stellar.org`| `https://soroban-mainnet.stellar.org` |
| Friendbot         | `https://friendbot.stellar.org`      | —                                |
| Explorer          | `https://stellar.expert/explorer/testnet` | `https://stellar.expert/explorer/public` |

### Stellar Account Format

- **Public Key**: `G...` (56 characters)
- **Secret Key**: `S...` (56 characters)
- **Contract ID**: `C...` (Soroban contract addresses)

---

## Execution

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Pollar API key and Stellar network config
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

### 5. Build Go WASM (optional — for high-performance crypto)

```bash
cd core-go
.\build_wasm.bat
# Copies pollar_core.wasm to public/
```

### 6. Deploy Soroban Contract (only if modified)

```bash
cd contracts/pollar_vault
stellar contract deploy --network testnet --source <KEY>
# Update VITE_VAULT_CONTRACT_ID in .env
```

---

## Testing

### E2E Tests (Playwright)

```bash
npx playwright test
```

Test suites:

| File                              | Coverage                              |
|-----------------------------------|---------------------------------------|
| `phase1-auth.spec.js`            | Authentication flow                   |
| `phase2-settings.spec.js`        | Settings and preferences              |
| `phase3-wallet-registry.spec.js` | Wallet linking and management         |
| `phase4-7-transport.spec.js`     | P2P transport (QR, BT, NFC)           |
| `base.spec.js`                   | Base configuration                    |

### Soroban Contract Tests

```bash
cd contracts/pollar_vault
cargo test
```

Unit tests cover:
- Vault initialization
- Batch settlement with Merkle root
- Self-send prevention
- Locked amount limit enforcement

---

## Project Structure

```
NCN-Pollar/ (Bounty-Pollar branch)
├── src/
│   ├── components/              # React UI components
│   │   ├── WalletVault.jsx              # Main wallet UI
│   │   ├── SyncManager.jsx              # On-chain settlement
│   │   ├── P2PPaymentTerminal.jsx       # P2P transfer UI
│   │   ├── QRScannerModal.jsx           # QR code scanner
│   │   ├── MerkleVisualizer.jsx         # Merkle tree visualization
│   │   ├── CryptoSelector.jsx           # Asset selection
│   │   └── ...
│   ├── context/
│   │   └── WalletContext.jsx            # Global wallet state
│   ├── services/                # Blockchain interaction logic
│   │   ├── stellarCrypto.js             # Ed25519, Horizon, Merkle
│   │   ├── sorobanVault.js              # Soroban contract client
│   │   ├── pollarEngine.js              # Pollar core engine (WASM)
│   │   ├── sorobanDeploy.js             # Contract deployment
│   │   ├── BiometricService.js          # Biometric auth
│   │   ├── BluetoothService.js          # BT transport
│   │   ├── NFCService.js                # NFC transport
│   │   └── ...
│   └── styles/                  # Tailwind CSS styles
├── contracts/
│   └── pollar_vault/            # Soroban smart contract (Rust)
│       ├── Cargo.toml
│       └── src/lib.rs
├── core-go/                     # Go WebAssembly core
│   ├── pkg/
│   ├── wasm/
│   └── build_wasm.bat
├── tests/
│   └── e2e/                     # Playwright E2E tests
├── android/                     # Capacitor Android project
├── scripts/                     # Deployment scripts
│   ├── deploy-vault.js
│   └── deploy-vault.mjs
└── public/
    └── pollar_core.wasm         # Compiled Go WASM (optional)
```

---

## Key Differences from EVM Branches

| Feature                     | Pollar (Stellar)           | EVM Branches (Avalanche/HSK) |
|----------------------------|----------------------------|------------------------------|
| Blockchain                 | Stellar (non-EVM)          | EVM-compatible               |
| Native Token               | XLM                        | AVAX / HSK                   |
| Smart Contract Language    | Rust (Soroban)             | Solidity                     |
| Cryptography               | Ed25519                    | EIP-712 (secp256k1)          |
| Account Format             | G... / S...                | 0x...                        |
| RPC Protocol               | Horizon + Soroban RPC      | JSON-RPC                     |
| WaaS Integration           | Pollar Core SDK            | —                            |
| Relayer                    | Pollar Core (custodial)    | Custom Node.js relayer       |
| Testnet Faucet             | Friendbot (automatic)      | Manual faucet                |
| Gas Payment                | Pollar Core (gasless)      | Relayer pays gas             |

---

## Links

- **Repository**: github.com/SebasMjz/NoConnectionNeeded
- **Branch**: `Bounty-Pollar`
- **Pollar API**: api.pollar.io
- **Stellar Testnet Explorer**: stellar.expert/explorer/testnet
- **Soroban Docs**: soroban.stellar.org

---

## License

MIT
