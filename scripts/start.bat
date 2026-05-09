@echo off
REM Scanstream - Unified Start Script for Windows
REM This script starts all services for local development

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║  🚀 Starting Scanstream Services                       ║
echo ╚════════════════════════════════════════════════════════╝
echo.

REM Check if Docker is running
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running! Please start Docker Desktop.
    pause
    exit /b 1
)

REM Start database
echo [1/4] Starting PostgreSQL Database (Docker)...
docker compose up db -d
timeout /t 3 /nobreak >nul

REM Wait for database to be ready
echo [2/4] Waiting for database to be ready...
:wait_db
docker exec scanstream-db-1 pg_isready -U scanuser >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto wait_db
)
echo ✅ Database is ready!

REM Start Scanner API in new window
echo [3/4] Starting Python Scanner API (Port 5001)...
start "Scanstream - Scanner API" cmd /k "python scanner_api.py"
timeout /t 2 /nobreak >nul

REM Start Backend in new window
echo [4/4] Starting Node.js Backend (Port 5000)...
start "Scanstream - Backend" cmd /k "npm run server"
timeout /t 3 /nobreak >nul

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║  ✅ All Backend Services Started!                      ║
echo ╠════════════════════════════════════════════════════════╣
echo ║  Database:       postgresql://localhost:5432/scandb    ║
echo ║  Scanner API:    http://localhost:5001                 ║
echo ║  Backend API:    http://localhost:5000                 ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo 📌 To start frontend dev server, run:
echo    npm run dev
echo.
echo 📌 To stop services:
echo    - Close the scanner and backend windows
echo    - Run: docker compose down
echo.

pause

