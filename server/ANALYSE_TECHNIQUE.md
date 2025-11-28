# 🔍 Analyse Technique Détaillée - Dossier Server (Node.js)

## 📋 Vue d'ensemble

Le dossier `server/` contient un **serveur Node.js** qui agit comme **intermédiaire** entre le frontend React et les services Python (STT/TTS). Il gère la communication **WebSocket en temps réel** pour l'enregistrement audio, la transcription, et la traduction via l'API Gemini.

---

## 🏗️ Architecture

### Structure des fichiers

```
server/
├── index.js                 # Serveur Express + WebSocket (262 lignes)
├── translationService.js    # Service de traduction Gemini (201 lignes)
├── audioProcessor.js        # Traitement audio → API Python (143 lignes)
└── temp/                    # Dossier temporaire pour fichiers audio
```

### Flux de données

```
Frontend (React)
    ↓ (WebSocket)
Node.js Server (index.js)
    ├── WebSocket → Accumulation chunks audio
    ├── audioProcessor.js → API Python (FastAPI) → Transcription
    └── translationService.js → API Gemini → Traduction
    ↓ (WebSocket)
Frontend (React) → Affichage résultats
```

### Rôle du serveur Node.js

Le serveur Node.js agit comme un **proxy intelligent** :
1. **Réception** : WebSocket pour chunks audio en temps réel
2. **Accumulation** : Stockage des chunks jusqu'à la fin de l'enregistrement
3. **Orchestration** : Appel séquentiel des services (STT → Translation)
4. **Distribution** : Envoi des résultats au frontend via WebSocket

---

## 🔧 Technologies et Dépendances

### Framework et serveur
- **Express** : Framework web minimaliste
- **http** : Serveur HTTP natif Node.js
- **ws** : Bibliothèque WebSocket pour Node.js
- **dotenv** : Gestion des variables d'environnement

### Communication HTTP
- **axios** : Client HTTP pour appels API (Python, Gemini)
- **form-data** : Gestion des uploads multipart/form-data

### Utilitaires
- **fs** : Système de fichiers (fichiers temporaires)
- **path** : Manipulation de chemins

---

## 📦 Services Détaillés

### 1. Serveur Principal (`index.js`)

#### Architecture Express + WebSocket

**Initialisation** :
```javascript
const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })
```

**Points techniques** :
- Serveur HTTP unique pour Express ET WebSocket
- WebSocket sur le même port que l'API REST
- Middleware Express pour JSON et fichiers statiques

#### Gestion des sessions WebSocket

**Structure de session** :
```javascript
const session = {
  id: sessionId,              // Identifiant unique
  audioChunks: [],            // Chunks audio accumulés
  startTime: Date.now(),      // Timestamp de début
  ws,                         // Référence WebSocket
  isStopped: false           // Flag d'arrêt
}
```

**Stockage** : `Map<sessionId, session>` pour accès O(1)

**Génération sessionId** :
- Priorité : Header `x-session-id` (si fourni)
- Fallback : `Date.now().toString()` (timestamp)

#### Gestion des messages WebSocket

**Types de messages** :

1. **Chunks audio** (Buffer/ArrayBuffer) :
   - Accumulation dans `session.audioChunks[]`
   - **Pas de traitement immédiat** (attente signal 'end')
   - Garantit un fichier audio complet

2. **Signal de fin** (JSON) :
   ```json
   { "type": "end" }
   ```
   - Déclenche `handleEndOfRecording()`
   - Traitement de tous les chunks accumulés

**Détection du type** :
```javascript
// Essayer de parser comme JSON
const text = data.toString('utf8')
if (text.trim().startsWith('{')) {
  const message = JSON.parse(text)
  if (message.type === 'end') {
    // Signal de fin
  }
}
// Sinon, traiter comme chunk audio
```

**Protection contre les doublons** :
- Flag `isStopped` empêche le traitement après l'arrêt
- Vérification `ws.readyState === 1` (OPEN) avant envoi

#### Pipeline de traitement audio

**Fonction `processAudioChunks(sessionId)`** :

