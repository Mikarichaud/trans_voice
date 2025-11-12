# 🎯 transVoicer

Application web de traduction vocale intelligente : **Speech-to-Text → Traduction → Text-to-Speech**

## 🧭 Description

Application web interactive développée en React permettant de :
- 🎙️ Parler en portugais (voix → texte)
- 📝 Transcrire automatiquement le discours (Speech-to-Text)
- 🌍 Traduire le texte via une IA linguistique (Gemini)
- 🔊 Lire la traduction à voix haute (Text-to-Speech)

## 🏗️ Architecture

### Frontend (React)
- **MicrophoneRecorder** : Capture audio depuis le navigateur
- **SpeechToText** : Envoi des fragments audio au serveur via WebSocket
- **TranslationDisplay** : Affichage du texte original + traduction
- **TextToSpeechPlayer** : Lecture vocale de la traduction
- **MetricsPanel** : Métriques de latence, qualité, état du micro et logs

### Backend (Node.js)
- **WebSocket Server** : Communication temps réel pour l'audio
- **Audio Processor** : Intégration avec le service Python STT
- **Translation Service** : Intégration avec l'API Gemini pour la traduction

### Services Python (Cœur du projet)
- **AudioPreprocessor** : Pré-traitement audio (VAD, réduction de bruit, normalisation, MFCC)
- **SpeechToTextService** : STT avec Whisper (modèle local), support multi-modèles
- **TextToSpeechService** : TTS avec pyttsx3 (offline) et gTTS (online)
- **FastAPI** : API REST pour exposer les services STT/TTS

## 🚀 Installation

### Prérequis
- Node.js 18+ et npm
- Python 3.8+ et pip
- Clé API Google Gemini (pour la traduction)

### Étapes

1. **Installer les dépendances Node.js**
```bash
npm run install:all
```

2. **Installer les dépendances Python**
```bash
cd python
python3 -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

3. **Configurer les variables d'environnement**
```bash
cp .env.example .env
# Éditer .env et ajouter votre GEMINI_API_KEY

# Configurer Python (optionnel)
cd python
cp .env.example .env  # Si vous avez un .env.example Python
# Configurer WHISPER_MODEL_SIZE, TTS_ENGINE, etc.
cd ..
```

4. **Démarrer tous les services**
```bash
# Terminal 1 : Service Python
cd python
source venv/bin/activate
python api.py

# Terminal 2 : Frontend + Backend Node.js
npm run dev
```

L'application sera accessible sur :
- Frontend : http://localhost:3000
- Backend API : http://localhost:3001
- WebSocket : ws://localhost:3001/ws
- Python API : http://localhost:8000

## 📦 Structure du projet

```
trans_voice/
├── frontend/              # Application React
│   ├── src/
│   │   ├── components/    # Composants React
│   │   ├── hooks/        # Hooks personnalisés
│   │   └── App.jsx       # Composant principal
│   └── package.json
├── server/                # Backend Node.js
│   ├── index.js          # Serveur Express + WebSocket
│   ├── audioProcessor.js # Intégration service Python STT
│   └── translationService.js # Service de traduction
├── python/               # Services Python (Cœur du projet)
│   ├── services/
│   │   ├── audio_preprocessor.py  # Pré-traitement audio
│   │   ├── speech_to_text.py     # Service STT avec Whisper
│   │   └── text_to_speech.py     # Service TTS
│   ├── api.py            # API FastAPI
│   └── requirements.txt
├── package.json
└── .env                   # Variables d'environnement
```

## 🔧 Configuration STT & TTS

### Service Python (Cœur du projet)

Le service Python utilise **Whisper** (modèle local) pour le STT avec :
- **Pré-traitement audio** : VAD (Voice Activity Detection), réduction de bruit, normalisation
- **Modèles Whisper** : tiny, base, small, medium, large (configurable)
- **Métriques** : Latence, WER (Word Error Rate)
- **100% local** : Aucune dépendance à des APIs externes pour le STT

**Configuration** dans `python/.env` :
```env
WHISPER_MODEL_SIZE=base  # tiny, base, small, medium, large
STT_LANGUAGE=pt
STT_PREPROCESS=true
TTS_ENGINE=pyttsx3  # ou gtts
TTS_LANGUAGE=fr
```

**Note** : Le package `openai-whisper` est le modèle Whisper d'OpenAI mais utilisé localement, pas via API.

### Autres services (optionnel)
Vous pouvez modifier `python/services/speech_to_text.py` pour intégrer d'autres modèles :
- Google Cloud Speech-to-Text
- Azure Speech Services
- Wav2Vec2 (modèle local)

## 📊 Métriques

L'application affiche en temps réel :
- **Enregistrement** : Durée, chunks, données, débit
- **Traduction** : Latence, nombre de mots
- **TTS** : Latence, durée de lecture
- **Logs techniques** : Événements système

## 🧪 Aspect scientifique

Le projet s'appuie sur des concepts fondamentaux du traitement de la voix :

### Pré-traitement audio
- **VAD (Voice Activity Detection)** : Détection d'activité vocale avec webrtcvad
- **Réduction de bruit** : Spectral gating avec noisereduce
- **Normalisation** : Normalisation RMS pour uniformiser l'amplitude
- **Caractéristiques acoustiques** : Extraction MFCC et log-Mel spectrogramme

### Reconnaissance vocale (STT)
- **Modèle Whisper** : Architecture Transformer avec encoder-decoder
- **Support multi-langues** : Détection automatique ou spécification de langue
- **Pré-traitement** : Optimisation audio avant transcription

### Évaluation STT
- **WER (Word Error Rate)** : Calcul de taux d'erreur de mots
- **Latence end-to-end** : Mesure du temps de traitement complet
- **Robustesse** : Test avec bruit, accents, différents environnements

### Synthèse vocale (TTS)
- **Moteurs disponibles** : pyttsx3 (offline) et gTTS (online)
- **Métriques** : Latence de génération, durée audio
- **Qualité** : Intelligibilité et prosodie

## 🌐 PWA

L'application est configurée comme Progressive Web App (PWA) et peut être installée sur mobile (iOS/Android).

## 📝 Notes

- **Service Python** : Le cœur du projet (STT/TTS) est en Python. Assurez-vous de démarrer l'API Python avant le backend Node.js
- **Whisper** : Le modèle sera téléchargé automatiquement au premier usage (peut prendre du temps)
- **Traduction** : Nécessite une clé API Gemini valide
- **TTS** : pyttsx3 fonctionne offline mais la qualité dépend du système. gTTS nécessite internet mais offre une meilleure qualité

## 📚 Documentation supplémentaire

- **Service Python** : Voir `python/README.md` pour plus de détails
- **Guide rapide** : Voir `QUICKSTART.md` pour démarrer rapidement

## 📄 Licence

MIT
