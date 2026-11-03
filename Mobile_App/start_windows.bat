@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ASAR AI mobile project
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js installed емес. https://nodejs.org/ бойынша Node.js орнатыңыз.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Пакеттер орнатылуда...
  call npm install
  if errorlevel 1 (echo npm install қатесі & pause & exit /b 1)
)
echo Expo Go қолданбасын телефонға орнатыңыз (SDK 54), содан соң QR-ды сканерлеңіз.
call npx expo start
pause
