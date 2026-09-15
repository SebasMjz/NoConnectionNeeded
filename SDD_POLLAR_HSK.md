# Software Design Document — Pollar HSK Wallet

**Versión:** 1.0
**Fecha:** 13 de septiembre de 2026
**Autor:** Equipo Pollar
**Rama:** `feature/***`

---

## 1. Overview

Pollar HSK es una billetera P2P offline construida sobre **HashKey Chain** que permite enviar y recibir USDC sin costo de gas para el usuario, mediante meta-transacciones gasless (ERC-2771).

### 1.1 Características Principales

- **Pagos P2P**: Enviar/recibir USDC entre dispositivos
- **Modo Offline**: Transacciones guardadas localmente, sincronizadas al reconectar
- **Gasless**: El relayer paga el gas; usuario solo firma
- **Vault**: Depósito/retiro de USDC en contrato PollarVault
- **Multi-red**: Soporte para HSK Testnet y Mainnet

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                 │
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ BalanceCard  │    │ MarketWidget │    │  SyncWidget   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   P2PSend    │    │  P2PReceive  │    │  MintCard    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │  VaultCard   │    │ NewsWidget   │                      │
│  └──────────────┘    └──────────────┘                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              WalletContext (React Context)             │    │
│  │  - provider (JsonRpcProvider)                          │    │
│  │  - signer (Wallet)                                    │    │
│  │  - isOnline (boolean)                                 │    │
│  │  - pendingTx[] (cola offline)                        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
        │ HSK RPC   │  │ localStorage│  │ Relayer   │
        │ testnet   │  │ pendingTx  │  │ :3001     │
        │ .hsk.xyz  │  │ wallet    │  │           │
        └───────────┘  └───────────┘  └───────────┘
                              │
                    ┌──────────▼──────────┐
                    │   HSK TESTNET (133) │
                    │                      │
                    │  ┌────────────────┐  │
                    │  │PollarForwarder│  │
                    │  │(gasless relay) │  │
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │ PollarVault    │  │
                    │  │ (depositos)    │  │
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │  MockUSDC      │  │
                    │  │  (test token)  │  │
                    │  └────────────────┘  │
                    └──────────────────────┘
```

---

## 3. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React | 18.x |
| Build | Vite | 8.x |
| Mobile | Capacitor | 8.x |
| Blockchain | ethers.js | 6.x |
| Contracts | Solidity | 0.8.x |
| Backend | Node.js | 18.x |
| Chain | HashKey Chain | Testnet (133) |

---

## 4. Contratos Inteligentes

### 4.1 PollarForwarder (ERC-2771)

**Dirección:** `0xBFB5078c8afF57226F1f32de999dd0ADd559dcbC`

**Propósito:** Permitir meta-transacciones gasless. El relayer paga el gas; el usuario solo firma.

**ABI relevante:**
```solidity
function getNonce(address from) external view returns (uint256);
function execute(
    tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, uint256 deadline, bytes data) req,
    bytes signature
) external payable returns (bool, bytes);
```

### 4.2 PollarVault

**Dirección:** `0x7e906F6C41660C218282fe4F5d7C76d8D8604d96`

**Propósito:** Custodiar depósitos de USDC de los usuarios.

**ABI relevante:**
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

### 4.3 MockUSDC

**Dirección:** `0x788952C55A04F32C4dC26dEd4858f5D6259f2F15`

**Propósito:** Token de testing en testnet. No tiene valor real.

**ABI relevante:**
```solidity
function mint(address to, uint256 amount) external;
function balanceOf(address) view returns (uint256);
function decimals() view returns (uint8); // 6
```

---

## 5. Configuración de Red

### 5.1 HSK Testnet

| Parámetro | Valor |
|-----------|-------|
| Chain ID | 133 |
| Nombre | HashKey Chain Testnet |
| RPC URL | `https://testnet.hsk.xyz` |
| Explorer | `https://hashkeychain-testnet-explorer.alt.technology` |
| Símbolo | HSK |

### 5.2 HSK Mainnet (pendiente)

| Parámetro | Valor |
|-----------|-------|
| Chain ID | 177 |
| Nombre | HashKey Chain |
| RPC URL | `https://mainnet.hsk.xyz` |
| Explorer | `https://explorer.hsk.xyz` |
| Símbolo | HSK |

---

## 6. Variables de Entorno y Secrets

