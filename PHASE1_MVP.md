# 🎯 Phase 1 - Version MVP (Minimum Viable Product)

## 📋 Vue d'ensemble

Cette version représente le **point de départ** du projet transVoicer avec les fonctionnalités essentielles pour démontrer le concept de traduction vocale.

---

## ✨ Fonctionnalités Incluses

### Frontend
- ✅ Enregistrement audio via microphone
- ✅ Affichage transcription (texte original)
- ✅ Affichage traduction (texte traduit)
- ✅ Interface simple et fonctionnelle

### Backend Node.js
- ✅ Serveur Express basique
- ✅ WebSocket pour communication temps réel
- ✅ Route API traduction (`/api/translate`)
- ✅ Intégration API Gemini

### Backend Python
- ✅ API FastAPI basique
- ✅ Service STT avec Whisper (modèle "base")
- ✅ Transcription audio simple

---

## 🚀 Installation Phase 1

### Prérequis
- Node.js 18+
- Python 3.8+
- Clé API Google Gemini

### Étapes

#### 1. Frontend (React)

**Dépendances minimales** :
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "vite": "^5.0.8",
    "@vitejs/plugin-react": "^4.2.1"
  }
}
```

**Installation** :
```bash
cd frontend
npm install
```

#### 2. Backend Node.js

**Dépendances minimales** :
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "axios": "^1.6.2",
    "@google/generative-ai": "^0.2.1",
    "dotenv": "^16.3.1"
  }
}
```

**Installation** :
```bash
npm install
```

#### 3. Backend Python

**Dépendances minimales** :
```txt
fastapi>=0.104.1
uvicorn[standard]>=0.24.0
python-multipart>=0.0.6
openai-whisper>=20231117
torch>=2.1.0
librosa>=0.10.1
soundfile>=0.12.1
numpy>=1.26.0
```

**Installation** :
```bash
cd python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 📁 Structure Phase 1

### Frontend
```
frontend/src/
├── main.jsx
├── App.jsx                    # Version simple
├── App.css                    # Styles basiques
├── index.css                  # Reset simple
├── components/
│   ├── MicrophoneRecorder.jsx # Version basique
│   └── TranslationDisplay.jsx  # Version basique
└── hooks/
    ├── useSpeechRecognition.js # Version simplifiée
    └── useTranslation.js       # Version simplifiée
```

### Backend Node.js
```
server/
├── index.js                   # Version simple
└── translationService.js      # Version basique
```

### Backend Python
```
python/
├── api.py                     # Version simple
└── services/
    └── speech_to_text.py     # Version simplifiée
```

---

## 🔧 Configuration Phase 1

### Variables d'environnement

**`.env` (racine)** :
```env
PORT=3001
GEMINI_API_KEY=your_key_here
```

**`python/.env`** :
```env
PYTHON_API_PORT=8000
WHISPER_MODEL_SIZE=base
STT_LANGUAGE=pt
```

---

## 🎨 Code Simplifié Phase 1

### Frontend - useSpeechRecognition (Simplifié)

```javascript
import { useState, useRef, useEffect } from 'react'

export const useSpeechRecognition = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioStreamRef = useRef(null)

  // Connexion WebSocket simple
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/ws')
    wsRef.current = ws
    
    ws.onopen = () => {
      console.log('WebSocket connecté')
    }
    
    return () => {
      ws.close()
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.ondataavailable = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(event.data)
        }
      }
      
      mediaRecorder.start(100)
      setIsRecording(true)
    } catch (err) {
      setError(err.message)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      // Envoyer signal de fin
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'end' }))
      }
      
      // Arrêter stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
    wsRef
  }
}
```

### Backend Node.js - index.js (Simplifié)

```javascript
const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const { translateText } = require('./translationService')
const axios = require('axios')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

app.use(express.json())

let audioChunks = []

