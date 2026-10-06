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
  const scopeKey = JSON.stringify([presentationId, slideId, refreshToken ?? null])
  const scopeRef = useRef({ key: scopeKey })
  if (scopeRef.current.key !== scopeKey) scopeRef.current = { key: scopeKey }
  const scope = scopeRef.current
  const mountedRef = useRef(true)
  const requestRef = useRef<object | null>(null)
  const [recording, setRecording] = useState<{
    scope: typeof scope; request: object; audio: SlideAudio | null; voiceName: string | null
  } | null>(null)
  const recordingIsCurrent = recording?.scope === scope && requestRef.current === recording.request
  const audio = recordingIsCurrent ? recording.audio : null
  const voiceName = recordingIsCurrent ? recording.voiceName : null
  const [loading, setLoading] = useState(false)
  const [playback, setPlayback] = useState<{ scope: typeof scope; playing: boolean } | null>(null)
  const playing = playback?.scope === scope && playback.playing === true
  const elementRef = useRef<HTMLAudioElement | null>(null)
  const scopeIsCurrent = () => mountedRef.current && scopeRef.current === scope

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current = null
      elementRef.current?.pause()
      elementRef.current = null
    }
  }, [])

  useEffect(() => {
    const request = {}
    requestRef.current = request
    let cancelled = false
    const isCurrent = () => !cancelled && scopeIsCurrent() && requestRef.current === request
    if (!presentationId) {
      setRecording(previous => isCurrent() ? null : previous)
      return
    }
    setLoading(previous => isCurrent() ? true : previous)
    ;(async () => {
      try {
        const response = await fetch(
          `/api/narration/manifest?presentationId=${encodeURIComponent(presentationId)}`
        )
        if (!isCurrent()) return
        if (!response.ok) {
          setRecording(previous => isCurrent() ? null : previous)
          return
        }
        const data = await response.json()
        if (!isCurrent()) return
        const audio = (data.slides ?? []).find((s: SlideAudio) => s.slideId === slideId) ?? null
        setRecording(previous => isCurrent() ? { scope, request, audio, voiceName: data.voiceName ?? null } : previous)
      } catch {
        // A failed read has no playable recording; retain the script editor.
        setRecording(previous => isCurrent() ? null : previous)
      } finally {
        setLoading(previous => isCurrent() ? false : previous)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [presentationId, slideId, refreshToken, scope])

  // Stop on slide change. Otherwise the previous slide keeps talking over the
  // one now on screen, which is disorienting in a way silence never is.
  useEffect(() => {
    elementRef.current?.pause()
    elementRef.current = null
    setPlayback(previous => scopeIsCurrent() ? { scope, playing: false } : previous)
  }, [scope])

  const toggle = useCallback(() => {
    if (!scopeIsCurrent() || recording?.scope !== scope || requestRef.current !== recording.request
      || !audio?.full || audio.stale) return
    if (playing) {
      elementRef.current?.pause()
      elementRef.current = null
      setPlayback(previous => scopeIsCurrent() ? { scope, playing: false } : previous)
      return
    }
    const element = new Audio(`/api/narration/segment/${audio.full}`)
    elementRef.current = element
    const isCurrent = () => scopeIsCurrent() && elementRef.current === element
    const stopped = () => setPlayback(previous => isCurrent() ? { scope, playing: false } : previous)
    element.addEventListener('ended', stopped)
    element.addEventListener('error', stopped)
    setPlayback(previous => isCurrent() ? { scope, playing: true } : previous)
    void element.play().catch(stopped)
  }, [audio, playing, recording, scope])

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