### 6.1 Relayer

```bash
# Wallet del relayer (paga el gas)
RELAYER_PRIVATE_KEY=0x8a2928db10eb8fbe530a6c130f93d910fbd8b526f9522fad60340c3fe8ee6268

# Contratos desplegados
FORWARDER_ADDRESS=0xBFB5078c8afF57226F1f32de999dd0ADd559dcbC
VAULT_ADDRESS=0x7e906F6C41660C218282fe4F5d7C76d8D8604d96

# Red
NETWORK=hskTestnet
RPC_URL=https://testnet.hsk.xyz

# Puerto del servidor
PORT=3001
```

### 6.2 Wallet Demo (Auto-login)

```
Address:  0x9E3EBaF039a45Ab325853d6fB289debbE280a31b
Private Key: 0x8a2928db10eb8fbe530a6c130f93d910fbd8b526f9522fad60340c3fe8ee6268
Balance HSK: ~0.094 HSK (testnet faucet)
```

---

## 7. Endpoints del Relayer

El relayer corre en `http://localhost:3001` (o servidor de producción).

### 7.1 Estado del Sistema

```bash
GET /api/status

# Response
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

### 7.2 Nonce de Usuario

```bash
GET /api/forwarder/nonce/:address

# Ejemplo
curl http://localhost:3001/api/forwarder/nonce/0x9E3EBaF039a45Ab325853d6fB289debbE280a31b

# Response
{ "nonce": 0 }
```

### 7.3 Meta-transacción Gasless (ERC-2771)

```bash
POST /api/relay/forward

# Body
{
  "forwardRequest": {
    "from": "0x...user address...",
    "to": "0x788952C55A04F32C4dC26dEd4858f5D6259f2F15",
    "value": "0",
    "gas": "100000",
    "nonce": 0,
    "deadline": 1730000000,
    "data": "0xa9059cbb000000000000000000000000...recipient...000000000000000000000000000000000000000000000000000000000bebc200"
  },
  "signature": "0x...EIP-712 signature..."
}

# Response
{
  "success": true,
  "txHash": "0x...transaction hash...",
  "gasUsed": "21000"
}
```

### 7.4 Depósito con EIP-3009

```bash
POST /api/relay/deposit-authorization

# Body
{
  "from": "0x...user...",
  "to": "0x...vault...",
  "value": "0",
  "gas": "100000",
  "nonce": 1,
  "deadline": 1730000000,
  "data": "0x...",
  "signature": "0x..."
}
```

### 7.5 Depósito con EIP-2612 (Permit)

```bash
POST /api/relay/deposit-permit

# Body
{
  "owner": "0x...user...",
  "spender": "0x...vault...",
  "value": "1000000",
  "deadline": 1730000000,
  "v": 27,
  "r": "0x...",
  "s": "0x..."
}
```

### 7.6 Liquidación Batch

```bash
POST /api/relay/settle-batch

# Body
{
  "merkleRoot": "0x...",
  "proofs": ["0x...", "0x..."],
  "values": ["1000000", "2000000"]
}
```

### 7.7 Balance USDC

```bash
GET /api/usdc/balance/:address

curl http://localhost:3001/api/usdc/balance/0x9E3EBaF039a45Ab325853d6fB289debbE280a31b

# Response
{ "balance": "1000000000", "decimals": 6 }
```

---

## 8. Comandos

### 8.1 Desarrollo Web

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Build producción
npm run build
```

### 8.2 Contratos (Deployment)

```bash
# Compilar contratos
node contracts/evm/compile.mjs

# Desplegar a HSK Testnet
node contracts/evm/deploy_hsk.cjs --network hskTestnet --private-key <KEY>

# Desplegar a HSK Mainnet (REQUIERE USDC REAL + HSK PARA GAS)
node contracts/evm/deploy_hsk.cjs --network hskMainnet --private-key <KEY>
```

### 8.3 Relayer

```bash
# Iniciar relayer (testnet)
RELAYER_PRIVATE_KEY=0x8a2928db... \
FORWARDER_ADDRESS=0xBFB5078c8afF57226F1f32de999dd0ADd559dcbC \
VAULT_ADDRESS=0x7e906F6C41660C218282fe4F5d7C76d8D8604d96 \
NETWORK=hskTestnet \
node server/hsk_relayer.js

# Verificar estado
curl http://localhost:3001/api/status
```

