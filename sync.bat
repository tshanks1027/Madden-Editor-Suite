@echo off
REM ============================================================
REM Quick Sync Script - Commit and Push Changes
REM ============================================================
REM Usage: sync.bat [optional commit message]
REM Example: sync.bat "Fixed roster save bug"
REM ============================================================

echo.
echo ============================================================
echo Git Sync - Madden Editor Suite
echo ============================================================
echo.

REM Pull latest changes first
echo [1/4] Pulling latest changes from GitHub...
git pull
if errorlevel 1 (
    echo.
    echo ERROR: Failed to pull from GitHub!
    echo You may have conflicts. Please resolve them manually.
    pause
    exit /b 1
)

echo.
echo [2/4] Staging all changes...
git add .

REM Check if there are any changes
git diff-index --quiet HEAD --
if %errorlevel%==0 (
    echo.
    echo No changes to commit. Already up to date!
    echo.
    pause
    exit /b 0
)

echo.
echo [3/4] Creating commit...
echo.

REM Use provided message or generate timestamp message
if "%~1"=="" (
    REM Generate timestamp message
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
    for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a:%%b)
    set MESSAGE=Auto-sync %mydate% %mytime%
) else (
    set MESSAGE=%~1
)

echo Commit message: %MESSAGE%
git commit -m "%MESSAGE%"

echo.
echo [4/4] Pushing to GitHub...
git push
if errorlevel 1 (
    echo.
    echo ERROR: Failed to push to GitHub!
    echo Make sure you have internet connection.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Sync Complete!
echo ============================================================
echo Changes have been pushed to GitHub
echo.
pause
