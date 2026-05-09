@echo off
echo ========================================
echo Starting Scanstream Services
echo ========================================
echo.

echo [1/3] Starting Python Scanner API (port 5001)...
start "Scanner API" cmd /k "python scanner_api.py"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Node.js Backend (port 5000)...
start "Backend Server" cmd /k "npm run server"
timeout /t 5 /nobreak >nul

echo [3/3] Starting Frontend Dev Server (port 5173)...
start "Frontend" cmd /k "cd client && npm run dev"

echo.
echo ========================================
echo All services starting...
echo ========================================
echo.
echo Scanner API:   http://localhost:5001
echo Backend API:   http://localhost:5000
echo Frontend:      http://localhost:5173
echo.
echo Press any key to exit (services will continue running)
pause >nul

