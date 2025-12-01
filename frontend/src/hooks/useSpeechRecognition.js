import { useState, useEffect, useRef, useCallback } from 'react'

export const useSpeechRecognition = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [audioChunks, setAudioChunks] = useState([])
  const [error, setError] = useState(null)
  const [microphoneStatus, setMicrophoneStatus] = useState('disconnected')
  const [recordingTime, setRecordingTime] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const mediaRecorderRef = useRef(null)
  const audioStreamRef = useRef(null)
  const wsRef = useRef(null)
  const isStoppingRef = useRef(false)
  const maxRecordingTime = 30
  const timeIntervalRef = useRef(null)
  const stopRecordingRef = useRef(null)
  const metricsRef = useRef({
    startTime: null,
    audioChunksCount: 0,
    totalBytes: 0
  })

  const isRecordingRef = useRef(false)

  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  const connectWebSocket = useCallback(() => {

    if (wsRef.current) {
      const state = wsRef.current.readyState
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        console.log('[useSpeechRecognition] WebSocket déjà en cours de connexion ou connectée')
        return
      }

      if (state === WebSocket.CLOSING || state === WebSocket.CLOSED) {
        wsRef.current = null
      }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    console.log('[useSpeechRecognition] Tentative de connexion WebSocket:', wsUrl)
    wsRef.current = new WebSocket(wsUrl)

    wsRef.current.onopen = () => {
      console.log('[useSpeechRecognition] WebSocket connecté avec succès')
      setMicrophoneStatus('connected')
      setError(null)
    }

    wsRef.current.onmessage = (event) => {

      try {
        if (event.data instanceof Blob) {

          return
        }
        const data = JSON.parse(event.data)
        if (data.type === 'transcription') {
          console.log('[useSpeechRecognition] Transcription reçue via WebSocket')
          setIsTranscribing(false)
          setIsSending(false)
        } else if (data.type === 'connected') {
          console.log('[useSpeechRecognition] Session connectée:', data.sessionId)
        } else if (data.type === 'error') {
          console.error('[useSpeechRecognition] Erreur reçue:', data.message)
          setIsTranscribing(false)
          setIsSending(false)
        } else if (data.type === 'processing') {
          setIsTranscribing(true)
          setIsSending(false)
        }
      } catch (e) {

      }
    }

    wsRef.current.onerror = (err) => {
      console.error('[useSpeechRecognition] Erreur WebSocket:', err)

    }

    wsRef.current.onclose = (event) => {
      console.log('[useSpeechRecognition] WebSocket fermé', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      })

      if (!isRecordingRef.current && event.code !== 1000) {
        setMicrophoneStatus('disconnected')
      }

      wsRef.current = null

      if (event.code !== 1000 && !isRecordingRef.current) {
        console.log('[useSpeechRecognition] Tentative de reconnexion dans 2 secondes...')
        setTimeout(() => {
          if (!wsRef.current) {
            connectWebSocket()
          }
        }, 2000)
      }
    }
  }, [])

  useEffect(() => {

    const timeoutId = setTimeout(() => {
      connectWebSocket()
    }, 500)

    return () => {
      clearTimeout(timeoutId)

      if (wsRef.current) {
        const state = wsRef.current.readyState
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {

          wsRef.current.close(1000, 'Component unmounting')
        }
        wsRef.current = null
      }
    }
  }, [connectWebSocket])

  const startRecording = useCallback(async () => {

    if (mediaRecorderRef.current?.state === 'recording') {
      console.log('Déjà en train d\'enregistrer, ignoré')
      return
    }

    try {
      setError(null)

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('[startRecording] WebSocket non connectée, connexion...')
        connectWebSocket()

        await new Promise((resolve) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            resolve()
          } else {
            const checkConnection = () => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                resolve()
              } else {
                setTimeout(checkConnection, 100)
              }
            }
            wsRef.current?.addEventListener('open', resolve, { once: true })
            setTimeout(() => {
              resolve()
            }, 2000)
          }
        })
      }
      metricsRef.current.startTime = Date.now()
      metricsRef.current.audioChunksCount = 0
      metricsRef.current.totalBytes = 0
      isStoppingRef.current = false
      setIsSending(false)
      setIsTranscribing(false)

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch (e) {
          console.warn('Erreur lors du nettoyage de l\'ancien MediaRecorder:', e)
        }
      }

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
        audioStreamRef.current = null
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      audioStreamRef.current = stream
      setMicrophoneStatus('recording')

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorderRef.current = mediaRecorder

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('[startRecording] WebSocket pas encore connectée, attente...')
        await new Promise((resolve) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            resolve()
          } else {
            wsRef.current?.addEventListener('open', resolve, { once: true })
            setTimeout(resolve, 1000)
          }
        })
      }

      mediaRecorder.ondataavailable = (event) => {

        if (event.data.size > 0) {

          const recorderState = mediaRecorderRef.current?.state
          const canSend = !isStoppingRef.current && 
                         wsRef.current?.readyState === WebSocket.OPEN &&
                         recorderState === 'recording'

          if (canSend) {
            try {
              wsRef.current.send(event.data)
              metricsRef.current.audioChunksCount++
              metricsRef.current.totalBytes += event.data.size
            } catch (err) {
              console.warn('Erreur lors de l\'envoi du chunk audio:', err)
            }
          } else {

            if (recorderState !== 'inactive') {
              console.log('Chunk audio ignoré (arrêt en cours)', {
                isStopping: isStoppingRef.current,
                wsReady: wsRef.current?.readyState,
                recorderState
              })
            }
          }
        }
      }

      mediaRecorder.onerror = (err) => {
        console.error('Erreur MediaRecorder:', err)
        setError('Erreur lors de l\'enregistrement audio')
        setIsRecording(false)
        setMicrophoneStatus('error')
      }

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder arrêté (onstop appelé)')
        setIsRecording(false)
        setMicrophoneStatus('stopped')
        isStoppingRef.current = false

        if (timeIntervalRef.current) {
          clearInterval(timeIntervalRef.current)
          timeIntervalRef.current = null
        }

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => {
            track.stop()
          })
          audioStreamRef.current = null
        }
      }

      isStoppingRef.current = false
      setRecordingTime(0)

      mediaRecorder.start(100)
      setIsRecording(true)
      console.log('Enregistrement démarré')

      timeIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1

          if (newTime >= maxRecordingTime) {
            console.log('Limite de 30 secondes atteinte, arrêt automatique...')

            setTimeout(() => {
              if (stopRecordingRef.current && mediaRecorderRef.current?.state === 'recording') {
                stopRecordingRef.current()
              }
            }, 0)
            return maxRecordingTime
          }
          return newTime
        })
      }, 1000)
    } catch (err) {
      console.error('Erreur lors du démarrage de l\'enregistrement:', err)
      setError(`Erreur: ${err.message}`)
      setMicrophoneStatus('error')
    }
  }, [connectWebSocket])

  const stopRecording = useCallback(() => {

    const actualState = mediaRecorderRef.current?.state
    const isActuallyRecording = actualState === 'recording' || actualState === 'paused'

    console.log('stopRecording appelé, état actuel:', {
      isRecording,
      mediaRecorderState: actualState,
      hasStream: !!audioStreamRef.current,
      isStopping: isStoppingRef.current,
      recordingTime,
      isActuallyRecording
    })

    if (isStoppingRef.current) {
      console.log('Déjà en train d\'arrêter, ignoré')
      return
    }

    if (!isActuallyRecording && !isRecording) {
      console.log('Pas en train d\'enregistrer, ignoré')
      return
    }

    isStoppingRef.current = true

    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current)
      timeIntervalRef.current = null
    }

    setIsRecording(false)
    setMicrophoneStatus('stopped')

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        setIsSending(true)
        wsRef.current.send(JSON.stringify({ type: 'end' }))
        console.log('Signal de fin envoyé au serveur')
        setTimeout(() => {
          setIsTranscribing(true)
          setIsSending(false)
        }, 500)
      } catch (err) {
        console.error('Erreur lors de l\'envoi du signal de fin:', err)
        setIsSending(false)
      }
    }

    if (mediaRecorderRef.current) {
      try {
        const state = mediaRecorderRef.current.state
        console.log('État MediaRecorder avant arrêt:', state)

        if (state === 'recording' || state === 'paused') {

          try {
            mediaRecorderRef.current.stop()
            console.log('MediaRecorder.stop() appelé avec succès')
          } catch (stopErr) {
            console.error('Erreur lors de stop():', stopErr)

            isStoppingRef.current = false
            setIsRecording(false)
            setMicrophoneStatus('stopped')
          }
        } else {

          console.log('MediaRecorder déjà arrêté, nettoyage manuel')
          isStoppingRef.current = false
          setIsRecording(false)
          setMicrophoneStatus('stopped')
        }
      } catch (err) {
        console.error('Erreur lors de l\'arrêt du MediaRecorder:', err)
        isStoppingRef.current = false
      }
    } else {
      isStoppingRef.current = false
    }

    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log('Track audio arrêté:', track.kind)
        })
        audioStreamRef.current = null
      } catch (err) {
        console.error('Erreur lors de l\'arrêt des tracks audio:', err)
      }
    }
  }, [isRecording, recordingTime])

  useEffect(() => {
    stopRecordingRef.current = stopRecording
  }, [stopRecording])

  useEffect(() => {
    return () => {

      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current)
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const getMetrics = useCallback(() => {
    if (!metricsRef.current.startTime) return null

    const duration = (Date.now() - metricsRef.current.startTime) / 1000
    return {
      duration,
      chunksCount: metricsRef.current.audioChunksCount,
      totalBytes: metricsRef.current.totalBytes,
      averageBitrate: metricsRef.current.totalBytes * 8 / duration / 1000
    }
  }, [])

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
    microphoneStatus,
    wsRef,
    getMetrics,
    recordingTime,
    maxRecordingTime,
    isSending,
    isTranscribing
  }
}
