@echo off
cd /d "%~dp0"
where py >nul 2>nul && (py build.py) || (python build.py)
echo.
pause
