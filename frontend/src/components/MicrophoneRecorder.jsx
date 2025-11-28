import React from 'react'

const MicrophoneRecorder = ({ isRecording, onStart, onStop, microphoneStatus, error, recordingTime, maxRecordingTime }) => {
  const getStatusColor = () => {
    switch (microphoneStatus) {
      case 'recording':
        return 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50'
      case 'connected':
        return 'bg-green-500 shadow-lg shadow-green-500/50'
      case 'error':
        return 'bg-red-600'
      default:
        return 'bg-slate-500'
    }
  }

  const getStatusText = () => {
    switch (microphoneStatus) {
      case 'recording':
        return 'Recording in progress...'
      case 'connected':
        return 'Microphone ready'
      case 'stopped':
        return 'Recording stopped'
      case 'error':
        return 'Microphone error'
      default:
        return 'Microphone disconnected'
    }
  }

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
      <div className="flex flex-col items-center space-y-6">
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

              e.currentTarget.style.transform = 'scale(0.95)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = ''
            }}
            disabled={microphoneStatus === 'error'}
            className={`
              w-28 h-28 rounded-full flex items-center justify-center
              transition-all duration-300 transform hover:scale-110 active:scale-95
              ${isRecording || microphoneStatus === 'recording'
                ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-2xl shadow-red-500/50' 
                : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-2xl shadow-blue-500/50'
              }
              ${microphoneStatus === 'error' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              focus:outline-none focus:ring-4 focus:ring-blue-500/30
            `}
          >
            {isRecording ? (
              <svg className="w-14 h-14 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zM12 9a1 1 0 10-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-14 h-14 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          {isRecording && (
            <div className="absolute inset-0 rounded-full border-4 border-red-400/60 animate-ping opacity-75 pointer-events-none z-0"></div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xl font-semibold text-slate-100 mb-2">
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </p>
          <div className="flex items-center justify-center mt-2 space-x-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
            <span className="text-sm text-slate-300">{getStatusText()}</span>
          </div>
          {isRecording && recordingTime !== undefined && (
            <div className="mt-4">
              <div className="text-3xl font-bold text-slate-100 mb-1">
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Limit: {maxRecordingTime}s
              </div>
              {recordingTime >= maxRecordingTime - 5 && (
                <div className="text-xs text-red-400 mt-2 font-semibold animate-pulse">
                  Auto-stop in {maxRecordingTime - recordingTime}s
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 text-red-200 rounded-xl text-sm backdrop-blur-sm">
            {error}
          </div>
        )}

        <div className="mt-4 text-xs text-slate-400 text-center max-w-md leading-relaxed">
          <p>Speak in Portuguese. The audio will be transcribed, translated, and read aloud.</p>
        </div>
      </div>
    </div>
  )
}

export default MicrophoneRecorder
