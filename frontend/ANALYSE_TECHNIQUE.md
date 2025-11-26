# 🔍 Analyse Technique Détaillée - Dossier Frontend (React)

## 📋 Vue d'ensemble

Le dossier `frontend/` contient une **application React moderne** construite avec **Vite**, utilisant **Tailwind CSS** pour le styling et une architecture basée sur des **hooks personnalisés** pour gérer la logique métier. L'application implémente un système complet de traduction vocale avec interface utilisateur professionnelle et thème sombre.

---

## 🏗️ Architecture

### Structure des fichiers

```
frontend/
├── index.html                    # Point d'entrée HTML
├── package.json                  # Dépendances
├── vite.config.js               # Configuration Vite + PWA
├── tailwind.config.js           # Configuration Tailwind
├── postcss.config.js            # Configuration PostCSS
└── src/
    ├── main.jsx                 # Point d'entrée React
    ├── App.jsx                  # Composant principal (242 lignes)
    ├── App.css                  # Styles spécifiques App
    ├── index.css                # Styles globaux
    ├── components/              # Composants UI
    │   ├── MicrophoneRecorder.jsx
    │   ├── AudioUploader.jsx
    │   ├── TranslationDisplay.jsx
    │   ├── TextToSpeechPlayer.jsx
    │   └── MetricsPanel.jsx
    └── hooks/                   # Hooks personnalisés
        ├── useSpeechRecognition.js (461 lignes)
        ├── useTranslation.js (189 lignes)
        └── useTTS.js (151 lignes)
```

### Flux de données

```
User Interaction
    ↓
Components (UI)
    ↓
Custom Hooks (Logique métier)
    ├── useSpeechRecognition → WebSocket → Node.js Server
    ├── useTranslation → REST API → Node.js Server
    └── useTTS → Browser SpeechSynthesis API
    ↓
State Management (React useState/useRef)
    ↓
UI Update (Re-render)
```

### Pattern architectural

**Architecture basée sur les hooks** :
- **Séparation des responsabilités** : UI (components) vs Logique (hooks)
- **Réutilisabilité** : Hooks peuvent être réutilisés
- **Testabilité** : Logique isolée dans les hooks
- **Performance** : `useCallback` et `useRef` pour optimisations

---

## 🔧 Technologies et Dépendances

### Framework et Build
- **React** (^18.2.0) : Bibliothèque UI
- **Vite** (^5.0.8) : Build tool moderne (remplace Create React App)
- **@vitejs/plugin-react** : Plugin React pour Vite

### Styling
- **Tailwind CSS** (^3.3.6) : Framework CSS utility-first
- **PostCSS** (^8.4.32) : Traitement CSS
- **Autoprefixer** (^10.4.16) : Préfixes CSS automatiques

### PWA
- **vite-plugin-pwa** (^0.17.4) : Support Progressive Web App

### Dépendances runtime
- **axios** : Client HTTP (utilisé dans AudioUploader)
- Pas de bibliothèque d'état globale (Redux, Zustand) → **State local React**

---

## 📦 Composants Détaillés

### 1. App.jsx (Composant Principal)

#### Architecture

**Structure** :
```javascript
App
├── Header (Titre + Sous-titre)
├── Language Selector
├── Main Grid (2 colonnes)
│   ├── Left Column
│   │   ├── MicrophoneRecorder
│   │   ├── AudioUploader
│   │   └── TranslationDisplay
│   └── Right Column
│       ├── TextToSpeechPlayer
│       └── MetricsPanel
├── Clear Button (conditionnel)
└── Footer
```

#### Gestion d'état

**State local** :
```javascript
const [targetLanguage, setTargetLanguage] = useState('fr')
const [logs, setLogs] = useState([])
const [isProcessingUpload, setIsProcessingUpload] = useState(false)
```

**State via hooks** :
- `useSpeechRecognition()` : Enregistrement audio
- `useTranslation(wsRef, targetLanguage)` : Traduction
- `useTTS()` : Synthèse vocale

**Refs** :
```javascript
const recordingMetricsRef = useRef(null)  // Métriques d'enregistrement
const intervalRef = useRef(null)           // Intervalle de mise à jour
```

