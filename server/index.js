const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const path = require('path')
const fs = require('fs')

if (fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
}
require('dotenv').config({ override: false })

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server, path: '/ws' })

app.use(express.json())
app.use(express.static(path.join(__dirname, '../frontend/dist')))

const { processAudioStream } = require('./audioProcessor')
const { translateText } = require('./translationService')

const sessions = new Map()

wss.on('connection', (ws, req) => {
  const sessionId = req.headers['x-session-id'] || Date.now().toString()
  const session = {
    id: sessionId,
    audioChunks: [],
    startTime: Date.now(),
    ws,
    isStopped: false
  }

  sessions.set(sessionId, session)
  console.log(`[WebSocket] Nouvelle connexion: ${sessionId}`)

  ws.on('message', async (data) => {
    try {
      if (session.isStopped) {
        return
      }

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
      }

      if (!session.isStopped && (data instanceof Buffer || data instanceof ArrayBuffer)) {
        session.audioChunks.push(data)
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

    const buffers = session.audioChunks.map(chunk => 
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    )
    const audioBuffer = Buffer.concat(buffers)

    console.log(`[STT] Buffer audio créé: ${audioBuffer.length} bytes`)

    console.log(`[STT] Envoi au service Python pour transcription...`)
    const transcription = await processAudioStream(audioBuffer)

    if (transcription && transcription.trim()) {
      if (session.ws && session.ws.readyState === 1) {
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

    session.audioChunks = []
  } catch (error) {
    console.error(`[STT] Transcription error:`, error)
    if (session.ws && session.ws.readyState === 1) {
      session.ws.send(JSON.stringify({
        type: 'error',
        message: `Transcription error: ${error.message}`
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

    session.isStopped = true

    if (session.audioChunks.length > 0) {
      const totalSize = session.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
      console.log(`[Session] Traitement de ${session.audioChunks.length} chunks audio (${totalSize} bytes total)...`)

      await processAudioChunks(sessionId)

      console.log(`[Session] Traitement audio terminé`)
    } else {
      console.log(`[Session] Aucun chunk audio à traiter`)
    }

    session.audioChunks = []

    console.log(`[Session] Enregistrement terminé: ${sessionId}`)
  } catch (error) {
    console.error(`[Session] Final processing error:`, error)
    if (session && session.ws && session.ws.readyState === 1) {
      session.ws.send(JSON.stringify({
        type: 'error',
        message: `Final processing error: ${error.message}`
      }))
    }
  }
}

// Route API pour la traduction
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text required' })
    }

    const translatedText = await translateText(text, targetLanguage || 'fr')

    res.json({
      translatedText,
      sourceLanguage: 'pt-BR',
      targetLanguage: targetLanguage || 'fr',
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('[API] Translation error:', error)

    if (error.message === 'Texte vide' || error.message === 'Empty text') {
      return res.status(400).json({ 
        error: 'Text required',
        message: error.message 
      })
    }

    try {
      const { simulateTranslation } = require('./translationService')
      const simulatedText = simulateTranslation(text, targetLanguage || 'fr')
      return res.json({
        translatedText: simulatedText,
        sourceLanguage: 'pt-BR',
        targetLanguage: targetLanguage || 'fr',
        timestamp: Date.now(),
        warning: 'Simulation mode (Gemini API unavailable)'
      })
    } catch (simError) {
      res.status(500).json({ 
        error: 'Translation error',
        message: error.message 
      })
    }
  }
})

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: Date.now(),
    activeSessions: sessions.size
  })
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'))
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`)
  console.log(`📡 WebSocket disponible sur ws://localhost:${PORT}/ws`)
  console.log(`🌐 API disponible sur http://localhost:${PORT}/api`)
})
