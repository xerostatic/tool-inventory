@echo off
echo ============================================
echo Tool Inventory - Windows Setup Script
echo ============================================
echo.

echo [1/6] Creating backend .env file...
(
echo DATABASE_URL=postgresql://neondb_owner:npg_IkLoV4gUX1GD@ep-wandering-glade-ah4hgryd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require^&channel_binding=require
echo.
echo JWT_SECRET=tool-inventory-super-secret-jwt-key-2024
echo.
echo PORT=5000
echo NODE_ENV=development
echo.
echo # Optional - for image recognition
echo # GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
) > backend\.env

if exist backend\.env (
    echo    Success! Created backend\.env
) else (
    echo    Error: Failed to create .env file
    pause
    exit /b 1
)

echo.
echo [2/6] Installing backend dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo    Error: Failed to install backend dependencies
    cd ..
    pause
    exit /b 1
)
echo    Success!

echo.
echo [3/6] Initializing database...
call npm run init-db
if errorlevel 1 (
    echo    Error: Database initialization failed
    echo    Please check your DATABASE_URL in backend\.env
    cd ..
    pause
    exit /b 1
)
echo    Success!

cd ..

echo.
echo [4/6] Installing frontend dependencies...
call npm install
if errorlevel 1 (
    echo    Error: Failed to install frontend dependencies
    pause
    exit /b 1
)
echo    Success!

echo.
echo ============================================
echo Setup Complete!
echo ============================================
echo.
echo Your Tool Inventory app is ready to use!
echo.
echo To start the application:
echo   1. Open a terminal and run: cd backend ^&^& npm run dev
echo   2. Open another terminal and run: npm start
echo.
echo OR use the provided start script:
echo   - Run: start-app.bat
echo.
echo For detailed instructions, see SETUP_GUIDE.md
echo.
pause

