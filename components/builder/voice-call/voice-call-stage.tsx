"use client"

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, Mic, MicOff, PhoneOff, Repeat, Square, X } from 'lucide-react'
import { CompanionPlayer } from './companion-player'
import './voice-call.css'
import type { VoiceCallSnapshot } from '@/lib/studio-voice-call-controller'
import {
  AUDIO_DISC_PX, AUDIO_DISC_PX_PHONE, DEFAULT_SCENE_FILE, MUTED_HINT, MUTE_LABEL, TALK_HINT, TALK_LATCHED_HINT, TRANSCRIPT_EMPTY, TRANSCRIPT_HIDE_LABEL, TRANSCRIPT_SHOW_LABEL, TRANSCRIPT_TITLE, UNMUTE_LABEL,
  VOICE_PHONE_MEDIA, companionName, nextCompanion, ringLevel, sceneFileFrom, sceneUrl, talkLabel, videoCharacterPx,
} from '@/lib/studio-voice-call-ui'

export interface VoiceCallStageProps {
  snapshot: VoiceCallSnapshot
  /** The pack's folder under public/companions/. */
  pack: string
  /** The characters on offer (a switch is shown when there is more than one, with a dot for each when there are three or more); one tap on it goes to the next, round the list. */
  choices: readonly string[]
  onChooseCompanion: () => void
  getLevel: () => number
  /** The talk button goes down / comes up (hold to talk, or tap to latch and tap again to send). */
  onTalkPress: () => void
  onTalkRelease: () => void
  onStop: () => void
  onMute: (muted: boolean) => void
  onEnd: () => void
  onRetry: () => void
  onDismissNotice: () => void
}

function usePhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(VOICE_PHONE_MEDIA).matches) // right from the first render: on a phone the stage is moved under the shell, and that must not remount it
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(VOICE_PHONE_MEDIA)
    const sync = () => setPhone(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return phone
}

/** On a phone the call is the whole screen, above the shell's own chrome (the tab bar, the logo, the Slides | Director switch): inside the chat column it would sit under them (a stacking context), so it is drawn as a child of the shell itself. */
function shellRoot(): Element | null {
  return typeof document === 'undefined' ? null : document.querySelector('[data-studio-v4-shell="true"]')
}

/** The pack's optional scene image (the character's setting): `scene` in its manifest names a file in the pack's folder, else scene.webp. null when the pack has none (a token gradient is drawn instead). Asked once per pack. */
const sceneArt = new Map<string, Promise<string | null>>()
function loadSceneArt(pack: string): Promise<string | null> {
  let found = sceneArt.get(pack)
  if (!found) {
    found = (async () => {
      let file = DEFAULT_SCENE_FILE
      try {
        const response = await fetch(`/companions/${pack}/motion/manifest.json`, { credentials: 'same-origin' })
        if (response.ok) file = sceneFileFrom(((await response.json()) as { scene?: unknown } | null)?.scene)
      } catch { /* the default file is tried */ }
      const url = sceneUrl(pack, file)
      return new Promise<string | null>(resolve => {
        try {
          const image = new Image()
          image.onload = () => resolve(url)
          image.onerror = () => resolve(null)
          image.src = url
        } catch { resolve(null) }
      })
    })().catch(() => null)
    sceneArt.set(pack, found)
  }
  return found
}
function useSceneArt(pack: string, wanted: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    void loadSceneArt(pack).then(found => { if (!cancelled) setUrl(found) })
    return () => { cancelled = true }
  }, [pack, wanted])
  return wanted ? url : null
}

/** The level ring and the character's breathing read the microphone while you talk and the speaker while it does: one animation loop sets a CSS variable on the element, never React state. */
function useLevelVariable(ref: React.RefObject<HTMLElement | null>, getLevel: () => number, running: boolean) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (!running) { element.style.setProperty('--voice-level', '0'); return }
    let raf = 0
    const tick = () => {
      element.style.setProperty('--voice-level', String(ringLevel(getLevel())))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); element.style.setProperty('--voice-level', '0') }
  }, [ref, getLevel, running])
}

/**
 * The call (NEXT_PUBLIC_STUDIO_VOICE_CALL). While it is on, this fills the chat column (the whole screen on a phone) and the composer is not drawn: you are only talking.
 * VIDEO: the character's scene is the canvas (the pack's scene image when it has one, else a token gradient) with the character large in it. AUDIO: a calm scene with the face, large and centred, in a level ring.
 * Either way the overlays are the same: the state chip, Stop / Mute / End, the talk button, and the live transcript in the bottom fifth (scrollable, can be hidden, shown by default). Presentation only: it holds no call state.
 * Without a call (the microphone was refused, or a start failed) it is just the plain-words notice, docked above the composer.
 */
