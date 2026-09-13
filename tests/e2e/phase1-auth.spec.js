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

// ─── PHASE 1 TESTS ────────────────────────────────────────────────────────

test('P1: AuthGateway shows Login and Register tabs', async ({ page }) => {
  await clearAppState(page);

  // Should show tabs in the tab bar
  const loginTab = page.locator('.pollar-btn-primary, button').filter({ hasText: /Iniciar Sesión/ }).first();
  const registerTab = page.locator('.pollar-btn-primary, button').filter({ hasText: /Registrarse/ }).first();
  await expect(loginTab).toBeVisible();
  await expect(registerTab).toBeVisible();
});

test('P1: Can switch from Login to Register tab', async ({ page }) => {
  await clearAppState(page);

  // Click Register tab
  await page.locator('button').filter({ hasText: 'Registrarse' }).first().click();

  // Register tab should show "Crear Cuenta" button
  await expect(page.locator('button').filter({ hasText: /Crear Cuenta/ })).toBeVisible();
});

test('P1: Can register a new user with email + password', async ({ page }) => {
  await clearAppState(page);

  // Switch to register tab
  await page.locator('button').filter({ hasText: 'Registrarse' }).first().click();

  // Fill email
  await page.locator('input[type="email"]').fill('testuser@example.com');

  // Fill password
  await page.locator('input[type="password"]').fill('testpass123');

  // Submit (register)
  await page.locator('button').filter({ hasText: /Crear Cuenta/ }).click();

  // Should be logged in directly (no OTP in register flow)
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=Iniciar sesión')).not.toBeVisible();
});

test('P1: Duplicate email registration shows error', async ({ page }) => {
  await clearAppState(page);

  // Register first user
  await page.locator('button').filter({ hasText: 'Registrarse' }).first().click();
  await page.locator('input[type="email"]').fill('duptest@example.com');
  await page.locator('input[type="password"]').fill('password123');
  await page.locator('button').filter({ hasText: /Crear Cuenta/ }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  // Logout
  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Cerrar sesión').click();
  await page.waitForTimeout(300);

  // Try registering same email again
  await page.locator('button').filter({ hasText: 'Registrarse' }).first().click();
  await page.locator('input[type="email"]').fill('duptest@example.com');
  await page.locator('input[type="password"]').fill('newpassword456');
  await page.locator('button').filter({ hasText: /Crear Cuenta/ }).click();

  // Should show duplicate email error
  await expect(page.locator('text=Este email ya está registrado')).toBeVisible({ timeout: 5000 });
});

test('P1: Login with registered email + password works', async ({ page }) => {
  await clearAppState(page);

  // Register user first
  await page.locator('button').filter({ hasText: 'Registrarse' }).first().click();
  await page.locator('input[type="email"]').fill('logintest@example.com');
  await page.locator('input[type="password"]').fill('mypassword99');
  await page.locator('button').filter({ hasText: /Crear Cuenta/ }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  // Logout
  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Cerrar sesión').click();
  await page.waitForTimeout(300);

  // Login with credentials on login tab
  await page.locator('input[type="email"]').fill('logintest@example.com');
  await page.locator('input[type="password"]').fill('mypassword99');
  // Use the submit button in the login form (not the tab button)
  await page.locator('button[type="submit"]').filter({ hasText: /Iniciar Sesión/ }).click();

  // Should be logged in
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
});

test('P1: Wrong password shows error on login', async ({ page }) => {
  await clearAppState(page);

  // Register user
  await page.locator('button').filter({ hasText: 'Registrarse' }).first().click();
  await page.locator('input[type="email"]').fill('wrongpw@example.com');
  await page.locator('input[type="password"]').fill('correctpass');
  await page.locator('button').filter({ hasText: /Crear Cuenta/ }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  // Logout
  await page.locator('[title="Configuración y Perfil"]').click();
  await page.locator('text=Cerrar sesión').click();
  await page.waitForTimeout(300);

  // Login with wrong password
  await page.locator('input[type="email"]').fill('wrongpw@example.com');
  await page.locator('input[type="password"]').fill('wrongpassword');
  await page.locator('button[type="submit"]').filter({ hasText: /Iniciar Sesión/ }).click();

  // Should show error
  await expect(page.locator('text=Contraseña incorrecta')).toBeVisible({ timeout: 5000 });
});

test('P1: Password input has minLength=6 attribute', async ({ page }) => {
  await clearAppState(page);

  // Register tab should have password minLength=6
  await page.locator('button').filter({ hasText: 'Registrarse' }).first().click();
  await expect(page.locator('input[type="password"]')).toHaveAttribute('minLength', '6');
});

test('P1: Show/hide password toggle changes input type', async ({ page }) => {
  await clearAppState(page);

  // Use placeholder to find the password input (stable regardless of type attribute)
  const passwordInput = page.locator('input[placeholder*="contraseña"], input[placeholder*="contrase"]').first();
  await expect(passwordInput).toBeVisible();
  await expect(passwordInput).toHaveAttribute('type', 'password');

  // Click the eye/eye-off toggle button (first icon button in form)
  const eyeBtn = page.locator('button[type="button"]').filter({ has: page.locator('svg') }).first();
  await eyeBtn.click();
  await page.waitForTimeout(100);

  // After click, input type should change to text
  await expect(passwordInput).toHaveAttribute('type', 'text');
});

test('P1: Quick access preset still works (no regression)', async ({ page }) => {
  await clearAppState(page);

  await page.getByRole('button', { name: /⚡ Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=PAGADOR').first()).toBeVisible();
});

test('P1: Google login still works (no regression)', async ({ page }) => {
  await clearAppState(page);

  await page.locator('button').filter({ hasText: /Google/ }).first().click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
});
