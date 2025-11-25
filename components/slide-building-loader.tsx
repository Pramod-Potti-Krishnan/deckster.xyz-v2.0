"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SlideBuildingLoaderProps {
  statusText?: string
  estimatedTime?: number
  className?: string
}

type LayoutType = 'text-heavy' | 'visual-heavy' | 'data-focused'

export function SlideBuildingLoader({
  statusText = "Building your presentation...",
  estimatedTime,
  className = ''
}: SlideBuildingLoaderProps) {
  const [currentLayout, setCurrentLayout] = useState<LayoutType>('text-heavy')
  const [isRebuilding, setIsRebuilding] = useState(false)

  // Cycle layouts
  useEffect(() => {
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
  }, [])

  return (
    <div className={cn("flex flex-col items-center justify-center gap-8", className)}>
      {/* Container */}
      <div className="relative w-full max-w-3xl aspect-video">
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
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center space-y-2">
        <motion.p
          className="text-lg font-medium bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {statusText}
        </motion.p>
        {estimatedTime && (
          <p className="text-sm text-muted-foreground">~{estimatedTime}s remaining</p>
        )}
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
