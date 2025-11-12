// Module de traitement audio pour Speech-to-Text
// Utilise le service Python via API FastAPI

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const FormData = require('form-data')

// Configuration
const TEMP_DIR = path.join(__dirname, 'temp')
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

// Créer le dossier temp s'il n'existe pas
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

/**
 * Traite un buffer audio et retourne la transcription
 * Utilise uniquement le service Python via API FastAPI
 */
async function processAudioStream(audioBuffer) {
  let tempFile = null
  
  try {
    // Vérifier que le buffer n'est pas vide
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Buffer audio vide')
    }

    // Vérifier que le service Python est disponible (avec retry)
    if (!(await checkPythonServiceAvailable())) {
      throw new Error('Service Python STT non disponible. Veuillez démarrer le service Python (python/api.py).')
    }

    // Sauvegarder temporairement l'audio
    tempFile = path.join(TEMP_DIR, `audio_${Date.now()}.webm`)
    fs.writeFileSync(tempFile, audioBuffer)
    
    console.log(`[STT] Fichier audio sauvegardé: ${tempFile} (${audioBuffer.length} bytes)`)

    // Utiliser le service Python
    return await transcribeWithPythonService(tempFile)

  } catch (error) {
    console.error('[STT] Erreur lors du traitement audio:', error)
    
    // Nettoyer le fichier temporaire en cas d'erreur
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile)
      } catch (e) {
        // Ignorer les erreurs de nettoyage
      }
    }
    
    throw error
  }
}

/**
 * Transcription avec le service Python (FastAPI)
 */
async function transcribeWithPythonService(audioFile) {
  try {
    const formData = new FormData()
    formData.append('file', fs.createReadStream(audioFile))
    formData.append('language', 'pt')
    formData.append('task', 'transcribe')
    formData.append('temperature', '0.0')

    const response = await axios.post(
      `${PYTHON_API_URL}/api/stt/transcribe`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 60000 // 60 secondes timeout
      }
    )

    // Nettoyer le fichier temporaire
    if (fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile)
    }

    // Vérifier la réponse
    console.log('[STT Python] Réponse reçue:', {
      status: response.status,
      hasData: !!response.data,
      hasText: !!response.data?.text,
      textLength: response.data?.text?.length || 0
    })

    // Retourner le texte transcrit
    const transcription = response.data?.text || ''
    if (!transcription || !transcription.trim()) {
      console.warn('[STT Python] Transcription vide ou invalide:', response.data)
    } else {
      console.log('[STT Python] Transcription réussie:', transcription.substring(0, 100))
    }
    
    return transcription
  } catch (error) {
    // Nettoyer le fichier temporaire même en cas d'erreur
    if (fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile)
    }
    console.error('[STT Python] Erreur:', error.message)
    throw error
  }
}

/**
 * Vérifie si le service Python est disponible
 * Avec retry pour gérer le cas où le service démarre après Node.js
 */
async function checkPythonServiceAvailable(retries = 3, delay = 1000) {
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
        // Attendre avant de réessayer
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      return false
    }
  }
  return false
}

module.exports = {
  processAudioStream
}
