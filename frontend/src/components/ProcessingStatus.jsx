import React from 'react'

const ProcessingStatus = ({ 
  isRecording, 
  isSending, 
  isTranscribing, 
  transcriptionReceived,
  isTranslating,
  translationReceived,
  error 
}) => {
  const steps = [
    {
      id: 'recording',
      label: 'Recording',
      active: isRecording,
      completed: !isRecording && (isSending || isTranscribing || transcriptionReceived || isTranslating || translationReceived),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )
    },
    {
      id: 'sending',
      label: 'Sending data',
      active: isSending,
      completed: !isSending && (isTranscribing || transcriptionReceived || isTranslating || translationReceived),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )
    },
    {
      id: 'transcribing',
      label: 'Transcription',
      active: isTranscribing,
      completed: transcriptionReceived,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'translating',
      label: 'Translation',
      active: isTranslating,
      completed: translationReceived,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      )
    }
  ]

  const hasAnyActivity = isRecording || isSending || isTranscribing || isTranslating || transcriptionReceived || translationReceived

  if (!hasAnyActivity && !error) {
    return null
  }

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Processing Status
      </h3>

      <div className="space-y-4">
        {steps.map((step, index) => {
          const isActive = step.active
          const isCompleted = step.completed
          const isPending = !isActive && !isCompleted

          return (
            <div key={step.id} className="flex items-center space-x-4">
              <div className="flex-shrink-0 relative">
                {isCompleted ? (
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : isActive ? (
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white animate-pulse">
                    <div className="w-6 h-6 animate-spin">
                      {step.icon}
                    </div>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-slate-300">
                    {step.icon}
                  </div>
                )}
                {index < steps.length - 1 && (
                  <div className={`absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-8 ${
                    isCompleted ? 'bg-green-500' : 'bg-slate-600'
                  }`}></div>
                )}
              </div>

              <div className="flex-1">
                <div className={`text-sm font-medium ${
                  isActive ? 'text-blue-400' : 
                  isCompleted ? 'text-green-400' : 
                  'text-slate-400'
                }`}>
                  {step.label}
                </div>
                {isActive && (
                  <div className="mt-1">
                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                )}
                {isCompleted && (
                  <div className="text-xs text-green-400 mt-1">Completed</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {translationReceived && !isTranslating && (
        <div className="mt-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
          <div className="flex items-center text-green-400">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Processing completed successfully</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProcessingStatus

