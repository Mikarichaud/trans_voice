import React, { useEffect, useState } from 'react'

const TextToSpeechPlayer = ({ 
  text, 
  onSpeak, 
  onPause, 
  onResume, 
  onStop,
  isPlaying,
  isPaused,
  ttsError,
  language = 'fr-FR'
}) => {
  const [availableVoices, setAvailableVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      setAvailableVoices(voices)
      
      // Sélectionner automatiquement une voix pour la langue
      if (voices.length > 0 && !selectedVoice) {
        const preferredVoice = voices.find(v => 
          v.lang.startsWith(language.split('-')[0])
        ) || voices[0]
        setSelectedVoice(preferredVoice)
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [language, selectedVoice])

  const handleSpeak = () => {
    if (text && text.trim()) {
      onSpeak(text, language, selectedVoice)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">
        Lecture vocale
      </h3>

      <div className="space-y-4">
        {availableVoices.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Voix
            </label>
            <select
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = availableVoices.find(v => v.name === e.target.value)
                setSelectedVoice(voice)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableVoices
                .filter(v => v.lang.startsWith(language.split('-')[0]))
                .map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-center space-x-4">
          {!isPlaying && !isPaused && (
            <button
              onClick={handleSpeak}
              disabled={!text || !text.trim()}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              <span>Lire la traduction</span>
            </button>
          )}

          {isPlaying && !isPaused && (
            <button
              onClick={onPause}
              className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Pause</span>
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResume}
              className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>Reprendre</span>
            </button>
          )}

          {(isPlaying || isPaused) && (
            <button
              onClick={onStop}
              className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              <span>Arrêter</span>
            </button>
          )}
        </div>

        {isPlaying && (
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm">Lecture en cours...</span>
          </div>
        )}

        {ttsError && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {ttsError}
          </div>
        )}
      </div>
    </div>
  )
}

export default TextToSpeechPlayer


