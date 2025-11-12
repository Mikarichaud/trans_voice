const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const path = require('path')
require('dotenv').config()

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

// Middleware
app.use(express.json())
app.use(express.static(path.join(__dirname, '../frontend/dist')))

// Import des modules de traitement
const { processAudioStream } = require('./audioProcessor')
const { translateText } = require('./translationService')

// Stockage temporaire des sessions
const sessions = new Map()

// WebSocket pour la communication temps réel
wss.on('connection', (ws, req) => {
  const sessionId = req.headers['x-session-id'] || Date.now().toString()
  const session = {
    id: sessionId,
    audioChunks: [],
    startTime: Date.now(),
    ws,
    isStopped: false  // Flag pour empêcher le traitement après l'arrêt
  }
  
  sessions.set(sessionId, session)
  console.log(`[WebSocket] Nouvelle connexion: ${sessionId}`)

  ws.on('message', async (data) => {
    try {
      // Si la session est arrêtée, ignorer les nouveaux messages
      if (session.isStopped) {
        return
      }
      
      // Vérifier si c'est un message JSON (signal de fin)
      // Essayer de parser comme JSON d'abord
      try {
        const text = data.toString('utf8')
        if (text.trim().startsWith('{')) {
          const message = JSON.parse(text)
          if (message.type === 'end') {
            session.isStopped = true
            await handleEndOfRecording(sessionId)
            return
          }
        }
      } catch (e) {
        // Ce n'est pas du JSON, continuer comme audio
      }

      // Accumuler les chunks audio sans traitement (traitement uniquement à la fin)
      if (!session.isStopped && (data instanceof Buffer || data instanceof ArrayBuffer)) {
        session.audioChunks.push(data)
        // Les chunks sont accumulés dans session.audioChunks
        // Le traitement se fera uniquement à la fin de l'enregistrement (signal 'end')
        // Cela garantit un fichier audio complet et valide pour la transcription
      }
    } catch (error) {
      console.error(`[WebSocket] Erreur lors du traitement:`, error)
      if (!session.isStopped && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message
        }))
      }
    }
  })

  ws.on('close', () => {
    console.log(`[WebSocket] Connexion fermée: ${sessionId}`)
    sessions.delete(sessionId)
  })

  ws.on('error', (error) => {
    console.error(`[WebSocket] Erreur:`, error)
    sessions.delete(sessionId)
  })

  // Envoyer un message de confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId
  }))
})

async function processAudioChunks(sessionId) {
  const session = sessions.get(sessionId)
  if (!session || session.audioChunks.length === 0) return

  try {
    console.log(`[STT] Début de la transcription audio (${session.audioChunks.length} chunks accumulés)`)
    
    // Convertir tous les chunks en Buffer (s'assurer qu'ils sont bien des Buffers)
    const buffers = session.audioChunks.map(chunk => 
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    )
    const audioBuffer = Buffer.concat(buffers)
    
    console.log(`[STT] Buffer audio créé: ${audioBuffer.length} bytes`)
    
    // Traiter l'audio (STT) - transcription complète du fichier audio
    console.log(`[STT] Envoi au service Python pour transcription...`)
    const transcription = await processAudioStream(audioBuffer)
    
    if (transcription && transcription.trim()) {
      // Envoyer la transcription au client (même si la session est marquée comme arrêtée,
      // car c'est le résultat final du traitement)
      if (session.ws && session.ws.readyState === 1) { // 1 = OPEN
        session.ws.send(JSON.stringify({
          type: 'transcription',
          text: transcription,
          timestamp: Date.now()
        }))
        
        console.log(`[STT] Transcription envoyée au client: ${transcription.substring(0, 100)}...`)
      } else {
        console.warn(`[STT] WebSocket non disponible pour envoyer la transcription (readyState: ${session.ws?.readyState})`)
      }
    } else {
      console.warn(`[STT] Transcription vide ou invalide: "${transcription}"`)
    }
    
    // Nettoyer les chunks traités (garder seulement les derniers pour éviter la perte de données)
    session.audioChunks = []
  } catch (error) {
    console.error(`[STT] Erreur lors de la transcription:`, error)
    if (session.ws && session.ws.readyState === 1) {
      session.ws.send(JSON.stringify({
        type: 'error',
        message: `Erreur de transcription: ${error.message}`
      }))
    }
  }
}

async function handleEndOfRecording(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) {
    console.warn(`[Session] Session ${sessionId} non trouvée`)
    return
  }

  try {
    console.log(`[Session] Signal de fin reçu. Début du traitement audio...`)
    console.log(`[Session] État WebSocket: ${session.ws?.readyState} (1=OPEN)`)
    
    // Marquer la session comme arrêtée (mais garder la WebSocket ouverte pour envoyer les résultats)
    session.isStopped = true
    
    // Traiter tous les chunks accumulés UNIQUEMENT maintenant (à la fin de l'enregistrement)
    // Cela garantit que nous avons un fichier audio complet et valide pour la transcription
    if (session.audioChunks.length > 0) {
      const totalSize = session.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
      console.log(`[Session] Traitement de ${session.audioChunks.length} chunks audio (${totalSize} bytes total)...`)
      
      // Traiter l'audio maintenant (transcription, traduction, etc.)
      await processAudioChunks(sessionId)
      
      console.log(`[Session] Traitement audio terminé`)
    } else {
      console.log(`[Session] Aucun chunk audio à traiter`)
    }
    
    // Nettoyer la session après traitement (mais ne pas fermer la WebSocket immédiatement)
    session.audioChunks = []
    
    console.log(`[Session] Enregistrement terminé: ${sessionId}`)
    
    // Laisser la WebSocket ouverte pour permettre au client de recevoir les résultats
    // Elle sera fermée automatiquement lors de la déconnexion du client
  } catch (error) {
    console.error(`[Session] Erreur lors du traitement final:`, error)
    if (session && session.ws && session.ws.readyState === 1) {
      session.ws.send(JSON.stringify({
        type: 'error',
        message: `Erreur lors du traitement final: ${error.message}`
      }))
    }
  }
}

// Route API pour la traduction
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Texte requis' })
    }

    const translatedText = await translateText(text, targetLanguage || 'fr')
    
    res.json({
      translatedText,
      sourceLanguage: 'pt-BR',
      targetLanguage: targetLanguage || 'fr',
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('[API] Erreur de traduction:', error)
    
    // Si l'erreur est "Texte vide", retourner 400
    if (error.message === 'Texte vide') {
      return res.status(400).json({ 
        error: 'Texte requis',
        message: error.message 
      })
    }
    
    // Pour les autres erreurs, essayer quand même de retourner une traduction simulée
    // pour que l'utilisateur voie au moins quelque chose
    try {
      const { simulateTranslation } = require('./translationService')
      const simulatedText = simulateTranslation(text, targetLanguage || 'fr')
      return res.json({
        translatedText: simulatedText,
        sourceLanguage: 'pt-BR',
        targetLanguage: targetLanguage || 'fr',
        timestamp: Date.now(),
        warning: 'Mode simulation (API Gemini indisponible)'
      })
    } catch (simError) {
      // Si même la simulation échoue, retourner l'erreur
      res.status(500).json({ 
        error: 'Erreur lors de la traduction',
        message: error.message 
      })
    }
  }
})

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: Date.now(),
    activeSessions: sessions.size
  })
})

// Servir l'application React en production
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'))
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`)
  console.log(`📡 WebSocket disponible sur ws://localhost:${PORT}/ws`)
  console.log(`🌐 API disponible sur http://localhost:${PORT}/api`)
})


