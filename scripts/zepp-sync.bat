@echo off
rem Scheduled task TheHybridLife_ZeppSync: ZeppBridge zepp.db -> Supabase sessions.
cd /d "%~dp0.."
if not exist logs mkdir logs
echo [%date% %time%] >> logs\zepp-sync.log
"C:\Program Files\nodejs\node.exe" --no-warnings scripts\zepp-sync.mjs >> logs\zepp-sync.log 2>&1