export function VoiceCallStage({ snapshot, pack, choices, onChooseCompanion, getLevel, onTalkPress, onTalkRelease, onStop, onMute, onEnd, onRetry, onDismissNotice }: VoiceCallStageProps) {
  const { controls, notice, mode, muted } = snapshot
  const live = snapshot.active || snapshot.starting
  const phone = usePhone()
  const rootRef = useRef<HTMLElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const art = useSceneArt(pack, live && mode === 'video')
  useLevelVariable(ringRef, getLevel, live && !snapshot.reducedMotion && (snapshot.holding || snapshot.scene === 'speaking'))

  useEffect(() => {
    const element = rootRef.current
    if (!element || !live) return
    const read = () => setHeight(element.clientHeight)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(read)
    watch.observe(element)
    return () => watch.disconnect()
  }, [live])

  const noticeBlock = notice ? (
    <div className="studio-voice-notice" role="alert" data-studio-voice-notice={notice.kind}>
      <div>
        <strong>{notice.title}</strong>
        <ol>{notice.steps.map(step => <li key={step}>{step}</li>)}</ol>
      </div>
      <div className="studio-voice-notice-actions">
        {notice.retry ? <button type="button" onClick={onRetry}>Try again</button> : null}
        <button type="button" onClick={onDismissNotice} aria-label="Dismiss"><X aria-hidden className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  ) : null

  // No call: only the words about what went wrong (the microphone was refused ...), above the composer, which is back.
  if (!live) return noticeBlock ? <section className="studio-voice-bar" data-studio-voice-call="notice" aria-label="Voice call">{noticeBlock}</section> : null

  const name = companionName(pack)
  const status = snapshot.starting ? 'Waiting for your microphone…' : muted ? MUTED_HINT : snapshot.progress ?? (snapshot.latched ? TALK_LATCHED_HINT : snapshot.holding || snapshot.transcript.length ? null : TALK_HINT)
  const subtitle = collapsed && !snapshot.starting ? snapshot.caption : null
  const discPx = phone ? AUDIO_DISC_PX_PHONE : AUDIO_DISC_PX
  const portalTo = phone ? shellRoot() : null
  const body = (
    <section
      ref={rootRef}
      className="studio-voice-stage"
      data-studio-voice-call="stage"
      data-voice-mode={mode}
      data-voice-scene={snapshot.scene}
      data-voice-chip={snapshot.chip}
      data-voice-phone={phone ? 'true' : 'false'}
      data-voice-art={art ? 'image' : 'gradient'}
      data-voice-transcript={collapsed ? 'collapsed' : 'open'}
      data-voice-muted={muted ? 'true' : 'false'}
      data-voice-active={snapshot.active ? 'true' : 'false'}
      aria-label={mode === 'video' ? 'Video call' : 'Audio call'}
      style={art ? ({ '--voice-scene-art': `url("${art}")` } as React.CSSProperties) : undefined}
    >
      <div className="studio-voice-canvas">
        <div className="studio-voice-top">
          <span className="studio-voice-chip" data-chip={snapshot.chip} role="status"><i aria-hidden />{snapshot.chip}</span>
          <div className="studio-voice-tools">
            {choices.length > 1 ? (
              <button type="button" className="studio-voice-pack" data-studio-voice-character={pack} onClick={onChooseCompanion} aria-label={`Character: ${name}. Switch to ${companionName(nextCompanion(pack, choices))}`} title={`Switch to ${companionName(nextCompanion(pack, choices))}`}>
                <Repeat aria-hidden className="h-3.5 w-3.5" />{name}
                {choices.length > 2 ? <span className="studio-voice-pack-dots" aria-hidden>{choices.map(choice => <i key={choice} data-choice={choice} data-on={choice === pack ? 'true' : 'false'} />)}</span> : null}
              </button>
            ) : null}
            <button type="button" className="studio-voice-icon" disabled={!controls.stop} onClick={onStop} aria-label="Stop" title="Stop">
              <Square aria-hidden className="h-3.5 w-3.5 fill-current" />
            </button>
            <button type="button" className="studio-voice-icon" data-studio-voice-mute="true" disabled={!controls.mute} onClick={() => onMute(!muted)} aria-label={muted ? UNMUTE_LABEL : MUTE_LABEL} aria-pressed={muted} title={muted ? UNMUTE_LABEL : MUTE_LABEL}>
              {muted ? <MicOff aria-hidden className="h-4 w-4" /> : <Mic aria-hidden className="h-4 w-4" />}
            </button>
            <button type="button" className="studio-voice-icon studio-voice-end" disabled={!controls.end} onClick={onEnd} aria-label="End call" title="End call">
              <PhoneOff aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </div>
        {noticeBlock}
        <div className="studio-voice-figure">
          {mode === 'video' ? (
            <div ref={ringRef} className="studio-voice-actor" data-ring={snapshot.scene}>
              <CompanionPlayer pack={pack} scene={snapshot.scene} dance={snapshot.dance} framing="chest" size={videoCharacterPx(height)} reducedMotion={snapshot.reducedMotion} getLevel={getLevel} />
            </div>
          ) : (
            <div ref={ringRef} className="studio-voice-halo" data-ring={snapshot.scene}>
              <i className="studio-voice-ring" aria-hidden />
              <div className="studio-voice-disc">
                <CompanionPlayer pack={pack} scene={snapshot.scene} dance={snapshot.dance} framing="disc" size={discPx} reducedMotion={snapshot.reducedMotion} getLevel={getLevel} />
              </div>
            </div>
          )}
        </div>
        <div className="studio-voice-lines">
          {subtitle ? <p className="studio-voice-caption" data-studio-voice-caption="line" aria-live="off">{subtitle}</p> : null}
          {status ? <p className={snapshot.progress && !muted && !snapshot.starting ? 'studio-voice-progress' : 'studio-voice-hint'} data-studio-voice-status={snapshot.progress && !muted && !snapshot.starting ? 'progress' : 'hint'}>{status}</p> : null}
        </div>
        <div className="studio-voice-talk-row">
          <button
            type="button"
            className="studio-voice-talk"
            data-holding={snapshot.holding ? 'true' : 'false'}
            data-latched={snapshot.latched ? 'true' : 'false'}
            disabled={!controls.talk}
            aria-pressed={snapshot.holding}
            aria-label="Hold to talk"
            title={TALK_HINT}
            onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); onTalkPress() }}
            onPointerUp={event => { event.currentTarget.releasePointerCapture?.(event.pointerId); onTalkRelease() }}
            onPointerCancel={onTalkRelease}
            onContextMenu={event => event.preventDefault()}
            onKeyDown={event => { if (event.key === ' ') event.preventDefault() }}
          >
            {muted ? <MicOff aria-hidden className="h-5 w-5" /> : <Mic aria-hidden className="h-5 w-5" />}
            <span>{talkLabel({ holding: snapshot.holding, latched: snapshot.latched, muted })}</span>
          </button>
        </div>
      </div>
      <Transcript snapshot={snapshot} name={name} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
    </section>
  )
  return portalTo ? createPortal(body, portalTo) : body
}

