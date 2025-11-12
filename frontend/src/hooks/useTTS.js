import { useState, useCallback, useRef } from 'react'

export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentText, setCurrentText] = useState('')
  const [ttsError, setTtsError] = useState(null)
  const [ttsMetrics, setTtsMetrics] = useState({
    latency: null,
    duration: null
  })

  const synthRef = useRef(window.speechSynthesis)
  const utteranceRef = useRef(null)
  const startTimeRef = useRef(null)

  const speak = useCallback((text, language = 'fr-FR', voice = null) => {
    if (!text || !text.trim()) {
      return
    }

    // Arrêter toute lecture en cours proprement
    // Nettoyer l'ancien utterance s'il existe pour éviter les erreurs "interrupted"
    if (utteranceRef.current) {
      utteranceRef.current.onerror = null // Désactiver les handlers pour éviter les erreurs
      utteranceRef.current.onend = null
      utteranceRef.current.onstart = null
    }
    
    if (synthRef.current.speaking || synthRef.current.pending) {
      synthRef.current.cancel()
    }

    setCurrentText(text)
    setTtsError(null)
    setIsPaused(false)
    setIsPlaying(false) // Réinitialiser l'état avant de démarrer

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Sélectionner une voix si disponible
    if (voice) {
      utterance.voice = voice
    } else {
      const voices = synthRef.current.getVoices()
      const preferredVoice = voices.find(v => 
        v.lang.startsWith(language.split('-')[0])
      ) || voices[0]
      if (preferredVoice) {
        utterance.voice = preferredVoice
      }
    }

    utterance.onstart = () => {
      setIsPlaying(true)
      startTimeRef.current = Date.now()
    }

    utterance.onend = () => {
      setIsPlaying(false)
      setIsPaused(false)
      if (startTimeRef.current) {
        const duration = (Date.now() - startTimeRef.current) / 1000
        setTtsMetrics(prev => ({
          ...prev,
          duration
        }))
      }
    }

    utterance.onerror = (event) => {
      // Ignorer les erreurs "interrupted" car elles sont normales
      // quand on annule une synthèse en cours pour en démarrer une nouvelle
      if (event.error === 'interrupted') {
        // C'est normal, on ignore silencieusement
        setIsPlaying(false)
        setIsPaused(false)
        return
      }
      
      // Pour les autres erreurs, on les log et on affiche un message
      console.error('Erreur TTS:', event)
      setTtsError(`Erreur lors de la synthèse vocale: ${event.error || 'erreur inconnue'}`)
      setIsPlaying(false)
      setIsPaused(false)
    }

    utteranceRef.current = utterance
    synthRef.current.speak(utterance)

    // Mesurer la latence (temps avant le début de la lecture)
    const latencyStart = Date.now()
    const checkLatency = setInterval(() => {
      if (synthRef.current.speaking) {
        const latency = Date.now() - latencyStart
        setTtsMetrics(prev => ({
          ...prev,
          latency
        }))
        clearInterval(checkLatency)
      }
    }, 10)
  }, [])

  const pause = useCallback(() => {
    if (synthRef.current.speaking && !synthRef.current.paused) {
      synthRef.current.pause()
      setIsPaused(true)
    }
  }, [])

  const resume = useCallback(() => {
    if (synthRef.current.paused) {
      synthRef.current.resume()
      setIsPaused(false)
    }
  }, [])

  const stop = useCallback(() => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel()
      setIsPlaying(false)
      setIsPaused(false)
      setCurrentText('')
    }
  }, [])

  const getAvailableVoices = useCallback(() => {
    return synthRef.current.getVoices()
  }, [])

  return {
    speak,
    pause,
    resume,
    stop,
    isPlaying,
    isPaused,
    currentText,
    ttsError,
    ttsMetrics,
    getAvailableVoices
  }
}


