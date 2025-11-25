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

  return (
    <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
      {/* The Slide Container */}
      <div className="relative w-full max-w-3xl" style={{ aspectRatio: '16/9' }}>
        {/* Glass-morphism container */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-xl rounded-xl overflow-hidden border border-purple-500/30"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Animated Grid Background */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(139, 92, 246, 0.3) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(139, 92, 246, 0.3) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
              animation: 'panGrid 10s linear infinite'
            }}
          />

          {/* Scanner Line */}
          <motion.div
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
            style={{
              top: `${scanProgress}%`,
              boxShadow: '0 0 20px rgba(96, 165, 250, 0.8), 0 0 40px rgba(96, 165, 250, 0.4)'
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
                    {/* Title */}
                    <AnimatePresence>
                      {showElements.includes('title') && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            transition: {
                              type: "spring",
                              stiffness: 300,
                              damping: 20
                            }
                          }}
                          className="relative"
                        >
                          {/* Wireframe effect */}
                          <motion.div
                            className="h-8 rounded border-2 border-purple-400"
                            initial={{ borderColor: 'rgba(192, 132, 252, 0.5)' }}
                            animate={{
                              borderColor: 'rgba(192, 132, 252, 0)',
                              transition: { delay: 0.3, duration: 0.5 }
                            }}
                          />
                          {/* Solid fill */}
                          <motion.div
                            className="absolute inset-0 rounded bg-gradient-to-r from-purple-500 to-blue-500"
                            initial={{ opacity: 0 }}
                            animate={{
                              opacity: 1,
                              transition: { delay: 0.3, duration: 0.5 }
                            }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Text Lines */}
                    <AnimatePresence>
                      {showElements.includes('image') && (
                        <motion.div
                          className="mt-6 space-y-3"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            transition: {
                              type: "spring",
                              stiffness: 300,
                              damping: 20
                            }
                          }}
                        >
                          {[60, 80, 70].map((width, i) => (
                            <motion.div
                              key={i}
                              className="relative h-4 rounded"
                              style={{ width: `${width}%` }}
                              initial={{ borderColor: 'rgba(96, 165, 250, 0.5)' }}
                              animate={{
                                borderColor: 'rgba(96, 165, 250, 0)',
                                transition: { delay: 0.2 + i * 0.1, duration: 0.4 }
                              }}
                            >
                              <motion.div
                                className="absolute inset-0 rounded border border-blue-400"
                                initial={{ opacity: 1 }}
                                animate={{ opacity: 0, transition: { delay: 0.2 + i * 0.1, duration: 0.4 } }}
                              />
                              <motion.div
                                className="absolute inset-0 rounded bg-gradient-to-r from-blue-500/60 to-purple-500/60"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1, transition: { delay: 0.2 + i * 0.1, duration: 0.4 } }}
                              />
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {/* Visual-Heavy Layout */}
                {currentLayout === 'visual-heavy' && (
                  <>
                    {/* Title */}
                    <AnimatePresence>
                      {showElements.includes('title') && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            transition: { type: "spring", stiffness: 300, damping: 20 }
                          }}
                          className="relative h-6 w-3/4 mx-auto"
                        >
                          <motion.div
                            className="absolute inset-0 rounded border-2 border-purple-400"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0, transition: { delay: 0.3, duration: 0.5 } }}
                          />
                          <motion.div
                            className="absolute inset-0 rounded bg-gradient-to-r from-purple-500 to-blue-500"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { delay: 0.3, duration: 0.5 } }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Large Image Placeholder */}
                    <AnimatePresence>
                      {showElements.includes('image') && (
                        <motion.div
                          className="mt-8 mx-auto relative"
                          style={{ width: '80%', height: '60%' }}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            transition: { type: "spring", stiffness: 300, damping: 20 }
                          }}
                        >
                          <motion.div
                            className="absolute inset-0 rounded-lg border-2 border-blue-400"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0, transition: { delay: 0.3, duration: 0.5 } }}
                          />
                          <motion.div
                            className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500/40 to-purple-600/40"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { delay: 0.3, duration: 0.5 } }}
                          />
                          {/* Fake image icon */}
                          <motion.div
                            className="absolute inset-0 flex items-center justify-center"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{
                              opacity: 0.6,
                              scale: 1,
                              transition: { delay: 0.5, type: "spring" }
                            }}
                          >
                            <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            transition: { type: "spring", stiffness: 300, damping: 20 }
                          }}
                          className="relative h-6 w-2/3"
                        >
                          <motion.div
                            className="absolute inset-0 rounded border-2 border-purple-400"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0, transition: { delay: 0.3, duration: 0.5 } }}
                          />
                          <motion.div
                            className="absolute inset-0 rounded bg-gradient-to-r from-purple-500 to-blue-500"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { delay: 0.3, duration: 0.5 } }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Bar Chart */}
                    <AnimatePresence>
                      {showElements.includes('chart') && (
                        <motion.div
                          className="mt-8 flex items-end justify-around h-40 px-8"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          {[60, 80, 45, 90, 70].map((height, i) => (
                            <motion.div
                              key={i}
                              className="relative w-12"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{
                                scale: 1,
                                opacity: 1,
                                transition: {
                                  type: "spring",
                                  stiffness: 300,
                                  damping: 20,
                                  delay: i * 0.1
                                }
                              }}
                              style={{ height: `${height}%` }}
                            >
                              <motion.div
                                className="absolute inset-0 rounded-t border-2 border-blue-400"
                                initial={{ opacity: 1 }}
                                animate={{ opacity: 0, transition: { delay: 0.3 + i * 0.1, duration: 0.4 } }}
                              />
                              <motion.div
                                className="absolute inset-0 rounded-t bg-gradient-to-t from-blue-600 to-purple-500"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1, transition: { delay: 0.3 + i * 0.1, duration: 0.4 } }}
                              />
                            </motion.div>
                          ))}
                        </motion.div>
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
                {Array.from({ length: 30 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-purple-400 rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                    }}
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{
                      opacity: 0,
                      scale: 0,
                      x: (Math.random() - 0.5) * 100,
                      y: (Math.random() - 0.5) * 100,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Spark Border - Traveling Energy Beam */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0)" />
              <stop offset="30%" stopColor="rgba(139, 92, 246, 0.6)" />
              <stop offset="50%" stopColor="rgba(96, 165, 250, 1)" />
              <stop offset="70%" stopColor="rgba(139, 92, 246, 0.6)" />
              <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
            </linearGradient>
          </defs>
          <motion.rect
            x="0"
            y="0"
            width="100"
            height="100"
            fill="none"
            stroke="url(#sparkGradient)"
            strokeWidth="0.5"
            rx="2"
            initial={{ strokeDasharray: "0 400", strokeDashoffset: 0 }}
            animate={{
              strokeDasharray: "80 400",
              strokeDashoffset: -480,
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              filter: 'drop-shadow(0 0 4px rgba(96, 165, 250, 0.8))'
            }}
          />
        </svg>
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
            background-position: 40px 40px;
          }
        }
      `}</style>
    </div>
  )
}
