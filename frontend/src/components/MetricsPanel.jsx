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
    <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">
        📊 Metrics & Technical Logs
      </h3>

      <div className="space-y-6">
        {/* Métriques d'enregistrement */}
        <div>
          <h4 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
            Audio Recording
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="text-xs text-slate-400 mb-1">Duration</div>
              <div className="text-lg font-semibold text-slate-100">
                {recordingMetrics ? formatDuration(recordingMetrics.duration) : 'N/A'}
              </div>
            </div>
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="text-xs text-slate-400 mb-1">Chunks</div>
              <div className="text-lg font-semibold text-slate-100">
                {recordingMetrics?.chunksCount || 0}
              </div>
            </div>
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="text-xs text-slate-400 mb-1">Data</div>
              <div className="text-lg font-semibold text-slate-100">
                {recordingMetrics ? formatBytes(recordingMetrics.totalBytes) : 'N/A'}
              </div>
            </div>
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="text-xs text-slate-400 mb-1">Avg Bitrate</div>
              <div className="text-lg font-semibold text-slate-100">
                {recordingMetrics?.averageBitrate 
                  ? `${recordingMetrics.averageBitrate.toFixed(2)} kbps` 
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Métriques de traduction */}
        <div>
          <h4 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
            Translation
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-700/30 backdrop-blur-sm">
              <div className="text-xs text-blue-400 mb-1">Latency</div>
              <div className="text-lg font-semibold text-blue-200">
                {translationMetrics ? formatLatency(translationMetrics.latency) : 'N/A'}
              </div>
            </div>
            <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-700/30 backdrop-blur-sm">
              <div className="text-xs text-blue-400 mb-1">Words</div>
              <div className="text-lg font-semibold text-blue-200">
                {translationMetrics?.wordCount || 0}
              </div>
            </div>
            <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-700/30 backdrop-blur-sm">
              <div className="text-xs text-blue-400 mb-1">Status</div>
              <div className="text-lg font-semibold text-blue-200 capitalize">
                {microphoneStatus}
              </div>
            </div>
          </div>
        </div>

        {/* Métriques TTS */}
        {ttsMetrics && (ttsMetrics.latency || ttsMetrics.duration) && (
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
              Text-to-Speech (TTS)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-900/30 p-4 rounded-xl border border-green-700/30 backdrop-blur-sm">
                <div className="text-xs text-green-400 mb-1">Latency</div>
                <div className="text-lg font-semibold text-green-200">
                  {formatLatency(ttsMetrics.latency)}
                </div>
              </div>
              <div className="bg-green-900/30 p-4 rounded-xl border border-green-700/30 backdrop-blur-sm">
                <div className="text-xs text-green-400 mb-1">Duration</div>
                <div className="text-lg font-semibold text-green-200">
                  {formatDuration(ttsMetrics.duration)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
              Technical Logs
            </h4>
            <div className="bg-slate-900/80 text-green-400 p-4 rounded-xl font-mono text-xs max-h-48 overflow-y-auto border border-slate-700/50 backdrop-blur-sm">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
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


