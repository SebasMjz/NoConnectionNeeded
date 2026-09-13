# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: debug-blank.spec.js >> PRESET LOGIN: clicking Pagador quick access should show main UI, not blank
- Location: tests/e2e/debug-blank.spec.js:18:1

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 2
Received array:  ["Failed to load resource: the server responded with a status of 404 (Not Found)", "Failed to load resource: the server responded with a status of 404 (Not Found)"]
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - generic [ref=f1e5]:
      - img "Pollar" [ref=f1e8]
      - generic [ref=f1e9]:
        - generic [ref=f1e10]:
          - generic [ref=f1e11]: Hola,
          - generic [ref=f1e12]: Pagador Demo
        - generic [ref=f1e13]:
          - generic [ref=f1e14]: pollar pay
          - generic [ref=f1e15]: TESTNET
    - generic [ref=f1e16]:
      - button "Online" [ref=f1e17] [cursor=pointer]
      - button "Configuración y Perfil" [ref=f1e23] [cursor=pointer]
  - generic [ref=f1e28]:
    - button "Pagador (A)" [ref=f1e29] [cursor=pointer]
    - button "Comercio POS (B)" [ref=f1e32] [cursor=pointer]
  - main [ref=f1e36]:
    - generic [ref=f1e37]:
      - generic [ref=f1e38]:
        - generic [ref=f1e39]:
          - generic [ref=f1e40]: Billetera Principal
          - button "Actualizar saldo" [ref=f1e41] [cursor=pointer]
        - generic [ref=f1e47]:
          - generic [ref=f1e48]: Saldo Total
          - generic [ref=f1e49]:
            - generic [ref=f1e50]: $100.00
            - generic [ref=f1e51]: USDT
          - generic [ref=f1e52]:
            - generic [ref=f1e53]:
              - text: "Libre:"
              - strong [ref=f1e54]: "90.00"
            - generic [ref=f1e55]: •
            - generic [ref=f1e56]:
              - text: "Bóveda Offline:"
              - strong [ref=f1e57]: "10.00"
        - generic [ref=f1e58] [cursor=pointer]: GBHOVTZJ7SDN56BH74QLXYFV42KWVREOSMMN2ZGS4GMJNWKTARJ5BHQW
        - generic [ref=f1e63]:
          - button "Pagar" [ref=f1e64] [cursor=pointer]
          - button "Cobrar" [ref=f1e70] [cursor=pointer]
          - button "Bóveda" [ref=f1e76] [cursor=pointer]
          - button "+10k XLM" [ref=f1e82] [cursor=pointer]
      - generic [ref=f1e88]:
        - heading "Transferencias Rápidas" [level=3] [ref=f1e89]
        - generic [ref=f1e90]:
          - button "Vincular" [ref=f1e91] [cursor=pointer]
          - button "POS Comercio B" [ref=f1e95] [cursor=pointer]:
            - generic [ref=f1e96]: POS
            - generic [ref=f1e97]: Comercio B
          - button "P-A Pagador A" [ref=f1e98] [cursor=pointer]:
            - generic [ref=f1e99]: P-A
            - generic [ref=f1e100]: Pagador A
          - button "⚡ Friendbot" [ref=f1e101] [cursor=pointer]:
            - generic [ref=f1e102]: ⚡
            - generic [ref=f1e103]: Friendbot
      - generic [ref=f1e104]:
        - generic [ref=f1e105]:
          - heading "Últimas Transacciones" [level=3] [ref=f1e106]
          - button "Ver todas (0)" [ref=f1e107] [cursor=pointer]
        - generic [ref=f1e108]:
          - paragraph [ref=f1e114]: Sin movimientos aún
          - paragraph [ref=f1e115]: Toca en Pagar para realizar tu primera transacción
  - navigation:
    - generic [ref=f1e117]:
      - button "Bóveda" [ref=f1e118] [cursor=pointer]
      - button "Transferir" [ref=f1e124] [cursor=pointer]
      - button "Sincronizar" [ref=f1e130] [cursor=pointer]
      - button "Simulador" [ref=f1e138] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | async function clearAppState(page) {
  4  |   await page.goto('/');
  5  |   await page.waitForLoadState('domcontentloaded');
  6  |   await page.evaluate(() => {
  7  |     localStorage.removeItem('pollar_auth_user');
  8  |     localStorage.removeItem('pollar_offline_wallet_v2_real');
  9  |     localStorage.removeItem('pollar_settings');
  10 |     localStorage.removeItem('pollar_wallets');
  11 |     localStorage.removeItem('pollar_biometric_creds');
  12 |     localStorage.removeItem('pollar_users');
  13 |   });
  14 |   await page.reload();
  15 |   await page.waitForLoadState('domcontentloaded');
  16 | }
  17 | 
  18 | test('PRESET LOGIN: clicking Pagador quick access should show main UI, not blank', async ({ page }) => {
  19 |   await clearAppState(page);
  20 | 
  21 |   // Capture console errors
  22 |   const errors = [];
  23 |   page.on('console', msg => {
  24 |     if (msg.type() === 'error') errors.push(msg.text());
  25 |   });
  26 |   page.on('pageerror', err => errors.push(err.message));
  27 | 
  28 |   // Verify AuthGateway visible
  29 |   await expect(page.locator('text=Iniciar sesión').first()).toBeVisible({ timeout: 5000 });
  30 | 
  31 |   // Click "Pagador" quick access button
  32 |   await page.getByRole('button', { name: /Pagador/i }).click();
  33 | 
  34 |   // Wait a bit for any errors to occur
  35 |   await page.waitForTimeout(2000);
  36 | 
  37 |   // Should show main app content (not blank)
  38 |   const rootContent = await page.locator('#root').innerHTML();
  39 |   console.log('Root content length:', rootContent.length);
  40 |   console.log('Errors:', errors);
  41 | 
  42 |   // If UI works, we should see "Bóveda" tab or user name
  43 |   const hasContent = await page.locator('text=Bóveda').or(page.locator('text=Pagador Demo')).count();
  44 |   console.log('Has visible content:', hasContent);
  45 | 
> 46 |   expect(errors).toHaveLength(0);
     |                  ^ Error: expect(received).toHaveLength(expected)
  47 |   expect(hasContent).toBeGreaterThan(0);
  48 | });
  49 | 
```