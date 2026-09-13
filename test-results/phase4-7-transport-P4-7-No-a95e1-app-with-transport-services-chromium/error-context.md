# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase4-7-transport.spec.js >> P4-7: No runtime errors when loading app with transport services
- Location: tests/e2e/phase4-7-transport.spec.js:121:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('text=Transferir')

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
        - generic [ref=f1e13]: PAGADOR (A)
    - generic [ref=f1e15]:
      - button "Online" [ref=f1e16] [cursor=pointer]
      - button "Configuración y Perfil" [ref=f1e22] [cursor=pointer]
  - generic [ref=f1e27]:
    - button "Pagador (A)" [ref=f1e28] [cursor=pointer]
    - button "Comercio (B)" [ref=f1e31] [cursor=pointer]
  - main [ref=f1e35]:
    - generic [ref=f1e37]:
      - generic [ref=f1e38]:
        - generic [ref=f1e39]: Billetera Pagador
        - button "Actualizar saldo" [ref=f1e40] [cursor=pointer]
      - generic [ref=f1e46]:
        - generic [ref=f1e47]: Saldo Total
        - generic [ref=f1e48]:
          - generic [ref=f1e49]: $100.00
          - generic [ref=f1e50]: USDT
        - generic [ref=f1e51]:
          - generic [ref=f1e52]:
            - text: "Bóveda Offline:"
            - strong [ref=f1e53]: "10.00"
          - generic [ref=f1e54]: •
          - generic [ref=f1e55]:
            - text: "Recibido:"
            - strong [ref=f1e56]: "0.00"
      - generic [ref=f1e57] [cursor=pointer]: GCOMHD7FVVAUGAA3RS5KI2TF5DU764IMFIIXYPYDOOXB4DFZCZCWLF2E
      - generic [ref=f1e62]:
        - button "Pagar" [ref=f1e63] [cursor=pointer]
        - button "Bóveda" [ref=f1e69] [cursor=pointer]
        - button "+10k XLM" [ref=f1e75] [cursor=pointer]
        - button "Vincular" [ref=f1e81] [cursor=pointer]
  - navigation:
    - generic [ref=f1e89]:
      - button "Bóveda" [ref=f1e90] [cursor=pointer]
      - button "Pagar" [ref=f1e96] [cursor=pointer]
      - button "Sincronizar" [ref=f1e102] [cursor=pointer]
      - button "Simulador" [ref=f1e110] [cursor=pointer]
