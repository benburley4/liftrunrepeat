@echo off
rem Scheduled task TheHybridLife_ZeppSyncPoll (every minute): answers the site's "Sync now".
cd /d "%~dp0.."
if not exist logs mkdir logs
"C:\Program Files\nodejs\node.exe" --no-warnings scripts\zepp-sync-poll.mjs >> logs\zepp-sync.log 2>&1
