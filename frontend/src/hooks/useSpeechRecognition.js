import { useState, useEffect, useRef, useCallback } from 'react'

export const useSpeechRecognition = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [audioChunks, setAudioChunks] = useState([])
  const [error, setError] = useState(null)
  const [microphoneStatus, setMicrophoneStatus] = useState('disconnected')
  const [recordingTime, setRecordingTime] = useState(0) // Temps d'enregistrement en secondes
  
  const mediaRecorderRef = useRef(null)
  const audioStreamRef = useRef(null)
  const wsRef = useRef(null)
  const isStoppingRef = useRef(false) // Flag pour empêcher l'envoi de données pendant l'arrêt
  const maxRecordingTime = 30 // Limite de 30 secondes
  const timeIntervalRef = useRef(null) // Référence pour l'intervalle de temps
  const stopRecordingRef = useRef(null) // Référence pour la fonction stopRecording
  const metricsRef = useRef({
    startTime: null,
    audioChunksCount: 0,
    totalBytes: 0
  })

  const isRecordingRef = useRef(false)
  
  // Synchroniser isRecordingRef avec isRecording
  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  const connectWebSocket = useCallback(() => {
    // Ne pas créer une nouvelle connexion si une existe déjà et est en cours
    if (wsRef.current) {
      const state = wsRef.current.readyState
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        console.log('[useSpeechRecognition] WebSocket déjà en cours de connexion ou connectée')
        return
      }
      // Si fermée, nettoyer avant de recréer
      if (state === WebSocket.CLOSING || state === WebSocket.CLOSED) {
        wsRef.current = null
      }
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? `${protocol}//${window.location.host}/ws`
      : `${protocol}//${window.location.hostname}:3001/ws`
    
    console.log('[useSpeechRecognition] Tentative de connexion WebSocket:', wsUrl)
    wsRef.current = new WebSocket(wsUrl)
    
    wsRef.current.onopen = () => {
      console.log('[useSpeechRecognition] WebSocket connecté avec succès')
      setMicrophoneStatus('connected')
      setError(null) // Effacer les erreurs précédentes
    }
    
    wsRef.current.onmessage = (event) => {
      // Les messages de transcription sont gérés par useTranslation
      // On log juste pour le débogage
      try {
        if (event.data instanceof Blob) {
          // Ignorer les blobs audio
          return
        }
        const data = JSON.parse(event.data)
        if (data.type === 'transcription') {
          console.log('[useSpeechRecognition] Transcription reçue via WebSocket')
        } else if (data.type === 'connected') {
          console.log('[useSpeechRecognition] Session connectée:', data.sessionId)
        } else if (data.type === 'error') {
          console.error('[useSpeechRecognition] Erreur reçue:', data.message)
        }
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
    }
    
    wsRef.current.onerror = (err) => {
      console.error('[useSpeechRecognition] Erreur WebSocket:', err)
      // Ne pas mettre le statut en erreur immédiatement, attendre onclose
      // car certaines erreurs peuvent être temporaires
    }
    
    wsRef.current.onclose = (event) => {
      console.log('[useSpeechRecognition] WebSocket fermé', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      })
      
      // Ne pas mettre le statut en disconnected si c'est une fermeture normale
      // ou si on est en train d'enregistrer (pour éviter les interruptions)
      if (!isRecordingRef.current && event.code !== 1000) {
        setMicrophoneStatus('disconnected')
      }
      
      // Nettoyer la référence
      wsRef.current = null
      
      // Tentative de reconnexion automatique si ce n'était pas une fermeture intentionnelle
      // et si on n'est pas en train d'enregistrer
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

  // Connecter la WebSocket au montage du composant
  useEffect(() => {
    // Attendre un peu que le serveur soit prêt avant de se connecter
    const timeoutId = setTimeout(() => {
      connectWebSocket()
    }, 500) // Délai de 500ms pour laisser le serveur démarrer
    
    return () => {
      clearTimeout(timeoutId)
      // Ne fermer la WebSocket que si elle est vraiment ouverte
      // et seulement lors du démontage du composant
      if (wsRef.current) {
        const state = wsRef.current.readyState
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          // Fermer proprement avec code 1000 (fermeture normale)
          wsRef.current.close(1000, 'Component unmounting')
        }
        wsRef.current = null
      }
    }
  }, [connectWebSocket])

  const startRecording = useCallback(async () => {
    // Si déjà en train d'enregistrer, ne rien faire
    if (mediaRecorderRef.current?.state === 'recording') {
      console.log('Déjà en train d\'enregistrer, ignoré')
      return
    }
    
    try {
      setError(null)
      
      // Vérifier si la WebSocket est connectée, sinon la connecter
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('[startRecording] WebSocket non connectée, connexion...')
        connectWebSocket()
        // Attendre un peu que la WebSocket se connecte
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
              resolve() // Timeout de sécurité après 2 secondes
            }, 2000)
          }
        })
      }
      metricsRef.current.startTime = Date.now()
      metricsRef.current.audioChunksCount = 0
      metricsRef.current.totalBytes = 0
      isStoppingRef.current = false

      // Nettoyer l'ancien MediaRecorder s'il existe
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch (e) {
          console.warn('Erreur lors du nettoyage de l\'ancien MediaRecorder:', e)
        }
      }

      // Arrêter l'ancien stream s'il existe
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
        audioStreamRef.current = null
      }

      // Demander l'accès au microphone
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

      // Créer le MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorderRef.current = mediaRecorder

      // La WebSocket devrait déjà être connectée au montage (via useEffect)
      // Si elle n'est pas connectée, attendre un peu
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('[startRecording] WebSocket pas encore connectée, attente...')
        await new Promise((resolve) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            resolve()
          } else {
            wsRef.current?.addEventListener('open', resolve, { once: true })
            setTimeout(resolve, 1000) // Timeout de sécurité
          }
        })
      }

      // Envoyer les chunks audio via WebSocket
      mediaRecorder.ondataavailable = (event) => {
        // Vérifier que l'enregistrement est toujours actif avant d'envoyer
        if (event.data.size > 0) {
          // Vérifications multiples pour s'assurer qu'on peut envoyer
          // Utiliser les refs pour avoir l'état réel, pas la closure
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
            // Log seulement si ce n'est pas juste un chunk final normal
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

      // Handler pour quand l'enregistrement s'arrête
      mediaRecorder.onstop = () => {
        console.log('MediaRecorder arrêté (onstop appelé)')
        setIsRecording(false)
        setMicrophoneStatus('stopped')
        isStoppingRef.current = false
        
        // Arrêter le compteur de temps
        if (timeIntervalRef.current) {
          clearInterval(timeIntervalRef.current)
          timeIntervalRef.current = null
        }
        
        // Nettoyer les tracks audio
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => {
            track.stop()
          })
          audioStreamRef.current = null
        }
      }

      // Réinitialiser le flag d'arrêt et le temps
      isStoppingRef.current = false
      setRecordingTime(0)
      
      // Démarrer l'enregistrement avec des chunks toutes les 100ms
      mediaRecorder.start(100)
      setIsRecording(true)
      console.log('Enregistrement démarré')
      
      // Démarrer le compteur de temps
      timeIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Arrêter automatiquement à 30 secondes
          if (newTime >= maxRecordingTime) {
            console.log('Limite de 30 secondes atteinte, arrêt automatique...')
            // Utiliser setTimeout pour éviter les problèmes de closure
            setTimeout(() => {
              if (stopRecordingRef.current && mediaRecorderRef.current?.state === 'recording') {
                stopRecordingRef.current()
              }
            }, 0)
            return maxRecordingTime
          }
          return newTime
        })
      }, 1000) // Mise à jour toutes les secondes
    } catch (err) {
      console.error('Erreur lors du démarrage de l\'enregistrement:', err)
      setError(`Erreur: ${err.message}`)
      setMicrophoneStatus('error')
    }
  }, [connectWebSocket])

  const stopRecording = useCallback(() => {
    // Vérifier l'état réel du MediaRecorder plutôt que l'état React
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
    
    // Si déjà en train d'arrêter ou si pas vraiment en train d'enregistrer, ne rien faire
    if (isStoppingRef.current) {
      console.log('Déjà en train d\'arrêter, ignoré')
      return
    }
    
    if (!isActuallyRecording && !isRecording) {
      console.log('Pas en train d\'enregistrer, ignoré')
      return
    }
    
    // Marquer qu'on est en train d'arrêter IMMÉDIATEMENT
    isStoppingRef.current = true
    
    // Arrêter le compteur de temps
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current)
      timeIntervalRef.current = null
    }
    
    // Arrêter immédiatement l'état pour que le bouton réagisse
    setIsRecording(false)
    setMicrophoneStatus('stopped')
    
    // Envoyer un signal de fin au serveur AVANT d'arrêter le MediaRecorder
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'end' }))
        console.log('Signal de fin envoyé au serveur')
      } catch (err) {
        console.error('Erreur lors de l\'envoi du signal de fin:', err)
      }
    }
    
    // Arrêter le MediaRecorder
    if (mediaRecorderRef.current) {
      try {
        const state = mediaRecorderRef.current.state
        console.log('État MediaRecorder avant arrêt:', state)
        
        if (state === 'recording' || state === 'paused') {
          // Arrêter le MediaRecorder - cela déclenchera onstop
          try {
            mediaRecorderRef.current.stop()
            console.log('MediaRecorder.stop() appelé avec succès')
          } catch (stopErr) {
            console.error('Erreur lors de stop():', stopErr)
            // Forcer l'arrêt même en cas d'erreur
            isStoppingRef.current = false
            setIsRecording(false)
            setMicrophoneStatus('stopped')
          }
        } else {
          // Si déjà arrêté, nettoyer manuellement
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

    // Arrêter tous les tracks audio immédiatement
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

  // Mettre à jour la ref avec la fonction stopRecording
  useEffect(() => {
    stopRecordingRef.current = stopRecording
  }, [stopRecording])

  useEffect(() => {
    return () => {
      // Nettoyer le compteur de temps
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
      averageBitrate: metricsRef.current.totalBytes * 8 / duration / 1000 // kbps
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
    recordingTime, // Temps d'enregistrement en secondes
    maxRecordingTime // Limite maximale
  }
}