wss.on('connection', (ws) => {
  console.log('Nouvelle connexion WebSocket')
  
  ws.on('message', async (data) => {
    try {
      // Vérifier si c'est un signal de fin
      if (data.toString().startsWith('{')) {
        const message = JSON.parse(data.toString())
        if (message.type === 'end') {
          // Traiter l'audio accumulé
          const audioBuffer = Buffer.concat(audioChunks)
          audioChunks = []
          
          // Envoyer à l'API Python
          const formData = new FormData()
          formData.append('file', audioBuffer, { filename: 'audio.webm' })
          
          const response = await axios.post(
            'http://localhost:8000/api/stt/transcribe',
            formData,
            { headers: formData.getHeaders() }
          )
          
          const transcription = response.data.text
          
          // Envoyer transcription au client
          ws.send(JSON.stringify({
            type: 'transcription',
            text: transcription
          }))
          
          // Traduire
          const translatedText = await translateText(transcription, 'fr')
          
          // Envoyer traduction au client
          ws.send(JSON.stringify({
            type: 'translation',
            text: translatedText
          }))
        }
      } else {
        // Accumuler chunks audio
        audioChunks.push(Buffer.from(data))
      }
    } catch (error) {
      console.error('Erreur:', error)
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }))
    }
  })
})

app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body
    const translatedText = await translateText(text, targetLanguage || 'fr')
    res.json({ translatedText })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

server.listen(3001, () => {
  console.log('Serveur démarré sur le port 3001')
})
```

### Backend Python - speech_to_text.py (Simplifié)

```python
import whisper
import torch
import tempfile
import os

class SpeechToTextService:
    def __init__(self, model_size="base", language="pt"):
        self.model_size = model_size
        self.language = language
        
        # Détecter device
        device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device
        
        # Charger modèle
        self.model = whisper.load_model(model_size, device=device)
    
    def transcribe(self, audio_path: str) -> dict:
        # Transcription simple
        result = self.model.transcribe(
            audio_path,
            language=self.language,
            task="transcribe"
        )
        
        return {
            "text": result["text"].strip(),
            "language": result.get("language", self.language)
        }
```

---

## 🚀 Démarrage Phase 1

### 1. Démarrer le service Python
```bash
cd python
source venv/bin/activate
python api.py
```

### 2. Démarrer le serveur Node.js
```bash
npm start
# ou
node server/index.js
```

### 3. Démarrer le frontend
```bash
cd frontend
npm run dev
```

### 4. Ouvrir dans le navigateur
```
http://localhost:3000
```

---

## ⚠️ Limitations Phase 1

### Fonctionnalités non incluses
- ❌ Upload de fichiers audio
- ❌ Text-to-Speech (lecture vocale)
- ❌ Métriques et logs techniques
- ❌ Pré-traitement audio avancé
- ❌ Gestion d'erreurs robuste
- ❌ Reconnexion automatique WebSocket
- ❌ Thème sombre professionnel
- ❌ Responsive design avancé

### Simplifications
- Pas de gestion sessions avancée
- Pas de retry automatique
- Pas de fallback simulation
- Pas de validation audio complexe
- Pas de rechargement modèle
- Pas de threading.Lock

---

## 📝 Prochaines Étapes

Pour migrer vers **Phase 2** (version finale), consultez :
- `ARCHITECTURE_PHASES.md` : Guide de migration complet
- `QUICKSTART.md` : Guide de la version finale

---

## ✅ Checklist Phase 1

### Fonctionnalités de base
- [x] Enregistrement audio
- [x] Transcription (STT)
- [x] Traduction (Gemini)
- [x] Affichage résultats
- [x] Communication WebSocket
- [x] API REST traduction

### Tests
- [ ] Test enregistrement audio
- [ ] Test transcription
- [ ] Test traduction
- [ ] Test WebSocket
- [ ] Test erreurs basiques

---

## 🎓 Objectifs Pédagogiques Phase 1

Cette version permet de comprendre :
1. **Concepts de base** : WebSocket, MediaRecorder, API REST
2. **Architecture simple** : Frontend → Backend → Services
3. **Intégration services** : Whisper, Gemini
4. **Flux de données** : Audio → Transcription → Traduction

Une fois ces concepts maîtrisés, vous pouvez progresser vers **Phase 2** pour découvrir les optimisations et fonctionnalités avancées.


