# 🔍 Analyse Technique Détaillée - Dossier Python

## 📋 Vue d'ensemble

Le dossier `python/` contient une **API FastAPI** complète pour les services de **Speech-to-Text (STT)** et **Text-to-Speech (TTS)**, utilisant principalement **OpenAI Whisper** pour la transcription et **pyttsx3/gTTS** pour la synthèse vocale.

---

## 🏗️ Architecture

### Structure des fichiers

```
python/
├── api.py                    # Point d'entrée FastAPI (343 lignes)
├── requirements.txt          # Dépendances Python (35 lignes)
├── README.md                 # Documentation utilisateur
├── run_api.sh                # Script de démarrage
└── services/
    ├── __init__.py           # Exports des services
    ├── speech_to_text.py     # Service STT avec Whisper (657 lignes)
    ├── text_to_speech.py     # Service TTS (283 lignes)
    └── audio_preprocessor.py  # Pré-traitement audio (246 lignes)
```

### Flux de données

```
Client (Frontend)
    ↓
FastAPI (api.py)
    ↓
Services (services/)
    ├── SpeechToTextService → Whisper → Transcription
    ├── TextToSpeechService → pyttsx3/gTTS → Audio
    └── AudioPreprocessor → VAD/Noise Reduction → Audio nettoyé
```

---

## 🔧 Technologies et Dépendances

### Framework Web
- **FastAPI** (≥0.104.1) : Framework moderne, asynchrone, avec validation automatique
- **Uvicorn** (≥0.24.0) : Serveur ASGI haute performance
- **Pydantic** (≥2.5.0) : Validation de données et modèles

### Traitement Audio
- **librosa** (≥0.10.1) : Analyse et traitement audio avancé
- **soundfile** (≥0.12.1) : Lecture/écriture de fichiers audio
- **pydub** (≥0.25.1) : Manipulation audio (nécessite ffmpeg)
- **numpy** (≥1.26.0) : Calculs numériques
- **scipy** (≥1.11.4) : Traitement du signal

