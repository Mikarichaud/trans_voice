# 🚀 Configuration Production transVoicer

## Fichiers Créés

### Dockerfiles
- ✅ `server/Dockerfile` - Backend Node.js (port 5030)
- ✅ `python/Dockerfile` - Backend Python FastAPI (port 8000)
- ✅ `frontend/Dockerfile` - Frontend React + Nginx (port 3030)

### Configuration
- ✅ `docker-compose.yml` - Orchestration des services
- ✅ `frontend/nginx.conf` - Configuration Nginx avec proxy
- ✅ `env.example` - Template des variables d'environnement
- ✅ `.dockerignore` (x4) - Fichiers à ignorer lors du build

### Scripts
- ✅ `deploy.sh` - Script de déploiement initial
- ✅ `update.sh` - Script de mise à jour

### Documentation
- ✅ `DEPLOY.md` - Guide complet de déploiement

## Architecture

```
Internet (port 3030)
    ↓
Frontend (Nginx)
    ├─> /api/* → Backend Node.js (port 5030, réseau Docker)
    ├─> /api/stt/* → Backend Python (port 8000, réseau Docker)
    ├─> /api/tts/* → Backend Python (port 8000, réseau Docker)
    └─> /ws → Backend Node.js WebSocket (port 5030, réseau Docker)
```

## Démarrage Rapide

1. **Configurer l'environnement** :
   ```bash
   cp env.example .env
   # Éditer .env avec vos valeurs (notamment GEMINI_API_KEY)
   ```

2. **Déployer** :
   ```bash
   ./deploy.sh
   ```

3. **Accéder à l'application** :
   - Frontend : http://localhost:3030

## Ports

- **3030** : Frontend (exposé publiquement)
- **5030** : Backend Node.js (réseau Docker uniquement)
- **8000** : Backend Python (réseau Docker uniquement)

## Variables d'Environnement

Voir `env.example` pour la liste complète. Variables importantes :

- `GEMINI_API_KEY` : Clé API Google Gemini (optionnel, fallback simulation)
- `WHISPER_MODEL_SIZE` : Taille du modèle Whisper (`tiny`, `small`, `base`, `medium`, `large`)
- `STT_LANGUAGE` : Langue de transcription (défaut: `pt`)
- `TTS_LANGUAGE` : Langue de synthèse vocale (défaut: `fr`)

## Modifications Apportées au Code

### Frontend
- ✅ `useSpeechRecognition.js` : URL WebSocket adaptative (production vs dev)
- ✅ `AudioUploader.jsx` : URL API Python adaptative (production vs dev)

### Nginx
- ✅ Proxy vers backend Node.js (`/api/*`)
- ✅ Proxy vers backend Python (`/api/stt/*`, `/api/tts/*`)
- ✅ Proxy WebSocket (`/ws`)
- ✅ Configuration de cache et sécurité

## Commandes Utiles

```bash
# Voir les logs
docker-compose logs -f

# Voir l'état
docker-compose ps

# Redémarrer un service
docker-compose restart [service_name]

# Reconstruire
docker-compose build --no-cache

# Arrêter
docker-compose down

# Mettre à jour
./update.sh
```

## Notes Importantes

1. **Premier démarrage** : Le modèle Whisper sera téléchargé automatiquement (peut prendre plusieurs minutes)

2. **Mémoire** : Whisper nécessite au moins 2-4GB de RAM selon le modèle

3. **Sécurité** : Seul le frontend est exposé publiquement. Les backends sont dans un réseau Docker privé.

4. **Performance** : Pour de meilleures performances, utilisez `WHISPER_MODEL_SIZE=tiny` ou `small`

## Support

Consultez `DEPLOY.md` pour plus de détails sur le déploiement et le dépannage.

