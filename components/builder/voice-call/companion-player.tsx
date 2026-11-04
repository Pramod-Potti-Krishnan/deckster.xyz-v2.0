"use client"

import React, { useEffect, useRef, useState } from 'react'
import type { BirdMotionManifest } from '@/lib/studio/voice/bird-motion'
import {
  BLINK_EVERY_MS, clipsForScene, framedWidth, framingRect, initialsFor, loadCompanionPack, mouthShapeIndex, nextDelayMs, planPoseAt, portraitUrl, scenePlan, stepFrameIndex, stillFrameIndex, clipDurationSec,
  type ClipLike, type CompanionScene, type FramingRect,
} from '@/lib/studio-voice-call-ui'
import { createLayeredPainter, parsedLayeredFace } from './layered-face'

/**
 * The companion: one pack from public/companions/<name>/ in the bird layout (motion/manifest.json, and a Face pack beside it for the small disc), drawn on a canvas from the call's scene.
 * The pack is read once, its frames are fetched on demand (a clip when a scene first needs it) and decoded at the size they are drawn, so a disc costs a few megabytes, not a pack's worth.
 * The scene -> clip table is lib/studio-voice-call-ui.ts (Garud's); a clip a pack does not have falls back through the core's resolveCompanionClip (lean_in -> head_tilt ...).
 * A pack with a layered (v2) face (Maya) is parsed through its compatibility view (the catalog without its `face` section, lib: compatCatalog) for its body poses and clips, and its face is drawn over the held body by
 * the v2 painter `layeredPainterFor` returns (below); if the face section does not parse, she stays in the compatibility view (body frames only). A pack that is missing, or does not pass the core's manifest check, shows its portrait (a level ring around it speaks for the voice) and, with no portrait either,
 * a plain disc with initials. Reduced motion draws one still per scene and runs no animation loop.
 */
export interface CompanionPlayerProps {
  pack: string
  scene: CompanionScene
  /** The scene is a celebration that dances. */
  dance: boolean
  framing: 'disc' | 'chest'
  /** CSS pixels: the disc's width and height, or the chest view's height. */
  size: number
  reducedMotion: boolean
  /** What is coming out of the speaker now (0..1), read every animation frame. */
  getLevel: () => number
}

export interface LoadedPack {
  manifest: BirdMotionManifest; base: string; resolve: (name: string) => string
  /** The pack's layered (v2) face section, whole and unread (Garud's locked `face` contract), or null for a v1 pack. Drawn by the v2 painter (layeredPainterFor) when it parses. */
  layered: Record<string, unknown> | null
}
const packs = new Map<string, Promise<LoadedPack | null>>()

/** What a layered face's painter is given after the body frame is drawn: the canvas, the frame just drawn and where it sits, the scene, the speaker's level and the scene's clock. */
export interface LayerPaintInput {
  context: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  pack: LoadedPack
  /** The body frame's id and its decoded bitmap, drawn from `rect` (frame pixels) over the whole canvas. */
  frame: string
  bitmap: ImageBitmap
  rect: FramingRect
  scene: CompanionScene
  /** 0..1, what is coming out of the speaker now. */
  level: number
  /** Seconds since the scene began. */
  timeSec: number
  /** Reduced motion: the face holds (closed mouth, no blink, no breath). */
  reduced?: boolean
}
export type LayerPainter = (input: LayerPaintInput) => void
/**
 * THE SEAM FOR THE V2 PLAYER (Garud's layered face: the body holds while the mouth, eye and brow patches change). Given a pack, return the painter that draws its patches over the body frame, or null.
 * A pack with a layered face section that Garud's locked contract accepts (lib/studio/voice-v2 parseCompanionFace, against the catalog's own body frames) gets the painter in ./layered-face (Garud's compositor: the
 * mouth from the speaker's level, Garud's loudness fallback since the call has no viseme timeline; the player's own blink on the eye patch and breathing as a slow transform; the thinking, pleased, concerned and
 * sorry recipes from the scene). A v1 pack, or a section that does not parse, gets null: the compatibility view, which draws the body frames only. When a painter is returned the loop repaints on every animation
 * frame, calling it right after the body is drawn. One painter per loaded pack (its pieces are fetched once).
 */
const painters = new WeakMap<object, LayerPainter | null>()
export function layeredPainterFor(pack: Pick<LoadedPack, 'layered' | 'manifest' | 'base'>): LayerPainter | null {
  if (!pack.layered) return null
  if (painters.has(pack)) return painters.get(pack)!
  const face = parsedLayeredFace(pack)
  const painter: LayerPainter | null = face ? createLayeredPainter(pack, face) : null
  painters.set(pack, painter)
  return painter
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.json()
}

