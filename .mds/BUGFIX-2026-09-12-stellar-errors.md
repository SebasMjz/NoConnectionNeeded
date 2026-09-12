# Bugfix: Stellar Testnet Payment Errors - 2026-09-12

## Errores reportados

```
1. horizon-testnet.stellar.org/accounts/[object%20Object]  400 Bad Request
2. stellarCrypto.js:8 Cannot read properties of undefined (reading 'digest')
3. horizon-testnet.stellar.org/accounts/GDFY4YXY...         404 Not Found
```

El error #2 (`crypto.subtle undefined`) era el que bloqueaba el flujo de pagos. El error #1 (`[object Object]`) ocurría al hacer click en botones de refresco de saldo.

---

## Causa raiz

### Error 1: `[object%20Object]` en URL de Horizon

**Archivo:** `WalletVault.jsx:98`, `LinkAccountModal.jsx:82`

```jsx
// ANTES (incorrecto) - React pasa el evento click como primer argumento
onClick={refreshOnlineBalance}

// La funcion recibe un SyntheticEvent en vez de un string de publicKey
const refreshOnlineBalance = async (targetPubKey = null) => {
    const pubKey = targetPubKey || deviceA.publicKey; // targetPubKey = [object Event]
```

### Error 2: `crypto.subtle` is undefined

**Archivo:** `stellarCrypto.js:8`, `pollarEngine.js:27`

`crypto.subtle` solo esta disponible en **contextos seguros** (HTTPS o localhost). El Vite config usa `host: '0.0.0.0'`, lo que significa que al acceder via IP de red (no localhost), el navegador no provee `crypto.subtle`.

---

## Cambios realizados

### 1. `src/components/WalletVault.jsx` linea 98

```diff
- onClick={refreshOnlineBalance}
+ onClick={() => refreshOnlineBalance()}
```

### 2. `src/components/LinkAccountModal.jsx` linea 82

```diff
- onClick={refreshOnlineBalance}
+ onClick={() => refreshOnlineBalance()}
```

### 3. `src/services/stellarCrypto.js` lineas 4-68

Se agrego una implementacion pura en JavaScript de SHA-256 (`sha256Pure`) como fallback cuando `crypto.subtle` no esta disponible.

```javascript
const hasCryptoSubtle = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';

export async function sha256Hex(dataString) {
  if (hasCryptoSubtle) {
    // Usa WebCrypto nativo (rapido)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return buf2hex(hashBuffer);
  }
  // Fallback: SHA-256 puro en JS (funciona en cualquier contexto)
  return sha256Pure(dataString);
}
```

### 4. `src/services/pollarEngine.js` lineas 23-85

Mismo fallback SHA-256 puro en JS aplicado a este archivo, ya que tambien usa `crypto.subtle.digest` directamente.

---

## Resultado esperado

- **Simulacion de pago P2P:** Deberia funcionar correctamente. El `buildRealMerkleTree` ahora puede calcular hashes SHA-256 sin `crypto.subtle`.
- **Errores en consola:** El error `Cannot read properties of undefined (reading 'digest')` ya no deberia aparecer.
- **Cuentas Horizon:** El error 404 de cuentas sin fondear es normal (se resuelve con Friendbot al hacer la transaccion real en testnet).
- **`[object Object]` en URLs:** Ya no ocurrira porque los onClick ahora pasan argumentos correctos.
