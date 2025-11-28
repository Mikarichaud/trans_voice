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
    <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">
        🔊 Voice Playback
      </h3>

      <div className="space-y-4">
        {availableVoices.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Voice
            </label>
            <select
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = availableVoices.find(v => v.name === e.target.value)
                setSelectedVoice(voice)
              }}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            >
              {availableVoices
                .filter(v => v.lang.startsWith(language.split('-')[0]))
                .map((voice) => (
                  <option key={voice.name} value={voice.name} className="bg-slate-800">
                    {voice.name} ({voice.lang})
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-center space-x-3">
          {!isPlaying && !isPaused && (
            <button
              onClick={handleSpeak}
              disabled={!text || !text.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg shadow-blue-500/30 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              <span>Play Translation</span>
            </button>
          )}

          {isPlaying && !isPaused && (
            <button
              onClick={onPause}
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl font-semibold hover:from-yellow-600 hover:to-yellow-700 transition-all transform hover:scale-105 shadow-lg shadow-yellow-500/30 flex items-center space-x-2"
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
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg shadow-green-500/30 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>Resume</span>
            </button>
          )}

          {(isPlaying || isPaused) && (
            <button
              onClick={onStop}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg shadow-red-500/30 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              <span>Stop</span>
            </button>
          )}
        </div>

        {isPlaying && (
          <div className="flex items-center justify-center space-x-2 text-blue-400">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-lg shadow-blue-400/50"></div>
            <span className="text-sm">Playing...</span>
          </div>
        )}

        {ttsError && (
          <div className="p-4 bg-red-900/30 border border-red-500/50 text-red-200 rounded-xl text-sm backdrop-blur-sm">
            {ttsError}
          </div>
        )}
      </div>
    </div>
  )
}

export default TextToSpeechPlayer
