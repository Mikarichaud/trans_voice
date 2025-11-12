#!/bin/bash
# Script pour démarrer l'API Python

# Activer l'environnement virtuel si présent
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Démarrer l'API
python api.py


