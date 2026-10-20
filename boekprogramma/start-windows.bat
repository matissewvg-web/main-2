@echo off
rem Dubbelklik om het boekschrijfprogramma te starten.
cd /d "%~dp0"

if not exist .venv (
  echo Eerste keer: Python-omgeving maken...
  py -3 -m venv .venv 2>nul || python -m venv .venv
  if errorlevel 1 (
    echo Python is niet gevonden. Installeer Python 3 van python.org en vink "Add python.exe to PATH" aan.
    pause
    exit /b 1
  )
)

fc /b requirements.txt .venv\requirements.txt >nul 2>&1
if errorlevel 1 (
  echo Onderdelen installeren...
  .venv\Scripts\python -m pip install -q -r requirements.txt && copy /y requirements.txt .venv\requirements.txt >nul
)

rem WeasyPrint heeft op Windows Pango nodig, bijvoorbeeld via MSYS2 (zie README).
if exist C:\msys64\mingw64\bin set WEASYPRINT_DLL_DIRECTORIES=C:\msys64\mingw64\bin

.venv\Scripts\python app.py
pause