/** The live transcript: the bottom fifth of the call, newest line last, kept scrolled to the newest unless you have scrolled up to read; hide it with its toggle. */
function Transcript({ snapshot, name, collapsed, onToggle }: { snapshot: VoiceCallSnapshot; name: string; collapsed: boolean; onToggle: () => void }) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const stuck = useRef(true)
  const { transcript } = snapshot
  useEffect(() => {
    const list = listRef.current
    if (list && stuck.current) list.scrollTop = list.scrollHeight
  }, [transcript, collapsed])
  return (
    <div className="studio-voice-transcript" data-studio-voice-transcript={collapsed ? 'collapsed' : 'open'}>
      <div className="studio-voice-transcript-head">
        <span>{TRANSCRIPT_TITLE}</span>
        <button type="button" className="studio-voice-icon studio-voice-small" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? TRANSCRIPT_SHOW_LABEL : TRANSCRIPT_HIDE_LABEL} title={collapsed ? TRANSCRIPT_SHOW_LABEL : TRANSCRIPT_HIDE_LABEL}>
          {collapsed ? <ChevronUp aria-hidden className="h-4 w-4" /> : <ChevronDown aria-hidden className="h-4 w-4" />}
        </button>
      </div>
      {collapsed ? null : (
        <div
          ref={listRef}
          className="studio-voice-transcript-list"
          role="log"
          aria-label="Call transcript"
          aria-live="polite"
          tabIndex={0}
          onScroll={event => { const list = event.currentTarget; stuck.current = list.scrollHeight - list.scrollTop - list.clientHeight < 24 }}
        >
          {transcript.length === 0 ? <p className="studio-voice-transcript-empty">{TRANSCRIPT_EMPTY}</p> : transcript.map(entry => (
            <p key={entry.id} className="studio-voice-line" data-who={entry.who}>
              <b>{entry.who === 'you' ? 'You' : name}</b>
              <span>{entry.text}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
