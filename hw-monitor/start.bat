@echo off
:: Prompt for Administrator privileges automatically
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges to read hardware sensors...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

title Nexus Hardware Monitor
echo Starting Nexus Hardware Monitor...
echo.
echo Running as Administrator to read motherboard and CPU core temperatures.
echo.

:: Ensure dependencies are installed
if not exist "node_modules\" (
    echo Installing dependencies for first run...
    call npm install
)

:: Kill any existing non-admin LHM and restart with admin privileges
taskkill /IM LibreHardwareMonitor.exe /F >nul 2>&1
echo Starting LibreHardwareMonitor with admin privileges for sensor access...
start "" /MIN "%~dp0LHM\LibreHardwareMonitor.exe"
echo Waiting for LHM to initialize WMI sensors...
timeout /t 8 >nul


:: Run Next.js server in the background
start /B cmd /c "timeout /t 5 >nul & start msedge --app=http://localhost:3005"

:: Run server in foreground so closing window kills it
call npm run dev -- -p 3005
