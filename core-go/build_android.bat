@echo off
echo ================================================================
echo Compilando Pollar Core Engine con GoMobile para Android (.AAR)...
echo ================================================================

REM Requisitos previos:
REM 1. go install golang.org/x/mobile/cmd/gomobile@latest
REM 2. gomobile init
REM 3. Android NDK y SDK configurados (ANDROID_HOME y ANDROID_NDK_HOME)

if not exist "..\android\pollarcore" mkdir "..\android\pollarcore"

echo Ejecutando gomobile bind...
gomobile bind -target=android -androidapi 21 -o ..\android\pollarcore\pollarcore.aar .\pkg\pollarcore

if %ERRORLEVEL% EQU 0 (
    echo [OK] pollarcore.aar generado exitosamente en android/pollarcore/
) else (
    echo [INFO] Para compilar .aar nativo en Windows/Linux:
    echo        1. Instala Android NDK en Android Studio
    echo        2. Ejecuta: go install golang.org/x/mobile/cmd/gomobile@latest
    echo        3. gomobile init
    echo        4. Vuelve a ejecutar este script.
)
