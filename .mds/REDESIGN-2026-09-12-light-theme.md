# Rediseño UI - Tema Claro Wallet Style - 2026-09-12

## Cambios realizados

### 1. Tema global (`src/styles/index.css`)
- **Fondo claro** `#f5f5f7` en vez de negro
- **Colores de texto** oscuros para contraste sobre fondo claro
- Eliminadas todas las CSS custom properties de Tailwind (causaban error de build con Tailwind v4)
- Tipografia Outfit + JetBrains Mono mantenida

### 2. Paleta de colores
| Uso | Color |
|-----|-------|
| Primario (acciones) | `#6C3CE1` (purple) |
| Exito/Online | `#10b981` (emerald) |
| Advertencia/Pendiente | `#f59e0b` (amber) |
| Error | `#ef4444` (rose) |
| Texto principal | `#1a1a2e` |
| Texto secundario | `#6b7280` |
| Texto dim | `#9ca3af` |
| Fondo | `#f5f5f7` |
| Superficies | `#ffffff` |
| Bordes | `#e5e7eb` |

### 3. Archivos modificados
| Archivo | Cambios |
|---------|---------|
| `AuthGateway.jsx` | Login con imagen pollar.webp de fondo, tema claro, boton primario purple |
| `App.jsx` | Header limpio, bottom nav con sombra sutil, settings sheet claro |
| `WalletVault.jsx` | Balance hero centrado, tarjetas blancas con bordes suaves, spacing `space-y-6` |
| `P2PPaymentTerminal.jsx` | Formularios limpios, inputs con fondo `#f9fafb`, botones purple/emerald |
| `SyncManager.jsx` | Metricas con border-left de color, paneles limpios |
| `FloatingDemoHelper.jsx` | Popover blanco, botones purple para demo |

### 4. Spacing y padding
- `space-y-5` y `space-y-6` entre secciones principales
- `p-5` y `p-6` en tarjetas (antes era `p-3.5`)
- `gap-3` y `gap-4` en grids
- `py-6` en el area de contenido principal
- Cards con `border-radius: 1rem` (rounded-2xl)

### 5. Build fix
- Reemplazadas todas las `text-[var(--xxx)]` por colores hex directos
- Tailwind v4 no soporta CSS variables dentro de arbitrary values
- Build pasa exitosamente (443ms)