#### Effets secondaires

**1. Mise à jour des métriques** :
```javascript
useEffect(() => {
  if (isRecording) {
    intervalRef.current = setInterval(() => {
      recordingMetricsRef.current = getRecordingMetrics()
    }, 100)
  } else {
    clearInterval(intervalRef.current)
  }
  return () => clearInterval(intervalRef.current)
}, [isRecording, getRecordingMetrics])
```

**2. Logging automatique** :
- Erreurs d'enregistrement
- Erreurs de traduction
- Transcriptions reçues
- Traductions complétées

**Limite des logs** : 20 dernières entrées (`slice(-19)`)

#### Handlers

**`handleClear()`** :
- Réinitialise tous les textes
- Arrête la synthèse vocale
- Vide les logs
- Réinitialise les métriques

**`handleUploadTranscription(text)`** :
- Appelle `translateText()` pour traduire
- Gère les états de chargement
- Log les événements

**`handleUploadError(error)`** :
- Ajoute l'erreur aux logs

#### Layout responsive

**Grid adaptatif** :
- Mobile : 1 colonne
- Desktop (≥1024px) : 2 colonnes

**CSS Grid** :
```css
.main-grid {
  grid-template-columns: 1fr;  /* Mobile */
}

@media (min-width: 1024px) {
  .main-grid {
    grid-template-columns: repeat(2, 1fr);  /* Desktop */
  }
}
```

---

### 2. useSpeechRecognition (Hook principal)

#### Responsabilités

1. **Gestion WebSocket** : Connexion au serveur Node.js
2. **Enregistrement audio** : MediaRecorder API
3. **Envoi de chunks** : Streaming audio via WebSocket
4. **Métriques** : Calcul de durée, bitrate, etc.

#### État interne

```javascript
const [isRecording, setIsRecording] = useState(false)
const [microphoneStatus, setMicrophoneStatus] = useState('disconnected')
const [recordingTime, setRecordingTime] = useState(0)
const [error, setError] = useState(null)
```

**Refs critiques** :
```javascript
const mediaRecorderRef = useRef(null)      // MediaRecorder instance
const audioStreamRef = useRef(null)        // Audio stream
const wsRef = useRef(null)                 // WebSocket (partagé avec useTranslation)
const isStoppingRef = useRef(false)        // Flag d'arrêt
const isRecordingRef = useRef(false)        // Sync avec isRecording
const timeIntervalRef = useRef(null)        // Intervalle de temps
const metricsRef = useRef({...})            // Métriques
```

#### Connexion WebSocket

**Fonction `connectWebSocket()`** :

**Stratégie de connexion** :
```javascript
1. Vérifier si WebSocket existe déjà
   - Si CONNECTING ou OPEN → Retourner
   - Si CLOSING ou CLOSED → Nettoyer et recréer

2. Créer nouvelle WebSocket
   const wsUrl = `${protocol}//${hostname}:3001/ws`

3. Gestionnaires d'événements
   - onopen → setMicrophoneStatus('connected')
   - onmessage → Log (transcription gérée par useTranslation)
   - onerror → Log seulement
   - onclose → Reconnexion automatique si code !== 1000