### 8.4 Android

```bash
# Build web
npm run build

# Sync con Android
npx cap sync android

# Generar APK
cd android
chmod +x gradlew
JAVA_HOME=/usr/lib/jvm/java-21 ./gradlew assembleDebug

# Instalar en dispositivo
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 8.5 Faucet HSK Testnet

```bash
# Obtener HSK de testnet
# Dirección: 0x9E3EBaF039a45Ab325853d6fB289debbE280a31b
# URL: https://faucet.hskchain.net/faucet
```

---

## 9. API Keys y Addresses

### 9.1 Contracts (HSK Testnet)

| Servicio | Address |
|----------|---------|
| PollarForwarder | `0xBFB5078c8afF57226F1f32de999dd0ADd559dcbC` |
| PollarVault | `0x7e906F6C41660C218282fe4F5d7C76d8D8604d96` |
| MockUSDC | `0x788952C55A04F32C4dC26dEd4858f5D6259f2F15` |

### 9.2 Relayer Wallet

| Campo | Valor |
|-------|-------|
| Address | `0x9E3EBaF039a45Ab325853d6fB289debbE280a31b` |
| Private Key | `[REDUCTED]` |
| Balance | ~0.094 HSK |

### 9.3 RPC Endpoints

| Red | URL |
|-----|-----|
| HSK Testnet | `https://testnet.hsk.xyz` |
| HSK Mainnet | `https://mainnet.hsk.xyz` |

### 9.4 Explorers

| Red | URL |
|-----|-----|
| HSK Testnet | `https://hashkeychain-testnet-explorer.alt.technology` |
| HSK Mainnet | `https://explorer.hsk.xyz` |

---

## 10. Flujo de Usuario

### 10.1 Pago Online (Gasless)

```
1. Usuario abre app → Auto-login con wallet demo
2. Usuario selecciona "Enviar USDC"
3. Usuario ingresa dirección destino y monto
4. App genera meta-transacción (EIP-712)
5. Usuario firma con su clave privada
6. App envía al relayer
7. Relayer ejecuta en chain (paga gas)
8. Tx confirmada → balances actualizados
```

### 10.2 Pago Offline

```
1. Usuario toggla a "Offline"
2. Usuario selecciona "Enviar USDC"
3. Transacción guardada en localStorage (pendingTx queue)
4. UI muestra "Guardado offline"
5. Usuario se reconecta
6. Usuario presiona "Sync Ahora"
7. Transacciones ejecutadas on-chain
```

### 10.3 Depósito al Vault

```
1. Usuario ingresa monto
2. App verifica allowance
3. Si allowance < monto → Approve (usuario paga gas)
4. App llama depositTokenVault
5. Si modo offline → guardado en cola
6. Balance del vault actualizado
```

---

## 11. Modelo de Datos

### 11.1 Wallet (localStorage)

```javascript
{
  address: "0x...",
  privateKey: "0x..."
}
```

### 11.2 Pending Transactions (localStorage)

```javascript
[
  {
    id: "1730000000-abc123",
    type: "SEND",  // SEND | RECEIVE
    to: "0x...",
    from: "0x...",
    amount: "100.00",
    synced: false,
    timestamp: 1730000000000
  }
]
```

### 11.3 Contract Returns

```javascript
// getTokenVault response
{
  token: "0x788952C55A04F32C4dC26dEd4858f5D6259f2F15",
  balance: "100000000",       // 100 USDC (6 decimales)
  totalDeposited: "500000000",
  totalWithdrawn: "400000000",
  merkleRoot: "0x...",
  lastUpdate: 1730000000
}
```

---

## 12. Paleta de Colores

| Variable | Hex | Uso |
|----------|-----|-----|
| `--hsl-bg` | `#0B0F14` | Background principal |
| `--hsl-surface` | `#131920` | Cards, surfaces |
| `--hsl-surface-2` | `#1A2230` | Surface elevada |
| `--hsl-border` | `#242E3E` | Bordes |
| `--hsl-text` | `#E2E8F0` | Texto principal |
| `--hsl-text-muted` | `#8B99AD` | Texto secundario |
| `--hsl-accent` | `#4A9FD4` | Acciones, links (azul platino) |
| `--hsl-positive` | `#34D399` | Ganancias, éxito (verde) |
| `--hsl-negative` | `#F87171` | Pérdidas, errores (rojo) |
| `--hsl-warning` | `#FBBF24` | Alertas (ámbar) |

