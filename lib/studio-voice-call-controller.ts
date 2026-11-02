// W6 P4-20 voice call: the controller. One call's whole life, with every browser thing injected (the microphone, the player, the clock, the timers, the router port), so scripts/test-studio-voice-call.mjs
// runs it offline with fakes: no microphone, no audio, no network, no real timer. It is loaded only when NEXT_PUBLIC_STUDIO_VOICE_CALL is on (the hook imports it on demand).
// The turn-taking is ELEMENT-3's core (lib/studio/voice: reduceCall, the filler and progress timing, the sentence chunker, the microphone help); the words and the character are lib/studio-voice-call-ui.ts.
//   call button -> openMic (the only place a microphone is asked for) -> idle ("Your turn")
//   hold (button or Space) -> listening -> release -> recording -> router transcribe -> sendTurn (the page's ordinary send, mode "voice") -> thinking
//   Director's frames -> the character's scene (payload.companion_state, else the frame's type); its payload.spoken (a chat_message's line, a progress frame's line, and nothing else) -> router speak, sentence by sentence -> speaking -> idle
//   talking over Director, or Stop -> the speech and the pending turn are cancelled (the core's barge-in)
import {
  canTalk, cleanForSpeech, describeMicError, initialCallState, pickFiller, PROGRESS_AFTER_MS, PROGRESS_EVERY_MS, reduceCall, shouldPlayFiller, splitSentences, worthSending,
  type CallEffect, type CallEvent, type CallState,
} from '@/lib/studio/voice'
import {
  actionsFromFrame, applyDirectorSignal, callControls, closesOpenAction, chipLabel, companionScene, describeSpeechProblem, disarmVoiceTurn, initialDirectorTrack, armVoiceTurn, progressCaption, progressTextFromFrame,
  isProgressSpoken, matchSpokenAnswer, signalFromFrame, spokenLineFromFrame, type CallControls, type CallNotice, type CallPhase, type ChipLabel, type CompanionScene, type DirectorTrack, type SpeechProblem, type VoiceAction,
} from '@/lib/studio-voice-call-ui'
import { VoiceRouterError, type VoiceRouterPort } from '@/lib/studio-voice-call-router'

export interface VoiceRecording {
  /** Stop and return what was heard: the audio, how long, and the loudest the microphone got (0..1). */
  stop(): Promise<{ blob: Blob; durationMs: number; peak: number }>
  cancel(): void
}
export interface VoiceMic {
  record(): VoiceRecording
  /** Release every track: the browser's recording indicator goes out. */
  close(): void
}
export interface VoicePlayer {
  play(audio: Blob, hooks: { onStart(): void; onEnd(): void; onError(): void }): void
  stop(): void
  /** What is coming out now, 0..1 (the mouth). */
  level(): number
}
export interface VoiceCallEnv {
  secureContext(): boolean
  hasMic(): boolean
  /** Rejects with an error whose name is a getUserMedia error name (NotAllowedError ...). */
  openMic(): Promise<VoiceMic>
  createPlayer(): VoicePlayer
  now(): number
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
  reducedMotion(): boolean
  /** The host is the Deckster Mac app (the microphone help names its settings). */
  macApp(): boolean
  mac(): boolean
}

export interface VoiceCallNotice extends CallNotice { kind: 'mic' | 'turn'; /** The notice has a "Try again" that starts the call again. */ retry: boolean }

export interface VoiceCallSnapshot {
  active: boolean
  starting: boolean
  phase: CallPhase
  scene: CompanionScene
  chip: ChipLabel
  /** The celebration dances (a pack with a dance clip shows it). */
  dance: boolean
  /** The line Director is saying, or just said. */
  caption: string | null
  /** What Director is doing, from its frames ("Building the slides"), under the disc while it works. */
  progress: string | null
  notice: VoiceCallNotice | null
  expanded: boolean
  reducedMotion: boolean
  /** The talk button or Space is held. */
  holding: boolean
  controls: CallControls
}