```

**Reconnexion automatique** :
```javascript
if (event.code !== 1000 && !isRecordingRef.current) {
  setTimeout(() => {
    if (!wsRef.current) {
      connectWebSocket()
    }
  }, 2000)
}
```

**Points techniques** :
- ✅ Évite les connexions multiples
- ✅ Reconnexion automatique
- ✅ Nettoyage propre au démontage

#### Enregistrement audio

**Fonction `startRecording()`** :

**Étapes** :
```javascript
1. Vérifier état (déjà en train d'enregistrer ?)

2. Vérifier/connexion WebSocket
   - Si non connectée → connectWebSocket()
   - Attendre connexion (max 2s timeout)

3. Nettoyer ancien MediaRecorder/Stream

4. Demander accès microphone
   navigator.mediaDevices.getUserMedia({
     audio: {
       channelCount: 1,
       sampleRate: 16000,
       echoCancellation: true,
       noiseSuppression: true,
       autoGainControl: true
     }
   })

5. Créer MediaRecorder
   new MediaRecorder(stream, {
     mimeType: 'audio/webm;codecs=opus'
   })

6. Configurer ondataavailable
   - Envoyer chunks via WebSocket
   - Vérifications multiples avant envoi
   - Mise à jour métriques

7. Démarrer enregistrement
   mediaRecorder.start(100)  // Chunks toutes les 100ms

8. Démarrer compteur de temps
   setInterval(() => {
     setRecordingTime(prev => prev + 1)
     // Auto-stop à 30 secondes
   }, 1000)
```

**Vérifications avant envoi** :
```javascript
const canSend = !isStoppingRef.current && 
               wsRef.current?.readyState === WebSocket.OPEN &&
               recorderState === 'recording'
```

**Limite d'enregistrement** :
- Maximum : 30 secondes (`maxRecordingTime = 30`)
- Auto-stop si limite atteinte
- Avertissement visuel 5s avant la fin

#### Arrêt d'enregistrement

**Fonction `stopRecording()`** :

**Séquence d'arrêt** :
```javascript
1. Vérifier état réel (mediaRecorderRef.current.state)

2. Marquer isStoppingRef.current = true (IMMÉDIATEMENT)

3. Arrêter compteur de temps

4. Mettre à jour état React (setIsRecording(false))

5. Envoyer signal de fin au serveur
   wsRef.current.send(JSON.stringify({ type: 'end' }))

6. Arrêter MediaRecorder
   mediaRecorderRef.current.stop()

7. Arrêter tracks audio
   audioStreamRef.current.getTracks().forEach(track => track.stop())
```

**Points critiques** :
- ✅ Flag `isStoppingRef` empêche envoi de nouveaux chunks
- ✅ Signal 'end' envoyé AVANT arrêt MediaRecorder
- ✅ Nettoyage complet des ressources

#### Métriques

**Fonction `getMetrics()`** :
```javascript
return {
  duration: (Date.now() - startTime) / 1000,
  chunksCount: audioChunksCount,
  totalBytes: totalBytes,
  averageBitrate: totalBytes * 8 / duration / 1000  // kbps
}
```

---

### 3. useTranslation (Hook de traduction)

#### Responsabilités

1. **Écoute WebSocket** : Recevoir transcriptions
2. **Appel API traduction** : REST API `/api/translate`
3. **Gestion état** : Texte original, traduit, erreurs
4. **Métriques** : Latence, nombre de mots

#### État

```javascript
const [originalText, setOriginalText] = useState('')
const [translatedText, setTranslatedText] = useState('')
const [isTranslating, setIsTranslating] = useState(false)
const [translationError, setTranslationError] = useState(null)
const [translationMetrics, setTranslationMetrics] = useState({
  latency: null,
  wordCount: 0
})
```

#### Écoute WebSocket

**useEffect avec retry** :
```javascript
useEffect(() => {
  const attachListener = () => {
    if (!wsRef.current) {
      return null  // WebSocket non disponible
    }
    
    const handleMessage = async (event) => {
      // Ignorer Blobs (audio)
      if (event.data instanceof Blob) return
      
      const data = JSON.parse(event.data)
      
      if (data.type === 'transcription') {
        setOriginalText(data.text)
        // Démarrer traduction automatiquement
        await translateText(data.text, targetLanguage)
      }
    }
    
    ws.addEventListener('message', handleMessage)
    return () => ws.removeEventListener('message', handleMessage)
  }
  
  // Attacher immédiatement ou après 500ms
  let cleanup = attachListener()
  if (!wsRef.current) {
    setTimeout(() => {
      cleanup = attachListener()
    }, 500)
  }
  
  return cleanup
}, [wsRef, targetLanguage])
```

**Points techniques** :
- ✅ Retry si WebSocket non disponible
- ✅ Nettoyage propre du listener
- ✅ Réaction au changement de `targetLanguage`

#### Traduction

**Fonction `translateText(text, lang)`** :

**Flux** :
```javascript
1. Validation
   if (!text || !text.trim()) return

2. Mise à jour état
   setOriginalText(text)
   setIsTranslating(true)
   translationStartTimeRef.current = Date.now()

3. Appel API
   fetch('/api/translate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ text, targetLanguage: lang })
   })

