import React from 'react'

const PullToRefreshIndicator = ({ progress, isRefreshing, pullDistance, threshold = 80 }) => {
  const shouldShow = pullDistance > 0 || isRefreshing
  const rotation = (progress / 100) * 360

  if (!shouldShow) return null

  return (
    <div 
      className="pull-to-refresh-indicator"
      style={{
        transform: `translateX(-50%) translateY(${Math.min(pullDistance, threshold)}px)`,
        opacity: Math.min(progress / 100, 1)
      }}
    >
      <div className="pull-to-refresh-content">
        {isRefreshing ? (
          <>
            <svg 
              className="pull-to-refresh-spinner" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="pull-to-refresh-text">Refreshing...</span>
          </>
        ) : (
          <>
            <svg 
              className="pull-to-refresh-arrow"
              style={{ transform: `rotate(${rotation}deg)` }}
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 14l-7 7m0 0l-7-7m7 7V3" 
              />
            </svg>
            <span className="pull-to-refresh-text">
              {progress >= 100 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export default PullToRefreshIndicator

