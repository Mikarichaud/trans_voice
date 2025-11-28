import { useState, useEffect, useRef } from 'react'

export const useTranslation = (wsRef, targetLanguage = 'fr') => {
  const [originalText, setOriginalText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationError, setTranslationError] = useState(null)
  const [translationMetrics, setTranslationMetrics] = useState({
    latency: null,
    wordCount: 0
  })

  const translationStartTimeRef = useRef(null)

  useEffect(() => {

    const attachListener = () => {
      if (!wsRef.current) {
        console.log('[useTranslation] WebSocket non disponible, attente...')
        return null
      }

      const ws = wsRef.current
      console.log('[useTranslation] Attachement du listener WebSocket, état:', ws.readyState)

      const handleMessage = async (event) => {
        try {

        if (event.data instanceof Blob) {
          return
        }

        const data = JSON.parse(event.data)
        console.log('[useTranslation] Message reçu:', data.type, data)

        if (data.type === 'transcription') {
          console.log('[useTranslation] Transcription reçue:', data.text?.substring(0, 50))
          setOriginalText(data.text)
          setTranslationError(null)

          if (data.text && data.text.trim()) {
            console.log('[useTranslation] Démarrage de la traduction...')
            translationStartTimeRef.current = Date.now()
            setIsTranslating(true)

            try {
              const response = await fetch('/api/translate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: data.text,
                  targetLanguage: targetLanguage
                })
              })

              if (!response.ok) {
                throw new Error('Erreur lors de la traduction')
              }

              const result = await response.json()
              console.log('[useTranslation] Traduction reçue:', result.translatedText?.substring(0, 50))
              setTranslatedText(result.translatedText)

              const latency = Date.now() - translationStartTimeRef.current
              setTranslationMetrics({
                latency,
                wordCount: data.text.split(' ').length
              })
            } catch (err) {
              console.error('[useTranslation] Erreur de traduction:', err)
              setTranslationError(err.message)
            } finally {
              setIsTranslating(false)
            }
          } else {
            console.warn('[useTranslation] Transcription vide ou invalide')
          }
        } else if (data.type === 'error') {
          console.error('[useTranslation] Erreur reçue:', data.message)
          setTranslationError(data.message)
        } else if (data.type === 'connected') {
          console.log('[useTranslation] WebSocket connecté, session:', data.sessionId)
        }
      } catch (err) {
        console.error('[useTranslation] Erreur lors du traitement du message:', err)
      }
    }

      ws.addEventListener('message', handleMessage)

      return () => {
        ws.removeEventListener('message', handleMessage)
      }
    }

    let cleanup = attachListener()

    if (!wsRef.current) {
      const timeoutId = setTimeout(() => {
        const newCleanup = attachListener()
        if (newCleanup) {
          cleanup = newCleanup
        }
      }, 500)

      return () => {
        clearTimeout(timeoutId)
        if (cleanup) cleanup()
      }
    }

    return cleanup || (() => {})
  }, [wsRef, targetLanguage])

  const clearTexts = () => {
    setOriginalText('')
    setTranslatedText('')
    setTranslationError(null)
    setTranslationMetrics({ latency: null, wordCount: 0 })
  }

  const translateText = async (text, lang = targetLanguage) => {
    if (!text || !text.trim()) return

    setOriginalText(text)
    setTranslationError(null)
    translationStartTimeRef.current = Date.now()
    setIsTranslating(true)

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          targetLanguage: lang
        })
      })

      if (!response.ok) {

        let errorMessage = 'Erreur lors de la traduction'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch (e) {
          errorMessage = `Erreur ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      setTranslatedText(result.translatedText)

      const latency = Date.now() - translationStartTimeRef.current
      setTranslationMetrics({
        latency,
        wordCount: text.split(' ').length
      })
    } catch (err) {
      console.error('Erreur de traduction:', err)
      setTranslationError(err.message || 'Erreur lors de la traduction')
    } finally {
      setIsTranslating(false)
    }
  }

  return {
    originalText,
    translatedText,
    isTranslating,
    translationError,
    translationMetrics,
    clearTexts,
    translateText
  }
}
