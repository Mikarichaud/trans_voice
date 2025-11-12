# 🐍 Services Python - STT & TTS

Services Python pour Speech-to-Text et Text-to-Speech utilisant Whisper et pyttsx3/gTTS.

## 📦 Installation

### 1. Créer un environnement virtuel (recommandé)

```bash
cd python
python3 -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
```

### 2. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 3. Télécharger le modèle Whisper

Le modèle Whisper sera téléchargé automatiquement au premier usage. Vous pouvez aussi le télécharger manuellement :

```python
import whisper
whisper.load_model("base")  # ou "small", "medium", "large"
```

## 🚀 Utilisation

### Démarrer l'API FastAPI

```bash
python api.py
```

L'API sera accessible sur http://localhost:8000

### Variables d'environnement

Créez un fichier `.env` dans le dossier `python/` :

```env
# Configuration STT
WHISPER_MODEL_SIZE=base  # tiny, base, small, medium, large
STT_LANGUAGE=pt
STT_PREPROCESS=true

# Configuration TTS
TTS_ENGINE=pyttsx3  # ou gtts
TTS_LANGUAGE=fr

# Port de l'API
PYTHON_API_PORT=8000
```

## 📚 Services disponibles

### 1. AudioPreprocessor

Pré-traitement audio avec :
- VAD (Voice Activity Detection)
- Réduction de bruit
- Normalisation
- Filtrage passe-bas
- Extraction MFCC et log-Mel spectrogramme

### 2. SpeechToTextService

Service STT avec Whisper :
- Support de plusieurs modèles (tiny à large)
- Pré-traitement optionnel
- Calcul de métriques (latence, WER)
- Support de plusieurs langues

### 3. TextToSpeechService

Service TTS avec :
- **pyttsx3** : Offline, multi-plateforme
- **gTTS** : Google TTS (nécessite internet)
- Configuration de vitesse, volume, voix

## 🔧 API Endpoints

### STT

- `POST /api/stt/transcribe` - Transcrit un fichier audio
- `POST /api/stt/transcribe-stream` - Transcrit un buffer audio
- `GET /api/stt/info` - Informations sur le service STT

### TTS

- `POST /api/tts/synthesize` - Synthétise du texte en audio
- `GET /api/tts/voices` - Liste des voix disponibles
- `GET /api/tts/info` - Informations sur le service TTS

### Santé

- `GET /health` - Vérification de santé
- `GET /` - Informations sur l'API

## 📊 Métriques

Les services retournent des métriques :
- **Latence** : Temps de traitement
- **WER** : Word Error Rate (pour STT)
- **Durée** : Durée de l'audio généré (pour TTS)

## 🧪 Tests

```python
# Test STT
from services.speech_to_text import SpeechToTextService

stt = SpeechToTextService(model_size="base", language="pt")
result = stt.transcribe("audio.wav")
print(result["text"])

# Test TTS
from services.text_to_speech import TextToSpeechService

tts = TextToSpeechService(engine="pyttsx3", language="fr")
audio_bytes, metadata = tts.synthesize("Bonjour, comment allez-vous?")
```

## 🔍 Pré-traitement audio

Le pré-traitement inclut :
1. **VAD** : Détection d'activité vocale (webrtcvad)
2. **Réduction de bruit** : noisereduce
3. **Normalisation** : Normalisation RMS
4. **Filtrage** : Filtre passe-bas 8kHz

## 📝 Notes

- Whisper nécessite PyTorch (installé automatiquement)
- Les modèles plus grands (medium, large) sont plus précis mais plus lents
- pyttsx3 fonctionne offline mais la qualité dépend du système
- gTTS nécessite internet mais offre une meilleure qualité


