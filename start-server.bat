@echo off
title SnapIT Local Server
echo ========================================================
echo   Starting SnapIT Server on http://localhost:3000...
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 3000
pause
