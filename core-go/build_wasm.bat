@echo off
echo =======================================================
echo Compilando Pollar Core Engine con Go para WebAssembly...
echo =======================================================

set GOOS=js
set GOARCH=wasm
go build -o ..\public\pollar_core.wasm .\wasm\main.go

if %ERRORLEVEL% EQU 0 (
    echo [OK] pollar_core.wasm compilado exitosamente en public/
    REM Copiar wasm_exec.js desde la distribucion de Go
    for /f "tokens=*" %%i in ('go env GOROOT') do set GOROOT=%%i
    copy "%GOROOT%\misc\wasm\wasm_exec.js" "..\public\wasm_exec.js"
    echo [OK] wasm_exec.js copiado exitosamente a public/
) else (
    echo [ERROR] Fallo la compilacion de WebAssembly
)
