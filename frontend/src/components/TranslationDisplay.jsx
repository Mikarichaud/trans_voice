import React from 'react'

const TranslationDisplay = ({ 
  originalText, 
  translatedText, 
  isTranslating,
  translationError,
  sourceLanguage = 'pt-BR',
  targetLanguage = 'fr'
}) => {
  return (
    <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 space-y-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-100">
            Original Text ({sourceLanguage})
          </h3>
        </div>
        <div className="bg-slate-900/60 rounded-xl p-5 min-h-[120px] border border-slate-700/50 backdrop-blur-sm">
          {originalText ? (
            <p className="text-slate-100 leading-relaxed text-base">{originalText}</p>
          ) : (
            <p className="text-slate-400 italic">Waiting for transcription...</p>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-100">
            Translation ({targetLanguage})
          </h3>
          {isTranslating && (
            <div className="flex items-center space-x-2 text-blue-400">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Translating...</span>
            </div>
          )}
        </div>
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-5 min-h-[120px] border border-blue-700/30 backdrop-blur-sm">
          {translationError ? (
            <p className="text-red-400">{translationError}</p>
          ) : translatedText ? (
            <p className="text-slate-100 leading-relaxed text-base">{translatedText}</p>
          ) : (
            <p className="text-slate-400 italic">Waiting for translation...</p>
          )}
        </div>
      </div>

      {originalText && translatedText && !isTranslating && (
        <div className="pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-center">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="ml-2 text-sm text-green-400 font-medium">
              Translation completed
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default TranslationDisplay
