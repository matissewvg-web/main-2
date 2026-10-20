#!/bin/bash
# Dubbelklik om het boekschrijfprogramma te starten.
cd "$(dirname "$0")" || exit 1

if [ ! -d .venv ]; then
  echo "Eerste keer: Python-omgeving maken..."
  python3 -m venv .venv || { echo "Python 3 niet gevonden. Installeer het van python.org."; exit 1; }
fi

if ! cmp -s requirements.txt .venv/requirements.txt; then
  echo "Onderdelen installeren..."
  .venv/bin/python -m pip install -q -r requirements.txt && cp requirements.txt .venv/requirements.txt
fi

# WeasyPrint vindt Pango van Homebrew niet altijd vanzelf (zie README).
[ -d /opt/homebrew/lib ] && export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib

exec .venv/bin/python app.py
