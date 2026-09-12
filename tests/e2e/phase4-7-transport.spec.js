import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const REPO = '/home/stuko/Jobs/NoRest/NoConnectionNeeded';

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

// ─── PHASE 4-7 TESTS ────────────────────────────────────────────────────────

test('P4: BluetoothService file exists with correct exports', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  // Verify the BluetoothService file exists and has expected exports
  const filePath = path.join(REPO, 'src/services/BluetoothService.js');
  expect(fs.existsSync(filePath)).toBe(true);

  const content = fs.readFileSync(filePath, 'utf8');
  expect(content).toMatch(/class BluetoothService/);
  expect(content).toMatch(/getBluetoothService/);
  expect(content).toMatch(/initialize/);
  expect(content).toMatch(/startScan/);
  expect(content).toMatch(/sendPayload/);
});

test('P5: NFCService file exists with correct exports', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  const filePath = path.join(REPO, 'src/services/NFCService.js');
  expect(fs.existsSync(filePath)).toBe(true);

  const content = fs.readFileSync(filePath, 'utf8');
  expect(content).toMatch(/class NFCService/);
  expect(content).toMatch(/getNFCService/);
  expect(content).toMatch(/read/);
  expect(content).toMatch(/write/);
});

test('P6: WifiDirectService file exists with correct exports', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  const filePath = path.join(REPO, 'src/services/WifiDirectService.js');
  expect(fs.existsSync(filePath)).toBe(true);

  const content = fs.readFileSync(filePath, 'utf8');
  expect(content).toMatch(/class WifiDirectService/);
  expect(content).toMatch(/getWifiDirectService/);
  expect(content).toMatch(/connectToPeer/);
  expect(content).toMatch(/sendPayload/);
});

test('P7: P2PTransportSelector component file exists', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  const filePath = path.join(REPO, 'src/components/P2PTransportSelector.jsx');
  expect(fs.existsSync(filePath)).toBe(true);

  const content = fs.readFileSync(filePath, 'utf8');
  expect(content).toMatch(/P2PTransportSelector/);
  expect(content).toMatch(/QrCode|qr/);
  expect(content).toMatch(/Bluetooth|bluetooth/);
  expect(content).toMatch(/Nfc|nfc/);
  expect(content).toMatch(/Wifi|wifi/);
});

test('P7: Transfer tab shows P2P payment terminal', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  await page.locator('text=Transferir').click();
  await page.waitForTimeout(500);

  // Should show P2P payment terminal content
  await expect(page.locator('text=Escanear Factura QR').or(page.locator('text=Firmar y Generar QR')).first()).toBeVisible({ timeout: 5000 });
});

test('P4-7: AndroidManifest has Bluetooth/NFC/WiFi permissions', async ({ page }) => {
  await clearAppState(page);
  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  const manifestPath = path.join(REPO, 'android/app/src/main/AndroidManifest.xml');
  expect(fs.existsSync(manifestPath)).toBe(true);

  const manifest = fs.readFileSync(manifestPath, 'utf8');
  expect(manifest).toMatch(/android.permission.BLUETOOTH/);
  expect(manifest).toMatch(/android.permission.BLUETOOTH_ADMIN/);
  expect(manifest).toMatch(/android.permission.BLUETOOTH_CONNECT/);
  expect(manifest).toMatch(/android.permission.BLUETOOTH_SCAN/);
  expect(manifest).toMatch(/android.permission.NFC/);
  expect(manifest).toMatch(/android.permission.ACCESS_WIFI_STATE/);
  expect(manifest).toMatch(/android.permission.CHANGE_WIFI_STATE/);
  expect(manifest).toMatch(/android.hardware.bluetooth_le/);
  expect(manifest).toMatch(/android.hardware.nfc/);
  expect(manifest).toMatch(/android.hardware.wifi.direct/);
});

test('P4-7: No runtime errors when loading app with transport services', async ({ page }) => {
  await clearAppState(page);

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.getByRole('button', { name: /Pagador/i }).click();
  await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });

  // Navigate through all tabs to ensure no errors
  await page.locator('text=Transferir').click();
  await page.waitForTimeout(300);
  await page.locator('text=Sincronizar').click();
  await page.waitForTimeout(300);
  await page.locator('text=Simulador').click();
  await page.waitForTimeout(300);
  await page.locator('text=Bóveda').first().click();
  await page.waitForTimeout(300);

  const realErrors = errors.filter(e =>
    !e.includes('404') &&
    !e.includes('Failed to load resource')
  );
  expect(realErrors).toHaveLength(0);
});
