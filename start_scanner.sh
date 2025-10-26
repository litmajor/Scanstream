#!/bin/bash
# Quick start script for the Scanner Service

echo "==================================="
echo "Starting Scanstream Scanner Service"
echo "==================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"
echo ""

# Check if requirements are installed
echo "Checking Python dependencies..."
pip3 list | grep -q "flask" || {
    echo "Installing Python dependencies..."
    pip3 install -r requirements.txt
}

echo "✓ Dependencies installed"
echo ""

# Start the scanner service
echo "Starting Scanner API on port 5001..."
echo "Press Ctrl+C to stop"
echo ""
python3 scanner_api.py

