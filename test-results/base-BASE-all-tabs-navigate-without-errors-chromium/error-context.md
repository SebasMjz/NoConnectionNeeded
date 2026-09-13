# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: base.spec.js >> BASE: all tabs navigate without errors
- Location: tests/e2e/base.spec.js:111:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Simulador').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Simulador').first() with timeout 10000ms
  - waiting for locator('text=Simulador').first()

```

# Test source

```ts
  30  |   await expect(page.locator('text=Iniciar sesión').first()).toBeVisible();
  31  |   await expect(page.locator('input[type="email"]')).toBeVisible();
  32  |   await expect(page.locator('button').filter({ hasText: /Iniciar Sesión/ }).first()).toBeVisible();
  33  | 
  34  |   // Social buttons visible
  35  |   await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
  36  |   await expect(page.locator('text=Continuar con una billetera')).toBeVisible();
  37  | 
  38  |   // Quick access preset chips
  39  |   await expect(page.getByRole('button', { name: /⚡ Pagador/i })).toBeVisible();
  40  |   await expect(page.getByRole('button', { name: /🏪 Comercio POS/i })).toBeVisible();
  41  | 
  42  |   // No console errors (filter known warnings and expected network 404s in dev)
  43  |   const realErrors = errors.filter(e =>
  44  |     !e.includes('Confetti') &&
  45  |     !e.includes('canvas-confetti') &&
  46  |     !e.includes('Warning:') &&
  47  |     !e.includes('Failed to load resource') &&
  48  |     !e.includes('404')
  49  |   );
  50  |   expect(realErrors).toHaveLength(0);
  51  | });
  52  | 
  53  | // ─── BASE TEST: preset login Pagador bypasses auth, shows main UI ───────
  54  | test('BASE: preset login Pagador bypasses auth, shows main UI', async ({ page }) => {
  55  |   await clearAppState(page);
  56  | 
  57  |   await page.getByRole('button', { name: /⚡ Pagador/i }).click();
  58  | 
  59  |   // Should now be in main app
  60  |   await expect(page.locator('text=Iniciar sesión').first()).not.toBeVisible({ timeout: 3000 });
  61  |   await expect(page.locator('text=Bóveda').first()).toBeVisible({ timeout: 5000 });
  62  |   await expect(page.locator('text=PAGADOR').first()).toBeVisible();
  63  | 
  64  |   // Bottom nav present
  65  |   await expect(page.locator('text=Bóveda').first()).toBeVisible();
  66  |   await expect(page.getByRole('navigation').getByText('Pagar')).toBeVisible();
  67  |   await expect(page.locator('text=Sincronizar')).toBeVisible();
  68  | });
  69  | 
  70  | // ─── BASE TEST: preset login Comercio works ─────────────────────────────
  71  | test('BASE: preset login Comercio POS switches role', async ({ page }) => {
  72  |   await clearAppState(page);
  73  | 
  74  |   await page.getByRole('button', { name: /🏪 Comercio POS/i }).click();
  75  | 
  76  |   await expect(page.locator('text=COMERCIO').first()).toBeVisible({ timeout: 5000 });
  77  |   await expect(page.getByRole('navigation').getByText('Cobrar')).toBeVisible();
  78  |   await expect(page.locator('text=Sincronizar')).toBeVisible();
  79  | });
  80  | 
  81  | // ─── BASE TEST: top header settings button opens sheet ──────────────────
  82  | test('BASE: settings button opens bottom sheet', async ({ page }) => {
  83  |   await clearAppState(page);
  84  |   await page.getByRole('button', { name: /Pagador/i }).click();
  85  | 
  86  |   // Open settings
  87  |   const settingsBtn = page.locator('[title="Configuración y Perfil"]');
  88  |   await expect(settingsBtn).toBeVisible();
  89  |   await settingsBtn.click();
  90  | 
  91  |   // Bottom sheet should show user info + actions
  92  |   await expect(page.locator('text=Seguridad')).toBeVisible();
  93  |   await expect(page.locator('text=Usar biometría')).toBeVisible();
  94  |   await expect(page.getByText('Billeteras', { exact: true })).toBeVisible();
  95  |   await expect(page.locator('text=Cerrar sesión')).toBeVisible();
  96  | });
  97  | 
  98  | // ─── BASE TEST: logout returns to AuthGateway ───────────────────────────
  99  | test('BASE: logout returns to AuthGateway', async ({ page }) => {
  100 |   await clearAppState(page);
  101 |   await page.getByRole('button', { name: /Pagador/i }).click();
  102 | 
  103 |   const settingsBtn = page.locator('[title="Configuración y Perfil"]');
  104 |   await settingsBtn.click();
  105 |   await page.locator('text=Cerrar sesión').click();
  106 | 
  107 |   await expect(page.locator('text=Iniciar sesión').first()).toBeVisible();
  108 | });
  109 | 
  110 | // ─── BASE TEST: navigation tabs work ───────────────────────────────────
  111 | test('BASE: all tabs navigate without errors', async ({ page }) => {
  112 |   await clearAppState(page);
  113 |   await page.getByRole('button', { name: /⚡ Pagador/i }).click();
  114 | 
  115 |   // Vault tab
  116 |   await expect(page.locator('text=Saldo Total')).toBeVisible({ timeout: 5000 });
  117 | 
  118 |   // Pagar tab
  119 |   await page.getByRole('navigation').getByText('Pagar').click();
  120 |   await expect(page.locator('text=Firmar y Generar QR')).toBeVisible();
  121 | 
  122 |   // Sincronizar tab
  123 |   await page.locator('text=Sincronizar').click();
  124 |   await page.waitForTimeout(300);
  125 |   await expect(page.locator('text=Sincronizar').first()).toBeVisible();
  126 | 
  127 |   // Simulador tab
  128 |   await page.locator('text=Simulador').click();
  129 |   await page.waitForTimeout(300);
> 130 |   await expect(page.locator('text=Simulador').first()).toBeVisible();
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  131 | });
  132 | 
  133 | // ─── BASE TEST: role switcher changes active device ─────────────────────
  134 | test('BASE: role switcher toggles between Pagador and Comercio', async ({ page }) => {
  135 |   await clearAppState(page);
  136 |   await page.getByRole('button', { name: /⚡ Pagador/i }).click();
  137 | 
  138 |   // Should start as Pagador
  139 |   await expect(page.locator('text=PAGADOR').first()).toBeVisible({ timeout: 5000 });
  140 | 
  141 |   // Switch to Comercio via role switcher
  142 |   await page.getByRole('button', { name: /Comercio \(B\)/i }).click();
  143 |   await page.waitForTimeout(300);
  144 |   await expect(page.locator('text=COMERCIO').first()).toBeVisible();
  145 | 
  146 |   // Switch back to Pagador
  147 |   await page.getByRole('button', { name: /Pagador \(A\)/i }).click();
  148 |   await page.waitForTimeout(300);
  149 |   await expect(page.locator('text=PAGADOR').first()).toBeVisible();
  150 | });
  151 | 
  152 | // ─── BASE TEST: P2P payment flow (QR) ──────────────────────────────────
  153 | test('BASE: P2P payment terminal generates payment QR without errors', async ({ page }) => {
  154 |   await clearAppState(page);
  155 |   await page.getByRole('button', { name: /⚡ Pagador/i }).click();
  156 | 
  157 |   // Go to Pagar tab
  158 |   await page.getByRole('navigation').getByText('Pagar').click();
  159 | 
  160 |   // Form should be visible
  161 |   await expect(page.locator('input[placeholder="G..."]')).toBeVisible();
  162 | 
  163 |   // Find pay button and click
  164 |   const payBtn = page.locator('button:has-text("Firmar y Generar QR")');
  165 |   await expect(payBtn).toBeVisible();
  166 |   await payBtn.click();
  167 | 
  168 |   // Should show success message
  169 |   await expect(page.locator('text=Pago Criptográfico Firmado')).toBeVisible({ timeout: 5000 });
  170 | });
  171 | 
  172 | // ─── BASE TEST: offline vault allocation ───────────────────────────────
  173 | test('BASE: can open vault allocation panel', async ({ page }) => {
  174 |   await clearAppState(page);
  175 |   await page.getByRole('button', { name: /⚡ Pagador/i }).click();
  176 | 
  177 |   // Vault panel should show balance
  178 |   await expect(page.locator('text=Saldo Total')).toBeVisible({ timeout: 5000 });
  179 | 
  180 |   // Tap Bóveda button in the balance card actions
  181 |   const vaultBtn = page.locator('button:has-text("Bóveda")').first();
  182 |   await expect(vaultBtn).toBeVisible();
  183 |   await vaultBtn.click();
  184 |   await page.waitForTimeout(300);
  185 | 
  186 |   // Allocation panel should appear
  187 |   await expect(page.locator('text=Bloquear en Bóveda')).toBeVisible();
  188 | });
  189 | 
  190 | // ─── BASE TEST: settings user profile shows ─────────────────────────────
  191 | test('BASE: settings sheet shows user info', async ({ page }) => {
  192 |   await clearAppState(page);
  193 |   await page.getByRole('button', { name: /Pagador/i }).click();
  194 | 
  195 |   const settingsBtn = page.locator('[title="Configuración y Perfil"]');
  196 |   await settingsBtn.click();
  197 | 
  198 |   // Should show the demo user email
  199 |   await expect(page.locator('text=pollar.io')).toBeVisible({ timeout: 3000 });
  200 | });
  201 | 
```