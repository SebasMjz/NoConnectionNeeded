import { test, expect } from '@playwright/test';

// ─── Helper: clear all localStorage state ───────────────────────────────
async function clearAppState(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    localStorage.removeItem('pollar_auth_user');
    localStorage.removeItem('pollar_offline_wallet_v2_real');
    localStorage.removeItem('pollar_settings');
    localStorage.removeItem('pollar_wallets');
    localStorage.removeItem('pollar_biometric_creds');
    localStorage.removeItem('pollar_role');
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

// ─── BASE TEST: app loads and AuthGateway renders ───────────────────────
test('BASE: app loads, shows AuthGateway, no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await clearAppState(page);

  // Auth Gateway should be visible
  await expect(page.locator('text=Iniciar sesión').first()).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('button').filter({ hasText: /Iniciar Sesión/ }).first()).toBeVisible();

  // Social buttons visible
  await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
  await expect(page.locator('text=Continuar con una billetera')).toBeVisible();

  // Quick access preset chips
  await expect(page.getByRole('button', { name: /⚡ Pagador/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /🏪 Comercio POS/i })).toBeVisible();

  // No console errors (filter known warnings and expected network 404s in dev)
  const realErrors = errors.filter(e =>
    !e.includes('Confetti') &&
    !e.includes('canvas-confetti') &&
    !e.includes('Warning:') &&
    !e.includes('Failed to load resource') &&
    !e.includes('404')
  );
  expect(realErrors).toHaveLength(0);
});

// ─── BASE TEST: preset login Pagador bypasses auth, shows main UI ───────
test('BASE: preset login Pagador bypasses auth, shows main UI', async ({ page }) => {
  await clearAppState(page);

  await page.getByRole('button', { name: /⚡ Pagador/i }).click();

  // Should now be in main app
  await expect(page.locator('text=Iniciar sesión').first()).not.toBeVisible({ timeout: 3000 });
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=PAGADOR').first()).toBeVisible();

  // Bottom nav present
  await expect(page.locator('text=Bóveda').first()).toBeVisible();
  await expect(page.getByRole('navigation').getByText('Pagar')).toBeVisible();
  await expect(page.locator('text=Sincronizar')).toBeVisible();
});

// ─── BASE TEST: preset login Comercio works ─────────────────────────────
test('BASE: preset login Comercio POS switches role', async ({ page }) => {
  await clearAppState(page);

  await page.getByRole('button', { name: /🏪 Comercio POS/i }).click();

  await expect(page.locator('text=COMERCIO').first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('navigation').getByText('Cobrar')).toBeVisible();
  await expect(page.locator('text=Sincronizar')).toBeVisible();
});

// ─── BASE TEST: top header settings button opens sheet ──────────────────
test('BASE: settings button opens bottom sheet', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();

  // Open settings
  const settingsBtn = page.locator('[title="Configuración y Perfil"]');
  await expect(settingsBtn).toBeVisible();
  await settingsBtn.click();

  // Bottom sheet should show user info + actions
  await expect(page.locator('text=Seguridad')).toBeVisible();
  await expect(page.locator('text=Usar biometría')).toBeVisible();
  await expect(page.getByText('Billeteras', { exact: true })).toBeVisible();
  await expect(page.locator('text=Cerrar sesión')).toBeVisible();
});

// ─── BASE TEST: logout returns to AuthGateway ───────────────────────────
test('BASE: logout returns to AuthGateway', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();

  const settingsBtn = page.locator('[title="Configuración y Perfil"]');
  await settingsBtn.click();
  await page.locator('text=Cerrar sesión').click();

  await expect(page.locator('text=Iniciar sesión').first()).toBeVisible();
});

// ─── BASE TEST: navigation tabs work ───────────────────────────────────
test('BASE: all tabs navigate without errors', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /⚡ Pagador/i }).click();

  // Vault tab
  await expect(page.locator('text=Saldo Total')).toBeVisible({ timeout: 5000 });

  // Pagar tab
  await page.getByRole('navigation').getByText('Pagar').click();
  await expect(page.locator('text=Firmar y Generar QR')).toBeVisible();

  // Sincronizar tab
  await page.locator('text=Sincronizar').click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Sincronizar').first()).toBeVisible();

  // Simulador tab
  await page.locator('text=Simulador').click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Simulador').first()).toBeVisible();
});

// ─── BASE TEST: role switcher changes active device ─────────────────────
test('BASE: role switcher toggles between Pagador and Comercio', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /⚡ Pagador/i }).click();

  // Should start as Pagador
  await expect(page.locator('text=PAGADOR').first()).toBeVisible({ timeout: 5000 });

  // Switch to Comercio via role switcher
  await page.getByRole('button', { name: /Comercio \(B\)/i }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=COMERCIO').first()).toBeVisible();

  // Switch back to Pagador
  await page.getByRole('button', { name: /Pagador \(A\)/i }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=PAGADOR').first()).toBeVisible();
});

// ─── BASE TEST: P2P payment flow (QR) ──────────────────────────────────
test('BASE: P2P payment terminal generates payment QR without errors', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /⚡ Pagador/i }).click();

  // Go to Pagar tab
  await page.getByRole('navigation').getByText('Pagar').click();

  // Form should be visible
  await expect(page.locator('input[placeholder="G..."]')).toBeVisible();

  // Find pay button and click
  const payBtn = page.locator('button:has-text("Firmar y Generar QR")');
  await expect(payBtn).toBeVisible();
  await payBtn.click();

  // Should show success message
  await expect(page.locator('text=Pago Criptográfico Firmado')).toBeVisible({ timeout: 5000 });
});

// ─── BASE TEST: offline vault allocation ───────────────────────────────
test('BASE: can open vault allocation panel', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /⚡ Pagador/i }).click();

  // Vault panel should show balance
  await expect(page.locator('text=Saldo Total')).toBeVisible({ timeout: 5000 });

  // Tap Bóveda button in the balance card actions
  const vaultBtn = page.locator('button:has-text("Bóveda")').first();
  await expect(vaultBtn).toBeVisible();
  await vaultBtn.click();
  await page.waitForTimeout(300);

  // Allocation panel should appear
  await expect(page.locator('text=Bloquear en Bóveda')).toBeVisible();
});

// ─── BASE TEST: settings user profile shows ─────────────────────────────
test('BASE: settings sheet shows user info', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();

  const settingsBtn = page.locator('[title="Configuración y Perfil"]');
  await settingsBtn.click();

  // Should show the demo user email
  await expect(page.locator('text=pollar.io')).toBeVisible({ timeout: 3000 });
});