4. Traitement réponse
   const result = await response.json()
   setTranslatedText(result.translatedText)

5. Calcul métriques
   const latency = Date.now() - translationStartTimeRef.current
   setTranslationMetrics({
     latency,
     wordCount: text.split(' ').length
   })

6. Gestion erreurs
   catch (err) {
     setTranslationError(err.message)
   } finally {
     setIsTranslating(false)
   }
```

**Gestion d'erreurs** :
- Extraction message d'erreur du serveur
- Fallback sur message générique
- Affichage dans l'UI

---

### 4. useTTS (Hook Text-to-Speech)

#### Responsabilités

1. **Synthèse vocale** : Browser SpeechSynthesis API
2. **Contrôle playback** : Play, Pause, Resume, Stop
3. **Sélection voix** : Détection automatique par langue
4. **Métriques** : Latence, durée

#### État

```javascript
const [isPlaying, setIsPlaying] = useState(false)
const [isPaused, setIsPaused] = useState(false)
const [currentText, setCurrentText] = useState('')
const [ttsError, setTtsError] = useState(null)
const [ttsMetrics, setTtsMetrics] = useState({
  latency: null,
  duration: null
})
```

#### Synthèse vocale

**Fonction `speak(text, language, voice)`** :

**Séquence** :
```javascript
1. Validation
   if (!text || !text.trim()) return

2. Nettoyage ancien utterance
   if (utteranceRef.current) {
     utteranceRef.current.onerror = null
     utteranceRef.current.onend = null
     utteranceRef.current.onstart = null
   }

3. Arrêter synthèse en cours
   if (synthRef.current.speaking || synthRef.current.pending) {
     synthRef.current.cancel()
   }

4. Créer nouveau SpeechSynthesisUtterance
   const utterance = new SpeechSynthesisUtterance(text)
   utterance.lang = language
   utterance.rate = 1.0
   utterance.pitch = 1.0
   utterance.volume = 1.0

5. Sélectionner voix
   const preferredVoice = voices.find(v => 
     v.lang.startsWith(language.split('-')[0])
   ) || voices[0]

6. Configurer handlers
   utterance.onstart → setIsPlaying(true), mesurer latence
   utterance.onend → setIsPlaying(false), calculer durée
   utterance.onerror → Gérer erreurs (ignorer 'interrupted')

7. Lancer synthèse
   synthRef.current.speak(utterance)