export interface VoiceCallOptions {
  env: VoiceCallEnv
  port: VoiceRouterPort
  /** The page's ordinary send of typed words (handleSendMessage(undefined, text)); the socket hook makes it a voice turn because the controller armed it. */
  sendTurn(text: string): Promise<unknown> | unknown
  /** The page's own click on a button of a card (handleActionClick): a spoken "yes" to the plan is that button's text and value with mode "voice". The card is the Director's action_request message `messageId`. */
  sendAction(action: VoiceAction, messageId: string): Promise<unknown> | unknown
  /** The socket is open (the talk button is off while it is not). */
  isConnected(): boolean
}

/** How long a reply may take with no frame at all before the turn is given up (a build keeps sending frames, so a long build does not hit it). */
export const REPLY_TIMEOUT_MS = 90000
/** The caption of a line stays this long after it was spoken. */
export const CAPTION_HOLD_MS = 8000
/** A progress line that has waited this long for its moment is stale: the Director is on to something else. */
export const PROGRESS_STALE_MS = 20000
const TICK_MS = 250

interface Awaiting {
  turn: number
  text: string | null
  transcribedAt: number | null
  lastActivity: number
  replyTextArrived: boolean
  fillerUsed: boolean
  sendObserved: boolean
}
/** `phased`: the line belongs to the call's turn (the reducer enters "speaking" for it). A filler, and a progress line said while a user turn waits for its reply, do not: the turn is still "thinking". */
interface SpeechItem { text: string; kind: 'reply' | 'filler' | 'progress'; turn: number; phased: boolean; audio: Promise<Blob | null> }

export class VoiceCallController {
  private readonly env: VoiceCallEnv
  private readonly port: VoiceRouterPort
  private readonly sendTurn: VoiceCallOptions['sendTurn']
  private readonly sendAction: VoiceCallOptions['sendAction']
  private readonly isConnected: () => boolean
  private readonly player: VoicePlayer
  private readonly listeners = new Set<() => void>()
  private cs: CallState = initialCallState()
  private track: DirectorTrack = initialDirectorTrack()
  private mic: VoiceMic | null = null
  private recording: VoiceRecording | null = null
  private active = false
  private starting = false
  private holding = false
  private expanded = false
  private notice: VoiceCallNotice | null = null
  private caption: string | null = null
  private captionUntil = 0
  private status: string | null = null
  private awaiting: Awaiting | null = null
  private turnCtl: AbortController | null = null
  private speechCtl: AbortController | null = null
  private queue: SpeechItem[] = []
  private playing: SpeechItem | null = null
  private speakingNow = false
  private audioStartedFor = -1
  private speechOff = false
  private lastFiller: string | null = null
  private readonly fillerCache = new Map<string, Blob>()
  private readonly seen = new Set<string>()
  private tickHandle: unknown = null
  private snapshot: VoiceCallSnapshot
  private disposed = false
  /** Bumped by every start and every end, so a microphone that is granted after the call was ended is released at once. */
  private startToken = 0
  /** Replies Director still owes for turns the user cancelled: the next report for each is not said (it is in the chat). */
  private owedReplies = 0
  /** The turn number of a turn Director opened itself (a report, a progress line), or -1. */
  private pseudoTurn = -1
  /** The newest progress line Director sent (payload.spoken of a status, a phase or a deck event), waiting for a quiet moment. */
  private progressLine: { text: string; at: number } | null = null
  private lastProgressSaidAt = -Infinity
  /** When it last was quiet: the call began, the user spoke, a line was said or a reply arrived. */
  private quietSince = 0
  /** The buttons of the card Director has open (its action_request), until it moves on or the user answers. */
  private openAction: { messageId: string; actions: VoiceAction[] } | null = null

  constructor(options: VoiceCallOptions) {
    this.env = options.env
    this.port = options.port
    this.sendTurn = options.sendTurn
    this.sendAction = options.sendAction
    this.isConnected = options.isConnected
    this.player = this.env.createPlayer()
    this.snapshot = this.build()
  }

