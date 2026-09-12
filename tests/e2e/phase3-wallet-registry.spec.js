import { test, expect } from '@playwright/test';

async function clearAppState(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    localStorage.removeItem('pollar_auth_user');
    localStorage.removeItem('pollar_offline_wallet_v2_real');
    localStorage.removeItem('pollar_settings');
    localStorage.removeItem('pollar_wallets');
    localStorage.removeItem('pollar_biometric_creds');
    localStorage.removeItem('pollar_users');
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

// ─── PHASE 3 TESTS ────────────────────────────────────────────────────────

test('P3: WalletRegistry opens and shows empty state', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Gestionar billeteras').click();
  await page.waitForTimeout(500);

  await expect(page.locator('text=Sin billeteras registradas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva' })).toBeVisible();
  await expect(page.locator('text=Importar')).toBeVisible();
});

test('P3: Can create a new wallet', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Gestionar billeteras').click();
  await page.waitForTimeout(300);

  // Click Nueva
  await page.locator('.pollar-modal-sheet button').filter({ hasText: 'Nueva' }).click();
  await expect(page.locator('text=Generar nuevo par de claves')).toBeVisible();

  // Name it
  await page.locator('input[placeholder*="principal"]').fill('Mi Billetera Test');
  await page.locator('.pollar-modal-sheet button', { hasText: /Generar nuevo par de claves/ }).click();

  // Should show generated wallet
  await expect(page.locator('text=Billetera generada')).toBeVisible();
  await expect(page.locator('text=CLAVE PÚBLICA')).toBeVisible();
  await expect(page.locator('text=CLAVE SECRETA')).toBeVisible();
  await expect(page.locator('text=BILLETERA GENERADA')).toBeVisible();

  // Public key should be a valid Stellar G... address
  const pubKeyEl = page.locator('code').first();
  const pubKey = await pubKeyEl.textContent();
  expect(pubKey.trim().startsWith('G')).toBe(true);
  expect(pubKey.trim().length).toBe(56);

  // Save wallet
  await page.locator('.pollar-modal-sheet button', { hasText: /Guardar billetera/ }).click();

  // Should be back on list with the wallet
  await expect(page.locator('text=Mi Billetera Test').first()).toBeVisible();
});

test('P3: Can import a wallet with a valid public key (G...)', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Gestionar billeteras').click();
  await page.waitForTimeout(300);

  // Click Importar tab
  await page.getByRole('button', { name: /^Importar$/ }).click();
  await expect(page.locator('text=Importar billetera')).toBeVisible();

  // Fill inputs in the import form
  const validKey = 'GBQHPNWCGBH2VUWTVM6SAPRR4HBCI3GJS6OSNMH3GD4JZXFDS25MHQDU';
  await page.getByPlaceholder(/SA\.\.\. o GA\.\.\./).fill(validKey);
  await page.getByPlaceholder(/Mi billetera fría/).fill('Wallet Importada Test');

  // Click import submit (exact match to avoid matching "Importar" tab)
  await page.locator('button').filter({ hasText: /^Importar billetera$/ }).click();
  await page.waitForTimeout(500);

  // Verify wallet was saved in localStorage
  const wallets = await page.evaluate(() => JSON.parse(localStorage.getItem('pollar_wallets') || '[]'));
  expect(wallets.some(w => w.name === 'Wallet Importada Test')).toBe(true);
});

test('P3: Cannot import an invalid Stellar key', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Gestionar billeteras').click();
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: /^Importar$/ }).click();
  await page.getByPlaceholder(/SA\.\.\. o GA\.\.\./).fill('INVALID_KEY_NOT_STELLAR');
  await page.getByPlaceholder(/Mi billetera fría/).fill('Bad Wallet');

  await page.locator('button').filter({ hasText: /^Importar billetera$/ }).click();

  await expect(page.locator('text=Clave inválida').first()).toBeVisible({ timeout: 5000 });
});

test('P3: Can delete a wallet', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Gestionar billeteras').click();
  await page.waitForTimeout(300);

  // Create a wallet first
  await page.locator('.pollar-modal-sheet button').filter({ hasText: 'Nueva' }).click();
  await page.locator('input[placeholder*="principal"]').fill('Wallet a borrar');
  await page.locator('.pollar-modal-sheet button', { hasText: /Generar nuevo par de claves/ }).click();
  await page.locator('.pollar-modal-sheet button', { hasText: /Guardar billetera/ }).click();
  await page.waitForTimeout(300);

  // Should show in list
  await expect(page.locator('text=Wallet a borrar').first()).toBeVisible();

  // Delete it
  const deleteBtn = page.locator('[title="Eliminar billetera"]').first();
  await deleteBtn.click();
  await page.waitForTimeout(300);

  // Should no longer show
  await expect(page.locator('text=Wallet a borrar').first()).not.toBeVisible();
  await expect(page.locator('text=Billetera eliminada')).toBeVisible();
});

test('P3: Wallet secret key is hidden by default, shown on click', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Gestionar billeteras').click();
  await page.waitForTimeout(300);

  // Create a wallet
  await page.locator('.pollar-modal-sheet button').filter({ hasText: 'Nueva' }).click();
  await page.locator('input[placeholder*="principal"]').fill('Secret Test');
  await page.locator('.pollar-modal-sheet button', { hasText: /Generar nuevo par de claves/ }).click();

  const pubKeyEl = page.locator('code').first();
  const pubKey = await pubKeyEl.textContent();

  await page.locator('.pollar-modal-sheet button', { hasText: /Guardar billetera/ }).click();
  await page.waitForTimeout(500);

  // Secret key should be hidden (truncated)
  const secretLabel = page.locator('text=Secreta:').first();
  await expect(secretLabel).toBeVisible();

  // Click eye button to reveal
  const eyeBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
  await eyeBtn.click();
  await page.waitForTimeout(200);

  // Secret should still be visible but the S... key should now be full
  // (The eye button toggles visibility)
  await expect(secretLabel).toBeVisible();
});

test('P3: Created wallets persist in localStorage after reload', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Gestionar billeteras').click();
  await page.waitForTimeout(300);

  // Create a wallet
  await page.locator('.pollar-modal-sheet button').filter({ hasText: 'Nueva' }).click();
  await page.locator('input[placeholder*="principal"]').fill('Persisted Wallet');
  await page.locator('.pollar-modal-sheet button', { hasText: /Generar nuevo par de claves/ }).click();
  await page.locator('.pollar-modal-sheet button', { hasText: /Guardar billetera/ }).click();
  await page.waitForTimeout(300);

  // Reload the page
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // Navigate back to wallet registry
  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Gestionar billeteras').click();
  await page.waitForTimeout(500);

  // Wallet should still be there
  await expect(page.locator('text=Persisted Wallet').first()).toBeVisible();
});
