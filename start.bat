@echo off
REM Seven Dreams World - prototype launcher
REM Uses serve.py (Range-enabled HTTP/1.1) so mp4 video plays correctly.
cd /d "%~dp0"

echo Starting local server: http://localhost:8000
echo Keep this window open. Press Ctrl+C to stop.
echo.

start "" http://localhost:8000/index.html

python serve.py 8000
if errorlevel 1 py serve.py 8000
