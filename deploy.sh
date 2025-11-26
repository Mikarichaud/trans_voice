#!/bin/bash

# Script de déploiement pour transVoicer
# Usage: ./deploy.sh

set -e

echo "🚀 Déploiement de transVoicer..."
echo ""

# Vérifications Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé"
    exit 1
fi

# Vérifier .env
if [ ! -f .env ]; then
    echo "⚠️  Le fichier .env n'existe pas"
    echo "📝 Création depuis env.example..."
    if [ -f env.example ]; then
        cp env.example .env
        echo "✅ Fichier .env créé. Veuillez le modifier avec vos valeurs."
        echo "⚠️  N'oubliez pas de configurer GEMINI_API_KEY et autres variables nécessaires"
    else
        echo "❌ Le fichier env.example n'existe pas non plus"
        exit 1
    fi
fi

# Charger les variables
set -a
source .env
set +a

# Construire et démarrer
echo "🔨 Construction des images..."
docker-compose build

echo "🛑 Arrêt des conteneurs existants..."
docker-compose down

echo "▶️  Démarrage des conteneurs..."
docker-compose up -d

echo "⏳ Attente du démarrage..."
sleep 15

echo "📊 État des conteneurs:"
docker-compose ps

echo ""
echo "✅ Déploiement terminé!"
echo ""
echo "🌐 Frontend disponible sur: http://localhost:3030"
echo "🔧 Backend Node.js: http://localhost:5030 (réseau Docker uniquement)"
echo "🐍 Backend Python: http://python-backend:8000 (réseau Docker uniquement)"
echo ""
echo "📝 Pour voir les logs: docker-compose logs -f"
echo "🛑 Pour arrêter: docker-compose down"