```javascript
1. Récupération de la session
2. Conversion des chunks en Buffer unique
   const buffers = session.audioChunks.map(chunk => 
     Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
   )
   const audioBuffer = Buffer.concat(buffers)

3. Appel au service Python (STT)
   const transcription = await processAudioStream(audioBuffer)

4. Envoi de la transcription au client
   ws.send(JSON.stringify({
     type: 'transcription',
     text: transcription,
     timestamp: Date.now()
   }))

5. Nettoyage des chunks
   session.audioChunks = []
```

**Points techniques** :
- **Accumulation complète** : Tous les chunks avant traitement
- **Buffer unique** : Concaténation pour fichier complet
- **Validation** : Vérification que WebSocket est OPEN avant envoi
- **Nettoyage** : Suppression des chunks après traitement

#### Gestion de la fin d'enregistrement

**Fonction `handleEndOfRecording(sessionId)`** :

```javascript
1. Marquer session comme arrêtée
   session.isStopped = true

2. Vérifier qu'il y a des chunks
   if (session.audioChunks.length > 0) {
     // Traiter
   }

3. Appel à processAudioChunks()
   await processAudioChunks(sessionId)

4. Nettoyage
   session.audioChunks = []
   // WebSocket reste ouverte pour recevoir les résultats
```

**Stratégie** :
- **Traitement différé** : Uniquement à la fin (pas en streaming)
- **WebSocket maintenue** : Reste ouverte pour envoyer les résultats
- **Nettoyage progressif** : Chunks supprimés après traitement

#### Routes API REST

**1. `POST /api/translate`** :
```javascript
- Body: { text, targetLanguage }
- Appel: translateText(text, targetLanguage)
- Retour: { translatedText, sourceLanguage, targetLanguage, timestamp }
```

**Gestion d'erreurs** :
- Erreur "Texte vide" → 400
- Erreur Gemini → Fallback simulation
- Erreur simulation → 500

**2. `GET /api/health`** :
```javascript
- Retour: { status: 'ok', timestamp, activeSessions }
- Utile pour monitoring
```

**3. `GET *` (catch-all)** :
```javascript
- Serve le frontend React (production)
- path.join(__dirname, '../frontend/dist/index.html')
```

#### Gestion des erreurs WebSocket

**Types d'erreurs gérées** :
- Erreur lors du traitement → Message `{ type: 'error', message }`
- Connexion fermée → Nettoyage de la session
- Erreur WebSocket → Suppression de la session

**Messages d'erreur** :
```javascript
ws.send(JSON.stringify({
  type: 'error',
  message: error.message
}))
```

#### Nettoyage des sessions

**Événements déclenchant le nettoyage** :
- `ws.on('close')` → `sessions.delete(sessionId)`
- `ws.on('error')` → `sessions.delete(sessionId)`

**Problème potentiel** : Pas de nettoyage automatique des sessions inactives (timeout)

---

### 2. Service de Traduction (`translationService.js`)

#### Architecture Gemini API

**Initialisation** :
```javascript
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  findAvailableModel() // Asynchrone au démarrage
}
```

**Variables globales** :
- `genAI` : Instance GoogleGenerativeAI
- `availableModel` : Modèle Gemini disponible (trouvé dynamiquement)

#### Découverte automatique de modèle

**Fonction `findAvailableModel()`** :

**Stratégie** : Essai séquentiel de plusieurs modèles

**Ordre de préférence** :
```javascript
const modelsToTry = [
  'gemini-2.0-flash',        // Nouveau (v1beta)
  'gemini-1.5-flash',        // Rapide
  'gemini-1.5-pro',          // Qualité
  'gemini-1.5-flash-latest', // Dernière version
  'gemini-1.5-pro-latest',  // Dernière version
  'gemini-pro'               // Ancien (déprécié)
]
```

**Mécanisme de test** :
```javascript
1. Créer le modèle
   const model = genAI.getGenerativeModel({ model: modelName })

2. Test avec timeout (5s)
   const testPromise = model.generateContent('test')
   const timeoutPromise = new Promise((_, reject) => 
     setTimeout(() => reject(new Error('Timeout')), 5000)
   )
   await Promise.race([testPromise, timeoutPromise])

3. Si succès → availableModel = modelName
4. Si erreur → Essayer le modèle suivant
```