  // ---------------------------------------------------------------------------------------------------- reading

  getSnapshot = (): VoiceCallSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** What is coming out of the speaker now (0..1), read by the character every animation frame. It is not in the snapshot: it changes sixty times a second. */
  getLevel = (): number => (this.speakingNow ? this.player.level() : 0)

  private scene(): CompanionScene {
    // A turn of Director's own that has not started to speak yet (its line is being fetched) is not "thinking": nobody asked it anything.
    const phase = this.pseudoTurn === this.cs.turn && this.cs.phase === 'thinking' ? 'idle' : this.cs.phase
    return companionScene({ phase, speakingNow: this.speakingNow, track: this.track, now: this.env.now() })
  }

  private build(): VoiceCallSnapshot {
    const scene = this.scene()
    return {
      active: this.active, starting: this.starting, phase: this.cs.phase, scene, chip: chipLabel(scene), dance: this.track.dance,
      caption: this.caption, progress: progressCaption(this.status, scene), notice: this.notice, expanded: this.expanded, reducedMotion: this.env.reducedMotion(), holding: this.holding,
      controls: callControls({ active: this.active, starting: this.starting, phase: this.cs.phase, speakingNow: this.speakingNow, connected: this.isConnected() }),
    }
  }

  private emit(): void {
    if (this.disposed) return
    const next = this.build()
    const prev = this.snapshot
    const same = (Object.keys(next) as (keyof VoiceCallSnapshot)[]).every(key => key === 'controls' ? JSON.stringify(next.controls) === JSON.stringify(prev.controls) : next[key] === prev[key])
    if (same) return
    this.snapshot = next
    for (const listener of [...this.listeners]) listener()
  }

  // ---------------------------------------------------------------------------------------------------- the call

  /** The call button. The only place a microphone is asked for. */
  async startCall(): Promise<void> {
    if (this.disposed || this.active || this.starting) return
    this.starting = true
    this.notice = null
    const token = ++this.startToken
    this.emit()
    const failure = !this.env.secureContext() ? 'InsecureContext' : !this.env.hasMic() ? 'Unsupported' : null
    if (failure) return this.micFailed(failure)
    try {
      const mic = await this.env.openMic()
      if (this.disposed || token !== this.startToken) { mic.close(); return }
      this.mic = mic
    } catch (error) {
      if (token !== this.startToken) return
      return this.micFailed(typeof error === 'object' && error !== null ? String((error as { name?: unknown }).name ?? '') : '')
    }
    this.cs = initialCallState()
    this.track = initialDirectorTrack()
    this.active = true
    this.starting = false
    this.caption = null
    this.status = null
    this.progressLine = null
    this.openAction = null
    this.quietSince = this.env.now()
    this.armTick()
    this.emit()
  }

  private micFailed(name: string): void {
    const help = describeMicError(name, { macApp: this.env.macApp(), mac: this.env.mac() })
    this.starting = false
    this.notice = { kind: 'mic', title: help.title, steps: help.steps, retry: true }
    this.emit()
  }

  endCall(): void {
    if (this.disposed || (!this.active && !this.starting)) { this.starting = false; return }
    this.startToken++
    this.holding = false
    this.dispatch({ type: 'end' })
    this.active = false
    this.starting = false
    this.caption = null
    this.status = null
    this.awaiting = null
    this.owedReplies = 0
    this.progressLine = null
    this.openAction = null
    this.track = initialDirectorTrack()
    this.emit()
  }

