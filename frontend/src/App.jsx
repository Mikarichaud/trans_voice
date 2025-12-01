import React, { useState, useEffect, useRef } from 'react'
import MicrophoneRecorder from './components/MicrophoneRecorder'
import AudioUploader from './components/AudioUploader'
import TranslationDisplay from './components/TranslationDisplay'
import TextToSpeechPlayer from './components/TextToSpeechPlayer'
import MetricsPanel from './components/MetricsPanel'
import PullToRefreshIndicator from './components/PullToRefreshIndicator'
import ProcessingStatus from './components/ProcessingStatus'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useTranslation } from './hooks/useTranslation'
import { useTTS } from './hooks/useTTS'
import { usePullToRefresh } from './hooks/usePullToRefresh'
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
    maxRecordingTime,
    isSending,
    isTranscribing
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
      addLog(`Error: ${recordingError}`)
    }
  }, [recordingError])

  useEffect(() => {
    if (translationError) {
      addLog(`Translation error: ${translationError}`)
    }
  }, [translationError])

  useEffect(() => {
    if (originalText) {
      addLog(`Transcription received: ${originalText.substring(0, 50)}...`)
    }
  }, [originalText])

  useEffect(() => {
    if (translatedText) {
      addLog(`Translation completed: ${translatedText.substring(0, 50)}...`)
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
    addLog(`Transcription received from upload: ${text.substring(0, 50)}...`)
    
    try {
      await translateText(text, targetLanguage)
      addLog('Translation completed from upload')
    } catch (error) {
      addLog(`Translation error: ${error.message}`)
    } finally {
      setIsProcessingUpload(false)
    }
  }

  const handleUploadError = (error) => {
    addLog(`Upload error: ${error}`)
  }

  const handleRefresh = async () => {
    return new Promise((resolve) => {
      handleClear()
      setTimeout(() => {
        window.location.reload()
        resolve()
      }, 300)
    })
  }

  const {
    containerRef,
    pullDistance,
    isRefreshing,
    progress,
    shouldShowIndicator
  } = usePullToRefresh(handleRefresh, 80)

  return (
    <div className="app-container" ref={containerRef}>
      <PullToRefreshIndicator
        progress={progress}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
        threshold={80}
      />
      <div className="app-content">
        {}
        <header className="app-header">
          <h1 className="app-title">
            transVoicer
          </h1>
          <p className="app-subtitle">
            Intelligent Voice Translation: Speech-to-Text → Translation → Text-to-Speech
          </p>
        </header>

        {}
        <div className="language-selector-container">
          <div className="language-selector">
            <label className="language-label">
              Target Language
            </label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="language-select"
              disabled={isRecording || isTranslating}
            >
              <option value="fr">French</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
            </select>
          </div>
        </div>

        {}
        <div className="main-grid">
          {}
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

            <ProcessingStatus
              isRecording={isRecording}
              isSending={isSending}
              isTranscribing={isTranscribing}
              transcriptionReceived={!!originalText}
              isTranslating={isTranslating}
              translationReceived={!!translatedText}
              error={recordingError || translationError}
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

          {}
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

        {}
        {(originalText || translatedText) && (
          <div className="clear-button-container">
            <button
              onClick={handleClear}
              className="clear-button"
            >
              Clear All
            </button>
          </div>
        )}

        {}
        <footer className="app-footer">
          <p>Intelligent Voice Translation Web Application</p>
          <p>Speech-to-Text → AI Translation → Text-to-Speech</p>
        </footer>
      </div>
    </div>
  )
}

export default App
