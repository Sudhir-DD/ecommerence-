@echo off
title Smart Price Shopping Cart
rem Double-click to run the app. Close this window (or press Ctrl+C) to stop it.
cd /d "%~dp0"

if not exist node_modules (
    echo Installing dependencies...
    call npm.cmd install || goto :failed
)

rem Port 3000 already taken? Usually an old copy of the app is still running.
netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul
if not errorlevel 1 (
    echo.
    echo Port 3000 is already in use - another copy of the app is probably still running.
    echo Close that window first, or open http://localhost:3000 to use it.
    goto :failed
)

echo Starting the app - open http://localhost:3000 in your browser.
echo It restarts automatically when files change. Close this window to stop it.
echo.
start "" http://localhost:3000
node --watch server.js

:failed
echo.
pause