```

**Gestion erreur "interrupted"** :
```javascript
utterance.onerror = (event) => {
  if (event.error === 'interrupted') {
    // Normal quand on annule pour démarrer une nouvelle synthèse
    setIsPlaying(false)
    setIsPaused(false)
    return
  }
  // Autres erreurs → Log et afficher
}
```

**Mesure latence** :
```javascript
const latencyStart = Date.now()
const checkLatency = setInterval(() => {
  if (synthRef.current.speaking) {
    const latency = Date.now() - latencyStart
    setTtsMetrics(prev => ({ ...prev, latency }))
    clearInterval(checkLatency)
  }
}, 10)
```

#### Contrôles

**`pause()`** : `synthRef.current.pause()`
**`resume()`** : `synthRef.current.resume()`
**`stop()`** : `synthRef.current.cancel()`

---

### 5. Composants UI

#### MicrophoneRecorder

**Fonctionnalités** :
- Bouton d'enregistrement (grand, circulaire)
- Indicateur de statut (couleur + texte)
- Compteur de temps (format MM:SS)
- Avertissement limite (5s avant fin)
- Message d'erreur

**Design** :
- Gradient bleu/rouge selon état
- Animation ping pendant enregistrement
- Feedback visuel au clic (scale)

**Props** :
```javascript
{
  isRecording: boolean
  onStart: () => void
  onStop: () => void
  microphoneStatus: 'disconnected' | 'connected' | 'recording' | 'stopped' | 'error'
  error: string | null
  recordingTime: number
  maxRecordingTime: number
}
```

#### AudioUploader

**Fonctionnalités** :
- Sélection fichier (input caché)
- Validation format (webm, wav, mp3, ogg, m4a)
- Validation taille (max 50MB)
- Affichage fichier sélectionné
- Upload vers API Python directe
- États de chargement

**Flux** :
```javascript
1. Sélection fichier → Validation
2. Affichage info fichier
3. Clic "Transcribe" → Upload
4. Appel API Python: POST /api/stt/transcribe
5. Callback onTranscription(text)
```

**Props** :
```javascript
{
  onTranscription: (text: string) => void
  onError: (error: string) => void
  isProcessing: boolean
}
```

#### TranslationDisplay

**Fonctionnalités** :
- Affichage texte original
- Affichage traduction
- Indicateur de chargement (spinner)
- Message d'erreur
- Badge "Translation completed"

**Design** :
- Fond différent pour original (slate) vs traduction (blue gradient)
- Min-height pour éviter layout shift
- Typography optimisée (leading-relaxed)

**Props** :
```javascript
{
  originalText: string
  translatedText: string
  isTranslating: boolean
  translationError: string | null
  sourceLanguage: string
  targetLanguage: string
}
```

#### TextToSpeechPlayer

**Fonctionnalités** :
- Sélecteur de voix (filtre par langue)
- Boutons Play/Pause/Resume/Stop
- Indicateur "Playing..."
- Gestion erreurs TTS

**Détection voix** :
```javascript
useEffect(() => {
  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices()
    setAvailableVoices(voices)
    
    // Sélection automatique
    const preferredVoice = voices.find(v => 
      v.lang.startsWith(language.split('-')[0])
    ) || voices[0]
    setSelectedVoice(preferredVoice)
  }
  
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}, [language])
```

**Props** :
```javascript
{
  text: string
  onSpeak: (text, language, voice) => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  isPlaying: boolean
  isPaused: boolean
  ttsError: string | null
  language: string
}
```

#### MetricsPanel

**Fonctionnalités** :
- Métriques d'enregistrement (durée, chunks, données, bitrate)
- Métriques de traduction (latence, mots, statut)
- Métriques TTS (latence, durée)
- Logs techniques (20 dernières entrées)

**Formatage** :
- `formatLatency(ms)` : "123 ms" ou "1.23 s"
- `formatDuration(seconds)` : "12.34 s"
- `formatBytes(bytes)` : "1.23 KB" ou "1.23 MB"

**Props** :
```javascript
{
  recordingMetrics: { duration, chunksCount, totalBytes, averageBitrate } | null
  translationMetrics: { latency, wordCount } | null
  ttsMetrics: { latency, duration } | null
  microphoneStatus: string
  logs: Array<{ timestamp: number, message: string }>
}
```

---

## 🎨 Styling et Design

### Thème sombre professionnel

**Couleurs principales** :
- Fond : `#0a0e1a` → `#1a1f35` (gradient)
- Cards : `rgba(30, 41, 59, 0.8)` (slate-800 avec transparence)
- Texte : `#e2e8f0` (slate-200)
- Accents : Bleu (`#3b82f6`), Rouge (`#ef4444`), Vert (`#10b981`)

### Tailwind CSS

**Configuration** :
- Couleurs personnalisées (primary palette)
- Utilities pour backdrop-blur, gradients
- Responsive breakpoints (sm, md, lg, xl)

**Classes utilisées** :
- `bg-slate-800/80` : Fond avec transparence
- `backdrop-blur-xl` : Effet de flou
- `rounded-2xl` : Bordures arrondies
- `shadow-2xl` : Ombres profondes
- `transition-all duration-300` : Transitions fluides

### CSS personnalisé

**App.css** :
- Styles spécifiques composants
- Gradients personnalisés
- Animations

**index.css** :
- Reset CSS
- Styles globaux
- Scrollbar personnalisée
- Effets de particules (pseudo-élément `::before`)

### Responsive Design

**Breakpoints** :
- Mobile : < 1024px (1 colonne)
- Desktop : ≥ 1024px (2 colonnes)

