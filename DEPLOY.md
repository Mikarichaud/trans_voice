# Guide de Déploiement transVoicer

Ce guide explique comment déployer transVoicer en production avec Docker.

## Prérequis

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- Au moins 4GB de RAM disponible
- Au moins 10GB d'espace disque (pour les modèles Whisper)

## Structure du Déploiement

```
transVoicer/
├── frontend/          # React + Vite (port 3030)
├── server/            # Node.js backend (port 5030, réseau Docker)
├── python/            # Python FastAPI (port 8000, réseau Docker)
├── docker-compose.yml # Orchestration
├── deploy.sh          # Script de déploiement
└── update.sh          # Script de mise à jour
```

## Configuration

### 1. Créer le fichier .env

Copiez `env.example` vers `.env` et configurez les variables :

```bash
cp env.example .env
```

Éditez `.env` avec vos valeurs :

```env
# Backend Node.js
PORT=5030
NODE_ENV=production

# Backend Python
WHISPER_MODEL_SIZE=base
STT_LANGUAGE=pt
STT_PREPROCESS=false
TTS_ENGINE=pyttsx3
TTS_LANGUAGE=fr

# URLs (ne pas modifier en production Docker)
PYTHON_API_URL=http://python-backend:8000
FRONTEND_URL=http://localhost:3030

# API Keys
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Déploiement Initial

```bash
./deploy.sh
```

Le script va :
- Vérifier Docker et Docker Compose
- Créer `.env` depuis `env.example` si nécessaire
- Construire les images Docker
- Démarrer tous les conteneurs
- Afficher l'état des services

### 3. Vérification

Une fois déployé, vérifiez que tout fonctionne :

```bash
# Voir les logs
docker-compose logs -f

# Voir l'état des conteneurs
docker-compose ps

# Tester le frontend
curl http://localhost:3030/health

# Tester le backend Node.js (depuis le conteneur)
docker-compose exec backend curl http://localhost:5030/api/health

# Tester le backend Python (depuis le conteneur)
docker-compose exec python-backend curl http://localhost:8000/health
```

## Accès

- **Frontend** : http://localhost:3030
- **Backend Node.js** : Accessible uniquement via le réseau Docker (port 5030)
- **Backend Python** : Accessible uniquement via le réseau Docker (port 8000)

## Mise à Jour

Pour mettre à jour l'application :

```bash
./update.sh
```

Le script va :
- Récupérer les modifications Git (si applicable)
- Reconstruire les images
- Redémarrer les conteneurs
- Nettoyer les images inutilisées

## Commandes Utiles

### Gestion des Conteneurs

```bash
# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Redémarrer
docker-compose restart

# Voir les logs
docker-compose logs -f [service_name]

# Voir l'état
docker-compose ps
```

### Maintenance

```bash
# Reconstruire une image spécifique
docker-compose build --no-cache [service_name]

# Entrer dans un conteneur
docker-compose exec [service_name] sh

# Voir l'utilisation des ressources
docker stats

# Nettoyer les images inutilisées
docker image prune -f

# Nettoyer tout (images, volumes, réseaux)
docker system prune -a --volumes
```

## Dépannage

### Les conteneurs ne démarrent pas

1. Vérifiez les logs : `docker-compose logs`
2. Vérifiez que les ports 3030 et 5030 ne sont pas utilisés
3. Vérifiez que `.env` existe et est correctement configuré

### Le frontend ne se connecte pas au backend

1. Vérifiez que le backend Node.js est en cours d'exécution : `docker-compose ps`
2. Vérifiez les logs du backend : `docker-compose logs backend`
3. Vérifiez la configuration nginx : `docker-compose exec frontend cat /etc/nginx/conf.d/default.conf`

### Le backend Python ne répond pas

1. Vérifiez que le modèle Whisper est téléchargé (première exécution peut prendre du temps)
2. Vérifiez les logs : `docker-compose logs python-backend`
3. Vérifiez que ffmpeg est installé : `docker-compose exec python-backend ffmpeg -version`

### Problèmes de mémoire

Si vous rencontrez des problèmes de mémoire avec Whisper :
- Réduisez `WHISPER_MODEL_SIZE` à `tiny` ou `small` dans `.env`
- Augmentez la RAM disponible pour Docker

## Architecture Réseau

```
Internet
   │
   └─> Frontend (nginx) :3030
          │
          ├─> /api/* → Backend Node.js :5030
          └─> /ws → Backend Node.js :5030 (WebSocket)
                    │
                    └─> Python Backend :8000 (réseau Docker)
```

Tous les services communiquent via le réseau Docker `transvoice-network`.

## Sécurité

- Le backend Node.js et Python ne sont **pas exposés** publiquement
- Seul le frontend (nginx) est accessible sur le port 3030
- Toutes les communications internes se font via le réseau Docker privé
- Configurez un firewall si nécessaire

## Performance

### Optimisations Recommandées

1. **Whisper Model Size** : Utilisez `tiny` ou `small` pour de meilleures performances
2. **Préprocessing** : Désactivez `STT_PREPROCESS=false` si vous avez des problèmes de performance
3. **Ressources** : Allouez au moins 4GB de RAM à Docker

### Monitoring

```bash
# Utilisation des ressources en temps réel
docker stats

# Logs en temps réel
docker-compose logs -f
```

## Support

Pour plus d'informations, consultez :
- `README.md` : Documentation générale
- `QUICKSTART.md` : Guide de démarrage rapide
- Logs Docker : `docker-compose logs`