### Speech-to-Text
- **openai-whisper** (≥20231117) : Modèle Whisper local (pas d'API)
- **torch** (≥2.1.0) : Framework PyTorch pour Whisper
- **torchaudio** (≥2.1.0) : Utilitaires audio PyTorch

### Pré-traitement Audio
- **webrtcvad** (≥2.0.10) : Voice Activity Detection (VAD)
- **silero-vad** (≥4.0.0) : VAD alternatif
- **noisereduce** (≥3.0.0) : Réduction de bruit

### Text-to-Speech
- **pyttsx3** (≥2.90) : TTS offline multi-plateforme
- **gTTS** (≥2.4.0) : Google TTS (nécessite internet)

### Utilitaires
- **python-multipart** : Gestion des uploads de fichiers
- **python-dotenv** : Variables d'environnement
- **aiofiles** : I/O asynchrone pour fichiers

---

## 📦 Services Détaillés

### 1. API FastAPI (`api.py`)

#### Points clés techniques

**Initialisation asynchrone** :
```python
@app.on_event("startup")
async def startup_event():
    # Initialisation des services au démarrage
    # Configuration via variables d'environnement
```

**CORS configuré** :
- Actuellement `allow_origins=["*"]` (à restreindre en production)
- Support complet des méthodes et headers

**Endpoints principaux** :

1. **`POST /api/stt/transcribe`**
   - Upload de fichier audio (multipart/form-data)
   - Paramètres : `language`, `task`, `temperature`
   - **Gestion robuste des fichiers temporaires** :
     - Validation de taille (fichier vide)
     - Nettoyage automatique dans `finally`
     - Nettoyage agressif des fichiers pré-traités (< 5 min)

2. **`POST /api/stt/transcribe-stream`**
   - Transcription de buffer audio en mémoire
   - Pour streaming en temps réel

3. **`POST /api/tts/synthesize`**
   - Synthèse vocale avec pyttsx3 ou gTTS
   - Retourne audio en WAV ou MP3
   - Headers personnalisés : `X-Duration`, `X-Latency`

4. **`GET /api/stt/info`** et **`GET /api/tts/info`**
   - Métadonnées sur les services

5. **`GET /health`**
   - Vérification de santé des services

#### Gestion des erreurs
- **HTTPException** avec codes appropriés (400, 500, 503)
- Logging détaillé avec `logging`
- Nettoyage garanti des fichiers temporaires dans `finally`

---

### 2. SpeechToTextService (`services/speech_to_text.py`)

#### Architecture technique

**Initialisation** :
- Détection automatique du device (CUDA > CPU, MPS désactivé)
- Chargement du modèle Whisper (tiny/base/small/medium/large)
- Pré-processeur optionnel (AudioPreprocessor)

**Problèmes résolus** :

1. **État persistant de Whisper** :
   - **Solution radicale** : Rechargement du modèle avant chaque transcription (`_reload_model()`)
   - Lock thread-safe (`threading.Lock`) pour éviter les conflits
   - Nettoyage agressif du cache PyTorch (`torch.cuda.empty_cache()`, `gc.collect()`)

2. **Hallucinations MPS** :
   - MPS (Metal Performance Shaders) désactivé temporairement
   - Problème : Répétitions "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
   - Solution : Forcer CPU pour stabilité

3. **Corruption audio** :
   - Validation robuste des fichiers (taille, durée, échantillons)
   - Double vérification avec `librosa` et `pydub`
   - Chargement direct avec `librosa.load()` → passage de NumPy array à Whisper
   - Évite les problèmes de compatibilité `ffmpeg`/`pydub`

**Méthode `transcribe()` - Points techniques** :

```python
# 1. Validation du fichier
if not os.path.exists(audio_path) or os.path.getsize(audio_path) == 0:
    raise ValueError("Fichier invalide")

# 2. Conversion de format
converted_path = self._ensure_format(audio_path)  # WebM → WAV

# 3. Rechargement du modèle (SOLUTION RADICALE)
self._reload_model()  # État propre garanti

# 4. Lock thread-safe
with self._transcribe_lock:
    # 5. Chargement avec librosa (bypass ffmpeg)
    audio_array, audio_sr = librosa.load(audio_path, sr=16000, mono=True)
    
    # 6. Options strictes pour éviter répétitions
    decode_options = {
        "temperature": 0.0,  # Déterministe
        "condition_on_previous_text": False,  # Pas de contexte
        "initial_prompt": None,  # Pas de prompt
        "suppress_blank": True,  # Supprimer caractères vides
        "compression_ratio_threshold": 2.4,  # Détecter répétitions
        "no_speech_threshold": 0.6,
        "logprob_threshold": -1.0
    }
    
    # 7. Transcription avec array NumPy
    result = self.model.transcribe(audio_array, **decode_options)

# 8. Nettoyage des segments (NaN/Inf → JSON-compliant)
segments_cleaned = [clean_segment(seg) for seg in result.get("segments", [])]
```

**Méthode `_ensure_format()`** :
- Conversion WebM/MP3/M4A → WAV mono 16kHz
- Validation avec `pydub` (durée source)
- Double vérification avec `librosa` (durée convertie)
- Gestion d'erreurs `ffmpeg` avec messages clairs

**Méthode `_reload_model()`** :
- Suppression explicite du modèle (`del self.model`)
- Nettoyage du cache GPU/CPU
- Garbage collection forcé
- Rechargement complet

**Détection de répétitions** :
```python
# Regex pour détecter 5+ répétitions consécutives
repeated_pattern = re.search(r'(.)\1{4,}', text)
if repeated_pattern:
    # Tentative de nettoyage ou erreur
```

**Nettoyage JSON** :
- Fonction `clean_segment()` pour remplacer `NaN`/`Inf` par `0.0` ou `None`
- Évite les erreurs de sérialisation JSON

---

### 3. TextToSpeechService (`services/text_to_speech.py`)

#### Architecture

**Deux moteurs supportés** :

1. **pyttsx3** (offline) :
   - Utilise les voix système (macOS: `say`, Linux: `espeak`, Windows: `SAPI`)
   - Configuration : vitesse, volume, voix
   - Export en WAV

2. **gTTS** (online) :
   - Nécessite internet
   - Qualité supérieure
   - Export en MP3

**Méthode `synthesize()`** :
- Retourne `Tuple[bytes, Dict]` (audio_bytes, metadata)
- Métadonnées : `duration`, `latency`, `word_count`
- Nettoyage automatique des fichiers temporaires

**Gestion des voix** :
- Détection automatique de la langue
- Liste des voix disponibles via `get_available_voices()`
- Configuration dynamique : `set_rate()`, `set_volume()`, `set_voice()`

---

### 4. AudioPreprocessor (`services/audio_preprocessor.py`)

#### Pipeline de pré-traitement

**Étapes** (actuellement **DÉSACTIVÉ** dans `speech_to_text.py`) :

1. **Réduction de bruit** (`noisereduce`) :
   - Méthode stationnaire
   - `prop_decrease=0.8` (80% de réduction)

2. **Normalisation RMS** :
   - Cible : `target_rms = 0.1`
   - Limitation à `[-1, 1]`

3. **VAD (Voice Activity Detection)** :
   - `webrtcvad` avec mode agressif (niveau 2/3)
   - Frames de 30ms
   - Fusion des segments proches

4. **Filtre passe-bas** :
   - Butterworth 4ème ordre
   - Cutoff : 8kHz (fréquences vocales)

**Extraction de caractéristiques** :
- `extract_mfcc()` : 13 coefficients MFCC
- `extract_log_mel_spectrogram()` : 80 mels

**Note** : Le pré-processeur est **temporairement désactivé** car suspecté de causer des corruptions audio (répétitions "A A A A...").

---

## 🔒 Points Techniques Critiques

### 1. Gestion de la mémoire

**Problème** : Whisper peut conserver un état interne entre transcriptions.

**Solutions implémentées** :
- Rechargement du modèle avant chaque transcription
- Nettoyage agressif du cache PyTorch
- Garbage collection forcé (`gc.collect()`)
- Lock thread-safe pour éviter les conflits

**Coût** : Plus lent (rechargement du modèle), mais **garantit la stabilité**.

### 2. Compatibilité des devices

**Hiérarchie** :
1. CUDA (si disponible) → GPU NVIDIA
2. CPU (fallback)
3. MPS (désactivé) → Problèmes d'hallucinations

**Détection automatique** :
```python
if torch.cuda.is_available():
    device = "cuda"
else:
    device = "cpu"  # MPS désactivé
```

### 3. Gestion des fichiers temporaires

**Stratégie** :
- Fichiers dans `tempfile.gettempdir() / "trans_voice"`
- Nettoyage dans `finally` (garanti même en cas d'erreur)
- Nettoyage agressif des fichiers < 5 minutes
- Validation avant suppression (existence, taille)

**Problèmes évités** :
- Accumulation de fichiers temporaires
- Réutilisation accidentelle de fichiers corrompus
- Fuites mémoire

### 4. Validation audio robuste

**Multi-niveaux** :
1. Taille du fichier (`os.path.getsize()`)
2. Durée avec `pydub` (source)
3. Échantillons avec `librosa` (conversion)
4. Amplitude (détection de silence)

**Erreurs détectées** :
- Fichiers vides
- Conversions incomplètes
- Audio trop court (< 0.5s)
- Audio silencieux (amplitude < 0.01)

### 5. Sérialisation JSON

**Problème** : Whisper retourne parfois `NaN` ou `Inf` dans les segments.

**Solution** : Fonction `clean_segment()` qui remplace :
- `NaN` → `0.0` (pour nombres) ou `None` (pour autres)
- `Inf` → `0.0` ou `None`

---

## ⚠️ Points d'Attention

### 1. Performance

**Bottlenecks identifiés** :
- **Rechargement du modèle** : Coûteux (~1-2s pour modèle "base")
- **Conversion audio** : Dépend de `ffmpeg` (peut être lent)
- **Pré-traitement** : Actuellement désactivé (mais serait coûteux)

**Optimisations possibles** :
- Cache du modèle (mais risque d'état persistant)
- Pool de workers pour transcriptions parallèles
- Conversion asynchrone

### 2. Dépendances système

**ffmpeg requis** :
- Pour conversion WebM/MP3/M4A → WAV
- Installation : `brew install ffmpeg` (macOS) ou `apt-get install ffmpeg` (Linux)
- Erreur claire si manquant

**Voix système** (pyttsx3) :
- macOS : `say` (intégré)
- Linux : `espeak` ou `festival`
- Windows : `SAPI`

### 3. Configuration

**Variables d'environnement** :
```env
WHISPER_MODEL_SIZE=base      # tiny, base, small, medium, large
STT_LANGUAGE=pt              # Code ISO 639-1
STT_PREPROCESS=true          # Activer pré-traitement (désactivé dans le code)
TTS_ENGINE=pyttsx3           # pyttsx3 ou gtts
TTS_LANGUAGE=fr
PYTHON_API_PORT=8000
```

**Note** : `STT_PREPROCESS` est ignoré (pré-processeur désactivé dans le code).

### 4. Sécurité

**CORS** :
- Actuellement `allow_origins=["*"]` → **À restreindre en production**

**Uploads** :
- Pas de limite de taille explicite (dépend de FastAPI)
- Validation du type MIME recommandée

**Fichiers temporaires** :
- Nettoyage automatique, mais risque si crash
- Pas de chiffrement des fichiers sensibles

---

## 🚀 Optimisations Possibles

### 1. Cache du modèle (avec précaution)

```python
# Pool de modèles avec rotation
_model_pool = []
MAX_POOL_SIZE = 3

def get_clean_model():
    if len(_model_pool) > 0:
        model = _model_pool.pop()
        # Réinitialiser l'état interne
        return model
    else:
        return whisper.load_model(model_size)
```

**Risque** : État persistant si mal géré.

### 2. Transcription asynchrone

```python
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=2)

@app.post("/api/stt/transcribe")
async def transcribe_audio(...):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        stt_service.transcribe,
        temp_file_path
    )
```

### 3. Streaming

- WebSocket pour transcription en temps réel
- Chunks audio au lieu de fichiers complets

### 4. Pré-traitement conditionnel

- Réactiver le pré-processeur avec validation stricte
- Option par requête (`preprocess=true/false`)

---

## 📊 Métriques et Monitoring

### Métriques retournées

**STT** :
- `latency` : Temps de transcription (s)
- `word_count` : Nombre de mots
- `segments` : Segments avec timestamps
- `language` : Langue détectée

**TTS** :
- `latency` : Temps de synthèse (s)
- `duration` : Durée audio généré (s)
- `word_count` : Nombre de mots

### Logging

- Niveau : `INFO` par défaut
- Format : `%(asctime)s - %(name)s - %(levelname)s - %(message)s`
- Logs détaillés pour debugging (hash MD5, options, etc.)

---

## 🐛 Problèmes Connus et Solutions

### 1. Répétitions "A A A A..." ou "!!!!!!!!"

**Cause** : État persistant de Whisper ou corruption audio.

**Solution actuelle** :
- Rechargement du modèle avant chaque transcription
- Options strictes (`temperature=0.0`, `condition_on_previous_text=False`)
- Validation audio robuste
- MPS désactivé

**Statut** : ✅ Résolu (selon retours utilisateur)

### 2. TTS "interrupted" errors

**Cause** : Interruption normale lors d'une nouvelle synthèse.

**Solution** : Ignorer les erreurs `interrupted` (géré côté frontend).

### 3. Fichiers temporaires non supprimés

**Cause** : Crash ou erreur non gérée.

**Solution** : Nettoyage dans `finally` + nettoyage agressif des fichiers < 5 min.

---

## 📝 Recommandations

### Court terme
1. ✅ Restreindre CORS en production
2. ✅ Ajouter limite de taille pour uploads
3. ✅ Validation du type MIME
4. ✅ Monitoring des métriques (Prometheus/Grafana)

### Moyen terme
1. Cache du modèle avec rotation
2. Transcription asynchrone
3. Réactivation du pré-processeur avec validation
4. Support WebSocket pour streaming

### Long terme
1. Support de modèles Whisper alternatifs (faster-whisper)
2. TTS haute qualité (Coqui TTS, XTTS)
3. Cache Redis pour transcriptions fréquentes
4. Load balancing pour haute disponibilité

---

## 🔗 Intégration avec le Frontend

### WebSocket (Node.js)
- Le frontend envoie des chunks audio via WebSocket
- Node.js reçoit et envoie à l'API Python
- Pas de WebSocket direct Python (pourrait être ajouté)

### Endpoints utilisés
- `POST /api/stt/transcribe` : Upload de fichiers audio
- `POST /api/tts/synthesize` : Synthèse vocale (non utilisé actuellement, TTS côté frontend)

---

## 📚 Documentation

- **README.md** : Guide utilisateur
- **Docstrings** : Documentation inline complète
- **Logs** : Messages détaillés pour debugging

---

## ✅ Conclusion

Le dossier `python/` contient une **implémentation robuste et bien structurée** des services STT/TTS, avec :

✅ **Points forts** :
- Architecture modulaire et extensible
- Gestion robuste des erreurs
- Validation audio multi-niveaux
- Nettoyage automatique des ressources
- Solutions aux problèmes d'état persistant

⚠️ **Points d'amélioration** :
- Performance (rechargement du modèle)
- Sécurité (CORS, validation)
- Monitoring et métriques
- Documentation API (Swagger/OpenAPI)

**Note** : L'API FastAPI génère automatiquement la documentation Swagger à `/docs` et ReDoc à `/redoc`.