**Adaptations** :
- Grid adaptatif
- Textes ajustés
- Espacements optimisés

---

## 🔒 Points Techniques Critiques

### 1. Gestion WebSocket partagée

**Problème** : `wsRef` partagé entre `useSpeechRecognition` et `useTranslation`

**Solution** :
- `wsRef` créé dans `useSpeechRecognition`
- Passé en paramètre à `useTranslation`
- Un seul WebSocket pour toute l'application

**Avantages** :
- ✅ Évite connexions multiples
- ✅ État synchronisé
- ✅ Nettoyage simplifié

### 2. Synchronisation état vs refs

**Problème** : Closures dans callbacks peuvent avoir état obsolète

**Solution** :
```javascript
// Ref pour état réel
const isRecordingRef = useRef(false)

// Synchronisation
useEffect(() => {
  isRecordingRef.current = isRecording
}, [isRecording])

// Utilisation dans callbacks
if (!isRecordingRef.current) {
  // Utiliser ref au lieu de state
}
```

**Avantages** :
- ✅ État toujours à jour dans callbacks
- ✅ Évite problèmes de closure

### 3. Gestion mémoire

**Problèmes potentiels** :
- ⚠️ Logs illimités (limité à 20)
- ⚠️ Chunks audio en mémoire (côté serveur)
- ⚠️ Métriques accumulées

**Solutions actuelles** :
- ✅ Limite logs : `slice(-19)`
- ✅ Nettoyage WebSocket au démontage
- ✅ Nettoyage MediaRecorder/Stream

### 4. Performance

**Optimisations** :
- ✅ `useCallback` pour fonctions stables
- ✅ `useRef` pour valeurs non réactives
- ✅ Nettoyage intervals/timeouts
- ✅ Conditionnal rendering

**Points d'amélioration** :
- ⚠️ Pas de `React.memo` sur composants
- ⚠️ Pas de `useMemo` pour calculs coûteux
- ⚠️ Re-renders potentiels inutiles

### 5. Gestion erreurs

**Stratégie** :
- Try-catch dans hooks
- Messages d'erreur dans state
- Affichage dans UI
- Logging console

**Points forts** :
- ✅ Erreurs capturées
- ✅ Messages utilisateur clairs
- ✅ Pas de crash de l'app

**Points d'amélioration** :
- ⚠️ Pas de retry automatique
- ⚠️ Pas de reporting d'erreurs
- ⚠️ Logs non structurés

---

## ⚠️ Points d'Attention

### 1. Dépendances navigateur

**APIs utilisées** :
- **MediaRecorder** : Support moderne (pas IE)
- **WebSocket** : Support large
- **SpeechSynthesis** : Support variable (qualité dépend du navigateur)
- **getUserMedia** : Nécessite HTTPS (sauf localhost)

**Compatibilité** :
- Chrome/Edge : ✅ Complet
- Firefox : ✅ Complet
- Safari : ⚠️ SpeechSynthesis limité
- Mobile : ⚠️ Varies

### 2. Configuration

**Variables d'environnement** :
```env
VITE_PYTHON_API_URL=http://localhost:8000  # Optionnel
```

**Proxy Vite** :
```javascript
proxy: {
  '/api': 'http://localhost:3001',
  '/ws': 'ws://localhost:3001'
}
```

### 3. PWA

**Configuration** :
- `vite-plugin-pwa` configuré
- Manifest défini
- Auto-update activé

**Limitations** :
- ⚠️ Pas d'icônes définies (pwa-192x192.png, pwa-512x512.png)
- ⚠️ Service Worker basique

### 4. Accessibilité

**Points à améliorer** :
- ⚠️ Pas d'ARIA labels
- ⚠️ Navigation clavier limitée
- ⚠️ Contraste (vérifier WCAG)
- ⚠️ Screen reader support

---

## 🚀 Optimisations Possibles

### 1. Performance

**React.memo** :
```javascript
export default React.memo(MicrophoneRecorder)
```

**useMemo pour calculs** :
```javascript
const formattedTime = useMemo(() => {
  return `${Math.floor(recordingTime / 60)}:${...}`
}, [recordingTime])
```

