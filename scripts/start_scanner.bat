@echo off
REM Quick start script for the Scanner Service (Windows)

echo ===================================
echo Starting Scanstream Scanner Service
echo ===================================
echo.

REM Check if Python is installed
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed
    pause
    exit /b 1
)

echo [OK] Python found
python --version
echo.

REM Check if requirements are installed
echo Checking Python dependencies...
pip list | findstr /C:"flask" >nul
if %errorlevel% neq 0 (
    echo Installing Python dependencies...
    pip install -r requirements.txt
)

echo [OK] Dependencies installed
echo.

REM Start the scanner service
echo Starting Scanner API on port 5001...
echo Press Ctrl+C to stop
echo.
python scanner_api.py

