@echo off
rem Scheduled task TheHybridLife_ZeppBridgeSync: pulls the last 12 days from the
rem Zepp cloud into ZeppBridge. ZeppBridge's own 30-day sync can use up its time
rem budget before it reaches weight (the last stream), so weight goes stale.
rem A 12-day window gets the same 90 s minimum budget and finishes in time.
rem Exit 4 = the desktop app holds the write lock; each try waits about 20 s.
cd /d "%~dp0.."
if not exist logs mkdir logs
set TRIES=0
:again
set /a TRIES+=1
echo [%date% %time%] try %TRIES% >> logs\zeppbridge-sync.log
"C:\Users\benbu\AppData\Local\ZeppBridge\zeppbridge-cli.exe" sync --mode history --days 12 --no-reprocess --json >> logs\zeppbridge-sync.log 2>&1
set CODE=%errorlevel%
echo exit %CODE% >> logs\zeppbridge-sync.log
if "%CODE%"=="4" if %TRIES% lss 30 goto again
exit /b %CODE%
