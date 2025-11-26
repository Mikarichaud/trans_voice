#!/bin/bash

# Script de mise à jour pour transVoicer
# Usage: ./update.sh

set -e

echo "🔄 Mise à jour transVoicer..."

# Pull des modifications (si Git)
if [ -d ".git" ]; then
    echo "📥 Récupération des modifications Git..."
    git pull
fi

# Rebuild
echo "🔨 Reconstruction des images..."
docker-compose build --no-cache

# Redémarrage
echo "🔄 Redémarrage des conteneurs..."
docker-compose down
docker-compose up -d

# Nettoyage
echo "🧹 Nettoyage des images inutilisées..."
docker image prune -f

echo "⏳ Attente du démarrage..."
sleep 10

echo "📊 État des conteneurs:"
docker-compose ps

echo ""
echo "✅ Mise à jour terminée!"

