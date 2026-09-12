@echo off
echo =========================================================
echo Compilando APK Android para Pollar Stellar Offline...
echo =========================================================

echo 1. Compilando Aplicacion Web (Vite + Wasm)...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo npm run build
    exit /b %ERRORLEVEL%
)

echo 2. Sincronizando con Capacitor Android...
call npx cap sync android

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo npx cap sync android
    exit /b %ERRORLEVEL%
)

echo 3. Compilando APK Debug con Gradle...
cd android
call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo =========================================================
    echo [EXITO] APK Generado exitosamente en:
    echo android\app\build\outputs\apk\debug\app-debug.apk
    echo =========================================================
) else (
    echo =========================================================
    echo [AVISO] Fallo la compilacion con Gradle.
    echo Para compilar desde Android Studio:
    echo 1. Abre Android Studio con: npx cap open android
    echo 2. Ve al menu: Build - Build Bundle or APK - Build APK
    echo =========================================================
)

cd ..
