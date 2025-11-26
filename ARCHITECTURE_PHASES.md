# 🏗️ Architecture en Deux Phases - transVoicer

## 📋 Vue d'ensemble

Ce document décrit l'organisation du projet **transVoicer** en **deux phases distinctes** :

1. **Phase 1 - Version Initiale** : Fonctionnalités de base et MVP
2. **Phase 2 - Version Finale** : Fonctionnalités avancées et optimisations

Cette séparation permet de :
- ✅ Comprendre l'évolution du projet
- ✅ Faciliter l'apprentissage (commencer par Phase 1)
- ✅ Identifier les fonctionnalités essentielles vs avancées
- ✅ Organiser le développement par itérations

---

## 🎯 Phase 1 - Version Initiale (MVP)

### Objectif
Créer une **application fonctionnelle minimale** qui démontre le concept de traduction vocale avec les fonctionnalités essentielles.

### Fonctionnalités Core

#### 1. Frontend (React)

**Composants essentiels** :
- ✅ `App.jsx` : Structure de base
- ✅ `MicrophoneRecorder.jsx` : Enregistrement audio basique
- ✅ `TranslationDisplay.jsx` : Affichage texte original et traduit
- ✅ Layout simple (1 colonne, pas de grid complexe)

**Hooks essentiels** :
- ✅ `useSpeechRecognition.js` : Version simplifiée
  - Connexion WebSocket basique
  - Enregistrement audio simple
  - Pas de métriques avancées
  - Pas de limite de temps
  - Pas de reconnexion automatique

- ✅ `useTranslation.js` : Version simplifiée
  - Écoute WebSocket basique
  - Appel API traduction
  - Pas de retry complexe
  - Pas de métriques

**Styling** :
- ✅ CSS basique (pas de Tailwind avancé)
- ✅ Thème simple (pas de dark theme élégant)
- ✅ Pas d'animations complexes

**Fichiers Phase 1** :
```
frontend/src/
├── main.jsx
├── App.jsx (version simple)
├── App.css (styles basiques)
├── index.css (reset simple)
├── components/
│   ├── MicrophoneRecorder.jsx (basique)
│   └── TranslationDisplay.jsx (basique)
└── hooks/
    ├── useSpeechRecognition.js (simplifié)
    └── useTranslation.js (simplifié)
```

#### 2. Backend Node.js

**Fonctionnalités essentielles** :
- ✅ Serveur Express basique
- ✅ WebSocket simple (pas de gestion sessions avancée)
- ✅ Route `/api/translate` basique
- ✅ Pas de gestion d'erreurs complexe
- ✅ Pas de fallback simulation

**Fichiers Phase 1** :
```
server/
├── index.js (version simple)
└── translationService.js (basique, pas de fallback)
```

**Simplifications** :
- Pas de `sessions` Map complexe
- Pas de gestion `isStoppingRef`
- Pas de retry automatique
- Pas de health check

#### 3. Backend Python

**Fonctionnalités essentielles** :
- ✅ API FastAPI basique
- ✅ Service STT avec Whisper (modèle "base")
- ✅ Transcription simple
- ✅ Pas de pré-traitement audio
- ✅ Pas de rechargement de modèle
- ✅ Pas de gestion avancée des fichiers temporaires

**Fichiers Phase 1** :
```
python/
├── api.py (version simple)
└── services/
    └── speech_to_text.py (simplifié)
```

**Simplifications** :
- Pas de `_reload_model()`
- Pas de `threading.Lock`
- Pas de validation audio complexe
- Pas de nettoyage agressif
- Pas de `AudioPreprocessor`
- Pas de service TTS

#### 4. Configuration minimale

**Variables d'environnement** :
```env
# Phase 1 - Minimal
PORT=3001
PYTHON_API_PORT=8000
GEMINI_API_KEY=your_key_here
```

**Dépendances minimales** :
- Frontend : React, Vite (pas de Tailwind, PWA)
- Backend Node : Express, ws, axios
- Backend Python : FastAPI, whisper, torch

---

## 🚀 Phase 2 - Version Finale (Actuelle)

### Objectif
Application **complète et professionnelle** avec toutes les fonctionnalités avancées, optimisations, et améliorations UX.

### Fonctionnalités Avancées

#### 1. Frontend (React)