**Gestion d'erreurs** :
- 404 → Modèle non disponible (log info)
- Autres erreurs → Log et continuation
- Aucun modèle → `availableModel = null`

**Avantages** :
- ✅ Compatibilité avec différentes versions de Gemini
- ✅ Détection automatique du meilleur modèle
- ✅ Résilience aux changements d'API

#### Traduction avec Gemini

**Fonction `translateWithGemini(text, targetLanguage)`** :

**Prompt engineering** :
```javascript
const prompt = `Traduis le texte suivant du portugais vers le ${targetLanguageName}. 
Réponds UNIQUEMENT avec la traduction, sans commentaires ni explications.

Texte à traduire: "${text}"

Traduction:`
```

**Points techniques** :
- **Langue cible** : Mapping code → nom (fr → français)
- **Prompt strict** : "UNIQUEMENT la traduction"
- **Nettoyage réponse** : Suppression guillemets et préfixes

**Nettoyage de la réponse** :
```javascript
return translatedText
  .replace(/^["']|["']$/g, '')           // Guillemets
  .replace(/^Traduction:\s*/i, '')        // Préfixe "Traduction:"
  .trim()
```

**Gestion d'erreurs** :
- Modèle non disponible → Erreur explicite
- Erreur API → Propagation avec message

#### Fallback et simulation

**Fonction `translateText(text, targetLanguage)`** :

**Stratégie de fallback** :
```javascript
1. Si Gemini disponible → Essayer translateWithGemini()
2. Si erreur Gemini → simulateTranslation() (fallback)
3. Si Gemini non configuré → simulateTranslation() (défaut)
```

**Avantages** :
- ✅ Résilience : Fonctionne même si Gemini échoue
- ✅ Développement : Pas besoin de clé API pour tester
- ✅ UX : L'utilisateur voit toujours un résultat

**Fonction `simulateTranslation(text, targetLanguage)`** :

**Traductions d'exemple** :
- 5 phrases pré-définies par langue
- Langues : fr, en, es, de, it

**Comportement** :
```javascript
// Si traduction exacte trouvée
if (langTranslations[text]) {
  return langTranslations[text]
}

// Sinon, retourner avec préfixe simulation
return `[Mode simulation - ${targetLanguage}] ${text}`
```

**Limitations** :
- ⚠️ Seulement 5 phrases par langue
- ⚠️ Texte original si pas de correspondance exacte
- ⚠️ Pas de vraie traduction pour nouveaux textes

---

### 3. Processeur Audio (`audioProcessor.js`)

#### Architecture

**Rôle** : Bridge entre Node.js et API Python (FastAPI)

**Flux** :
```
WebSocket chunks → Buffer audio → Fichier temporaire → API Python → Transcription
```

#### Traitement du stream audio

**Fonction `processAudioStream(audioBuffer)`** :

**Étapes** :
```javascript
1. Validation du buffer
   if (!audioBuffer || audioBuffer.length === 0) {
     throw new Error('Buffer audio vide')
   }

2. Vérification service Python
   if (!(await checkPythonServiceAvailable())) {
     throw new Error('Service Python STT non disponible')
   }

3. Sauvegarde temporaire
   tempFile = path.join(TEMP_DIR, `audio_${Date.now()}.webm`)
   fs.writeFileSync(tempFile, audioBuffer)

4. Transcription via API Python
   return await transcribeWithPythonService(tempFile)

5. Nettoyage (finally)
   if (tempFile && fs.existsSync(tempFile)) {
     fs.unlinkSync(tempFile)
   }
```

**Points techniques** :
- **Format** : `.webm` (format du MediaRecorder du navigateur)
- **Nom unique** : Timestamp pour éviter collisions
- **Nettoyage garanti** : Même en cas d'erreur

#### Communication avec API Python

**Fonction `transcribeWithPythonService(audioFile)`** :

