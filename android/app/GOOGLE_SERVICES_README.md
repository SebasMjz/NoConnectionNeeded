# ⚠️ google-services.json — Guía de Configuración

Este archivo `google-services.json` debe ser generado desde **Firebase Console** o **Google Cloud Console**.
Es requerido para que el Google Sign-In nativo funcione en Android.

## Pasos para obtenerlo (gratis, ~5 min)

### Opción A — Firebase Console (más fácil)

1. Ve a https://console.firebase.google.com
2. Crea un proyecto nuevo (ej: "Pollar Pay")
3. Click **"Agregar app"** → elige **Android**
4. Nombre del paquete: `com.pollar.stellarp2p`
5. Apodo: "Pollar Pay"
6. **SHA-1**: ejecuta en tu terminal:
   ```
   # Si usas la keystore de debug:
   keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
   ```
   Copia el SHA-1 y pégalo en Firebase.
7. Descarga el `google-services.json` y colócalo en:
   `android/app/google-services.json`

### Opción B — Google Cloud Console

1. Ve a https://console.cloud.google.com
2. Crea un proyecto nuevo
3. Ve a **APIs & Services → Credentials**
4. Click **"+ CREATE CREDENTIALS" → OAuth 2.0 Client IDs**
5. Crea uno de tipo **Android** con `com.pollar.stellarp2p` y el SHA-1
6. Crea otro de tipo **Web** (para el `serverClientId`)
7. Descarga el `google-services.json`

### Después de obtenerlo

1. Coloca el archivo en `android/app/google-services.json`
2. Copia el **Web Client ID** y reemplázalo en `capacitor.config.json`:
   ```json
   "GoogleAuth": {
     "serverClientId": "TU_WEB_CLIENT_ID_AQUI.apps.googleusercontent.com"
   }
   ```
3. Ejecuta:
   ```
   npm run build
   npx cap sync android
   ```
4. Abre en Android Studio y compila.

## Sin google-services.json

La app funciona igual en modo **web (browser)** con el OAuth simulado.
En Android solo el botón de Google no lanzará la cuenta real — todo lo demás (wallets, biometría, pagos offline) funciona igual.
