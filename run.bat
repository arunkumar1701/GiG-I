@echo off
echo ==============================================
echo ParametriX System Initialization
echo ==============================================

echo [1/4] Installing Backend Dependencies...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
  echo Error installing backend dependencies. Ensure Python is installed.
  pause
  exit /b
)

echo [2/4] Starting Backend Server...
start "Backend FastApi Server" cmd /k "uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo [3/4] Installing Frontend Dependencies...
cd ../frontend
call npm install
if errorlevel 1 (
  echo Error installing frontend dependencies. Ensure Node.js is installed.
  pause
  exit /b
)

echo [4/4] Starting Frontend Dev Server...
start "Frontend Vite Server" cmd /k "npm run dev"

echo ==============================================
echo Application Launched Successfully!
echo Backend API available at: http://127.0.0.1:8000
echo Frontend UI available at: http://localhost:5173
echo ==============================================
pause
