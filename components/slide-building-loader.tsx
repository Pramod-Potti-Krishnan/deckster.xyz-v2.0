"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SlideBuildingLoaderProps {
  className?: string
  mode?: 'default' | 'strawman'
}

type LayoutType = 'text-heavy' | 'visual-heavy' | 'data-focused'

export function SlideBuildingLoader({
  className = '',
  mode = 'default'
}: SlideBuildingLoaderProps) {
  const [currentLayout, setCurrentLayout] = useState<LayoutType>('text-heavy')
  const [isRebuilding, setIsRebuilding] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [slideSize, setSlideSize] = useState<{ width: number; height: number } | null>(null)

  // Calculate optimal 16:9 dimensions that fit within available parent space
  const calculateSize = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const { width, height } = container.getBoundingClientRect()
    // Subtract padding (p-4 = 16px each side, matching presentation-viewer)
    const pw = width - 32, ph = height - 32
    if (pw <= 0 || ph <= 0) return
    const ratio = 16 / 9
    let w = pw, h = w / ratio
    if (h > ph) { h = ph; w = h * ratio }
    setSlideSize({ width: w, height: h })
  }, [])

  // ResizeObserver to track parent size changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    calculateSize()
    const ro = new ResizeObserver(() => calculateSize())
    ro.observe(container)
    return () => ro.disconnect()
  }, [calculateSize])

  // Cycle layouts (only for default mode)
  useEffect(() => {
    if (mode !== 'default') return

    const layouts: LayoutType[] = ['text-heavy', 'visual-heavy', 'data-focused']
    let currentIndex = 0

    const interval = setInterval(() => {
      setIsRebuilding(true)
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % layouts.length
        setCurrentLayout(layouts[currentIndex])
        setIsRebuilding(false)
      }, 600) // Wait for exit animation
    }, 4000) // 4 seconds per slide

    return () => clearInterval(interval)
  }, [mode])

  return (
    <div ref={containerRef} className={cn("flex items-center justify-center", className)}>
      {/* Container */}
      <div
        className="relative"
        style={slideSize ? { width: slideSize.width, height: slideSize.height } : { width: '100%', aspectRatio: '16/9', maxWidth: '768px' }}
      >
        {/* 1. Glassmorphism Background & Border Container */}
        <div className="absolute inset-0 rounded-xl overflow-hidden bg-gradient-to-br from-white/40 to-white/10 dark:from-black/40 dark:to-black/10 backdrop-blur-md border border-white/20 shadow-2xl">
          {/* Animated Grid Background */}
          <div className="absolute inset-0 opacity-20 dark:opacity-10"
            style={{
              backgroundImage: `linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
              maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
            }}>
            <motion.div
              className="absolute inset-0"
              animate={{ x: [0, 24], y: [0, 24] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            />
          </div>
        </div>

        {/* 2. The "Spark" Border Effect */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ padding: '1px' }}>
          <rect x="0" y="0" width="100%" height="100%" rx="12" ry="12" fill="none" stroke="transparent" />
          <motion.rect
            x="0" y="0" width="100%" height="100%" rx="12" ry="12"
            fill="none"
            stroke="url(#spark-gradient)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0, pathOffset: 0 }}
            animate={{ pathLength: 0.25, pathOffset: 1 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <defs>
            <linearGradient id="spark-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>

        {/* 3. Content Area */}
        <div className="absolute inset-0 p-8 flex flex-col">
          {mode === 'strawman' ? (
            <StrawmanLayout />
          ) : (
            <AnimatePresence mode="wait">
              {!isRebuilding && (
                <motion.div
                  key={currentLayout}
                  className="w-full h-full flex flex-col gap-4"
                  initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.05, filter: 'blur(4px)' }}
                  transition={{ duration: 0.5 }}
                >
                  {currentLayout === 'text-heavy' && <TextHeavyLayout />}
                  {currentLayout === 'visual-heavy' && <VisualHeavyLayout />}
                  {currentLayout === 'data-focused' && <DataFocusedLayout />}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

    </div>
  )
}

// Strawman Layout: Grid of small slides appearing
function StrawmanLayout() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="grid grid-cols-3 gap-6 w-full max-w-2xl">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <motion.div
            key={i}
            className="aspect-video rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative overflow-hidden shadow-sm"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              delay: i * 0.3, // Staggered appearance
              duration: 0.5,
              type: "spring",
              bounce: 0.4
            }}
          >
            {/* Mini slide content skeleton */}
            <div className="p-2 space-y-1.5">
              {/* Title line */}
              <motion.div
                className="h-1.5 w-3/4 bg-slate-300 dark:bg-slate-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '75%' }}
                transition={{ delay: i * 0.3 + 0.3, duration: 0.4 }}
              />
              {/* Body lines */}
              <motion.div
                className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: i * 0.3 + 0.4, duration: 0.4 }}
              />
              <motion.div
                className="h-1 w-5/6 bg-slate-200 dark:bg-slate-700 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '83%' }}
                transition={{ delay: i * 0.3 + 0.5, duration: 0.4 }}
              />
            </div>

            {/* Shimmer overlay */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: "linear",
                delay: i * 0.2 // Offset shimmers slightly
              }}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Sub-components for layouts with specific animations
function TextHeavyLayout() {
  return (
    <>
      {/* Title - Typing Effect */}
      <div className="h-12 w-3/4 mb-4 flex items-center">
        <TypingEffect text="Executive Summary & Key Insights" className="text-2xl font-bold text-slate-800 dark:text-slate-100" />
      </div>
      {/* Body Text - Staggered Lines */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="h-4 rounded bg-slate-200 dark:bg-slate-700"
            style={{ width: `${100 - i * 10}%` }}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: `${100 - i * 10}%`, opacity: 1 }}
            transition={{ delay: i * 0.1 + 0.5, duration: 0.5, ease: "easeOut" }}
          />
        ))}
      </div>
    </>
  )
}

function VisualHeavyLayout() {
  return (
    <div className="flex gap-6 h-full">
      <div className="w-1/2 space-y-4 pt-4">
        <motion.div
          className="h-8 w-3/4 rounded bg-slate-200 dark:bg-slate-700"
          initial={{ width: 0 }}
          animate={{ width: '75%' }}
          transition={{ duration: 0.5 }}
        />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="h-3 rounded bg-slate-200 dark:bg-slate-700"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
            />
          ))}
        </div>
      </div>
      <motion.div
        className="w-1/2 h-full rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {/* Shimmer Effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
          >
            <div className="w-16 h-16 rounded-full bg-white/50 backdrop-blur" />
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

function DataFocusedLayout() {
  return (
    <div className="h-full flex flex-col">
      <motion.div
        className="h-8 w-1/2 mb-8 rounded bg-slate-200 dark:bg-slate-700 mx-auto"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      />
      <div className="flex-1 flex items-end justify-around px-8 pb-4">
        {[40, 75, 55, 90, 65].map((height, i) => (
          <motion.div
            key={i}
            className="w-12 rounded-t-lg bg-gradient-to-t from-blue-500 to-purple-500"
            initial={{ height: 0 }}
            animate={{ height: `${height}%` }}
            transition={{
              delay: i * 0.1,
              duration: 0.8,
              type: "spring",
              bounce: 0.4
            }}
          />
        ))}
      </div>
    </div>
  )
}

function TypingEffect({ text, className }: { text: string, className?: string }) {
  const characters = text.split("");
  return (
    <div className={className}>
      {characters.map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1, delay: index * 0.03 }}
        >
          {char}
        </motion.span>
      ))}
    </div>
  );
}