```

# Test source

```ts
  31  |   const filePath = path.join(REPO, 'src/services/BluetoothService.js');
  32  |   expect(fs.existsSync(filePath)).toBe(true);
  33  | 
  34  |   const content = fs.readFileSync(filePath, 'utf8');
  35  |   expect(content).toMatch(/class BluetoothService/);
  36  |   expect(content).toMatch(/getBluetoothService/);
  37  |   expect(content).toMatch(/initialize/);
  38  |   expect(content).toMatch(/startScan/);
  39  |   expect(content).toMatch(/sendPayload/);
  40  | });
  41  | 
  42  | test('P5: NFCService file exists with correct exports', async ({ page }) => {
  43  |   await clearAppState(page);
  44  |   await page.getByRole('button', { name: /Pagador/i }).click();
  45  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  46  | 
  47  |   const filePath = path.join(REPO, 'src/services/NFCService.js');
  48  |   expect(fs.existsSync(filePath)).toBe(true);
  49  | 
  50  |   const content = fs.readFileSync(filePath, 'utf8');
  51  |   expect(content).toMatch(/class NFCService/);
  52  |   expect(content).toMatch(/getNFCService/);
  53  |   expect(content).toMatch(/read/);
  54  |   expect(content).toMatch(/write/);
  55  | });
  56  | 
  57  | test('P6: WifiDirectService file exists with correct exports', async ({ page }) => {
  58  |   await clearAppState(page);
  59  |   await page.getByRole('button', { name: /Pagador/i }).click();
  60  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  61  | 
  62  |   const filePath = path.join(REPO, 'src/services/WifiDirectService.js');
  63  |   expect(fs.existsSync(filePath)).toBe(true);
  64  | 
  65  |   const content = fs.readFileSync(filePath, 'utf8');
  66  |   expect(content).toMatch(/class WifiDirectService/);
  67  |   expect(content).toMatch(/getWifiDirectService/);
  68  |   expect(content).toMatch(/connectToPeer/);
  69  |   expect(content).toMatch(/sendPayload/);
  70  | });
  71  | 
  72  | test('P7: P2PTransportSelector component file exists', async ({ page }) => {
  73  |   await clearAppState(page);
  74  |   await page.getByRole('button', { name: /Pagador/i }).click();
  75  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  76  | 
  77  |   const filePath = path.join(REPO, 'src/components/P2PTransportSelector.jsx');
  78  |   expect(fs.existsSync(filePath)).toBe(true);
  79  | 
  80  |   const content = fs.readFileSync(filePath, 'utf8');
  81  |   expect(content).toMatch(/P2PTransportSelector/);
  82  |   expect(content).toMatch(/QrCode|qr/);
  83  |   expect(content).toMatch(/Bluetooth|bluetooth/);
  84  |   expect(content).toMatch(/Nfc|nfc/);
  85  |   expect(content).toMatch(/Wifi|wifi/);
  86  | });
  87  | 
  88  | test('P7: Transfer tab shows P2P payment terminal', async ({ page }) => {
  89  |   await clearAppState(page);
  90  |   await page.getByRole('button', { name: /Pagador/i }).click();
  91  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  92  | 
  93  |   await page.locator('text=Transferir').click();
  94  |   await page.waitForTimeout(500);
  95  | 
  96  |   // Should show P2P payment terminal content
  97  |   await expect(page.locator('text=Escanear Factura QR').or(page.locator('text=Firmar y Generar QR')).first()).toBeVisible({ timeout: 5000 });
  98  | });
  99  | 
  100 | test('P4-7: AndroidManifest has Bluetooth/NFC/WiFi permissions', async ({ page }) => {
  101 |   await clearAppState(page);
  102 |   await page.getByRole('button', { name: /Pagador/i }).click();
  103 |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  104 | 
  105 |   const manifestPath = path.join(REPO, 'android/app/src/main/AndroidManifest.xml');
  106 |   expect(fs.existsSync(manifestPath)).toBe(true);
  107 | 
  108 |   const manifest = fs.readFileSync(manifestPath, 'utf8');
  109 |   expect(manifest).toMatch(/android.permission.BLUETOOTH/);
  110 |   expect(manifest).toMatch(/android.permission.BLUETOOTH_ADMIN/);
  111 |   expect(manifest).toMatch(/android.permission.BLUETOOTH_CONNECT/);
  112 |   expect(manifest).toMatch(/android.permission.BLUETOOTH_SCAN/);
  113 |   expect(manifest).toMatch(/android.permission.NFC/);
  114 |   expect(manifest).toMatch(/android.permission.ACCESS_WIFI_STATE/);
  115 |   expect(manifest).toMatch(/android.permission.CHANGE_WIFI_STATE/);
  116 |   expect(manifest).toMatch(/android.hardware.bluetooth_le/);
  117 |   expect(manifest).toMatch(/android.hardware.nfc/);
  118 |   expect(manifest).toMatch(/android.hardware.wifi.direct/);
  119 | });
  120 | 
  121 | test('P4-7: No runtime errors when loading app with transport services', async ({ page }) => {
  122 |   await clearAppState(page);
  123 | 
  124 |   const errors = [];
  125 |   page.on('pageerror', err => errors.push(err.message));
  126 | 
  127 |   await page.getByRole('button', { name: /Pagador/i }).click();
  128 |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  129 | 
  130 |   // Navigate through all tabs to ensure no errors
> 131 |   await page.locator('text=Transferir').click();
      |                                         ^ Error: locator.click: Test timeout of 30000ms exceeded.
  132 |   await page.waitForTimeout(300);
  133 |   await page.locator('text=Sincronizar').click();
  134 |   await page.waitForTimeout(300);
  135 |   await page.locator('text=Simulador').click();
  136 |   await page.waitForTimeout(300);
  137 |   await page.locator('text=Bóveda').first().click();
  138 |   await page.waitForTimeout(300);
  139 | 
  140 |   const realErrors = errors.filter(e =>
  141 |     !e.includes('404') &&
  142 |     !e.includes('Failed to load resource')
  143 |   );
  144 |   expect(realErrors).toHaveLength(0);
  145 | });
  146 | 
```