**Composants avancés** :
- ✅ `AudioUploader.jsx` : Upload de fichiers audio
- ✅ `TextToSpeechPlayer.jsx` : Synthèse vocale avec contrôles
- ✅ `MetricsPanel.jsx` : Affichage métriques et logs
- ✅ Layout professionnel (grid 2 colonnes, responsive)

**Hooks avancés** :
- ✅ `useSpeechRecognition.js` : Version complète
  - Reconnexion automatique WebSocket
  - Gestion métriques (durée, chunks, bitrate)
  - Limite de temps (30s) avec auto-stop
  - Synchronisation refs pour éviter closures
  - Gestion d'erreurs robuste
  - Nettoyage complet des ressources

- ✅ `useTranslation.js` : Version complète
  - Retry automatique si WebSocket non disponible
  - Métriques (latence, word count)
  - Gestion d'erreurs détaillée
  - Fonction `translateText` manuelle

- ✅ `useTTS.js` : Nouveau hook
  - Synthèse vocale complète
  - Contrôles (play, pause, resume, stop)
  - Sélection automatique de voix
  - Métriques (latence, durée)
  - Gestion erreur "interrupted"

**Styling avancé** :
- ✅ Tailwind CSS complet
- ✅ Thème sombre professionnel
- ✅ Animations et transitions
- ✅ Backdrop blur effects
- ✅ Gradients et ombres
- ✅ Scrollbar personnalisée
- ✅ Responsive design complet

**Fichiers Phase 2** :
```
frontend/src/
├── main.jsx
├── App.jsx (complet)
├── App.css (styles avancés)
├── index.css (thème sombre)
├── components/
│   ├── MicrophoneRecorder.jsx (avancé)
│   ├── AudioUploader.jsx (nouveau)
│   ├── TranslationDisplay.jsx (amélioré)
│   ├── TextToSpeechPlayer.jsx (nouveau)
│   └── MetricsPanel.jsx (nouveau)
└── hooks/
    ├── useSpeechRecognition.js (complet)
    ├── useTranslation.js (complet)
    └── useTTS.js (nouveau)
```

#### 2. Backend Node.js

**Fonctionnalités avancées** :
- ✅ Gestion sessions avec Map
- ✅ Flag `isStoppingRef` pour éviter doublons
- ✅ Retry automatique pour API Python
- ✅ Fallback simulation si Gemini échoue
- ✅ Health check endpoint
- ✅ Gestion d'erreurs robuste
- ✅ Nettoyage automatique sessions

**Fichiers Phase 2** :
```
server/
├── index.js (complet)
├── translationService.js (avec fallback)
└── audioProcessor.js (nouveau)
```

**Améliorations** :
- Sessions avec `isStoppingRef`
- Retry pour `checkPythonServiceAvailable()`
- Fallback `simulateTranslation()`
- Découverte automatique modèle Gemini
- Gestion fichiers temporaires

#### 3. Backend Python

**Fonctionnalités avancées** :
- ✅ Rechargement modèle avant chaque transcription
- ✅ Threading.Lock pour éviter conflits
- ✅ Validation audio multi-niveaux
- ✅ Pré-traitement audio (VAD, noise reduction)
- ✅ Nettoyage agressif fichiers temporaires
- ✅ Service TTS (pyttsx3/gTTS)
- ✅ Gestion JSON (NaN/Inf)
- ✅ Désactivation MPS (éviter hallucinations)

**Fichiers Phase 2** :
```
python/
├── api.py (complet)
├── services/
│   ├── speech_to_text.py (avancé)
│   ├── text_to_speech.py (nouveau)
│   └── audio_preprocessor.py (nouveau)
└── README.md
```

**Améliorations** :
- `_reload_model()` avant chaque transcription
- `threading.Lock()` pour thread-safety
- Validation avec `pydub` et `librosa`
- Chargement audio direct avec `librosa.load()`
- Options strictes Whisper (temperature=0.0, etc.)
- Nettoyage segments (clean_segment)
- Pré-processeur complet (VAD, noise reduction)

#### 4. Configuration avancée

**Variables d'environnement** :
```env
# Phase 2 - Complet
PORT=3001
PYTHON_API_URL=http://localhost:8000
GEMINI_API_KEY=your_key_here

# Python
WHISPER_MODEL_SIZE=base
STT_LANGUAGE=pt
STT_PREPROCESS=true
TTS_ENGINE=pyttsx3
TTS_LANGUAGE=fr
PYTHON_API_PORT=8000
```

