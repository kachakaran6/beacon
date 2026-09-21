@echo off
cd /d "D:\Widget"
set npm_config_cache=D:\npm-cache
start "Beacon Vite" /min cmd /c "node node_modules\vite\bin\vite.js --host 127.0.0.1"
timeout /t 4 /nobreak >nul
node node_modules\electron\cli.js .
