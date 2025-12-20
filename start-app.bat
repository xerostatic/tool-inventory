@echo off
echo ============================================
echo Starting Tool Inventory App
echo ============================================
echo.
echo Starting backend server...
start "Tool Inventory - Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak > nul

echo Starting frontend...
start "Tool Inventory - Frontend" cmd /k "npm start"

echo.
echo ============================================
echo App is starting!
echo ============================================
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo The app will open in your browser automatically.
echo.
echo Press any key to close this window...
pause > nul

