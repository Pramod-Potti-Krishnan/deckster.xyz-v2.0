"use client"

/**
 * The deck presenting itself.
 *
 * A full-screen run: audio plays, slides advance when their audio ends, and a
 * clock runs against the time the publisher said they had. This is the moment
 * narration stops being a creator's artefact and becomes something an audience
 * sits through, so the failures that matter are different from everywhere else
 * in the feature — they are failures of pacing and of trust, not of data.
 *
 * Three rules the whole component is built around:
 *
 * 1. **It never starts by itself.** Audio beginning unbidden on a stranger's
 *    link is how a deck gets closed rather than watched. The audience presses
 *    play, every time.
 *
 * 2. **A slide with no usable audio is still SHOWN, silently, for a sensible
 *    beat.** Skipping it would hide part of the deck; sitting on it forever
 *    would look broken. Silence over a slide that was never recorded is honest;
 *    speaking the wrong words over it would not be, which is why the manifest
 *    refuses to supply stale audio at all.
 *
 * 3. **Running late degrades, it does not truncate.** When the remaining audio
 *    will not fit the remaining time, the run switches to the compressed script
 *    for what is left and says so. A deck that stops mid-sentence at the buzzer
 *    is the failure the whole time budget exists to prevent.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Pause, Play, X } from 'lucide-react'
import {
  PresenterQuestion,
  type AskedQuestion,
  type HandState,
} from '@/components/presenter-question'

interface SlideAudio {
  slideId: string
  index: number
  full: string | null
  compressed: string | null
  fullDurationMs: number | null
  compressedDurationMs: number | null
  stale: boolean
}

interface Budget {
  totalMinutes: number
  qaReserveMinutes: number
  narrationMinutes: number
  compressedMinutes: number
}

export interface NarrationManifest {
  voiceName: string
  slides: SlideAudio[]
  closing: string | null
  closingDurationMs: number | null
  /** Whether this deck's voice starts speaking fast enough to answer out loud.
   *  A nine-second wait after asking reads as broken, not thoughtful. */
  speaksAnswers?: boolean
  missing: number
  totalDurationMs: number
  budget: Budget | null
  qaEnabled: boolean
}

/** How long a slide with no audio stays on screen. Long enough to read a
 *  headline and a couple of lines, short enough not to feel stalled. */
const SILENT_SLIDE_MS = 6000

interface Props {
  slug: string
  manifest: NarrationManifest
  /** Move the deck behind us. 1-based, matching the citation contract. */
  onSlide: (slideNumber: number) => void
  onExit: () => void
}

/**
 * Whether a raised hand should interrupt the CURRENT slide or wait for it.
 *
 * It waits. Cutting the audio mid-sentence to take a question is what makes a
 * machine feel like a machine; finishing the thought and then turning to the
 * questioner is what a presenter does. The cost is a few seconds and it buys
 * the entire impression.
 */
const PAUSE_AT_SLIDE_END = true

