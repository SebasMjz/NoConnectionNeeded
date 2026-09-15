# NoConnectionNeeded

**Billetera P2P offline sobre HashKey Chain.** Permite enviar y recibir USDC sin costo de gas para el usuario, funcionando incluso sin conexion a internet.

> Rama activa: `feature/hsk-compatibility`
> Red: HashKey Chain Testnet (chainId 133)

---

## Indice

1. [Arquitectura](#arquitectura)
2. [Stack Tecnologico](#stack-tecnologico)
3. [Flujo del Sistema](#flujo-del-sistema)
4. [Contratos Inteligentes](#contratos-inteligentes)
5. [API del Relayer](#api-del-relayer)
6. [Configuracion](#configuracion)
7. [Ejecucion](#ejecucion)
8. [Diagramas](#diagramas)

---

## Arquitectura

El sistema se compone de tres capas:

```
┌──────────────────────────────────────────────────────────────┐
│                      CAPA 1 — Dispositivo Android             │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │ WalletContext│  │  pendingTx[]  │  │  EIP-712 Signer│  │
│  │ (provider,   │  │  (cola offline│  │  (firma con    │  │
│  │  signer,     │  │   en browser  │  │   clave priv.) │  │
│  │  isOnline)   │  │   storage)    │  │                │  │
│  └──────────────┘  └───────────────┘  └────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │  SyncManager  │  │   Online /     │  │    P2P UI      │  │
│  │  (ejecuta   │  │   Offline      │  │  (BT/NFC/QR   │  │
│  │   cola)      │  │   Toggle       │  │   - mockeado) │  │
│  └──────────────┘  └───────────────┘  └────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐
│   HSK RPC       │  │ localStorage  │  │  Relayer        │
│  testnet.hsk   │  │ pendingTx[]  │  │  localhost:3001 │
│  .xyz          │  │ wallet.json  │  │  Node.js        │
└────────┬────────┘  └──────────────┘  └────────┬────────┘
         │                                        │
         └──────────────┬────────────────────────┘
                        ▼
         ┌──────────────────────────────┐
         │   HASHKEY CHAIN TESTNET     │
         │         chainId: 133         │
         │                               │
         │  ┌──────────────────────┐    │
         │  │  PollarForwarder    │    │
         │  │  ERC-2771           │    │
         │  │  0xBFB5…59dcbC     │    │
         │  └──────────────────────┘    │
         │  ┌──────────────────────┐    │
         │  │  PollarVault        │    │
         │  │  ERC-20 Custody     │    │
         │  │  0x7e90…4d96       │    │
         │  └──────────────────────┘    │
         │  ┌──────────────────────┐    │
         │  │  MockUSDC          │    │
         │  │  0x7889…2F15       │    │
         │  └──────────────────────┘    │
         └──────────────────────────────┘
```

### Capa 1 — Dispositivo Android

La aplicacion corre en un WebView (Capacitor) dentro de un APK Android. No existe un backend servidor; toda la logica de wallet vive en el dispositivo.

- **WalletContext**: estado global de React que mantiene el `JsonRpcProvider`, el `signer` (Wallet), el flag `isOnline`, y la cola `pendingTx[]`.
- **pendingTx[]**: array de transacciones pendientes almacenado en `localStorage` del browser. Cada entrada contiene `id`, `type`, `to`, `from`, `amount`, `synced` y `timestamp`.
- **EIP-712 Signer**: firma meta-transacciones con `ethers.js` usando el estandar EIP-712 (typed data), mas seguro que transacciones raw.
- **SyncManager**: componente que detecta reconexion y ejecuta `POST /api/relay/forward` para cada transaccion pendiente no sincronizada.
- **Online/Offline Toggle**: interrumpe la deteccion automatica de conectividad y fuerza el modo offline manual.

### Capa 2 — Relayer (Backend)

Servidor Node.js escuchando en puerto 3001. No custodia fondos; solo paga gas en nombre del usuario.

- Recibe meta-transacciones firmadas via `POST /api/relay/forward`.
- Verifica la firma EIP-712 y el nonce del usuario en el contrato `PollarForwarder`.
- Ejecuta la transaccion en HashKey Chain usando su propia wallet con saldo HSK.
- Retorna `txHash` al frontend para confirmacion.

### Capa 3 — HashKey Chain

Blockchain EVM-compatible donde se ejecutan los contratos. Testnet chainId 133, RPC `https://testnet.hsk.xyz`.

---

## Stack Tecnologico

| Capa            | Tecnologia              | Version   | Rol                                           |
|-----------------|------------------------|-----------|-----------------------------------------------|
| **Frontend**    | React                   | 18.x      | UI, wallet signing, cola offline              |
| **Build**       | Vite                    | 8.x       | Bundler de desarrollo y produccion             |
| **Mobile**      | Capacitor               | 8.x       | Compilacion a APK Android nativo               |
| **Blockchain**   | ethers.js               | 6.x       | Conexion RPC, firma EIP-712, interaction con contratos |
| **Backend**     | Node.js + Express        | 18.x      | Relayer, endpoints REST                        |
| **Smart Contracts** | Solidity            | 0.8.x     | PollarForwarder, PollarVault, MockUSDC         |
| **Blockchain**   | HashKey Chain (EVM)    | Testnet   | Red de ejecucion (chainId 133)                 |
| **Token**       | MockUSDC                | —         | ERC-20 de prueba, 6 decimales                 |

---

## Flujo del Sistema

### Flujo Online (Gasless)

```
Usuario abre la app
        │
        ▼
WalletContext detecta isOnline = true
        │
        ▼
Usuario ingresa monto + direccion destino
        │
        ▼
App genera EIP-712 ForwardRequest
        │
        ▼
Usuario firma con clave privada (solo firma, no envia a red)
        │
        ▼
App envia { forwardRequest, signature } al Relayer
        │
        ▼
Relayer verifica firma + nonce
        │
        ▼
Relayer ejecuta en HSK Chain (paga gas con su wallet)
        │
        ▼
Relayer retorna txHash al frontend
        │
        ▼
WalletContext actualiza balances
```

### Flujo Offline

```
Usuario activa modo Offline (toggle manual)
        │
        ▼
WalletContext.setOnline(false)
        │
        ▼
Usuario ingresa monto + direccion destino
        │
        ▼
App genera ForwardRequest y firma localmente
        │
        ▼
Transaccion guardada en localStorage.pendingTx[]
        │
        ▼
UI muestra "Guardado offline" + indicador visual
        │
        ▼
[Usuario se reconecta]
        │
        ▼
SyncManager detecta isOnline = true
        │
        ▼
Para cada tx en pendingTx[] donde synced = false:
        │   POST /api/relay/forward
        │   Relayer ejecuta en chain
        │   WalletContext.markSynced(txHash)
        ▼
Cola vaciada, balances actualizados
```

### Flujo P2P (mockeado)

```
Usuario A genera transaccion offline
        │
        ▼
Payload de la transaccion exportado como JSON
        │
        ▼
Transferencia via Bluetooth / NFC / QR
        │
        ▼
Usuario B importa el payload en su app
        │
        ▼
Usuario B presiona "Sync Ahora"
        │
        ▼
Primer conectado ejecuta en chain
        │
        ▼
Segundo conectado valida idempotencia (nonce ya usado)
        │
        ▼
Ambos balances actualizados
```

---

## Contratos Inteligentes

Todos desplegados en **HashKey Chain Testnet** (chainId 133).

### PollarForwarder

**Address:** `0xBFB5078c8afF57226F1f32de999dd0ADd559dcbC`

Implementa **ERC-2771** para meta-transacciones gasless. Permite que una cuenta autorizada (el relayer) ejecute transacciones en nombre de un usuario sin que el usuario pague gas.

```solidity
function getNonce(address from) external view returns (uint256);
function execute(
    tuple(address from, address to, uint256 value, uint256 gas,
           uint256 nonce, uint256 deadline, bytes data) req,
    bytes signature
) external payable returns (bool, bytes memory);
```

**Seguridad:** El contrato valida `nonce` (idempotencia), `deadline` (expiracion), y la firma EIP-712 del usuario antes de ejecutar.

### PollarVault

**Address:** `0x7e906F6C41660C218282fe4F5d7C76d8D8604d96`

Custodia depositos ERC-20 de los usuarios.

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

### MockUSDC

**Address:** `0x788952C55A04F32C4dC26dEd4858f5D6259f2F15`

Token ERC-20 de prueba en testnet. 6 decimales (igual que USDC real). `mint()` es publica para permitir faucet de tokens de demo.

```solidity
function mint(address to, uint256 amount) external;
function balanceOf(address) view returns (uint256);
function decimals() view returns (uint8);  // returns 6
```

---

## API del Relayer

El relayer corre en `http://localhost:3001`. Expone los siguientes endpoints REST.

### GET /api/status

Estado del sistema.

```json
{
  "status": "online",
  "network": "hskTestnet",
  "chainId": 133,
  "relayerAddress": "0x9E3EBaF039a45Ab325853d6fB289debbE280a31b",
  "relayerBalance": "0.093968222665753765",
  "forwarderAddress": "0xBFB5078c8afF57226F1f32de999dd0ADd559dcbC",
  "vaultAddress": "0x7e906F6C41660C218282fe4F5d7C76d8D8604d96",
  "usdcAddress": "0x788952C55A04F32C4dC26dEd4858f5D6259f2F15"
}
```

### GET /api/forwarder/nonce/:address

Consulta el nonce actual del usuario en el `PollarForwarder`.

```bash
curl http://localhost:3001/api/forwarder/nonce/0x9E3EBaF039a45Ab325853d6fB289debbE280a31b
# { "nonce": 0 }
```

### POST /api/relay/forward

Ejecuta una meta-transaccion gasless via `PollarForwarder`.

```json
{
  "forwardRequest": {
    "from":    "0x...usuario...",
    "to":      "0x...destinatario...",
    "value":   "0",
    "gas":     "100000",
    "nonce":   0,
    "deadline": 1730000000,
    "data":    "0xa9059cbb000000000000000000000000...recipient...000000000000000000000000000000000000000000000000000000000bebc200"
  },
  "signature": "0x...EIP-712 signature..."
}
```

Respuesta:
```json
{ "success": true, "txHash": "0x...transaction hash...", "gasUsed": "21000" }
```

### POST /api/relay/deposit-authorization

Deposito usando EIP-3009 (`transferFromWithAuthorization`).

### POST /api/relay/deposit-permit

Deposito usando EIP-2612 (`permit`).

### POST /api/relay/settle-batch

Liquidacion batch con Merkle proofs.

### GET /api/usdc/balance/:address

Consulta el balance de USDC de una direccion.

```bash
curl http://localhost:3001/api/usdc/balance/0x9E3EBaF039a45Ab325853d6fB289debbE280a31b
# { "balance": "1000000000", "decimals": 6 }
```

---

## Configuracion

### Variables de entorno (Relayer)

```bash
RELAYER_PRIVATE_KEY=0x8a2928db10eb8fbe530a6c130f93d910fbd8b526f9522fad60340c3fe8ee6268
FORWARDER_ADDRESS=0xBFB5078c8afF57226F1f32de999dd0ADd559dcbC
VAULT_ADDRESS=0x7e906F6C41660C218282fe4F5d7C76d8D8604d96
NETWORK=hskTestnet
RPC_URL=https://testnet.hsk.xyz
PORT=3001
```

### Wallet Demo (Auto-login)

```
Address:     0x9E3EBaF039a45Ab325853d6fB289debbE280a31b
Private Key: 0x8a2928db10eb8fbe530a6c130f93d910fbd8b526f9522fad60340c3fe8ee6268
Balance HSK: ~0.094 HSK (testnet faucet)
Balance USDC: 1000 USDC (mint via faucet)
```

### Endpoints de Red

| Recurso          | URL                                             |
|------------------|-------------------------------------------------|
| HSK Testnet RPC  | `https://testnet.hsk.xyz`                       |
| HSK Mainnet RPC  | `https://mainnet.hsk.xyz`                       |
| Testnet Explorer | `https://hashkeychain-testnet-explorer.alt.technology` |
| Mainnet Explorer  | `https://explorer.hsk.xyz`                      |
| Faucet HSK       | `https://faucet.hskchain.net/faucet`            |

---

## Ejecucion

### 1. Instalar dependencias

```bash
npm install
```

### 2. Iniciar el Relayer

```bash
RELAYER_PRIVATE_KEY=0x8a2928db... \
FORWARDER_ADDRESS=0xBFB5078c8afF57226F1f32de999dd0ADd559dcbC \
VAULT_ADDRESS=0x7e906F6C41660C218282fe4F5d7C76d8D8604d96 \
NETWORK=hskTestnet \
node server/hsk_relayer.js
```

Verificar estado:
```bash
curl http://localhost:3001/api/status
```

### 3. Servidor de desarrollo web

```bash
npm run dev
# Abre en http://localhost:5173
```

### 4. Compilar APK Android

```bash
npm run build
npx cap sync android
cd android
JAVA_HOME=/usr/lib/jvm/java-21 ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 5. Compilar y desplegar contratos (solo si se modifyan)

```bash
# Compilar
node contracts/evm/compile.mjs

# Desplegar a testnet
node contracts/evm/deploy_hsk.cjs --network hskTestnet --private-key <KEY>
```

---

## Diagramas

El diagrama de arquitectura SVG interactivo esta en:

```
docs/architecture-diagram.html
```

Abrir directamente en cualquier navegador — no requiere dependencias externas.

Incluye:
- Capa de usuario (dispositivos Android)
- Capa de aplicacion (WalletContext, pendingTx[], EIP-712 Signer, SyncManager)
- Capa de relayer (servidor Node.js + wallet del relayer)
- Capa de blockchain (HashKey Chain Testnet + 3 contratos)
- Flujos online, offline y P2P con flechas etiquetadas
- Leyenda de colores

---

## Links

- **Repositorio:** github.com/SebasMjz/NoConnectionNeeded
- **Rama activa:** `feature/hsk-compatibility`
- **Base branch:** `feature/evm-compatibility` (ef997c3)
- **APK:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Explorador HSK Testnet:** hashkeychain-testnet-explorer.alt.technology
