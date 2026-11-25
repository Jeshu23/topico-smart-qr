@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo.
echo   TÓPICO SMART QR - Iniciando sistema...
echo.
call npm start
pause
