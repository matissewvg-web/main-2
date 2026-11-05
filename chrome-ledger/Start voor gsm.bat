@echo off
title Chrome Ledger - gsm
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py tools\ui.py --gsm) else (python tools\ui.py --gsm)
if errorlevel 1 (
  echo.
  echo Python niet gevonden of er ging iets mis. Installeer Python 3 via https://www.python.org/downloads/ en vink "Add to PATH" aan.
)
pause
