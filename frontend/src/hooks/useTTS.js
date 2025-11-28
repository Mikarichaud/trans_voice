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

    if (utteranceRef.current) {
      utteranceRef.current.onerror = null
      utteranceRef.current.onend = null
      utteranceRef.current.onstart = null
    }

    if (synthRef.current.speaking || synthRef.current.pending) {
      synthRef.current.cancel()
    }

    setCurrentText(text)
    setTtsError(null)
    setIsPaused(false)
    setIsPlaying(false)

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

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

      if (event.error === 'interrupted') {

        setIsPlaying(false)
        setIsPaused(false)
        return
      }

      console.error('Erreur TTS:', event)
      setTtsError(`Erreur lors de la synthèse vocale: ${event.error || 'erreur inconnue'}`)
      setIsPlaying(false)
      setIsPaused(false)
    }

    utteranceRef.current = utterance
    synthRef.current.speak(utterance)

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
