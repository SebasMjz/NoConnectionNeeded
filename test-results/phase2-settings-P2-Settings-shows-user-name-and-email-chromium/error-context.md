# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase2-settings.spec.js >> P2: Settings shows user name and email
- Location: tests/e2e/phase2-settings.spec.js:31:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=pollar pay')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=pollar pay') with timeout 10000ms
  - waiting for locator('text=pollar pay')

```

```yaml
- banner:
  - img "Pollar"
  - text: Hola, Pagador Demo PAGADOR (A)
  - button "Online"
  - button "Configuración y Perfil"
- button "Pagador (A)"
- button "Comercio (B)"
- main:
  - text: Billetera Pagador
  - button "Actualizar saldo"
  - text: "Saldo Total $100.00 USDT Bóveda Offline:"
  - strong: "10.00"
  - text: "• Recibido:"
  - strong: "0.00"
  - text: GBANFPOAM2NZLDSSD7RTYNLXZ6N5NZL7AWFOKHOOHFM4MZ5WC3PZDR6Y
  - button "Pagar"
  - button "Bóveda"
  - button "+10k XLM"
  - button "Vincular"
- navigation:
  - button "Bóveda"
  - button "Pagar"
  - button "Sincronizar"
  - button "Simulador"
- paragraph: Cuenta
- text: P
- paragraph: Pagador Demo
- paragraph: demo.pagador@pollar.io
- text: preset
- paragraph: Seguridad
- text: Usar biometría No disponible en este dispositivo
- button [disabled]
- paragraph: Billeteras
- button "Gestionar billeteras Crear, importar o editar wallets personales"
- button "Cerrar sesión"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | async function clearAppState(page) {
  4   |   await page.goto('/');
  5   |   await page.waitForLoadState('domcontentloaded');
  6   |   await page.evaluate(() => {
  7   |     localStorage.removeItem('pollar_auth_user');
  8   |     localStorage.removeItem('pollar_offline_wallet_v2_real');
  9   |     localStorage.removeItem('pollar_settings');
  10  |     localStorage.removeItem('pollar_wallets');
  11  |     localStorage.removeItem('pollar_biometric_creds');
  12  |     localStorage.removeItem('pollar_users');
  13  |   });
  14  |   await page.reload();
  15  |   await page.waitForLoadState('domcontentloaded');
  16  | }
  17  | 
  18  | // ─── PHASE 2 TESTS ────────────────────────────────────────────────────────
  19  | 
  20  | test('P2: Settings opens from header gear icon', async ({ page }) => {
  21  |   await clearAppState(page);
  22  |   // Login with preset
  23  |   await page.getByRole('button', { name: /Pagador/i }).click();
  24  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  25  | 
  26  |   // Open settings
  27  |   await page.locator('[title="Configuración y Perfil"]').click();
  28  |   await expect(page.locator('text=Usar biometría')).toBeVisible({ timeout: 5000 });
  29  | });
  30  | 
  31  | test('P2: Settings shows user name and email', async ({ page }) => {
  32  |   await clearAppState(page);
  33  |   await page.getByRole('button', { name: /Pagador/i }).click();
  34  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  35  | 
  36  |   await page.locator('[title="Configuración y Perfil"]').click();
  37  |   await expect(page.locator('text=Cuenta')).toBeVisible({ timeout: 3000 });
  38  |   // Should show preset user info
> 39  |   await expect(page.locator('text=pollar pay')).toBeVisible();
      |                                                 ^ Error: expect(locator).toBeVisible() failed
  40  | });
  41  | 
  42  | test('P2: Settings has biometric toggle row', async ({ page }) => {
  43  |   await clearAppState(page);
  44  |   await page.getByRole('button', { name: /Pagador/i }).click();
  45  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  46  | 
  47  |   await page.locator('[title="Configuración y Perfil"]').click();
  48  |   await expect(page.locator('text=Seguridad')).toBeVisible({ timeout: 3000 });
  49  |   await expect(page.locator('text=Usar biometría')).toBeVisible();
  50  | });
  51  | 
  52  | test('P2: Biometric toggle row has a toggle switch button', async ({ page }) => {
  53  |   await clearAppState(page);
  54  |   await page.getByRole('button', { name: /Pagador/i }).click();
  55  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  56  | 
  57  |   await page.locator('[title="Configuración y Perfil"]').click();
  58  |   // Toggle switch is a button (48x28px)
  59  |   const toggleBtn = page.locator('button').filter({ hasText: '' }).nth(1);
  60  |   // Should find a button that looks like a toggle (in the biometric row)
  61  |   await expect(page.locator('text=Usar biometría')).toBeVisible();
  62  |   // The toggle should be a button with a round div inside
  63  |   await expect(page.locator('button').filter({ has: page.locator('div') }).nth(0)).toBeVisible();
  64  | });
  65  | 
  66  | test('P2: Clicking biometric toggle saves setting to localStorage', async ({ page }) => {
  67  |   await clearAppState(page);
  68  |   await page.getByRole('button', { name: /Pagador/i }).click();
  69  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  70  | 
  71  |   await page.locator('[title="Configuración y Perfil"]').click();
  72  |   await page.waitForTimeout(500);
  73  | 
  74  |   // Toggle the biometric switch (the toggle button inside the biometric row)
  75  |   // Find the toggle button: it's a button containing a div (the knob)
  76  |   await page.locator('text=Usar biometría').waitFor({ state: 'visible' });
  77  |   await expect(page.locator('text=Usar biometría')).toBeVisible();
  78  |   // Verify the biometric toggle row is present in the settings
  79  |   // The toggle button should exist and be clickable (in headless Chromium it may be disabled due to no WebAuthn)
  80  |   // Settings should start with biometricEnabled: false
  81  |   const settingsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('pollar_settings') || '{"biometricEnabled": false}'));
  82  |   // Either not set yet (undefined) or explicitly false
  83  |   expect(settingsBefore.biometricEnabled === false || settingsBefore.biometricEnabled === undefined).toBe(true);
  84  | });
  85  | 
  86  | test('P2: Settings has "Gestionar billeteras" row that navigates to WalletRegistry', async ({ page }) => {
  87  |   await clearAppState(page);
  88  |   await page.getByRole('button', { name: /Pagador/i }).click();
  89  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  90  | 
  91  |   await page.locator('[title="Configuración y Perfil"]').click();
  92  |   await expect(page.getByText('Billeteras', { exact: true })).toBeVisible({ timeout: 3000 });
  93  |   await expect(page.locator('text=Gestionar billeteras')).toBeVisible();
  94  | 
  95  |   // Click to navigate to wallet registry
  96  |   await page.locator('text=Gestionar billeteras').click();
  97  |   await page.waitForTimeout(500);
  98  | 
  99  |   // Should show wallet registry content
  100 |   await expect(page.locator('text=Sin billeteras registradas').first()).toBeVisible({ timeout: 3000 });
  101 | });
  102 | 
  103 | test('P2: Logout from settings returns to AuthGateway', async ({ page }) => {
  104 |   await clearAppState(page);
  105 |   await page.getByRole('button', { name: /Pagador/i }).click();
  106 |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  107 | 
  108 |   await page.locator('[title="Configuración y Perfil"]').click();
  109 |   await expect(page.locator('text=Seguridad')).toBeVisible({ timeout: 3000 });
  110 | 
  111 |   // Click logout button
  112 |   await page.locator('text=Cerrar sesión').click();
  113 |   await page.waitForTimeout(300);
  114 | 
  115 |   // Should be back at AuthGateway
  116 |   await expect(page.locator('text=Iniciar sesión').first()).toBeVisible({ timeout: 5000 });
  117 | });
  118 | 
```