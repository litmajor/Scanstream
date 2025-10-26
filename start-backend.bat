@echo off
echo Starting Scanstream Backend Server...
cd /d "%~dp0"
call npx tsx server/index.ts
pause

