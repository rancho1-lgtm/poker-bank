@echo off
title בנק פוקר של רן ולימלימ
cd /d "%~dp0"

echo.
echo  בודק Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  שגיאה: Node.js לא מותקן!
    echo  הורד מ: https://nodejs.org
    pause
    exit /b 1
)

echo  מתקין חבילות...
call npm install --silent

echo  מפעיל שרת...
echo.
start "" http://localhost:3000
node server.js
pause
