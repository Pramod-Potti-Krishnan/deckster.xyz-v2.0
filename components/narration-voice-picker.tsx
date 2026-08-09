"use client"

/**
 * Choose the voice this deck is narrated in.
 *
 * Sits beside the Script tab because that is where narration is written — you
 * write the words in Script, you choose who reads them here. It is not in the
 * publish dialog: that modal already carries visibility, passcode, downloads,
 * Q&A settings and source permissions, and a listening task does not belong
 * behind three clicks in a crowded sheet.
 *
 * The design constraint that shapes everything below: **cost and wait are shown
 * before the choice, not after it.** The voices differ by 120× in price and 26×
 * in latency, and the model behind a voice is deliberately invisible — so if
 * those two numbers were not on the card, a publisher could pick a voice and
 * silently multiply their narration bill, or make every spoken answer arrive
 * nine seconds late.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Loader2, Pause, Play, Zap } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface VoiceOption {
  id: string
  name: string
  description: string
  costPerMinuteUsd: number
  firstAudioSeconds: number
  liveAnswers: boolean
  sampleUrl: string
}

interface Props {
  sessionId: string | null
  /** Slides in the deck, used only to estimate cost. Absent → no estimate
   *  shown, rather than an estimate built on a guess. */
  slideCount?: number | null
}

/** Rough narration length per slide. Only ever used for an estimate that is
 *  labelled as one — the real figure arrives once scripts exist and carry
 *  Researcher's own `duration_seconds_estimate`. */
const MINUTES_PER_SLIDE = 0.5
const COMPRESSED_RATIO = 0.55
const CLOSING_MINUTES = 0.67

function estimateDeckCost(voice: VoiceOption, slideCount: number): number {
  const runtime = slideCount * MINUTES_PER_SLIDE
  const total = runtime * (1 + COMPRESSED_RATIO) + CLOSING_MINUTES
  return voice.costPerMinuteUsd * total
}

function formatCost(usd: number): string {
  if (usd < 0.01) return '<1¢'
  return `$${usd.toFixed(2)}`
}

