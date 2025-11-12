import React, { useState, useEffect, useRef } from 'react'
import MicrophoneRecorder from './components/MicrophoneRecorder'
import AudioUploader from './components/AudioUploader'
import TranslationDisplay from './components/TranslationDisplay'
import TextToSpeechPlayer from './components/TextToSpeechPlayer'
import MetricsPanel from './components/MetricsPanel'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useTranslation } from './hooks/useTranslation'
import { useTTS } from './hooks/useTTS'
import axios from 'axios'
import './App.css'

function App() {
  const [targetLanguage, setTargetLanguage] = useState('fr')
  const [logs, setLogs] = useState([])
  
  const {
    isRecording,
    startRecording,
    stopRecording,
    error: recordingError,
    microphoneStatus,
    wsRef,
    getMetrics: getRecordingMetrics,
    recordingTime,
    maxRecordingTime
  } = useSpeechRecognition()

  const {
    originalText,
    translatedText,
    isTranslating,
    translationError,
    translationMetrics,
    clearTexts,
    translateText
  } = useTranslation(wsRef, targetLanguage)
  
  const [isProcessingUpload, setIsProcessingUpload] = useState(false)

  const {
    speak,
    pause,
    resume,
    stop,
    isPlaying,
    isPaused,
    ttsError,
    ttsMetrics
  } = useTTS()

  const recordingMetricsRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        recordingMetricsRef.current = getRecordingMetrics()
      }, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      recordingMetricsRef.current = getRecordingMetrics()
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRecording, getRecordingMetrics])

  const addLog = (message) => {
    setLogs(prev => [...prev.slice(-19), { timestamp: Date.now(), message }])
  }

  useEffect(() => {
    if (recordingError) {
      addLog(`Erreur: ${recordingError}`)
    }
  }, [recordingError])

  useEffect(() => {
    if (translationError) {
      addLog(`Erreur traduction: ${translationError}`)
    }
  }, [translationError])

  useEffect(() => {
    if (originalText) {
      addLog(`Transcription reçue: ${originalText.substring(0, 50)}...`)
    }
  }, [originalText])

  useEffect(() => {
    if (translatedText) {
      addLog(`Traduction complétée: ${translatedText.substring(0, 50)}...`)
    }
  }, [translatedText])

  const handleClear = () => {
    clearTexts()
    stop()
    setLogs([])
    recordingMetricsRef.current = null
  }

  const handleUploadTranscription = async (text) => {
    if (!text || !text.trim()) return
    
    setIsProcessingUpload(true)
    addLog(`Transcription reçue depuis upload: ${text.substring(0, 50)}...`)
    
    try {
      await translateText(text, targetLanguage)
      addLog('Traduction complétée depuis upload')
    } catch (error) {
      addLog(`Erreur lors de la traduction: ${error.message}`)
    } finally {
      setIsProcessingUpload(false)
    }
  }

  const handleUploadError = (error) => {
    addLog(`Erreur upload: ${error}`)
  }

  return (
    <div className="app-container">
      <div className="app-content">
        {/* Header */}
        <header className="app-header">
          <h1 className="app-title">
            🎯 transVoicer
          </h1>
          <p className="app-subtitle">
            Traduction vocale intelligente : Speech-to-Text → Traduction → Text-to-Speech
          </p>
        </header>

        {/* Language Selector */}
        <div className="language-selector-container">
          <div className="language-selector">
            <label className="language-label">
              Langue de traduction
            </label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="language-select"
              disabled={isRecording || isTranslating}
            >
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
              <option value="es">Espagnol</option>
              <option value="de">Allemand</option>
              <option value="it">Italien</option>
            </select>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="main-grid">
          {/* Left Column */}
          <div className="column">
            <MicrophoneRecorder
              isRecording={isRecording}
              onStart={startRecording}
              onStop={stopRecording}
              microphoneStatus={microphoneStatus}
              error={recordingError}
              recordingTime={recordingTime}
              maxRecordingTime={maxRecordingTime}
            />

            <AudioUploader
              onTranscription={handleUploadTranscription}
              onError={handleUploadError}
              isProcessing={isProcessingUpload || isTranslating}
            />

            <TranslationDisplay
              originalText={originalText}
              translatedText={translatedText}
              isTranslating={isTranslating}
              translationError={translationError}
              sourceLanguage="pt-BR"
              targetLanguage={targetLanguage}
            />
          </div>

          {/* Right Column */}
          <div className="column">
            <TextToSpeechPlayer
              text={translatedText}
              onSpeak={speak}
              onPause={pause}
              onResume={resume}
              onStop={stop}
              isPlaying={isPlaying}
              isPaused={isPaused}
              ttsError={ttsError}
              language={`${targetLanguage}-${targetLanguage.toUpperCase()}`}
            />

            <MetricsPanel
              recordingMetrics={recordingMetricsRef.current}
              translationMetrics={translationMetrics}
              ttsMetrics={ttsMetrics}
              microphoneStatus={microphoneStatus}
              logs={logs}
            />
          </div>
        </div>

        {/* Clear Button */}
        {(originalText || translatedText) && (
          <div className="clear-button-container">
            <button
              onClick={handleClear}
              className="clear-button"
            >
              Effacer tout
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="app-footer">
          <p>Application web de traduction vocale intelligente</p>
          <p>Speech-to-Text → Traduction IA → Text-to-Speech</p>
        </footer>
      </div>
    </div>
  )
}

export default App


