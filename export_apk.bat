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
    echo [INFO] Si necesitas compilar con Android Studio:
    echo        Ejecuta: npx cap open android
)

cd ..
