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
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-700">
            Texte original ({sourceLanguage})
          </h3>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 min-h-[100px] border border-gray-200">
          {originalText ? (
            <p className="text-gray-800 leading-relaxed">{originalText}</p>
          ) : (
            <p className="text-gray-400 italic">En attente de transcription...</p>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-700">
            Traduction ({targetLanguage})
          </h3>
          {isTranslating && (
            <div className="flex items-center space-x-2 text-blue-600">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Traduction en cours...</span>
            </div>
          )}
        </div>
        <div className="bg-blue-50 rounded-lg p-4 min-h-[100px] border border-blue-200">
          {translationError ? (
            <p className="text-red-600">{translationError}</p>
          ) : translatedText ? (
            <p className="text-gray-800 leading-relaxed">{translatedText}</p>
          ) : (
            <p className="text-gray-400 italic">En attente de traduction...</p>
          )}
        </div>
      </div>

      {originalText && translatedText && !isTranslating && (
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="ml-2 text-sm text-green-600 font-medium">
              Traduction complétée
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default TranslationDisplay


