import React, { useRef, useState } from 'react'
import axios from 'axios'

const AudioUploader = ({ onTranscription, onError, isProcessing }) => {
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Vérifier le type de fichier
      const validTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/m4a', 'audio/x-m4a']
      const validExtensions = ['.webm', '.wav', '.mp3', '.mpeg', '.ogg', '.m4a']
      
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase()
      const isValidType = validTypes.includes(file.type) || validExtensions.includes(fileExtension)
      
      if (!isValidType) {
        onError(`Format de fichier non supporté. Formats acceptés: ${validExtensions.join(', ')}`)
        return
      }
      
      // Vérifier la taille (max 50MB)
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        onError('Le fichier est trop volumineux. Taille maximale: 50MB')
        return
      }
      
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    onError(null) // Réinitialiser les erreurs précédentes
    
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('language', 'pt')
      formData.append('task', 'transcribe')
      formData.append('temperature', '0.0')

      const pythonApiUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000'
      const response = await axios.post(
        `${pythonApiUrl}/api/stt/transcribe`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 120000 // 2 minutes pour les gros fichiers
        }
      )

      if (response.data && response.data.text) {
        onTranscription(response.data.text)
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        onError('Aucune transcription reçue du serveur')
      }
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error)
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.error || 
                          error.message || 
                          'Erreur lors de l\'upload du fichier'
      onError(errorMessage || 'Erreur inconnue')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
        📁 Uploader un fichier audio
      </h3>
      
      <div className="space-y-4">
        {/* Input file caché */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.webm,.wav,.mp3,.mpeg,.ogg,.m4a"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading || isProcessing}
        />

        {/* Bouton pour sélectionner le fichier */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isProcessing}
          className={`
            w-full px-4 py-3 rounded-lg font-semibold
            transition-all duration-300
            ${isUploading || isProcessing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
            }
            focus:outline-none focus:ring-4 focus:ring-blue-300
          `}
        >
          {selectedFile ? 'Changer de fichier' : 'Sélectionner un fichier audio'}
        </button>

        {/* Affichage du fichier sélectionné */}
        {selectedFile && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  📄 {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={handleRemoveFile}
                disabled={isUploading || isProcessing}
                className="ml-2 text-red-500 hover:text-red-700 disabled:opacity-50"
                title="Supprimer"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Bouton pour uploader */}
        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={isUploading || isProcessing}
            className={`
              w-full px-4 py-3 rounded-lg font-semibold
              transition-all duration-300
              ${isUploading || isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
              }
              focus:outline-none focus:ring-4 focus:ring-green-300
            `}
          >
            {isUploading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Traitement en cours...
              </span>
            ) : (
              '📤 Transcrir le fichier'
            )}
          </button>
        )}

        {/* Info */}
        <div className="text-xs text-gray-500 text-center">
          <p>Formats supportés: WAV, MP3, WebM, OGG, M4A</p>
          <p>Taille maximale: 50MB</p>
        </div>
      </div>
    </div>
  )
}

export default AudioUploader