  dispose(): void {
    this.endCall()
    this.disposed = true
    this.clearTick()
    this.listeners.clear()
  }

  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return
    this.expanded = expanded
    this.emit()
  }

  dismissNotice(): void {
    if (!this.notice) return
    this.notice = null
    this.emit()
  }

  // ---------------------------------------------------------------------------------------------------- the user's turn

  /** The talk button (or Space) goes down: listening. Talking over Director cancels what it is saying and the turn that is pending (the core's barge-in). */
  pttDown(): void {
    if (!this.active || this.starting || this.holding || !this.isConnected() || !canTalk(this.cs)) return
    this.notice = this.notice?.kind === 'mic' ? this.notice : null
    this.holding = true
    this.status = null
    this.quietSince = this.env.now()
    this.dispatch({ type: 'talk_start', source: 'ptt' })
    this.emit()
  }

  /** The talk button (or Space) comes up: the recording goes to the router if it is worth sending. */
  async pttUp(): Promise<void> {
    if (!this.holding) return
    this.holding = false
    if (this.cs.phase !== 'listening' || this.cs.source !== 'ptt') { this.emit(); return }
    const recording = this.recording
    this.recording = null
    if (!recording) { this.dispatch({ type: 'talk_end', source: 'ptt', keep: false }); this.emit(); return }
    let heard: { blob: Blob; durationMs: number; peak: number }
    try {
      heard = await recording.stop()
    } catch {
      this.finishRecordingFailed()
      return
    }
    if (this.disposed || !this.active || this.cs.phase !== 'listening') return
    const verdict = worthSending({ durationMs: heard.durationMs, peakLevel: heard.peak })
    if (!verdict.ok) {
      this.dispatch({ type: 'talk_end', source: 'ptt', keep: false })
      this.setTurnNotice(verdict.reason === 'too_short' ? 'too_short' : 'no_words')
      this.emit()
      return
    }
    this.dispatch({ type: 'talk_end', source: 'ptt', keep: true })
    this.beginTurn(this.cs.turn, heard.blob)
    this.emit()
  }

  private finishRecordingFailed(): void {
    this.dispatch({ type: 'talk_end', source: 'ptt', keep: false })
    this.setTurnNotice('failed')
    this.emit()
  }

  /** Stop: what Director is saying, and a turn that is still pending (not the build: that has its own Stop). */
  stop(): void {
    if (!this.active) return
    this.dispatch({ type: 'skip' })
    this.awaiting = null
    this.emit()
  }

  private beginTurn(turn: number, audio: Blob): void {
    const now = this.env.now()
    const ctl = new AbortController()
    this.turnCtl = ctl
    this.awaiting = { turn, text: null, transcribedAt: null, lastActivity: now, replyTextArrived: false, fillerUsed: false, sendObserved: false }
    void this.runTurn(turn, audio, ctl)
  }

  private async runTurn(turn: number, audio: Blob, ctl: AbortController): Promise<void> {
    let text: string
    try {
      text = (await this.port.transcribe(audio, { signal: ctl.signal })).text.trim()
    } catch (error) {
      this.turnFailed(turn, error)
      return
    }
    if (this.awaiting?.turn !== turn) return
    if (!text) { this.failTurn(turn, 'no_words'); return }
    const now = this.env.now()
    this.awaiting.text = text
    this.awaiting.transcribedAt = now
    this.awaiting.lastActivity = now
    this.quietSince = now
    // A card is open and the words are plainly its answer ("yes" to the plan): the card's own button is pressed, as a voice turn. Anything else is a plain voice message.
    const open = this.openAction
    const action = open ? matchSpokenAnswer(text, open.actions) : null
    this.openAction = null
    const words = action ? action.label : text
    this.awaiting.text = words
    armVoiceTurn(words)
    try {
      await (action && open ? this.sendAction(action, open.messageId) : this.sendTurn(text))
    } catch {
      /* the page toasts a failed send itself; below, a turn the socket never saw is told to the user */
    }
    disarmVoiceTurn()
    if (this.awaiting?.turn !== turn) return
    if (!this.awaiting.sendObserved) this.failTurn(turn, 'not_sent')
    this.emit()
  }

  private turnFailed(turn: number, error: unknown): void {
    if (this.awaiting?.turn !== turn) return
    const kind = error instanceof VoiceRouterError ? error.kind : 'failed'
    if (kind === 'aborted') return
    this.failTurn(turn, kind === 'not_connected' ? 'not_connected' : kind === 'limit' ? 'limit' : 'failed')
  }

  private failTurn(turn: number, problem: SpeechProblem): void {
    if (this.awaiting?.turn !== turn) return
    this.awaiting = null
    this.turnCtl?.abort()
    this.turnCtl = null
    this.dispatch({ type: 'turn_failed', turn })
    this.setTurnNotice(problem)
    this.emit()
  }

  private setTurnNotice(problem: SpeechProblem): void {
    const words = describeSpeechProblem(problem)
    this.notice = { kind: 'turn', title: words.title, steps: words.steps, retry: false }
  }

  /** The socket hook says a user_message with mode "voice" with these words went out. */
  onSent = (text: string): void => {
    if (this.awaiting && this.awaiting.text === text) { this.awaiting.sendObserved = true; this.awaiting.lastActivity = this.env.now() }
  }

  // ---------------------------------------------------------------------------------------------------- Director's frames

  onFrame = (frame: unknown): void => {
    if (!this.active || this.disposed) return
    const id = typeof frame === 'object' && frame !== null ? (frame as { message_id?: unknown }).message_id : undefined
    if (typeof id === 'string' && id) {
      if (this.seen.has(id)) return
      this.seen.add(id)
      if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value as string)
    }
    const now = this.env.now()
    if (this.awaiting) this.awaiting.lastActivity = now
    const words = progressTextFromFrame(frame)
    if (words) this.status = words
    const signal = signalFromFrame(frame)
    if (signal) this.track = applyDirectorSignal(this.track, signal, now)
    // What Director was doing is not what it is doing once it is done, stopped or in trouble: its last words are not shown under a new turn.
    if (signal && (signal.kind === 'idle' || signal.kind === 'concerned' || signal.kind === 'paused' || (signal.kind === 'pleased' && signal.big))) this.status = null
    const type = typeof frame === 'object' && frame !== null ? (frame as { type?: unknown }).type : undefined
    // any text of the reply (even a progress bubble) means the Director is already answering: no filler on top of it
    if ((type === 'chat_message' || type === 'action_request') && this.awaiting) this.awaiting.replyTextArrived = true
    // a card with buttons is open until Director moves on; a new turn of Director's closes it
    if (closesOpenAction(frame)) this.openAction = null
    const buttons = actionsFromFrame(frame)
    if (buttons && typeof id === 'string' && id) this.openAction = { messageId: id, actions: buttons }
    if ((type === 'chat_message' && signal?.kind === 'reporting') || (type === 'action_request' && signal?.kind === 'waiting')) this.heardReply(frame)
    else if (isProgressSpoken(frame)) this.heardProgress(spokenLineFromFrame(frame)!)
    this.emit()
  }

  /** A chat_message that is a report (not a progress bubble), or a card: its spoken line, if the Director sent one, is said chunk by chunk, unless the user has the floor. No line, nothing to say: the reply is in the chat. */
  private heardReply(frame: unknown): void {
    const awaiting = this.awaiting
    if (awaiting) awaiting.replyTextArrived = true
    this.quietSince = this.env.now()
    if (this.cs.phase === 'listening') return // the user is talking: the reply is in the chat, and nothing talks over them
    if (!awaiting && this.owedReplies > 0) { this.owedReplies--; return } // the reply to a turn the user cancelled: it is in the chat, it is not said
    const spoken = spokenLineFromFrame(frame)
    const sentences = spoken ? splitSentences(cleanForSpeech(spoken)) : []
    if (spoken && sentences.length) this.showCaption(spoken)
    if (awaiting && (!sentences.length || this.speechOff)) {
      // the turn is answered with nothing to say aloud: it ends here
      this.awaiting = null
      this.dispatch({ type: 'reply_done', turn: this.cs.turn })
      this.dispatch({ type: 'audio_drained', turn: this.cs.turn })
      return
    }
    if (!sentences.length || this.speechOff) return
    const turn = this.openSpeechTurn()
    for (const sentence of sentences) this.enqueue(sentence, 'reply', turn, true)
    this.awaiting = null
    this.dispatch({ type: 'reply_done', turn })
    this.pump()
  }

  /** A spoken progress line on a status_update, a build_phase or a deck-scope build_event. The Director sends one for most progress frames; whether it is worth saying is the client's call (Garud's rules, P4-18 section 5): only the newest waits, and it is said when it has been quiet for 4 s and the last one was at least 6 s ago. */
  private heardProgress(line: string): void {
    this.progressLine = { text: line, at: this.env.now() }
  }

  private sayProgress(line: string): void {
    const sentences = splitSentences(cleanForSpeech(line))
    if (!sentences.length) return
    this.lastProgressSaidAt = this.env.now()
    if (this.awaiting) {
      // a user turn waits for its reply: the line is said, and the turn stays "thinking"
      for (const sentence of sentences) this.enqueue(sentence, 'progress', this.cs.turn, false)
    } else {
      const turn = this.openSpeechTurn()
      for (const sentence of sentences) this.enqueue(sentence, 'progress', turn, true)
      this.dispatch({ type: 'reply_done', turn })
    }
    this.pump()
  }

  /** The turn a line of Director's own belongs to: the one in progress, or, when nothing is, a turn of its own (the reducer has no entry for speech that was not asked for, so Stop and talking over it work like any other). */
  private openSpeechTurn(): number {
    if (this.awaiting || this.cs.phase === 'thinking' || this.cs.phase === 'speaking') return this.cs.turn
    const turn = this.cs.turn + 1
    this.cs = { ...this.cs, phase: 'thinking', turn, replyDone: false, playing: false, source: null }
    this.pseudoTurn = turn
    return turn
  }

  private showCaption(text: string): void {
    this.caption = text
    this.captionUntil = this.env.now() + CAPTION_HOLD_MS
  }

  // ---------------------------------------------------------------------------------------------------- speech out

  private enqueue(text: string, kind: SpeechItem['kind'], turn: number, phased: boolean): void {
    const cached = kind === 'filler' ? this.fillerCache.get(text) : undefined
    const ctl = (this.speechCtl ??= new AbortController())
    const audio = cached ? Promise.resolve<Blob | null>(cached) : this.port.speak(text, { signal: ctl.signal }).then(blob => {
      if (kind === 'filler') this.fillerCache.set(text, blob)
      return blob
    }, (error: unknown) => {
      if (error instanceof VoiceRouterError && error.kind === 'aborted') return null
      if (!this.speechOff) {
        this.speechOff = true
        this.notice = { kind: 'turn', ...describeSpeechProblem(error instanceof VoiceRouterError && error.kind === 'limit' ? 'limit' : 'not_connected'), retry: false }
        this.emit()
      }
      return null
    })
    this.queue.push({ text, kind, turn, phased, audio })
  }

  private pump(): void {
    if (this.playing || !this.queue.length || !this.active) { this.afterSpeech(); return }
    const item = this.queue.shift()!
    this.playing = item
    void item.audio.then(blob => {
      if (this.playing !== item || !this.active) return
      if (!blob) { this.playing = null; this.pump(); return }
      this.player.play(blob, {
        onStart: () => {
          if (this.playing !== item) return
          this.speakingNow = true
          if (item.kind !== 'filler') this.showCaption(item.text)
          if (item.phased && this.audioStartedFor !== item.turn) {
            this.audioStartedFor = item.turn
            this.dispatch({ type: 'audio_started', turn: item.turn })
          }
          this.emit()
        },
        onEnd: () => { this.spoken(item) },
        onError: () => { this.spoken(item) },
      })
    })
  }

  private spoken(item: SpeechItem): void {
    if (this.playing !== item) return
    this.playing = null
    this.speakingNow = false
    this.quietSince = this.env.now()
    this.captionUntil = this.env.now() + CAPTION_HOLD_MS
    this.pump()
    this.emit()
  }

  /** Nothing left to play: the reply's last sentence is done, so the turn is too. */
  private afterSpeech(): void {
    if (this.playing || this.queue.length) return
    if (this.cs.replyDone && (this.cs.phase === 'speaking' || this.cs.phase === 'thinking')) { this.dispatch({ type: 'audio_drained', turn: this.cs.turn }); this.emit() }
  }

  private stopSpeech(): void {
    this.speechCtl?.abort()
    this.speechCtl = null
    this.queue = []
    this.playing = null
    this.speakingNow = false
    this.player.stop()
  }

  // ---------------------------------------------------------------------------------------------------- the machine

  private dispatch(event: CallEvent): void {
    const step = reduceCall(this.cs, event)
    this.cs = step.state
    for (const effect of step.effects) this.run(effect)
  }

  private run(effect: CallEffect): void {
    switch (effect.type) {
      case 'start_recording':
        this.recording = this.mic ? this.mic.record() : null
        break
      case 'discard_recording':
        this.recording?.cancel()
        this.recording = null
        break
      case 'cancel_speech':
        this.stopSpeech()
        break
      case 'cancel_turn':
        if (this.awaiting && this.awaiting.sendObserved && !this.awaiting.replyTextArrived) this.owedReplies++
        this.turnCtl?.abort()
        this.turnCtl = null
        this.awaiting = null
        disarmVoiceTurn()
        break
      case 'teardown':
        this.stopSpeech()
        this.recording?.cancel()
        this.recording = null
        this.mic?.close()
        this.mic = null
        this.clearTick()
        break
      case 'send_recording':
        break // pttUp holds the audio and sends it (beginTurn)
    }
  }

  // ---------------------------------------------------------------------------------------------------- time

  private armTick(): void {
    if (this.tickHandle !== null || this.disposed) return
    this.tickHandle = this.env.setTimer(() => { this.tickHandle = null; this.tick(); if (this.active) this.armTick() }, TICK_MS)
  }

  private clearTick(): void {
    if (this.tickHandle !== null) this.env.clearTimer(this.tickHandle)
    this.tickHandle = null
  }

  /** Beats end, captions clear, the filler and the progress line are said, a turn with no answer is given up. */
  tick(): void {
    if (!this.active || this.disposed) return
    const now = this.env.now()
    if (this.caption && !this.speakingNow && !this.playing && now >= this.captionUntil) this.caption = null
    const awaiting = this.awaiting
    if (awaiting && awaiting.transcribedAt !== null && this.cs.phase === 'thinking') {
      if (now - awaiting.lastActivity > REPLY_TIMEOUT_MS) { this.failTurn(awaiting.turn, 'no_answer'); return }
      const filler = shouldPlayFiller({ elapsedMs: now - awaiting.transcribedAt, replyTextArrived: awaiting.replyTextArrived, audioStarted: this.speakingNow, alreadyUsed: awaiting.fillerUsed, reducedMotion: this.env.reducedMotion(), speechOff: this.speechOff })
      if (filler.play) {
        awaiting.fillerUsed = true
        const phrase = pickFiller('calm', { turn: awaiting.turn, last: this.lastFiller, isCached: p => this.fillerCache.has(p) })
        this.lastFiller = phrase
        this.enqueue(phrase, 'filler', awaiting.turn, false)
        this.pump()
      }
    }
    const progress = this.progressLine
    if (progress) {
      const busy = this.speakingNow || !!this.playing || this.queue.length > 0
      if (now - progress.at > PROGRESS_STALE_MS || this.speechOff) this.progressLine = null
      else if (!busy && this.cs.phase !== 'listening' && now - this.quietSince >= PROGRESS_AFTER_MS && now - this.lastProgressSaidAt >= PROGRESS_EVERY_MS) {
        this.progressLine = null
        this.sayProgress(progress.text)
      }
    }
    this.emit()
  }
}
