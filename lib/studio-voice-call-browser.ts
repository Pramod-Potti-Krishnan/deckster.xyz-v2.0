// W6 P4-20 voice call: the browser's side of the controller's environment (lib/studio-voice-call-controller.ts): the microphone, the recorder, the speaker, the clock. Loaded only with the flag on, and only
// when a call starts does anything here touch the microphone: openMic is called by the call button and nothing else. No provider is contacted from here; speech in and out is the same-origin router port.
import { pickRecorderMime, rmsByteTimeDomain } from '@/lib/studio/voice'
import { createVoiceRouterPort, type VoiceRouterPort } from '@/lib/studio-voice-call-router'
import type { VoiceCallEnv, VoiceMic, VoicePlayer, VoiceRecording } from '@/lib/studio-voice-call-controller'

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ?? null
}

/** The same-origin router port, over the page's own fetch. */
export function browserVoicePort(): VoiceRouterPort {
  return createVoiceRouterPort((input, init) => fetch(input, init as RequestInit), FormData as unknown as new () => { append(name: string, value: unknown, filename?: string): void })
}

function openMic(): Promise<VoiceMic> {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(stream => {
    const Ctx = audioContextCtor()
    let context: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    if (Ctx) {
      try {
        context = new Ctx()
        analyser = context.createAnalyser()
        analyser.fftSize = 1024
        context.createMediaStreamSource(stream).connect(analyser)
      } catch { context = null; analyser = null }
    }
    const mime = pickRecorderMime(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))
    const mic: VoiceMic = {
      record(): VoiceRecording {
        const chunks: Blob[] = []
        const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
        const startedAt = performance.now()
        let peak = 0
        let cancelled = false
        const bytes = new Uint8Array(analyser ? analyser.fftSize : 0)
        const meter = window.setInterval(() => {
          if (!analyser) return
          analyser.getByteTimeDomainData(bytes)
          peak = Math.max(peak, rmsByteTimeDomain(bytes))
        }, 40)
        recorder.addEventListener('dataavailable', event => { if (event.data && event.data.size > 0) chunks.push(event.data) })
        const stopped = new Promise<void>(resolve => recorder.addEventListener('stop', () => resolve(), { once: true }))
        if (context?.state === 'suspended') void context.resume()
        recorder.start()
        return {
          async stop() {
            window.clearInterval(meter)
            if (recorder.state !== 'inactive') recorder.stop()
            await stopped
            if (cancelled) throw new Error('cancelled')
            return { blob: new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' }), durationMs: performance.now() - startedAt, peak }
          },
          cancel() {
            cancelled = true
            window.clearInterval(meter)
            if (recorder.state !== 'inactive') recorder.stop()
          },
        }
      },
      close() {
        for (const track of stream.getTracks()) track.stop()
        void context?.close().catch(() => {})
      },
    }
    return mic
  })
}

/** One audio element, started on demand (so a flag-on page that never makes a call creates no audio graph), with an analyser on it for the mouth. */
function createPlayer(): VoicePlayer {
  let audio: HTMLAudioElement | null = null
  let analyser: AnalyserNode | null = null
  let bytes: Uint8Array | null = null
  let url: string | null = null
  const release = () => { if (url) { URL.revokeObjectURL(url); url = null } }
  const element = (): HTMLAudioElement => {
    if (audio) return audio
    audio = new Audio()
    audio.preload = 'auto'
    const Ctx = audioContextCtor()
    if (Ctx) {
      try {
        const context = new Ctx()
        analyser = context.createAnalyser()
        analyser.fftSize = 1024
        bytes = new Uint8Array(analyser.fftSize)
        const source = context.createMediaElementSource(audio)
        source.connect(analyser)
        analyser.connect(context.destination)
        audio.addEventListener('play', () => { if (context.state === 'suspended') void context.resume() })
      } catch { analyser = null; bytes = null }
    }
    return audio
  }
  return {
    play(blob, hooks) {
      const el = element()
      release()
      url = URL.createObjectURL(blob)
      const done = (fn: () => void) => () => { el.onplaying = el.onended = el.onerror = null; release(); fn() }
      el.onplaying = () => { el.onplaying = null; hooks.onStart() }
      el.onended = done(hooks.onEnd)
      el.onerror = done(hooks.onError)
      el.src = url
      void el.play().catch(() => { el.onplaying = el.onended = el.onerror = null; release(); hooks.onError() })
    },
    stop() {
      if (!audio) return
      audio.onplaying = audio.onended = audio.onerror = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      release()
    },
    level() {
      if (!analyser || !bytes) return 0
      analyser.getByteTimeDomainData(bytes as Uint8Array<ArrayBuffer>)
      return rmsByteTimeDomain(bytes)
    },
  }
}

export function browserVoiceEnv(): VoiceCallEnv {
  return {
    secureContext: () => typeof window !== 'undefined' && window.isSecureContext === true,
    hasMic: () => typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined',
    openMic,
    createPlayer,
    now: () => performance.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: handle => window.clearTimeout(handle as number),
    reducedMotion: () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    macApp: () => false,
    mac: () => typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || ''),
  }
}