**Dépendances complètes** :
- Frontend : React, Vite, Tailwind, PWA
- Backend Node : Express, ws, axios, form-data, @google/generative-ai
- Backend Python : FastAPI, whisper, torch, librosa, pydub, noisereduce, webrtcvad, pyttsx3, gTTS

---

## 📊 Comparaison Phase 1 vs Phase 2

### Frontend

| Fonctionnalité | Phase 1 | Phase 2 |
|----------------|---------|---------|
| Composants | 2 (Microphone, Translation) | 5 (+ Upload, TTS, Metrics) |
| Hooks | 2 (simplifiés) | 3 (complets) |
| Styling | CSS basique | Tailwind + thème sombre |
| WebSocket | Connexion simple | Reconnexion auto + métriques |
| Métriques | ❌ | ✅ (durée, latence, bitrate) |
| Upload fichier | ❌ | ✅ |
| TTS | ❌ | ✅ (SpeechSynthesis) |
| Responsive | Basique | Complet (grid 2 colonnes) |
| Animations | ❌ | ✅ |
| Logs techniques | ❌ | ✅ (20 dernières entrées) |

### Backend Node.js

| Fonctionnalité | Phase 1 | Phase 2 |
|----------------|---------|---------|
| Sessions | ❌ | ✅ (Map avec gestion état) |
| Retry API Python | ❌ | ✅ (3 tentatives) |
| Fallback Gemini | ❌ | ✅ (simulation) |
| Health check | ❌ | ✅ |
| Gestion erreurs | Basique | Robuste |
| audioProcessor | ❌ | ✅ (module séparé) |
| Découverte modèle | ❌ | ✅ (auto-détection Gemini) |

### Backend Python

| Fonctionnalité | Phase 1 | Phase 2 |
|----------------|---------|---------|
| Rechargement modèle | ❌ | ✅ (avant chaque transcription) |
| Thread safety | ❌ | ✅ (Lock) |
| Validation audio | Basique | Multi-niveaux |
| Pré-traitement | ❌ | ✅ (VAD, noise reduction) |
| Service TTS | ❌ | ✅ (pyttsx3/gTTS) |
| Nettoyage fichiers | Basique | Agressif (< 5 min) |
| Gestion JSON | ❌ | ✅ (NaN/Inf) |
| Désactivation MPS | ❌ | ✅ (éviter hallucinations) |
| Métriques | Basiques | Complètes (latence, WER) |

---

## 🗂️ Organisation Recommandée

### Option 1 : Branches Git

**Structure** :
```
main (Phase 2 - actuelle)
├── phase-1-mvp (branche)
└── phase-2-final (branche, actuelle)
```

**Avantages** :
- ✅ Historique complet
- ✅ Facile de basculer entre versions
- ✅ Merge possible

**Commandes** :
```bash
# Créer branche Phase 1
git checkout -b phase-1-mvp
# Supprimer fichiers Phase 2
# Commit version simplifiée

# Branche Phase 2 (actuelle)
git checkout main  # ou phase-2-final
```

### Option 2 : Dossiers séparés

**Structure** :
```
trans_voice/
├── phase-1/          # Version MVP
│   ├── frontend/
│   ├── server/
│   └── python/
├── phase-2/          # Version finale (actuelle)
│   ├── frontend/
│   ├── server/
│   └── python/
└── shared/           # Code commun (optionnel)
```

**Avantages** :
- ✅ Séparation claire
- ✅ Facile de comparer
- ✅ Pas de conflit Git

### Option 3 : Tags Git (Recommandé)

**Structure** :
```
trans_voice/ (actuel)
├── v1.0.0-mvp (tag)      # Phase 1
└── v2.0.0-final (tag)    # Phase 2 (actuel)
```

**Avantages** :
- ✅ Historique préservé
- ✅ Facile de revenir à Phase 1
- ✅ Pas de duplication de code
- ✅ Documentation dans commits

**Commandes** :
```bash
# Créer tag Phase 1 (point de départ)
git tag v1.0.0-mvp <commit-hash-initial>

# Tag Phase 2 (actuel)
git tag v2.0.0-final

# Revenir à Phase 1
git checkout v1.0.0-mvp
```

---

## 📝 Guide de Migration Phase 1 → Phase 2

### Étape 1 : Frontend

**Ajouter composants** :
1. Créer `AudioUploader.jsx`
2. Créer `TextToSpeechPlayer.jsx`
3. Créer `MetricsPanel.jsx`