/** The pack's manifest (the Face pack for the disc when the pack has one and it loads), parsed by the core through the compatibility view (lib: loadCompanionPack). null when there is no pack here or it is refused. */
function loadPack(pack: string, framing: 'disc' | 'chest'): Promise<LoadedPack | null> {
  const key = `${pack}:${framing}`
  let found = packs.get(key)
  if (!found) {
    found = (async () => {
      try {
        const core = await import('@/lib/studio/voice/bird-motion')
        const catalog = await loadCompanionPack(pack, framing, fetchJson, core.parseBirdMotionManifest)
        if (!catalog) return null
        const { manifest } = catalog
        const cache = new Map<string, string>()
        return { manifest, base: catalog.base, layered: catalog.layered, resolve: (name: string) => { let hit = cache.get(name); if (!hit) { hit = core.resolveCompanionClip(manifest, name); cache.set(name, hit) } return hit } }
      } catch {
        return null
      }
    })()
    packs.set(key, found)
  }
  return found
}

/** Frames of one pack at the size they are drawn. Decoding is lazy and bounded: a clip's frames are fetched when a scene first asks for the clip. */
class FrameStore {
  private readonly bitmaps = new Map<string, ImageBitmap>()
  private readonly pending = new Set<string>()
  private readonly failed = new Set<string>()
  private disposed = false
  onLoad: (() => void) | null = null
  constructor(private readonly pack: LoadedPack, private readonly scale: number) {}
  has(id: string): boolean { return this.bitmaps.has(id) }
  get(id: string): ImageBitmap | undefined { return this.bitmaps.get(id) }
  ensureClip(name: string): void {
    const clip = this.pack.manifest.clips[this.pack.resolve(name)]
    if (clip) for (const id of clip.frames) this.ensure(id)
  }
  ensure(id: string): void {
    const frame = this.pack.manifest.frames[id]
    if (!frame || this.disposed || this.bitmaps.has(id) || this.pending.has(id) || this.failed.has(id)) return
    this.pending.add(id)
    const { size } = this.pack.manifest
    void fetch(`${this.pack.base}${frame.src}`, { credentials: 'same-origin' }).then(response => response.blob()).then(blob => {
      const width = Math.max(32, Math.round(size.width * this.scale)), height = Math.max(32, Math.round(size.height * this.scale))
      return createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'medium' }).catch(() => createImageBitmap(blob))
    }).then(bitmap => {
      this.pending.delete(id)
      if (this.disposed) { bitmap.close(); return }
      this.bitmaps.set(id, bitmap)
      this.onLoad?.()
    }, () => { this.pending.delete(id); this.failed.add(id) })
  }
  dispose(): void {
    this.disposed = true
    for (const bitmap of this.bitmaps.values()) bitmap.close()
    this.bitmaps.clear()
    this.onLoad = null
  }
}

