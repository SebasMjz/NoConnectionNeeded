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

test('PRESET LOGIN: clicking Pagador quick access should show main UI, not blank', async ({ page }) => {
  await clearAppState(page);

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('404')) errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  // Verify AuthGateway visible
  await expect(page.locator('text=Iniciar sesión').first()).toBeVisible({ timeout: 5000 });

  // Click "Pagador" quick access button
  await page.getByRole('button', { name: /Pagador/i }).click();

  // Wait for content to load
  await page.waitForTimeout(3000);

  // Should show main app content (not blank)
  const rootContent = await page.locator('#root').innerHTML();
  console.log('Root content length:', rootContent.length);
  console.log('Non-404 Errors:', errors);

  // If UI works, we should see "Bóveda" tab or user name
  const hasContent = await page.locator('text=Bóveda').or(page.locator('text=Pagador Demo')).count();
  console.log('Has visible content:', hasContent);

  expect(errors).toHaveLength(0);
  expect(hasContent).toBeGreaterThan(0);
});