**Améliorer hooks** :
1. Ajouter métriques dans `useSpeechRecognition`
2. Ajouter retry dans `useTranslation`
3. Créer `useTTS.js`

**Améliorer styling** :
1. Installer Tailwind CSS
2. Créer thème sombre
3. Ajouter animations

### Étape 2 : Backend Node.js

**Améliorer WebSocket** :
1. Ajouter gestion sessions (Map)
2. Ajouter flag `isStoppingRef`
3. Ajouter reconnexion automatique

**Améliorer traduction** :
1. Ajouter fallback simulation
2. Ajouter découverte modèle Gemini
3. Créer `audioProcessor.js`

### Étape 3 : Backend Python

**Améliorer STT** :
1. Ajouter `_reload_model()`
2. Ajouter `threading.Lock`
3. Améliorer validation audio
4. Créer `AudioPreprocessor`

**Ajouter TTS** :
1. Créer `TextToSpeechService`
2. Ajouter endpoints TTS dans API

---

## 🎓 Utilisation Pédagogique

### Pour l'apprentissage

**Phase 1** :
- ✅ Comprendre les concepts de base
- ✅ WebSocket simple
- ✅ Transcription basique
- ✅ Traduction simple

**Phase 2** :
- ✅ Comprendre optimisations
- ✅ Gestion d'erreurs avancée
- ✅ Performance et métriques
- ✅ Architecture professionnelle

### Pour le développement

**Démarrer avec Phase 1** :
1. Implémenter fonctionnalités de base
2. Tester et valider
3. Migrer vers Phase 2 progressivement

**Phase 2 comme référence** :
- Solutions aux problèmes courants
- Patterns avancés
- Optimisations

---

## 📚 Documentation par Phase

### Phase 1 - Documentation

**Fichiers à créer** :
- `README_PHASE1.md` : Guide démarrage Phase 1
- `ARCHITECTURE_PHASE1.md` : Architecture simplifiée
- `QUICKSTART_PHASE1.md` : Démarrage rapide

**Contenu** :
- Installation minimale
- Configuration basique
- Fonctionnalités disponibles
- Limitations

### Phase 2 - Documentation

**Fichiers existants** :
- `QUICKSTART.md` : Guide complet
- `python/README.md` : Documentation Python
- `python/ANALYSE_TECHNIQUE.md` : Analyse technique
- `server/ANALYSE_TECHNIQUE.md` : Analyse serveur
- `frontend/ANALYSE_TECHNIQUE.md` : Analyse frontend

**Contenu** :
- Installation complète
- Configuration avancée
- Toutes les fonctionnalités
- Optimisations

---

## ✅ Checklist Phase 1 → Phase 2

### Frontend
- [ ] Ajouter Tailwind CSS
- [ ] Créer thème sombre
- [ ] Ajouter composant AudioUploader
- [ ] Ajouter composant TextToSpeechPlayer
- [ ] Ajouter composant MetricsPanel
- [ ] Améliorer useSpeechRecognition (métriques, limite temps)
- [ ] Améliorer useTranslation (retry, métriques)
- [ ] Créer useTTS
- [ ] Ajouter animations
- [ ] Améliorer responsive

### Backend Node.js
- [ ] Ajouter gestion sessions (Map)
- [ ] Ajouter flag isStoppingRef
- [ ] Ajouter retry API Python
- [ ] Ajouter fallback simulation
- [ ] Créer audioProcessor.js
- [ ] Ajouter health check
- [ ] Améliorer gestion erreurs

### Backend Python
- [ ] Ajouter _reload_model()
- [ ] Ajouter threading.Lock
- [ ] Améliorer validation audio
- [ ] Créer AudioPreprocessor
- [ ] Créer TextToSpeechService
- [ ] Améliorer nettoyage fichiers
- [ ] Ajouter gestion JSON (NaN/Inf)
- [ ] Désactiver MPS

---

## 🎯 Conclusion

Cette séparation en deux phases permet de :

1. **Comprendre l'évolution** : Du MVP à la version complète
2. **Apprendre progressivement** : Commencer simple, puis avancer
3. **Organiser le développement** : Itérations claires
4. **Faciliter la maintenance** : Code organisé par complexité

**Recommandation** : Utiliser **Tags Git** pour marquer les deux phases tout en gardant un historique complet et la possibilité de revenir à la Phase 1 si nécessaire.

