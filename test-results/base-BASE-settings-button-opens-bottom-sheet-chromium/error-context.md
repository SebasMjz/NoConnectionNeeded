# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: base.spec.js >> BASE: settings button opens bottom sheet
- Location: tests/e2e/base.spec.js:83:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[title="Configuración y Perfil"]')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('[title="Configuración y Perfil"]') with timeout 10000ms
  - waiting for locator('[title="Configuración y Perfil"]')

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // ─── Helper: clear all localStorage state ───────────────────────────────
  4   | async function clearAppState(page) {
  5   |   await page.goto('/');
  6   |   await page.waitForLoadState('domcontentloaded');
  7   |   await page.evaluate(() => {
  8   |     localStorage.removeItem('pollar_auth_user');
  9   |     localStorage.removeItem('pollar_offline_wallet_v2_real');
  10  |     localStorage.removeItem('pollar_settings');
  11  |     localStorage.removeItem('pollar_wallets');
  12  |     localStorage.removeItem('pollar_biometric_creds');
  13  |   });
  14  |   await page.reload();
  15  |   await page.waitForLoadState('domcontentloaded');
  16  | }
  17  | 
  18  | // ─── BASE TEST: app loads and AuthGateway renders ───────────────────────
  19  | test('BASE: app loads, shows AuthGateway, no console errors', async ({ page }) => {
  20  |   const errors = [];
  21  |   page.on('console', msg => {
  22  |     if (msg.type() === 'error') errors.push(msg.text());
  23  |   });
  24  |   page.on('pageerror', err => errors.push(err.message));
  25  | 
  26  |   await clearAppState(page);
  27  | 
  28  |   // Auth Gateway should be visible (first() because "Iniciar sesión" appears 3x: label, tab, submit btn)
  29  |   await expect(page.locator('text=Iniciar sesión').first()).toBeVisible();
  30  |   await expect(page.locator('input[type="email"]')).toBeVisible();
  31  |   await expect(page.locator('button').filter({ hasText: /Iniciar Sesión/ }).first()).toBeVisible();
  32  | 
  33  |   // Social buttons visible
  34  |   await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
  35  |   await expect(page.locator('text=Continuar con una billetera')).toBeVisible();
  36  | 
  37  |   // Quick access preset chips
  38  |   await expect(page.getByRole('button', { name: /Pagador/i })).toBeVisible();
  39  |   await expect(page.getByRole('button', { name: /Comercio POS/i })).toBeVisible();
  40  | 
  41  |   // No console errors (filter known warnings and expected network 404s in dev)
  42  |   const realErrors = errors.filter(e =>
  43  |     !e.includes('Confetti') &&
  44  |     !e.includes('canvas-confetti') &&
  45  |     !e.includes('Warning:') &&
  46  |     !e.includes('Failed to load resource') &&
  47  |     !e.includes('404')
  48  |   );
  49  |   expect(realErrors).toHaveLength(0);
  50  | });
  51  | 
  52  | // ─── BASE TEST: preset login Pagador bypasses auth, shows main UI ───────
  53  | test('BASE: preset login Pagador bypasses auth, shows main UI', async ({ page }) => {
  54  |   await clearAppState(page);
  55  | 
  56  |   await page.getByRole('button', { name: /Pagador/i }).click();
  57  | 
  58  |   // Should now be in main app (no more AuthGateway)
  59  |   await expect(page.locator('text=Iniciar sesión o registrarse')).not.toBeVisible();
  60  |   await expect(page.locator('text=Bóveda').first()).toBeVisible();
  61  |   await expect(page.locator('text=pollar pay')).toBeVisible();
  62  | 
  63  |   // Bottom nav present
  64  |   await expect(page.locator('text=Bóveda').first()).toBeVisible();
  65  |   await expect(page.locator('text=Transferir')).toBeVisible();
  66  |   await expect(page.locator('text=Sincronizar')).toBeVisible();
  67  | 
  68  |   // Balance card visible
  69  |   await expect(page.locator('text=Billetera Principal')).toBeVisible();
  70  | });
  71  | 
  72  | // ─── BASE TEST: preset login Comercio works ─────────────────────────────
  73  | test('BASE: preset login Comercio POS switches role', async ({ page }) => {
  74  |   await clearAppState(page);
  75  | 
  76  |   await page.getByRole('button', { name: /Comercio POS/i }).click();
  77  | 
  78  |   await expect(page.locator('text=Terminal POS Comercio')).toBeVisible();
  79  |   await expect(page.locator('text=Cobros Offline')).toBeVisible();
  80  | });
  81  | 
  82  | // ─── BASE TEST: top header settings button opens sheet ──────────────────
  83  | test('BASE: settings button opens bottom sheet', async ({ page }) => {
  84  |   await clearAppState(page);
  85  |   await page.getByRole('button', { name: /Pagador/i }).click();
  86  | 
  87  |   // Open settings
  88  |   const settingsBtn = page.locator('[title="Configuración y Perfil"]');
> 89  |   await expect(settingsBtn).toBeVisible();
      |                             ^ Error: expect(locator).toBeVisible() failed
  90  |   await settingsBtn.click();
  91  | 
  92  |   // Bottom sheet should show user info + actions
  93  |   await expect(page.locator('text=Seguridad')).toBeVisible();
  94  |   await expect(page.locator('text=Usar biometría')).toBeVisible();
  95  |   await expect(page.getByText('Billeteras', { exact: true })).toBeVisible();
  96  |   await expect(page.locator('text=Cerrar sesión')).toBeVisible();
  97  | });
  98  | 
  99  | // ─── BASE TEST: logout returns to AuthGateway ───────────────────────────
  100 | test('BASE: logout returns to AuthGateway', async ({ page }) => {
  101 |   await clearAppState(page);
  102 |   await page.getByRole('button', { name: /Pagador/i }).click();
  103 | 
  104 |   const settingsBtn = page.locator('[title="Configuración y Perfil"]');
  105 |   await settingsBtn.click();
  106 |   await page.locator('text=Cerrar sesión').click();
  107 | 
  108 |   await expect(page.locator('text=Iniciar sesión').first()).toBeVisible();
  109 | });
  110 | 
  111 | // ─── BASE TEST: navigation tabs work ───────────────────────────────────
  112 | test('BASE: all tabs navigate without errors', async ({ page }) => {
  113 |   await clearAppState(page);
  114 |   await page.getByRole('button', { name: /Pagador/i }).click();
  115 | 
  116 |   // Vault tab
  117 |   await expect(page.locator('text=Billetera Principal')).toBeVisible();
  118 | 
  119 |   // Transferir tab
  120 |   await page.locator('text=Transferir').click();
  121 |   await expect(page.locator('text=Enviar Pago')).toBeVisible();
  122 |   await expect(page.locator('text=Terminal Cobrar')).toBeVisible();
  123 | 
  124 |   // Sincronizar tab
  125 |   await page.locator('text=Sincronizar').click();
  126 |   await expect(page.locator('text=Sincronizador de Lote')).toBeVisible();
  127 |   await expect(page.locator('text=Pendientes')).toBeVisible();
  128 | 
  129 |   // Simulador tab
  130 |   await page.locator('text=Simulador').click();
  131 |   await expect(page.locator('text=Simulador Bilateral P2P')).toBeVisible();
  132 | });
  133 | 
  134 | // ─── BASE TEST: role switcher changes active device ─────────────────────
  135 | test('BASE: role switcher toggles between Pagador and Comercio', async ({ page }) => {
  136 |   await clearAppState(page);
  137 |   await page.getByRole('button', { name: /Pagador/i }).click();
  138 | 
  139 |   // Should start as Pagador
  140 |   await expect(page.locator('text=Billetera Principal')).toBeVisible();
  141 | 
  142 |   // Switch to Comercio
  143 |   await page.getByRole('button', { name: /Comercio POS/i }).click();
  144 |   await expect(page.locator('text=Terminal POS Comercio')).toBeVisible();
  145 |   await expect(page.locator('text=Cobros Offline')).toBeVisible();
  146 | 
  147 |   // Switch back to Pagador
  148 |   await page.getByRole('button', { name: /Pagador \(A\)/i }).click();
  149 |   await expect(page.locator('text=Billetera Principal')).toBeVisible();
  150 | });
  151 | 
  152 | // ─── BASE TEST: P2P payment flow (QR mock) ─────────────────────────────
  153 | test('BASE: P2P payment terminal generates payment QR without errors', async ({ page }) => {
  154 |   await clearAppState(page);
  155 |   await page.getByRole('button', { name: /Pagador/i }).click();
  156 | 
  157 |   // Go to Transferir tab
  158 |   await page.locator('text=Transferir').click();
  159 | 
  160 |   // Form should be visible
  161 |   await expect(page.locator('input[placeholder="G..."]')).toBeVisible();
  162 |   await expect(page.locator('text=Bóveda:')).toBeVisible();
  163 | 
  164 |   // Find pay button and click
  165 |   const payBtn = page.locator('button:has-text("Firmar y Generar QR")');
  166 |   await expect(payBtn).toBeVisible();
  167 |   await payBtn.click();
  168 | 
  169 |   // Should show success message and QR
  170 |   await expect(page.locator('text=Pago firmado')).toBeVisible({ timeout: 5000 });
  171 | });
  172 | 
  173 | // ─── BASE TEST: offline vault allocation ───────────────────────────────
  174 | test('BASE: can open vault allocation panel', async ({ page }) => {
  175 |   await clearAppState(page);
  176 |   await page.getByRole('button', { name: /Pagador/i }).click();
  177 | 
  178 |   // Vault panel should show balance
  179 |   await expect(page.locator('text=Billetera Principal')).toBeVisible();
  180 | 
  181 |   // Tap Bóveda button in the balance card actions
  182 |   const vaultBtn = page.locator('button:has-text("Bóveda")').first();
  183 |   await expect(vaultBtn).toBeVisible();
  184 |   await vaultBtn.click();
  185 |   await page.waitForTimeout(300);
  186 | 
  187 |   // Allocation panel should appear
  188 |   await expect(page.locator('text=Bloquear a Bóveda')).toBeVisible();
  189 | });
```