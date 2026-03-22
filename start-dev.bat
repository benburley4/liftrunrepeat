@echo off
taskkill /F /IM node.exe 2>/dev/null
cd /d "C:\Users\benbu\OneDrive\AI Projects\TheHybridLife"
if exist .next rmdir /s /q .next
npm run dev
pause
