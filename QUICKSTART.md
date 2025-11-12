# 🚀 Guide de démarrage rapide

## Installation rapide

```bash
# 1. Installer toutes les dépendances
npm run install:all

# 2. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env et ajouter votre GEMINI_API_KEY

# 3. Installer et démarrer le service Python
cd python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python api.py

# 4. Dans un autre terminal, démarrer l'application
cd ..
npm run dev
```

## Obtenir une clé API Gemini

1. Allez sur [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Créez une nouvelle clé API
3. Copiez-la dans votre fichier `.env` :
   ```
   GEMINI_API_KEY=votre_cle_api_ici
   ```

## Utilisation

1. Ouvrez http://localhost:3000 dans votre navigateur
2. Autorisez l'accès au microphone
3. Cliquez sur le bouton d'enregistrement
4. Parlez en portugais
5. La transcription et la traduction apparaîtront automatiquement
6. Cliquez sur "Lire la traduction" pour entendre le résultat

## Configuration STT (Speech-to-Text)

### Option recommandée : Service Python (Whisper)

1. Installez les dépendances Python :
```bash
cd python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. Démarrez le service Python :
```bash
python api.py
```

Le service Python utilise Whisper (modèle local) pour le STT avec pré-traitement audio (VAD, réduction de bruit).

**Note** : Le traitement STT est 100% local, aucune API externe n'est nécessaire.

## Dépannage

### Le microphone ne fonctionne pas
- Vérifiez que vous avez autorisé l'accès au microphone dans votre navigateur
- Utilisez HTTPS en production (requis pour certains navigateurs)

### La traduction ne fonctionne pas
- Vérifiez que `GEMINI_API_KEY` est correctement configurée dans `.env`
- Vérifiez votre connexion internet

### Erreur WebSocket
- Vérifiez que le serveur backend est démarré (port 3001)
- Vérifiez les logs du serveur pour plus de détails

### Erreur STT (Speech-to-Text)
- Vérifiez que le service Python est démarré (port 8000)
- Vérifiez que vous avez installé toutes les dépendances Python
- Consultez les logs du service Python pour plus de détails

