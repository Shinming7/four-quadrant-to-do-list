@echo off
setlocal
cd /d "%~dp0"
start "四象限待办开发服务器" cmd /k "npm run dev -- --host 0.0.0.0"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5173/"
