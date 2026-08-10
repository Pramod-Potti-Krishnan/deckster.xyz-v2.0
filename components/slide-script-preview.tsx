"use client"

/**
 * Hear the slide you are reading.
 *
 * Sits above the Script textarea because that is where the author is when the
 * question "does this actually sound right?" occurs to them. Sending them to
 * the publish dialog to find out would mean leaving the words they are editing.
 *
 * It plays what is RECORDED, which is not always what is on screen — the author
 * may have typed since. That gap is stated rather than hidden: a slide whose
 * script has changed since it was recorded offers no playback and says why,
 * because playing the old words over the new ones is the one failure this
 * feature must never produce.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Pause, Play } from 'lucide-react'

interface SlideAudio {
  slideId: string
  index: number
  full: string | null
  fullDurationMs: number | null
  stale: boolean
}

interface Props {
  presentationId: string | null
  slideId: string | null
  /** Bumped by the panel when a script is written elsewhere, so the preview
   *  stops offering audio for words that have just been replaced. */
  refreshToken?: number
}

export function SlideScriptPreview({ presentationId, slideId, refreshToken }: Props) {
  const [audio, setAudio] = useState<SlideAudio | null>(null)
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const elementRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!presentationId) {
      setAudio(null)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const response = await fetch(
          `/api/narration/manifest?presentationId=${encodeURIComponent(presentationId)}`
        )
        if (!response.ok) {
          if (!cancelled) setAudio(null)
          return
        }
        const data = await response.json()
        if (cancelled) return
        setVoiceName(data.voiceName ?? null)
        setAudio(
          (data.slides ?? []).find((s: SlideAudio) => s.slideId === slideId) ?? null
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [presentationId, slideId, refreshToken])

  // Stop on slide change. Otherwise the previous slide keeps talking over the
  // one now on screen, which is disorienting in a way silence never is.
  useEffect(() => {
    elementRef.current?.pause()
    setPlaying(false)
  }, [slideId])

  useEffect(() => () => elementRef.current?.pause(), [])

  const toggle = useCallback(() => {
    if (!audio?.full) return
    if (playing) {
      elementRef.current?.pause()
      setPlaying(false)
      return
    }
    const element = new Audio(`/api/narration/segment/${audio.full}`)
    elementRef.current = element
    element.addEventListener('ended', () => setPlaying(false))
    element.addEventListener('error', () => setPlaying(false))
    setPlaying(true)
    void element.play().catch(() => setPlaying(false))
  }, [audio, playing])

  if (!presentationId || !slideId) return null

  if (loading && !audio) {
    return (
      <p className="flex items-center gap-1.5 pb-1.5 text-[11px] text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking for a recording…
      </p>
    )
  }

  if (audio?.stale) {
    return (
      <p className="flex items-start gap-1.5 pb-1.5 text-[11px] text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-px h-3 w-3 flex-shrink-0" />
        <span>
          This slide has changed since it was recorded. Record it again under Publish →
          Voice to hear the new words.
        </span>
      </p>
    )
  }

  if (!audio?.full) return null

  const seconds = audio.fullDurationMs ? Math.round(audio.fullDurationMs / 1000) : null

  return (
    <div className="flex items-center gap-2 pb-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Stop the recording' : 'Play this slide'}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition-colors hover:text-slate-900 dark:border-slate-600 dark:hover:text-slate-100"
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        Hear this slide{voiceName ? ` in ${voiceName}` : ''}
        {seconds ? ` · ${seconds}s` : ''}
      </span>
    </div>
  )
}