**Requête multipart/form-data** :
```javascript
const formData = new FormData()
formData.append('file', fs.createReadStream(audioFile))
formData.append('language', 'pt')
formData.append('task', 'transcribe')
formData.append('temperature', '0.0')
```

**Configuration axios** :
```javascript
axios.post(
  `${PYTHON_API_URL}/api/stt/transcribe`,
  formData,
  {
    headers: {
      ...formData.getHeaders(),  // Content-Type avec boundary
    },
    timeout: 60000  // 60 secondes (transcription peut être longue)
  }
)
```

**Gestion de la réponse** :
```javascript
const transcription = response.data?.text || ''

// Validation
if (!transcription || !transcription.trim()) {
  console.warn('[STT Python] Transcription vide')
}

return transcription
```

**Nettoyage** :
- Fichier temporaire supprimé après transcription
- Même en cas d'erreur (dans catch)

#### Vérification de disponibilité du service

**Fonction `checkPythonServiceAvailable(retries, delay)`** :

**Stratégie avec retry** :
```javascript
for (let i = 0; i < retries; i++) {
  try {
    const response = await axios.get(`${PYTHON_API_URL}/health`, {
      timeout: 5000
    })
    if (response.data.status === 'healthy' && response.data.stt_ready) {
      return true
    }
  } catch (error) {
    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay))
      continue
    }
    return false
  }
}
```

**Paramètres par défaut** :
- `retries = 3` : 3 tentatives
- `delay = 1000` : 1 seconde entre tentatives

**Avantages** :
- ✅ Résilience : Gère le démarrage asynchrone des services
- ✅ Timeout : 5s par tentative (évite les blocages)
- ✅ Vérification complète : `status === 'healthy' && stt_ready`

**Cas d'usage** :
- Service Python démarre après Node.js
- Service Python redémarre
- Problème réseau temporaire

---

## 🔒 Points Techniques Critiques

### 1. Gestion de la mémoire

**Problème** : Accumulation de chunks audio en mémoire

**Solution actuelle** :
- Chunks stockés dans `session.audioChunks[]`
- Nettoyage après traitement : `session.audioChunks = []`
- Fichiers temporaires supprimés après transcription

**Risques** :
- ⚠️ Sessions longues → Beaucoup de chunks en mémoire
- ⚠️ Pas de limite de taille de session
- ⚠️ Pas de timeout automatique

