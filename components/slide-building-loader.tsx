"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SlideBuildingLoaderProps {
  statusText?: string
  estimatedTime?: number
  className?: string
}

type LayoutType = 'text-heavy' | 'visual-heavy' | 'data-focused'

const layouts: LayoutType[] = ['text-heavy', 'visual-heavy', 'data-focused']

export function SlideBuildingLoader({
  statusText = "Building your presentation...",
  estimatedTime,
  className = ''
}: SlideBuildingLoaderProps) {
  const [scanProgress, setScanProgress] = useState(0)
  const [currentLayout, setCurrentLayout] = useState<LayoutType>('text-heavy')
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [showElements, setShowElements] = useState<string[]>([])
  const [sparkPosition, setSparkPosition] = useState(0)

  // Animation cycle: scan → show elements → hold → dissolve → repeat
  useEffect(() => {
    const cycle = async () => {
      // Reset state
      setIsRebuilding(false)
      setShowElements([])
      setScanProgress(0)

      // Scanner animation (2 seconds)
      const scanDuration = 2000
      const scanInterval = 20
      const scanSteps = scanDuration / scanInterval
      let step = 0

      const scanTimer = setInterval(() => {
        step++
        const progress = step / scanSteps
        setScanProgress(progress * 100)

        // Reveal elements as scanner passes
        if (progress > 0.2 && !showElements.includes('title')) {
          setShowElements(prev => [...prev, 'title'])
        }
        if (progress > 0.5 && !showElements.includes('image')) {
          setShowElements(prev => [...prev, 'image'])
        }
        if (progress > 0.8 && !showElements.includes('chart')) {
          setShowElements(prev => [...prev, 'chart'])
        }

        if (step >= scanSteps) {
          clearInterval(scanTimer)
        }
      }, scanInterval)

      // Hold for 1 second
      await new Promise(resolve => setTimeout(resolve, scanDuration + 1000))

      // Dissolve and rebuild
      setIsRebuilding(true)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Switch to next layout
      const currentIndex = layouts.indexOf(currentLayout)
      const nextLayout = layouts[(currentIndex + 1) % layouts.length]
      setCurrentLayout(nextLayout)
    }

    // Initial cycle
    cycle()

    // Repeat every 4.5 seconds
    const cycleInterval = setInterval(cycle, 4500)

    return () => {
      clearInterval(cycleInterval)
    }
  }, [currentLayout, showElements])

  // Spark animation that travels around the border
  useEffect(() => {
    const sparkInterval = setInterval(() => {
      setSparkPosition(prev => (prev + 1) % 100)
    }, 20)

    return () => clearInterval(sparkInterval)
  }, [])

  // Calculate spark position on the perimeter (0-100 maps to border path)
  const getSparkCoordinates = (progress: number) => {
    const perimeterProgress = progress / 100
    if (perimeterProgress < 0.25) {
      // Top edge (left to right)
      return { x: perimeterProgress * 4 * 100, y: 0 }
    } else if (perimeterProgress < 0.5) {
      // Right edge (top to bottom)
      return { x: 100, y: (perimeterProgress - 0.25) * 4 * 100 }
    } else if (perimeterProgress < 0.75) {
      // Bottom edge (right to left)
      return { x: 100 - (perimeterProgress - 0.5) * 4 * 100, y: 100 }
    } else {
      // Left edge (bottom to top)
      return { x: 0, y: 100 - (perimeterProgress - 0.75) * 4 * 100 }
    }
  }

  const sparkCoords = getSparkCoordinates(sparkPosition)

  return (
    <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
      {/* The Slide Container */}
      <div className="relative w-full max-w-3xl" style={{ aspectRatio: '16/9' }}>
        {/* Glass-morphism container */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-xl rounded-xl overflow-hidden border-2 border-purple-500/50"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Animated Grid Background - MORE VISIBLE */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(139, 92, 246, 0.5) 2px, transparent 2px),
                linear-gradient(to bottom, rgba(139, 92, 246, 0.5) 2px, transparent 2px)
              `,
              backgroundSize: '30px 30px',
              animation: 'panGrid 8s linear infinite'
            }}
          />

          {/* Bright Scanner Line with Glow */}
          <motion.div
            className="absolute left-0 right-0 h-2"
            style={{
              top: `${scanProgress}%`,
              background: 'linear-gradient(to right, transparent, rgba(96, 165, 250, 1), transparent)',
              boxShadow: '0 0 30px rgba(96, 165, 250, 1), 0 0 60px rgba(96, 165, 250, 0.6)',
              filter: 'blur(2px)'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: scanProgress > 0 && scanProgress < 100 ? 1 : 0 }}
          />

          {/* Content Elements - Layout Changes */}
          <AnimatePresence mode="wait">
            {!isRebuilding && (
              <motion.div
                key={currentLayout}
                className="absolute inset-0 p-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
              >
                {/* Text-Heavy Layout */}
                {currentLayout === 'text-heavy' && (
                  <>
                    {/* Title with construction effect */}
                    <AnimatePresence>
                      {showElements.includes('title') && (
                        <motion.div
                          className="relative mb-6"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          {/* Building animation - left to right */}
                          <motion.div
                            className="h-10 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 relative overflow-hidden"
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          >
                            {/* Shimmer effect */}
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                              initial={{ x: '-100%' }}
                              animate={{ x: '200%' }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Text Lines with progressive build */}
                    <AnimatePresence>
                      {showElements.includes('image') && (
                        <div className="space-y-4">
                          {[70, 85, 60, 75].map((width, i) => (
                            <motion.div
                              key={i}
                              className="relative"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.15 }}
                            >
                              <motion.div
                                className="h-5 rounded bg-gradient-to-r from-blue-400/70 to-purple-400/70 relative overflow-hidden"
                                style={{ width: `${width}%` }}
                                initial={{ width: 0 }}
                                animate={{ width: `${width}%` }}
                                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.15 }}
                              >
                                {/* Shimmer */}
                                <motion.div
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                  initial={{ x: '-100%' }}
                                  animate={{ x: '200%' }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: i * 0.1 }}
                                />
                              </motion.div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </AnimatePresence>

                    {/* Construction Particles */}
                    {showElements.includes('image') && Array.from({ length: 15 }).map((_, i) => (
                      <motion.div
                        key={`particle-${i}`}
                        className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full"
                        style={{
                          left: `${20 + Math.random() * 60}%`,
                          top: `${20 + Math.random() * 40}%`,
                        }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                          opacity: [0, 1, 0],
                          scale: [0, 1.5, 0],
                          y: [-20, -40, -60]
                        }}
                        transition={{
                          duration: 1.5,
                          delay: i * 0.1,
                          repeat: Infinity,
                          repeatDelay: 1
                        }}
                      />
                    ))}
                  </>
                )}

                {/* Visual-Heavy Layout */}
                {currentLayout === 'visual-heavy' && (
                  <>
                    {/* Title */}
                    <AnimatePresence>
                      {showElements.includes('title') && (
                        <motion.div
                          className="relative h-8 w-3/4 mx-auto mb-8"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <motion.div
                            className="h-full rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 relative overflow-hidden"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            style={{ transformOrigin: 'left' }}
                          >
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                              initial={{ x: '-100%' }}
                              animate={{ x: '200%' }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Large Image Placeholder with build effect */}
                    <AnimatePresence>
                      {showElements.includes('image') && (
                        <motion.div
                          className="mx-auto relative"
                          style={{ width: '75%', height: '55%' }}
                        >
                          {/* Frame builds from corners */}
                          <motion.div
                            className="absolute inset-0 rounded-lg border-4 border-blue-400/80 overflow-hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            {/* Corner to corner build animation */}
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-br from-blue-500/40 to-purple-600/40"
                              initial={{ clipPath: 'inset(50% 50% 50% 50%)' }}
                              animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                          </motion.div>

                          {/* Building grid overlay */}
                          <motion.div
                            className="absolute inset-0 opacity-50"
                            style={{
                              backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)',
                              backgroundSize: '20px 20px'
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 0.5, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />

                          {/* Icon */}
                          <motion.div
                            className="absolute inset-0 flex items-center justify-center"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                          >
                            <svg className="w-20 h-20 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {/* Data-Focused Layout */}
                {currentLayout === 'data-focused' && (
                  <>
                    {/* Title */}
                    <AnimatePresence>
                      {showElements.includes('title') && (
                        <motion.div
                          className="relative h-8 w-2/3 mb-8"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <motion.div
                            className="h-full rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 relative overflow-hidden"
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          >
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                              initial={{ x: '-100%' }}
                              animate={{ x: '200%' }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Bar Chart with dramatic build */}
                    <AnimatePresence>
                      {showElements.includes('chart') && (
                        <div className="flex items-end justify-around h-48 px-8">
                          {[65, 85, 50, 95, 70].map((height, i) => (
                            <motion.div
                              key={i}
                              className="relative w-16"
                              initial={{ height: 0 }}
                              animate={{ height: `${height}%` }}
                              transition={{
                                duration: 0.8,
                                delay: i * 0.15,
                                ease: "easeOut"
                              }}
                            >
                              {/* Bar with gradient */}
                              <div className="absolute inset-0 rounded-t-lg bg-gradient-to-t from-blue-600 via-blue-500 to-purple-500 relative overflow-hidden">
                                {/* Shimmer effect */}
                                <motion.div
                                  className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-transparent"
                                  initial={{ y: '100%' }}
                                  animate={{ y: '-100%' }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
                                />
                              </div>

                              {/* Value sparkle on top */}
                              <motion.div
                                className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white rounded-full"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{
                                  scale: [0, 1.5, 1],
                                  opacity: [0, 1, 1]
                                }}
                                transition={{ delay: 0.8 + i * 0.15, duration: 0.4 }}
                              />
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Particle Dissolution Effect */}
          <AnimatePresence>
            {isRebuilding && (
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {Array.from({ length: 40 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      background: i % 2 === 0 ? 'rgba(139, 92, 246, 0.8)' : 'rgba(96, 165, 250, 0.8)'
                    }}
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{
                      opacity: 0,
                      scale: 0,
                      x: (Math.random() - 0.5) * 150,
                      y: (Math.random() - 0.5) * 150,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* FIREWORK SPARK BORDER - BRIGHT AND OBVIOUS */}
        <div className="absolute inset-0 pointer-events-none rounded-xl">
          {/* Main spark with trail */}
          <motion.div
            className="absolute w-6 h-6 rounded-full"
            style={{
              left: `${sparkCoords.x}%`,
              top: `${sparkCoords.y}%`,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(96,165,250,1) 30%, rgba(139,92,246,0.8) 60%, transparent 100%)',
              boxShadow: '0 0 30px rgba(96, 165, 250, 1), 0 0 60px rgba(139, 92, 246, 0.8), 0 0 90px rgba(139, 92, 246, 0.4)',
              filter: 'blur(1px)'
            }}
          />

          {/* Trailing particles */}
          {[0, 1, 2, 3, 4].map((offset) => {
            const trailProgress = ((sparkPosition - offset * 2 + 100) % 100)
            const trailCoords = getSparkCoordinates(trailProgress)
            return (
              <motion.div
                key={offset}
                className="absolute rounded-full"
                style={{
                  left: `${trailCoords.x}%`,
                  top: `${trailCoords.y}%`,
                  width: `${6 - offset}px`,
                  height: `${6 - offset}px`,
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(circle, rgba(96,165,250,${0.8 - offset * 0.15}) 0%, transparent 70%)`,
                  boxShadow: `0 0 ${20 - offset * 3}px rgba(96, 165, 250, ${0.6 - offset * 0.1})`
                }}
              />
            )
          })}

          {/* Border glow path */}
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ borderRadius: '0.75rem' }}
          >
            <defs>
              <linearGradient id="borderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(139, 92, 246, 0.3)" />
                <stop offset="50%" stopColor="rgba(96, 165, 250, 0.5)" />
                <stop offset="100%" stopColor="rgba(139, 92, 246, 0.3)" />
              </linearGradient>
            </defs>
            <rect
              x="2"
              y="2"
              width="calc(100% - 4px)"
              height="calc(100% - 4px)"
              rx="10"
              fill="none"
              stroke="url(#borderGlow)"
              strokeWidth="3"
              opacity="0.6"
            />
          </svg>
        </div>
      </div>

      {/* Status Text */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-lg font-medium text-gray-900 mb-2">
          {statusText}
        </p>
        {estimatedTime && (
          <p className="text-sm text-gray-600">
            ~{estimatedTime}s remaining
          </p>
        )}
      </motion.div>

      {/* CSS Animation for Grid Panning */}
      <style jsx>{`
        @keyframes panGrid {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 30px 30px;
          }
        }
      `}</style>
    </div>
  )
}
