@echo off
rem Scheduled task TheHybridLife_ZeppSync: ZeppBridge zepp.db -> Supabase sessions.
cd /d "%~dp0.."
if not exist logs mkdir logs
echo [%date% %time%] >> logs\zepp-sync.log
rem Renpho first, so the task's exit code stays the Zepp sync's.
"C:\Program Files\nodejs\node.exe" --no-warnings scripts\renpho-sync.mjs >> logs\zepp-sync.log 2>&1
"C:\Program Files\nodejs\node.exe" --no-warnings scripts\zepp-sync.mjs >> logs\zepp-sync.log 2>&1