export function CompanionPlayer({ pack, scene, dance, framing, size, reducedMotion, getLevel }: CompanionPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [loaded, setLoaded] = useState<LoadedPack | null | undefined>(undefined)
  const [drawn, setDrawn] = useState(false)
  const [noPortrait, setNoPortrait] = useState<string | null>(null) // the pack whose portrait could not be shown
  const live = useRef({ scene, dance, reducedMotion, getLevel })
  live.current = { scene, dance, reducedMotion, getLevel }
  const rect: FramingRect | null = loaded ? framingRect(loaded.manifest, framing) : null
  const width = framedWidth(framing, size, rect)

  useEffect(() => {
    let cancelled = false
    setLoaded(undefined)
    setDrawn(false)
    void loadPack(pack, framing).then(result => { if (!cancelled) setLoaded(result) })
    return () => { cancelled = true }
  }, [pack, framing])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!loaded || !canvas || !rect) return
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(size * dpr))
    const context = canvas.getContext('2d')
    if (!context) return
    const store = new FrameStore(loaded, Math.min(1, (canvas.width * 1.25) / rect.sw))
    const painter = layeredPainterFor(loaded) // null: the compatibility view (the body frames only)
    if (rootRef.current) rootRef.current.dataset.companionFace = painter ? 'layered' : loaded.layered ? 'compat' : 'v1'
    const clipOf = (name: string): ClipLike => loaded.manifest.clips[loaded.resolve(name)] ?? loaded.manifest.clips.idle_breathe!
    const clipName = (name: string) => loaded.resolve(name)
    let raf = 0
    let currentScene = live.current.scene
    let sceneStart = performance.now()
    let overlay: { clip: string; reverse: boolean; start: number } | null = null
    let nextAccent: number | null = null
    let nextBlink: number | null = null
    let shownId: string | null = null
    let shownClip = ''
    let stopped = false
    const ask = (name: CompanionScene) => { for (const clip of clipsForScene(name)) store.ensureClip(clip); store.ensureClip('idle_breathe') }
    ask(currentScene)
    const draw = (id: string): boolean => {
      const bitmap = store.get(id) ?? store.get(loaded.manifest.neutral)
      if (!bitmap) return false
      const k = bitmap.width / loaded.manifest.size.width
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, rect.sx * k, rect.sy * k, rect.sw * k, rect.sh * k, 0, 0, canvas.width, canvas.height)
      shownId = id
      painter?.({ context, canvas, pack: loaded, frame: store.has(id) ? id : loaded.manifest.neutral, bitmap, rect, scene: currentScene, level: live.current.getLevel(), timeSec: (performance.now() - sceneStart) / 1000, reduced: live.current.reducedMotion })
      return true
    }
    const pick = (now: number): { id: string; clip: string } => {
      const { scene: wanted, dance: dancing, reducedMotion: reduced } = live.current
      if (wanted !== currentScene) {
        currentScene = wanted; sceneStart = now; overlay = null; nextAccent = null; nextBlink = null
        ask(wanted)
      }
      const plan = scenePlan(currentScene, { dance: dancing })
      if (reduced) {
        const still = clipOf(plan.still.clip)
        return { id: still.frames[stillFrameIndex(plan, still)]!, clip: clipName(plan.still.clip) }
      }
      if (overlay) {
        const clip = clipOf(overlay.clip), elapsed = (now - overlay.start) / 1000
        if (elapsed < clipDurationSec(clip)) {
          const index = stepFrameIndex(clip, 'once', elapsed)
          return { id: clip.frames[overlay.reverse ? clip.frames.length - 1 - index : index]!, clip: clipName(overlay.clip) }
        }
        overlay = null
      }
      const pose = planPoseAt(plan, clipOf, (now - sceneStart) / 1000)
      const clip = clipOf(pose.clip)
      if (pose.mode === 'talk') {
        // an emphasis now and then while it speaks (the mouth is still for the moment it takes)
        if (plan.accent) {
          if (nextAccent === null) nextAccent = now + nextDelayMs(plan.accent.everyMs, Math.random())
          else if (now >= nextAccent) { overlay = { clip: plan.accent.clip, reverse: plan.accent.reverse, start: now }; nextAccent = now + nextDelayMs(plan.accent.everyMs, Math.random()) }
        }
        const index = mouthShapeIndex(live.current.getLevel(), (now - sceneStart) / 1000, clip.fps)
        return { id: clip.frames[Math.min(index, clip.frames.length - 1)]!, clip: clipName(pose.clip) }
      }
      if (pose.resting) {
        if (plan.accent) {
          if (nextAccent === null) nextAccent = now + nextDelayMs(plan.accent.everyMs, Math.random())
          else if (now >= nextAccent) { overlay = { clip: plan.accent.clip, reverse: plan.accent.reverse, start: now }; nextAccent = now + nextDelayMs(plan.accent.everyMs, Math.random()) }
        }
        if (plan.blink) {
          if (nextBlink === null) nextBlink = now + nextDelayMs(BLINK_EVERY_MS, Math.random())
          else if (now >= nextBlink && !overlay) { overlay = { clip: 'blink', reverse: false, start: now }; nextBlink = now + nextDelayMs(BLINK_EVERY_MS, Math.random()) }
        }
      }
      return { id: clip.frames[pose.index] ?? loaded.manifest.neutral, clip: clipName(pose.clip) }
    }
    const paint = (now: number) => {
      const next = pick(now)
      if (next.id !== shownId || !store.has(next.id) || painter) {
        if (store.has(next.id) ? draw(next.id) : (shownId === null ? draw(loaded.manifest.neutral) : false)) {
          setDrawn(true)
        }
      }
      if (rootRef.current && next.clip !== shownClip) { shownClip = next.clip; rootRef.current.dataset.companionClip = next.clip }
    }
    const loop = (now: number) => {
      if (stopped) return
      if (!document.hidden) paint(now)
      raf = requestAnimationFrame(loop)
    }
    store.onLoad = () => { if (live.current.reducedMotion) paint(performance.now()) }
    store.ensure(loaded.manifest.neutral)
    if (live.current.reducedMotion) paint(performance.now())
    else raf = requestAnimationFrame(loop)
    // A scene change in reduced motion paints its still at once (there is no loop to notice it).
    const watch = live.current.reducedMotion ? window.setInterval(() => paint(performance.now()), 200) : 0
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      if (watch) window.clearInterval(watch)
      store.dispose()
    }
  }, [loaded, framing, size, width, reducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps

  const ready = !!loaded && drawn
  // No usable catalog (missing, or refused by the parser): the portrait, still; the level ring around it (the stage's own in the audio call, the portrait's own in the video call) is what shows the voice. Its own failure: the initials.
  const portrait = loaded === null && noPortrait !== pack
  return (
    <div
      ref={rootRef}
      className="studio-voice-companion"
      data-studio-voice-companion={loaded === null ? 'fallback' : ready ? 'pack' : 'loading'}
      data-companion-art={loaded === null ? (portrait ? 'portrait' : 'initials') : undefined}
      data-companion-scene={scene}
      data-companion-pack={pack}
      data-companion-framing={framing}
      data-companion-reduced={reducedMotion ? 'true' : undefined}
      style={{ width, height: size }}
      role="img"
      aria-label={`${pack} the companion`}
    >
      {loaded ? <canvas ref={canvasRef} style={{ width, height: size, opacity: ready ? 1 : 0 }} aria-hidden /> : null}
      {portrait ? <img className="studio-voice-portrait" src={portraitUrl(pack)} alt="" draggable={false} onError={() => setNoPortrait(pack)} /> : null}
      {!ready && !portrait ? <span className="studio-voice-initials" aria-hidden>{initialsFor(pack)}</span> : null}
    </div>
  )
}