---

## 13. Pendiente

- [ ] Conexión P2P real (Bluetooth/NFC/WiFi)
- [ ] iOS (Web Bluetooth/NFC no disponibles en Safari)
- [ ] Notificaciones push
- [ ] API real de Market/News
- [ ] Despliegue a HSK Mainnet
- [ ] Tests E2E

---

## 14. Links

- **Repo:** https://github.com/SebasMjz/NoConnectionNeeded
- **Rama:** `feature/***`
- **APK:** `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 15. Guion para Presentación ante Jurado

### 1. Descripción General de la Aplicación (60 segundos)

**¿Qué es Pollar?**
Pollar es una aplicación para teléfonos Android que permite enviar y recibir dinero digital (USDC, una stablecoin) entre personas, sin necesidad de tener internet en el momento de la transacción.

**Explicación paso a paso:**

- **Paso 1 — Instalación:** El usuario instala la app en su celular Android. Al abrirla, la app le crea automáticamente una cuenta de wallet (como una cuenta bancaria, pero en el celular). Se le dan 100 USDC de prueba para que pueda probar.

- **Paso 2 — Enviar dinero:** Si el usuario quiere pagarle a otra persona, selecciona cuánto quiere enviar, ingresa la dirección de la otra persona, y presiona "Enviar". Si tiene internet, la transacción sale inmediatamente. Si no tiene internet, la app guarda esa transacción localmente y la envía cuando se conecte.

- **Paso 3 — Recibir dinero:** Si alguien le quiere pagar al usuario, le comparte un código QR o lo envía por Bluetooth. El usuario lo importa en su app, confirma, y recibe el dinero.

- **Paso 4 — Sin costo de gas para el usuario:** En blockchain normal, cada transacción cuesta "gas" (una tarifa). En Pollar, el usuario NO paga gas. Hay un servidor llamado "relayer" que paga ese costo por ellos. El usuario solo firma digitalmente la transacción; el relayer la ejecuta en su nombre.

- **Resumen de una línea:** "Pollar es una billetera de pagos entre personas que funciona sin internet y sin que el usuario pague comisiones."

---

### 2. El Problema que Resuelve (20 segundos)

En Latinoamérica, aproximadamente 200 millones de personas no tienen acceso a servicios bancarios. Incluso quienes poseen un smartphone enfrentan dos barreras adicionales:

- **Sin conexión:** En subterráneos, zonas rurales, edificios con mala señal o aviones, no se pueden realizar pagos digitales.
- **Comisiones elevadas:** En Ethereum, cada transacción cuesta entre USD 20 y USD 100 en concepto de gas, lo cual hace inviable el envío de micropagos.

Pollar elimina ambas barreras.

---

### 3. La Solución Técnica (40 segundos)

Pollar resuelve esto mediante tres tecnologías:

1. **Pagos offline (cola de transacciones):** La app guarda las transacciones firmadas en el almacenamiento local del teléfono (localStorage). Cuando el usuario recupera conexión, la cola se sincroniza automáticamente con la blockchain.

2. **Meta-transacciones gasless (ERC-2771):** El usuario firma la transacción con su clave privada, pero no la envía él mismo a la red. Un componente denominado "relayer" la recibe y la ejecuta en representación del usuario, pagando el gas. El usuario no percibe que está interacting con blockchain.

3. **Transferencia P2P nativa:** La app soporta Bluetooth, NFC y códigos QR para transferir el payload de la transacción entre dispositivos sin necesidad de internet. El primer usuario que se conecte a la red ejecuta la transacción on-chain; el segundo, al reconectarse, solo valida que ya fue ejecutada (idempotencia mediante nonce).

---

### 4. Arquitectura y Stack Tecnológico (60 segundos — Demo)

La arquitectura se compone de tres capas:

**Frontend:** React + Vite, compilado a APK Android mediante Capacitor. Cada instalación genera una wallet EOAs (Externally Owned Account) con clave privada almacenada en el dispositivo. El estado de la aplicación se gestiona mediante React Context, incluyendo una cola de transacciones pendientes en localStorage.

**Backend (Relayer):** Servidor Node.js escuchando en puerto 3001. Expone endpoints REST para recibir meta-transacciones firmadas con EIP-712, ejecutarlas en HashKey Chain y retornar el txHash. El relayer posee una wallet con saldo HSK para pagar gas.

**Capa de contratos inteligentes (desplegados en HashKey Testnet, chainId 133):**
- **PollarForwarder** (`0xBFB5078c8afF57226F1f32de999dd0ADd559dcbC`): Implementa ERC-2771 para meta-transacciones gasless.
- **PollarVault** (`0x7e906F6C41660C218282fe4F5d7C76d8D8604d96`): Custodia depósitos de USDC de los usuarios.
- **MockUSDC** (`0x788952C55A04F32C4dC26dEd4858f5D6259f2F15`): Token de prueba en testnet (6 decimales).

**HashKey Chain** fue seleccionada por tres razones: regulación en Hong Kong (confianza institucional), compatibilidad total con EVM (misma experiencia de desarrollo que Ethereum), y fees de gas de aproximadamente USD 0.001 por transacción (vs. USD 0.01–1 en otras L2).

**Demo:**
- Abrir app → mostrar balance USDC.
- Toggle offline → indicador visual cambia.
- Enviar USD 10 offline → mensaje "guardado offline".
- Toggle online → presionar "Sync Ahora" → transacción confirmada en explorer.

---

### 5. Diferenciadores Competitivos (30 segundos)

Los cuatro diferenciadores de Pollar frente a wallets convencionales son:

1. **Funciona offline:** Ninguna wallet institucional (Metamask, Coinbase Wallet, Trust Wallet) soporta pagos offline.
2. **Gasless real:** El usuario no interactúa conscientemente con blockchain ni paga comisiones; la experiencia es equivalente a una app de mensajería con pagos.
3. **P2P nativo:** Bluetooth, NFC y QR permiten transferencia de valor sin infraestructura de red.
4. **HashKey Chain:** Exchange regulado en Hong Kong, compatible EVM, fees sub-centavo.

---

### 6. Estado Actual y Próximos Pasos (20 segundos)

El producto se encuentra desplegado en HashKey Testnet con tokens de prueba. El relayer corre en localhost:3001. La APK Android está compilada y lista para instalación.

Los próximos hitos son:
- Despliegue en HashKey Mainnet con USDC real.
- Conexión P2P real (Bluetooth/NFC) — actualmente mocked.
- Notificaciones push para confirmación de transacciones.
- Tests E2E automatizados.

Quedamos a disposición del jurado para preguntas.

---

### FAQ Preparadas

**P: ¿Qué impide que un usuario gaste dos veces los fondos mientras está offline?**
R: Cada transacción offline genera un idempotency key basado en timestamp + random. El contrato PollarForwarder valida el nonce del usuario; si el nonce ya fue utilizado, la transacción es rechazada.

**P: ¿Quién asume el costo del gas?**
R: El relayer. Este costo puede recuperarse mediante una fee pequeña cobrada al usuario, o absorberse como costo de adquisición de usuarios.

**P: ¿Qué ocurre si el relayer no está disponible?**
R: Las transacciones offline persisten en localStorage del dispositivo. Cuando el relayer vuelve a estar operativo, la cola se ejecuta automáticamente.

**P: ¿Por qué HashKey Chain y no Polygon, Arbitrum u Optimism?**
R: HashKey Group es el segundo exchange de criptomonedas más grande de Asia por volumen, regulado por la SFC de Hong Kong. Esto proporciona confianza institucional. Adicionalmente, los fees de gas en HashKey Chain rondan los USD 0.001, frente a USD 0.01–1 en las cadenas mencionadas.

---

## 16. Checklist para Demo

- [ ] App abierta mostrando balance USDC
- [ ] Toggle Online/Offline funcionando
- [ ] Enviar transacción offline → mensaje de guardado
- [ ] Sync manual → transacción confirmada en explorer
- [ ] Depositar en Vault → approval + deposit
- [ ] Retirar del Vault → withdrawal
- [ ] Explorer mostrando transacciones en tiempo real
- [ ] QR de transacción generado
- [ ] Relayer status (`curl http://localhost:3001/api/status`)

---

## 17. Contactos Técnicos

| Rol | Responsabilidad |
|-----|----------------|
| Frontend | UI, React, Capacitor Android |
| Backend | Relayer, Node.js, ethers.js |
| Smart Contracts | Solidity, deployment, security |
| DevOps | RPC, explorers, faucet |
