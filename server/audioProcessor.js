const fs = require('fs')
const path = require('path')
const axios = require('axios')
const FormData = require('form-data')

const TEMP_DIR = path.join(__dirname, 'temp')
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

async function processAudioStream(audioBuffer) {
  let tempFile = null

  try {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer')
    }

    if (!(await checkPythonServiceAvailable())) {
      throw new Error('Python STT service not available. Please start the Python service (python/api.py).')
    }

    tempFile = path.join(TEMP_DIR, `audio_${Date.now()}.webm`)
    fs.writeFileSync(tempFile, audioBuffer)

    console.log(`[STT] Fichier audio sauvegardé: ${tempFile} (${audioBuffer.length} bytes)`)

    return await transcribeWithPythonService(tempFile)

  } catch (error) {
    console.error('[STT] Erreur lors du traitement audio:', error)

    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile)
      } catch (e) {
      }
    }

    throw error
  }
}

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
        timeout: 60000
      }
    )

    if (fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile)
    }

    console.log('[STT Python] Réponse reçue:', {
      status: response.status,
      hasData: !!response.data,
      hasText: !!response.data?.text,
      textLength: response.data?.text?.length || 0
    })

    const transcription = response.data?.text || ''
    if (!transcription || !transcription.trim()) {
      console.warn('[STT Python] Transcription vide ou invalide:', response.data)
    } else {
      console.log('[STT Python] Transcription réussie:', transcription.substring(0, 100))
    }

    return transcription
  } catch (error) {
    if (fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile)
    }
    console.error('[STT Python] Erreur:', error.message)
    throw error
  }
}

async function checkPythonServiceAvailable(retries = 3, delay = 1000) {
  console.log(`[STT] Checking Python service at ${PYTHON_API_URL}/health`)
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(`${PYTHON_API_URL}/health`, {
        timeout: 5000
      })
      console.log(`[STT] Python service health check response:`, response.data)
      if (response.data.status === 'healthy' && response.data.stt_ready) {
        console.log(`[STT] Python service is available and ready`)
        return true
      } else {
        console.warn(`[STT] Python service health check failed: status=${response.data.status}, stt_ready=${response.data.stt_ready}`)
      }
    } catch (error) {
      console.warn(`[STT] Python service health check attempt ${i + 1}/${retries} failed:`, error.message)
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      console.error(`[STT] Python service not available after ${retries} attempts`)
      return false
    }
  }
  return false
}

module.exports = {
  processAudioStream
}