export function PublishedPresenter({ slug, manifest, onSlide, onExit }: Props) {
  const [index, setIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [compressed, setCompressed] = useState(false)
  const [announced, setAnnounced] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [hand, setHand] = useState<HandState>('down')
  const [asked, setAsked] = useState<AskedQuestion | null>(null)
  // Q&A time is spent from the SAME clock as the narration, because it is the
  // same room and the same hour. Tracked separately only so the audience can be
  // told where their time went.
  const [qaMs, setQaMs] = useState(0)
  const qaStartedAt = useRef<number | null>(null)
  // The closing plays after the last slide, or the moment the clock beats us.
  const [closing, setClosing] = useState(false)
  // True while a reply is being spoken. Narration must not resume over it —
  // two voices at once was the failure that made this whole change necessary.
  const [answerSpeaking, setAnswerSpeaking] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Read inside audio callbacks, which close over the state they were created
  // with — a ref is the only thing that sees the hand going up mid-slide.
  const handRef = useRef<HandState>('down')
  handRef.current = hand
  // Guards against the closing re-triggering itself when it finishes.
  const closingRef = useRef(false)
  const silentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedAt = useRef<number | null>(null)

  const slides = manifest.slides
  const slide = slides[index]
  const budgetMs = manifest.budget ? manifest.budget.narrationMinutes * 60_000 : null

  const clearTimers = useCallback(() => {
    if (silentTimer.current) clearTimeout(silentTimer.current)
    silentTimer.current = null
    audioRef.current?.pause()
    audioRef.current = null
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  // The deck behind us follows the run.
  useEffect(() => {
    if (started) onSlide(index + 1)
  }, [index, started, onSlide])

  /**
   * Are we going to overrun?
   *
   * Compares the audio still to play against the time still available. Switching
   * early is better than switching late: the compressed variant only helps if
   * there is enough runway left for it to matter, and a deck that decides at the
   * last slide has already lost.
   */
  const shouldCompress = useMemo(() => {
    if (!budgetMs || compressed) return compressed
    const remainingMs = slides
      .slice(index)
      .reduce((sum, s) => sum + (s.fullDurationMs ?? SILENT_SLIDE_MS), 0)
    return elapsedMs + remainingMs > budgetMs
  }, [budgetMs, compressed, slides, index, elapsedMs])

  useEffect(() => {
    if (!shouldCompress || compressed) return
    setCompressed(true)
    setAnnounced(true)
    // Said out loud, not just shown. The audience is listening, not reading —
    // and a presenter who is running late says so rather than putting a caption
    // on the wall. Best-effort: a failed announcement must never stop the run,
    // and the on-screen notice remains either way.
    void (async () => {
      try {
        const response = await fetch('/api/narration/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, kind: 'announcement' }),
        })
        if (!response.ok) return
        const blob = await response.blob()
        const element = new Audio(URL.createObjectURL(blob))
        // Layered over the narration deliberately: interrupting the slide to
        // announce that we are short of time would cost more time.
        void element.play().catch(() => {})
      } catch {
        /* the on-screen notice is the fallback */
      }
    })()
  }, [shouldCompress, compressed, slug])

  /** Play the current slide, or hold it silently if it has no usable audio. */
  const playCurrent = useCallback(() => {
    clearTimers()
    const current = slides[index]
    if (!current) return

    const segmentId = compressed ? current.compressed ?? current.full : current.full
    const advance = () => {
      // A raised hand is honoured HERE — at the boundary between slides — which
      // is what makes the pause feel invited rather than interrupted.
      if (PAUSE_AT_SLIDE_END && handRef.current === 'raised') {
        setHand('asking')
        setRunning(false)
        return
      }
      setIndex((i) => (i + 1 < slides.length ? i + 1 : i))
    }
    const finish = () => {
      if (handRef.current === 'raised') {
        setRunning(false)
        setStarted(true)
        setHand('asking')
        return
      }
      // Always end on the closing. A deck that simply stops after its last
      // slide ends on whatever that slide happened to say; a deck that closes
      // ends on purpose.
      if (manifest.closing && !closingRef.current) {
        closingRef.current = true
        setClosing(true)
        return
      }
      setRunning(false)
      setStarted(true)
    }

    if (!segmentId) {
      // No audio: show it, then move on. Never skip — the slide is part of the
      // deck whether or not anyone recorded it.
      silentTimer.current = setTimeout(() => {
        if (index + 1 < slides.length) advance()
        else finish()
      }, SILENT_SLIDE_MS)
      return
    }

    setLoading(true)
    const element = new Audio(
      `/api/narration/segment/${segmentId}?slug=${encodeURIComponent(slug)}`
    )
    audioRef.current = element
    element.addEventListener('playing', () => setLoading(false))
    element.addEventListener('ended', () => {
      if (index + 1 < slides.length) advance()
      else finish()
    })
    element.addEventListener('error', () => {
      // A segment that will not load must not stall the run. Fall through to
      // the silent dwell, so the deck keeps moving.
      setLoading(false)
      silentTimer.current = setTimeout(() => {
        if (index + 1 < slides.length) advance()
        else finish()
      }, SILENT_SLIDE_MS)
    })
    void element.play().catch(() => setLoading(false))
  }, [clearTimers, compressed, index, slides, slug])

  // The closing segment, played whenever the run reaches an ending — the last
  // slide, or the clock.
  useEffect(() => {
    if (!closing || !manifest.closing) return
    clearTimers()
    const element = new Audio(
      `/api/narration/segment/${manifest.closing}?slug=${encodeURIComponent(slug)}`
    )
    audioRef.current = element
    const done = () => {
      setClosing(false)
      setRunning(false)
      setStarted(true)
    }
    element.addEventListener('ended', done)
    element.addEventListener('error', done)
    void element.play().catch(done)
  }, [closing, manifest.closing, slug, clearTimers])

  useEffect(() => {
    // `answerSpeaking` gates this as well as the resume control does. The button
    // is the intended path; this is the guarantee — narration cannot start over
    // a reply no matter which path got here.
    if (running && !closing && !answerSpeaking) playCurrent()
    else if (!closing) clearTimers()
    // playCurrent changes identity when the slide does, which is exactly when a
    // new segment should start.
  }, [running, index, compressed, answerSpeaking]) // eslint-disable-line react-hooks/exhaustive-deps

  // The clock. Wall time, not audio time: a pause the audience took is time the
  // session actually spent, and the budget is about the room, not the file.
  useEffect(() => {
    if (!running) return
    if (startedAt.current === null) startedAt.current = Date.now() - elapsedMs
    const tick = setInterval(() => {
      if (startedAt.current !== null) setElapsedMs(Date.now() - startedAt.current)
    }, 1000)
    return () => clearInterval(tick)
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  // The questioning clock starts when the deck stops and stops when it starts.
  useEffect(() => {
    if (hand === 'asking' || hand === 'answering' || hand === 'answered') {
      if (qaStartedAt.current === null) qaStartedAt.current = Date.now()
    } else if (qaStartedAt.current !== null) {
      setQaMs((ms) => ms + (Date.now() - (qaStartedAt.current as number)))
      qaStartedAt.current = null
    }
  }, [hand])

  const resumeAfterQuestion = useCallback(() => {
    setAnswerSpeaking(false)
    setHand('down')
    setAsked(null)
    setIndex((i) => (i + 1 < slides.length ? i + 1 : i))
    startedAt.current = Date.now() - elapsedMs
    setRunning(true)
  }, [slides.length, elapsedMs])

  const start = () => {
    setStarted(true)
    setRunning(true)
  }
  const toggle = () => {
    if (running) {
      startedAt.current = null
      setRunning(false)
    } else {
      startedAt.current = Date.now() - elapsedMs
      setRunning(true)
    }
  }

  const remainingMs = budgetMs ? Math.max(0, budgetMs - elapsedMs) : null
  const mmss = (ms: number) =>
    `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end">
      {/* Nothing plays until this is pressed. */}
      {!started && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
          <button
            onClick={start}
            className="flex items-center gap-3 rounded-full bg-white/95 px-6 py-3.5 text-slate-900 shadow-lg transition-transform hover:scale-[1.02]"
          >
            <Play className="h-5 w-5" />
            <span className="text-left">
              <span className="block text-sm font-semibold">Play the presentation</span>
              <span className="block text-xs text-slate-500">
                {manifest.voiceName} narrates {slides.length} slides
                {manifest.budget ? ` · ${manifest.budget.narrationMinutes} min` : ''}
              </span>
            </span>
          </button>
        </div>
      )}

      {started && (
        <div className="pointer-events-auto flex flex-col gap-1.5 bg-gradient-to-t from-black/75 to-transparent px-4 pb-3 pt-8 text-white">
          {announced && (
            <p className="self-center rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-medium text-amber-950">
              Running long — switching to the short version so we finish.
            </p>
          )}

          {/* The question surface sits ABOVE the transport, over the slide, so
              the deck stays visible while it is being asked about. */}
          {manifest.qaEnabled && hand !== 'down' && (
            <div className="mb-2 flex justify-center px-2">
              <PresenterQuestion
                slug={slug}
                state={hand}
                pendingUntilSlideEnds={hand === 'raised'}
                onRaise={() => setHand('raised')}
                onCancel={() => {
                  setHand('down')
                  setAsked(null)
                  if (!running) {
                    startedAt.current = Date.now() - elapsedMs
                    setRunning(true)
                  }
                }}
                speaksAnswers={manifest.speaksAnswers}
                onSpeakingChange={setAnswerSpeaking}
                onAsked={(next) => {
                  setAsked(next)
                  setHand('answered')
                }}
                onResume={resumeAfterQuestion}
                asked={asked}
                onCiteSlide={onSlide}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              aria-label={running ? 'Pause' : 'Resume'}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : running ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="h-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white/80 transition-[width] duration-500"
                  style={{ width: `${((index + 1) / Math.max(1, slides.length)) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-white/70">
                Slide {index + 1} of {slides.length}
                {remainingMs !== null && ` · ${mmss(remainingMs)} left`}
                {qaMs > 5000 && ` · ${mmss(qaMs)} on questions`}
                {slide?.stale && ' · this slide has no recording'}
              </p>
            </div>

            {/* Raising a hand does not stop anything immediately — it books the
                next boundary. The label says so. */}
            {manifest.qaEnabled && hand === 'down' && (
              <PresenterQuestion
                slug={slug}
                state="down"
                pendingUntilSlideEnds={false}
                onRaise={() => setHand('raised')}
                onCancel={() => setHand('down')}
                onAsked={() => {}}
                onResume={() => {}}
                asked={null}
                onCiteSlide={onSlide}
              />
            )}

            <button
              onClick={() => {
                clearTimers()
                onExit()
              }}
              aria-label="Leave the presentation"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