export function NarrationVoicePicker({ sessionId, slideCount }: Props) {
  const { toast } = useToast()
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [effective, setEffective] = useState<string | null>(null)
  const [persistenceReady, setPersistenceReady] = useState(true)
  const [samplesReady, setSamplesReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`/api/narration/voice?sessionId=${sessionId}`)
        const data = await response.json()
        if (cancelled || !response.ok) return
        setVoices(data.voices ?? [])
        setSelected(data.selectedVoiceId ?? null)
        setEffective(data.effectiveVoiceId ?? null)
        setPersistenceReady(data.persistenceReady !== false)
        setSamplesReady(data.samplesReady !== false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // One clip at a time — auditioning voices means comparing them, and two
  // playing at once compares nothing.
  const preview = useCallback(
    (voice: VoiceOption) => {
      if (playing === voice.id) {
        audioRef.current?.pause()
        setPlaying(null)
        return
      }
      audioRef.current?.pause()
      const audio = new Audio(voice.sampleUrl)
      audioRef.current = audio
      setLoadingAudio(voice.id)
      audio.addEventListener('playing', () => setLoadingAudio(null))
      audio.addEventListener('ended', () => setPlaying(null))
      audio.addEventListener('error', () => {
        setLoadingAudio(null)
        setPlaying(null)
        toast({ title: `Could not play the ${voice.name} sample`, variant: 'destructive' })
      })
      setPlaying(voice.id)
      void audio.play().catch(() => {
        setLoadingAudio(null)
        setPlaying(null)
      })
    },
    [playing, toast]
  )

  useEffect(() => () => audioRef.current?.pause(), [])

  const choose = useCallback(
    async (voice: VoiceOption) => {
      if (!sessionId) return
      setSaving(voice.id)
      const previous = selected
      setSelected(voice.id)
      setEffective(voice.id)
      try {
        const response = await fetch('/api/narration/voice', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, voiceId: voice.id }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not save that voice')
        setPersistenceReady(data.persistenceReady !== false)
        if (data.persistenceReady === false) {
          toast({
            title: `${voice.name} selected, but not saved yet`,
            description: 'Narration storage is still being set up. Re-pick after it lands.',
          })
        }
      } catch (error) {
        setSelected(previous)
        setEffective(previous)
        toast({
          title: error instanceof Error ? error.message : 'Could not save that voice',
          variant: 'destructive',
        })
      } finally {
        setSaving(null)
      }
    },
    [sessionId, selected, toast]
  )

  if (!sessionId) {
    return (
      <p className="flex h-full items-center justify-center text-xs text-slate-400">
        Open a deck to choose its narration voice.
      </p>
    )
  }

  if (loading) {
    return (
      <p className="flex h-full items-center justify-center text-xs text-slate-400">
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading voices…
      </p>
    )
  }

  const slides = typeof slideCount === 'number' && slideCount > 0 ? slideCount : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 pb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          {selected
            ? `Narrated by ${voices.find((v) => v.id === effective)?.name ?? effective}`
            : 'No voice chosen — the default will be used'}
        </span>
        {slides && <span>Estimated for {slides} slides</span>}
      </div>

      {!samplesReady && (
        <p className="mb-1.5 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
          <AlertTriangle className="mt-px h-3 w-3 flex-shrink-0" />
          <span>
            Samples can&apos;t play on this deployment — <code>OPENROUTER_API_KEY</code> isn&apos;t
            set. Costs and speeds below are still accurate.
          </span>
        </p>
      )}

      {!persistenceReady && (
        <p className="mb-1.5 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
          <AlertTriangle className="mt-px h-3 w-3 flex-shrink-0" />
          <span>
            You can listen and pick, but the choice won&apos;t stick until narration storage is set
            up.
          </span>
        </p>
      )}

      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {voices.map((voice) => {
          const isSelected = selected === voice.id
          const cost = slides ? estimateDeckCost(voice, slides) : null
          return (
            <div
              key={voice.id}
              className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors ${
                isSelected
                  ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/30'
                  : 'border-gray-200 dark:border-slate-700'
              }`}
            >
              <button
                type="button"
                onClick={() => preview(voice)}
                disabled={!samplesReady}
                aria-label={`Play the ${voice.name} sample`}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition-colors hover:text-slate-900 dark:border-slate-600 dark:hover:text-slate-100"
              >
                {loadingAudio === voice.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : playing === voice.id ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {voice.name}
                  </span>
                  {voice.liveAnswers ? (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-100 px-1 py-px text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      title={`Starts speaking in ${voice.firstAudioSeconds.toFixed(1)}s — fast enough to answer questions out loud`}
                    >
                      <Zap className="h-2.5 w-2.5" /> live answers
                    </span>
                  ) : (
                    <span
                      className="rounded-sm bg-slate-100 px-1 py-px text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      title={`Takes ${voice.firstAudioSeconds.toFixed(1)}s to start speaking — too slow to answer questions out loud, so answers stay written`}
                    >
                      narration only
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {voice.description}
                </p>
              </div>

              {/* The two numbers that must be visible BEFORE the choice. */}
              <div className="flex flex-shrink-0 flex-col items-end tabular-nums">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {cost !== null ? formatCost(cost) : `$${voice.costPerMinuteUsd.toFixed(4)}`}
                </span>
                <span className="text-[10px] text-slate-400">
                  {cost !== null ? 'this deck' : 'per min'} · {voice.firstAudioSeconds.toFixed(1)}s
                  wait
                </span>
              </div>

              <button
                type="button"
                onClick={() => choose(voice)}
                disabled={saving !== null || isSelected}
                className={`flex-shrink-0 rounded-md px-2 py-1 text-xs transition-colors ${
                  isSelected
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'border border-gray-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {saving === voice.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isSelected ? (
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3" /> Using
                  </span>
                ) : (
                  'Use'
                )}
              </button>
            </div>
          )
        })}
      </div>

      <p className="flex-shrink-0 pt-1.5 text-[10px] text-slate-400">
        Cost and wait are measured from real renders. &ldquo;Narration only&rdquo; voices sound
        great but start too slowly to answer a viewer&apos;s question out loud — those answers stay
        written.
      </p>
    </div>
  )
}
