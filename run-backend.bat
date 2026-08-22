@echo off
title Veyro Backend
cd /d "C:\Users\gusin\Downloads\Website\VEYRO"
set "VEYRO_DB=%APPDATA%\VEYRO\server-db.json"

:restart
echo [%date% %time%] Starting Veyro Backend...
node server/server.js
echo [%date% %time%] Backend exited. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto restart