**Code splitting** :
```javascript
const MetricsPanel = lazy(() => import('./components/MetricsPanel'))
```

### 2. State Management

**Context API** :
- Créer `TranslationContext` pour partager état
- Réduire prop drilling

**Zustand/Redux** :
- Pour état global complexe
- DevTools pour debugging

### 3. Error Boundary

**Implémentation** :
```javascript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log error
    // Report to service
  }
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}
```

### 4. Tests

**Unitaires** :
- Jest + React Testing Library
- Tests hooks avec `@testing-library/react-hooks`

**E2E** :
- Playwright ou Cypress
- Tests flux complets

### 5. Monitoring

**Analytics** :
- Google Analytics ou Plausible
- Tracking événements (enregistrement, traduction)

**Error Tracking** :
- Sentry ou LogRocket
- Capture erreurs runtime

---

## 🐛 Problèmes Connus et Solutions

### 1. WebSocket non disponible au démarrage

**Problème** : `useTranslation` peut s'attacher avant connexion WebSocket

**Solution actuelle** : Retry après 500ms

**Amélioration possible** : État de connexion partagé

### 2. Erreurs TTS "interrupted"

**Problème** : Erreur normale quand on annule une synthèse

**Solution actuelle** : Ignorer silencieusement

**Statut** : ✅ Résolu

### 3. Métriques non mises à jour

**Problème** : `recordingMetricsRef` peut être null

**Solution actuelle** : Vérification dans MetricsPanel

**Amélioration** : Valeur par défaut

### 4. Logs limités

**Problème** : Seulement 20 dernières entrées

**Solution actuelle** : `slice(-19)`

**Amélioration** : Pagination ou scroll infini

---

## 📊 Métriques et Monitoring

### Métriques disponibles

**Enregistrement** :
- Durée
- Nombre de chunks
- Taille totale (bytes)
- Bitrate moyen

**Traduction** :
- Latence (ms)
- Nombre de mots

**TTS** :
- Latence (ms)
- Durée (s)

**Logs** :
- 20 dernières entrées
- Timestamp pour chaque log

### Affichage

**Formatage** :
- Latence : "123 ms" ou "1.23 s"
- Durée : "12.34 s"
- Bytes : "1.23 KB" ou "1.23 MB"

**Couleurs** :
- Enregistrement : Slate
- Traduction : Blue
- TTS : Green

---

## 🔗 Intégration avec Backend

### WebSocket

**Connexion** :
- URL : `ws://localhost:3001/ws` (dev) ou `wss://...` (prod)
- Protocole détecté automatiquement

**Messages** :
- Client → Server : Chunks audio (Blob) ou `{ type: 'end' }`
- Server → Client : `{ type: 'transcription', text }`, `{ type: 'error' }`, `{ type: 'connected' }`

### REST API

**Endpoints utilisés** :
- `POST /api/translate` : Traduction (via proxy Vite)

**Direct API Python** :
- `POST /api/stt/transcribe` : Transcription upload (direct, pas via proxy)

---

## 📝 Recommandations

### Court terme
1. ✅ Ajouter React.memo sur composants
2. ✅ Implémenter Error Boundary
3. ✅ Ajouter ARIA labels
4. ✅ Tests unitaires hooks

### Moyen terme
1. Context API pour état partagé
2. Code splitting
3. Service Worker pour offline
4. Analytics intégration

### Long terme
1. State management (Zustand)
2. Tests E2E complets
3. Monitoring avancé (Sentry)
4. Internationalisation (i18n)

---

## ✅ Conclusion

Le frontend est une **implémentation moderne et bien structurée** avec :

✅ **Points forts** :
- Architecture claire (hooks + components)
- Design professionnel (thème sombre)
- Gestion robuste WebSocket
- Performance optimisée (useCallback, useRef)
- Responsive design

⚠️ **Points d'amélioration** :
- Tests (unitaires + E2E)
- Accessibilité (ARIA)
- State management (si complexité augmente)
- Monitoring et error tracking

**Note** : L'application est prête pour la production avec quelques améliorations recommandées pour la robustesse et l'accessibilité.

