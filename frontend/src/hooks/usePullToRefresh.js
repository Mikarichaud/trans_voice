import { useEffect, useRef, useState, useCallback } from 'react'

export const usePullToRefresh = (onRefresh, threshold = 80) => {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const currentY = useRef(0)
  const isPulling = useRef(false)
  const containerRef = useRef(null)
  const pullDistanceRef = useRef(0)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setPullDistance(threshold)
    
    try {
      if (onRefresh) {
        await onRefresh()
      } else {
        window.location.reload()
      }
    } finally {
      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
        pullDistanceRef.current = 0
      }, 500)
    }
  }, [onRefresh, threshold])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e) => {
      if (window.scrollY === 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY
        isPulling.current = true
      }
    }

    const handleTouchMove = (e) => {
      if (!isPulling.current || isRefreshing) return

      currentY.current = e.touches[0].clientY
      const distance = Math.max(0, currentY.current - startY.current)

      if (distance > 0 && window.scrollY === 0) {
        e.preventDefault()
        const limitedDistance = Math.min(distance, threshold * 1.5)
        setPullDistance(limitedDistance)
        pullDistanceRef.current = limitedDistance
      } else {
        isPulling.current = false
        setPullDistance(0)
        pullDistanceRef.current = 0
      }
    }

    const handleTouchEnd = () => {
      const currentDistance = pullDistanceRef.current
      
      if (currentDistance >= threshold && isPulling.current && !isRefreshing) {
        handleRefresh()
      } else {
        setPullDistance(0)
        pullDistanceRef.current = 0
      }
      
      isPulling.current = false
      startY.current = 0
      currentY.current = 0
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [threshold, handleRefresh, isRefreshing])

  const progress = Math.min((pullDistance / threshold) * 100, 100)
  const shouldShowIndicator = pullDistance > 0 || isRefreshing

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    progress,
    shouldShowIndicator
  }
}

