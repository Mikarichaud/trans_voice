import React from 'react'

const MicrophoneRecorder = ({ isRecording, onStart, onStop, microphoneStatus, error, recordingTime, maxRecordingTime }) => {
  const getStatusColor = () => {
    switch (microphoneStatus) {
      case 'recording':
        return 'bg-red-500 animate-pulse'
      case 'connected':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-600'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusText = () => {
    switch (microphoneStatus) {
      case 'recording':
        return 'Enregistrement en cours...'
      case 'connected':
        return 'Microphone prêt'
      case 'stopped':
        return 'Enregistrement arrêté'
      case 'error':
        return 'Erreur microphone'
      default:
        return 'Microphone déconnecté'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <button
            type="button"
            style={{ zIndex: 10, position: 'relative' }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('Bouton cliqué - isRecording:', isRecording, 'microphoneStatus:', microphoneStatus)
              if (isRecording || microphoneStatus === 'recording') {
                console.log('Appel de onStop()')
                onStop()
              } else {
                console.log('Appel de onStart()')
                onStart()
              }
            }}
            onMouseDown={(e) => {
              // Feedback visuel immédiat
              e.currentTarget.style.transform = 'scale(0.95)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = ''
            }}
            disabled={microphoneStatus === 'error'}
            className={`
              w-24 h-24 rounded-full flex items-center justify-center
              transition-all duration-300 transform hover:scale-105 active:scale-95
              ${isRecording || microphoneStatus === 'recording'
                ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50' 
                : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/50'
              }
              ${microphoneStatus === 'error' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              focus:outline-none focus:ring-4 focus:ring-blue-300
            `}
          >
            {isRecording ? (
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zM12 9a1 1 0 10-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          {isRecording && (
            <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-75 pointer-events-none z-0"></div>
          )}
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">
            {isRecording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement'}
          </p>
          <div className="flex items-center justify-center mt-2 space-x-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
            <span className="text-sm text-gray-600">{getStatusText()}</span>
          </div>
          {isRecording && recordingTime !== undefined && (
            <div className="mt-3">
              <div className="text-2xl font-bold text-gray-800">
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Limite: {maxRecordingTime}s
              </div>
              {recordingTime >= maxRecordingTime - 5 && (
                <div className="text-xs text-red-500 mt-1 font-semibold">
                  Arrêt automatique dans {maxRecordingTime - recordingTime}s
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 text-center max-w-md">
          <p>Parlez en portugais. L'audio sera transcrit, traduit et lu à voix haute.</p>
        </div>
      </div>
    </div>
  )
}

export default MicrophoneRecorder


