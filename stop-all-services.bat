@echo off
echo ========================================
echo   Stopping All Scanstream Services
echo ========================================
echo.

REM Kill Node.js processes (Backend server on port 4000)
echo Stopping Node.js backend server (port 4000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000') do (
    taskkill /F /PID %%a 2>nul
)

REM Kill Python processes (Scanner API on port 5001)
echo Stopping Python scanner API (port 5001)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001') do (
    taskkill /F /PID %%a 2>nul
)

REM Kill Vite dev server (port 5173)
echo Stopping Vite dev server (port 5173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    taskkill /F /PID %%a 2>nul
)

REM Kill any process on port 5174
echo Stopping any service on port 5174...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174') do (
    taskkill /F /PID %%a 2>nul
)

echo.
echo ========================================
echo   All services stopped!
echo ========================================
pause

