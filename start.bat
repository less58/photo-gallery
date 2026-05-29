@echo off
title Photo Gallery - Starting...
cd /d "%~dp0"

echo.
echo  ========================================
echo   Photo Gallery - Starting Dev Server
echo  ========================================
echo.

start "" http://localhost:3000

npm run dev
