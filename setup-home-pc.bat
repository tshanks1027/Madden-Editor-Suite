@echo off
REM ============================================================
REM Madden Editor Suite - Home PC Setup Script
REM ============================================================
REM This script sets up the project on a new PC
REM Run this AFTER cloning the repository
REM ============================================================

echo.
echo ============================================================
echo Madden Editor Suite - Home PC Setup
echo ============================================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: package.json not found!
    echo Please run this script from the madden-editor-suite directory
    echo.
    pause
    exit /b 1
)

echo [1/5] Installing Node.js dependencies...
echo.
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed!
    echo Make sure Node.js is installed: https://nodejs.org/
    pause
    exit /b 1
)

echo.
echo [2/5] Checking for required folders...
echo.

REM Create Lookups folder if it doesn't exist
if not exist "Lookups" (
    echo Creating Lookups folder...
    mkdir Lookups
)

REM Create data/lookups folder if it doesn't exist
if not exist "src\main\data\lookups" (
    echo Creating src\main\data\lookups folder...
    mkdir "src\main\data\lookups"
)

echo.
echo [3/5] Checking for lookup files...
echo.
echo You need to copy these files manually from your other PC:
echo   - Lookups\college_lookup.csv
echo   - Lookups\state_lookup.csv
echo   - Lookups\pid_lookup.csv
echo.
echo Also copy the Madden 26 template roster file:
echo   From: Documents\Madden NFL 26\Saves\ROSTER-Official
echo   To:   %USERPROFILE%\Documents\Madden NFL 26\Saves\
echo.

set /p COPIED="Have you copied these files? (y/n): "
if /i not "%COPIED%"=="y" (
    echo.
    echo Please copy the files first, then run this script again.
    pause
    exit /b 0
)

echo.
echo [4/5] Verifying files...
echo.

set MISSING=0

if not exist "Lookups\college_lookup.csv" (
    echo MISSING: Lookups\college_lookup.csv
    set MISSING=1
)
if not exist "Lookups\state_lookup.csv" (
    echo MISSING: Lookups\state_lookup.csv
    set MISSING=1
)
if not exist "Lookups\pid_lookup.csv" (
    echo MISSING: Lookups\pid_lookup.csv
    set MISSING=1
)

if %MISSING%==1 (
    echo.
    echo WARNING: Some lookup files are missing!
    echo The app may not work correctly without them.
    echo.
)

echo.
echo [5/5] Testing build...
echo.
call npm run typecheck
if errorlevel 1 (
    echo.
    echo WARNING: TypeScript type checking found issues
    echo The app should still work, but there may be type errors
    echo.
)

echo.
echo ============================================================
echo Setup Complete!
echo ============================================================
echo.
echo To start the app:
echo   npm start
echo.
echo To sync changes from GitHub:
echo   git pull
echo   npm install  (if package.json changed)
echo.
echo To push changes to GitHub:
echo   git add .
echo   git commit -m "Your message"
echo   git push
echo.
pause
