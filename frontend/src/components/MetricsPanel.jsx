import React from 'react'

const MetricsPanel = ({ 
  recordingMetrics,
  translationMetrics,
  ttsMetrics,
  microphoneStatus,
  logs = []
}) => {
  const formatLatency = (ms) => {
    if (!ms) return 'N/A'
    return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`
  }

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A'
    return `${seconds.toFixed(2)} s`
  }

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">
        Métriques et Logs techniques
      </h3>

      <div className="space-y-6">
        {/* Métriques d'enregistrement */}
        <div>
          <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Enregistrement Audio
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Durée</div>
              <div className="text-lg font-semibold text-gray-800">
                {recordingMetrics ? formatDuration(recordingMetrics.duration) : 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Chunks</div>
              <div className="text-lg font-semibold text-gray-800">
                {recordingMetrics?.chunksCount || 0}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Données</div>
              <div className="text-lg font-semibold text-gray-800">
                {recordingMetrics ? formatBytes(recordingMetrics.totalBytes) : 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Débit moyen</div>
              <div className="text-lg font-semibold text-gray-800">
                {recordingMetrics?.averageBitrate 
                  ? `${recordingMetrics.averageBitrate.toFixed(2)} kbps` 
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Métriques de traduction */}
        <div>
          <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Traduction
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-xs text-blue-600 mb-1">Latence</div>
              <div className="text-lg font-semibold text-blue-800">
                {translationMetrics ? formatLatency(translationMetrics.latency) : 'N/A'}
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-xs text-blue-600 mb-1">Mots</div>
              <div className="text-lg font-semibold text-blue-800">
                {translationMetrics?.wordCount || 0}
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-xs text-blue-600 mb-1">État</div>
              <div className="text-lg font-semibold text-blue-800">
                {microphoneStatus}
              </div>
            </div>
          </div>
        </div>

        {/* Métriques TTS */}
        {ttsMetrics && (ttsMetrics.latency || ttsMetrics.duration) && (
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Synthèse Vocale (TTS)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-xs text-green-600 mb-1">Latence</div>
                <div className="text-lg font-semibold text-green-800">
                  {formatLatency(ttsMetrics.latency)}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-xs text-green-600 mb-1">Durée</div>
                <div className="text-lg font-semibold text-green-800">
                  {formatDuration(ttsMetrics.duration)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Logs techniques
            </h4>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs max-h-48 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className="ml-2">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MetricsPanel