**Recommandations** :
- Limiter la taille maximale de session (ex: 50MB)
- Timeout automatique (ex: 5 minutes d'inactivité)
- Streaming vers fichier au lieu de mémoire

### 2. Gestion des sessions

**Structure** : `Map<sessionId, session>`

**Avantages** :
- ✅ Accès O(1) par sessionId
- ✅ Pas de limite de sessions (jusqu'à mémoire)

**Problèmes potentiels** :
- ⚠️ Pas de nettoyage automatique des sessions inactives
- ⚠️ Pas de limite de nombre de sessions
- ⚠️ Sessions orphelines si WebSocket se ferme brutalement

**Recommandations** :
- Nettoyage périodique (setInterval)
- Limite de sessions actives
- Heartbeat pour détecter connexions mortes

### 3. Traitement différé vs streaming

**Choix actuel** : **Traitement différé** (à la fin)

**Avantages** :
- ✅ Fichier audio complet et valide
- ✅ Meilleure précision Whisper
- ✅ Plus simple à implémenter

**Inconvénients** :
- ⚠️ Latence plus élevée (attente fin enregistrement)
- ⚠️ Pas de feedback en temps réel
- ⚠️ Consommation mémoire (tous les chunks)

**Alternative** : Streaming avec chunks de 5-10 secondes
- Transcription partielle en temps réel
- Latence réduite
- Plus complexe (gestion de contexte)

### 4. Gestion des erreurs

**Stratégie actuelle** :
- Try-catch dans chaque fonction
- Messages d'erreur via WebSocket
- Fallback simulation pour traduction

**Points forts** :
- ✅ Erreurs capturées et loggées
- ✅ Messages utilisateur clairs
- ✅ Pas de crash du serveur

**Points d'amélioration** :
- ⚠️ Pas de retry automatique pour API Python
- ⚠️ Pas de circuit breaker pour Gemini
- ⚠️ Logs non structurés (console.log)

### 5. Sécurité

**Points à améliorer** :
- ⚠️ CORS non configuré (pas nécessaire, même origine)
- ⚠️ Pas de validation de taille de fichier
- ⚠️ Pas d'authentification/autorisation
- ⚠️ SessionId généré côté client (risque de collision)

**Recommandations** :
- Validation taille max (ex: 50MB)
- Authentification JWT pour WebSocket
- Rate limiting par session
- Validation format audio

---

## ⚠️ Points d'Attention

### 1. Performance

**Bottlenecks identifiés** :
- **Accumulation mémoire** : Tous les chunks en RAM
- **Traitement séquentiel** : STT → Translation (pas parallèle)
- **Pas de cache** : Même texte traduit plusieurs fois

**Optimisations possibles** :
- Streaming vers fichier au lieu de mémoire
- Cache Redis pour traductions fréquentes
- Traitement parallèle (STT + préparation traduction)

### 2. Scalabilité

**Limitations actuelles** :
- Serveur monolithique (pas de clustering)
- Sessions en mémoire (pas de partage entre instances)
- Pas de load balancing

**Solutions** :
- Redis pour sessions partagées
- Cluster Node.js (PM2)
- Load balancer (nginx)

### 3. Dépendances externes

**Services requis** :
- **API Python** : Doit être disponible (port 8000)
- **API Gemini** : Optionnel (fallback simulation)

**Gestion** :
- ✅ Vérification disponibilité Python (avec retry)
- ✅ Fallback simulation si Gemini indisponible
- ⚠️ Pas de health check périodique

**Recommandations** :
- Health check périodique (toutes les 30s)
- Circuit breaker pour API Python
- Queue pour requêtes en cas d'indisponibilité

### 4. Configuration

**Variables d'environnement** :
```env
PORT=3001                          # Port serveur Node.js
PYTHON_API_URL=http://localhost:8000  # URL API Python
GEMINI_API_KEY=...                 # Clé API Gemini (optionnel)
```

**Points** :
- ✅ Configuration via dotenv
- ⚠️ Pas de validation des variables
- ⚠️ Valeurs par défaut hardcodées

---

## 🚀 Optimisations Possibles

### 1. Streaming vers fichier

**Actuel** :
```javascript
session.audioChunks.push(data)  // En mémoire
```

**Optimisé** :
```javascript
const writeStream = fs.createWriteStream(tempFile)
ws.on('message', (data) => {
  writeStream.write(data)  // Directement dans fichier
})
```

**Avantages** :
- Moins de mémoire utilisée
- Support de très longs enregistrements
- Pas de limite de taille

### 2. Cache de traductions

**Implémentation** :
```javascript
const translationCache = new Map()

async function translateText(text, targetLanguage) {
  const key = `${text}:${targetLanguage}`
  if (translationCache.has(key)) {
    return translationCache.get(key)
  }
  const result = await translateWithGemini(text, targetLanguage)
  translationCache.set(key, result)
  return result
}
```

**Avantages** :
- Réduction appels API Gemini
- Latence réduite
- Coût réduit

### 3. Traitement parallèle

**Actuel** :
```javascript
transcription = await processAudioStream(audioBuffer)
translation = await translateText(transcription, targetLanguage)
```

**Optimisé** :
```javascript
// Préparer la traduction pendant la transcription
const transcriptionPromise = processAudioStream(audioBuffer)
const [transcription] = await Promise.all([transcriptionPromise])
// Puis traduire
```

**Note** : Pas vraiment parallèle ici, mais préparation possible.

### 4. WebSocket avec compression

**Actuel** : Chunks bruts

**Optimisé** : Compression gzip des messages JSON
```javascript
const zlib = require('zlib')
const compressed = zlib.gzipSync(JSON.stringify(data))
ws.send(compressed)
```

**Avantages** :
- Bande passante réduite
- Latence réduite (moins de données)

### 5. Monitoring et métriques

**Ajout possible** :
```javascript
const metrics = {
  activeSessions: sessions.size,
  totalTranscriptions: 0,
  totalTranslations: 0,
  averageLatency: 0
}

// Exposer via endpoint
app.get('/api/metrics', (req, res) => {
  res.json(metrics)
})
```

---

## 🐛 Problèmes Connus et Solutions

### 1. Sessions orphelines

**Problème** : Sessions non nettoyées si WebSocket se ferme brutalement

**Solution actuelle** : Nettoyage sur `close` et `error`

**Amélioration** : Timeout automatique
```javascript
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.startTime > 300000) {  // 5 minutes
      sessions.delete(id)
    }
  }
}, 60000)  // Vérifier toutes les minutes
```

### 2. Accumulation mémoire

**Problème** : Chunks audio en mémoire pour sessions longues

**Solution recommandée** : Streaming vers fichier (voir optimisations)

### 3. Erreurs silencieuses

**Problème** : Certaines erreurs ne sont pas loggées

**Solution** : Logging structuré
```javascript
const winston = require('winston')
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: 'server.log' })]
})
```

---

## 📊 Métriques et Monitoring

### Métriques disponibles

**Actuellement** :
- `activeSessions` : Nombre de sessions actives (via `/api/health`)

**Métriques possibles** :
- Nombre total de transcriptions
- Nombre total de traductions
- Latence moyenne (STT + Translation)
- Taux d'erreur
- Taille moyenne des sessions

### Logging

**Actuel** : `console.log` / `console.error`

**Format** : `[Module] Message`

**Exemples** :
- `[WebSocket] Nouvelle connexion: 1234567890`
- `[STT] Transcription réussie: ...`
- `[Translation] Gemini a échoué, utilisation du mode simulation`

**Amélioration** : Logging structuré (JSON) pour parsing automatique

---

## 🔗 Intégration avec autres services

### Frontend (React)

**Communication** :
- WebSocket : `ws://localhost:3001`
- API REST : `http://localhost:3001/api/translate`

**Messages WebSocket** :
- Client → Server : Chunks audio (Buffer) ou `{ type: 'end' }`
- Server → Client : `{ type: 'connected' }`, `{ type: 'transcription' }`, `{ type: 'error' }`

### API Python (FastAPI)

**Communication** :
- Endpoint : `POST /api/stt/transcribe`
- Format : multipart/form-data
- Timeout : 60 secondes

**Health check** :
- Endpoint : `GET /health`
- Retry : 3 tentatives avec délai 1s

### API Gemini

**Communication** :
- SDK : `@google/generative-ai`
- Découverte automatique de modèle
- Fallback simulation si indisponible

---

## 📝 Recommandations

### Court terme
1. ✅ Ajouter timeout automatique pour sessions
2. ✅ Limiter taille maximale de session
3. ✅ Validation taille fichier audio
4. ✅ Logging structuré

### Moyen terme
1. Streaming vers fichier au lieu de mémoire
2. Cache de traductions (Redis ou Map)
3. Health check périodique API Python
4. Circuit breaker pour résilience

### Long terme
1. Clustering Node.js (PM2)
2. Sessions partagées (Redis)
3. Load balancing
4. Monitoring avancé (Prometheus/Grafana)

---

## ✅ Conclusion

Le serveur Node.js est une **implémentation solide** qui remplit bien son rôle d'intermédiaire :

✅ **Points forts** :
- Architecture claire et modulaire
- Gestion robuste des erreurs avec fallback
- Découverte automatique de modèle Gemini
- Vérification disponibilité services avec retry
- Nettoyage automatique des ressources

⚠️ **Points d'amélioration** :
- Gestion mémoire (accumulation chunks)
- Scalabilité (sessions en mémoire)
- Monitoring et métriques
- Sécurité (validation, authentification)

**Note** : Le serveur est conçu pour un usage **mono-instance**. Pour la production à grande échelle, des améliorations de scalabilité sont recommandées.


