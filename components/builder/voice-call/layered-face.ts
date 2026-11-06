/**
 * Maya's layered (v2) face in the call player: the painter `layeredPainterFor` returns. The decisions are Garud's pure compositor and speech sampler
 * (lib/studio/voice-v2, ported from Garud feature/companion-v2-player b3a812e); the drawing follows Garud's CompanionFaceCanvas (b3a812e,
 * apps/web/components/call/CompanionFaceCanvas.ts): per kind, the weighted patches on a transparent scratch, a feathered edge mask, then the patch
 * through the head transform. Differences from Garud's player: the body frame is the call player's (its scene clips, accents and crossfade-free steps),
 * so Garud's gesture crossfade, timeline gestures and held-body filter are not used here; the pieces are fetched with createImageBitmap, not the decode-budgeted loader.
 */
import { callMouth, CALL_MOUTH_REST, composeCompanionFace, parseCompanionFace, sceneExpression, type CallMouthMemory, type CompanionFace, type CompanionFaceLayer, type BirdMotionManifest as LayeredManifest } from '@/lib/studio/voice-v2'
import type { BirdMotionManifest } from '@/lib/studio/voice/bird-motion'
import { framingPlan, type CompanionFraming } from '@/lib/studio-voice-call-ui'

export interface LayeredPack { manifest: BirdMotionManifest; base: string; layered: Record<string, unknown> | null }
export interface LayeredPaintInput {
  context: CanvasRenderingContext2D; canvas: HTMLCanvasElement
  frame: string; bitmap: CanvasImageSource & { width: number; height: number }
  rect: { sx: number; sy: number; sw: number; sh: number }
  framing?: CompanionFraming
  scene: string; level: number; timeSec: number; reduced?: boolean
}
export interface LayeredPainterDeps {
  /** Fetches and decodes one piece (pack-relative path). */
  loadImage?: (url: string) => Promise<CanvasImageSource>
  createCanvas?: () => HTMLCanvasElement
  now?: () => number
}

/** The face section, parsed by Garud's locked contract against the catalog's body frames; null (the compatibility view) when it is missing or refused. */
export function parsedLayeredFace(pack: Pick<LayeredPack, 'manifest' | 'layered'>): CompanionFace | null {
  if (!pack.layered || !pack.manifest) return null
  try { return parseCompanionFace(pack.layered, Object.keys(pack.manifest.frames)) } catch { return null }
}

const defaultLoad = (url: string) => fetch(url, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error(`${url} answered ${r.status}`); return r.blob() }).then(b => createImageBitmap(b))

export function createLayeredPainter(pack: LayeredPack, face: CompanionFace, deps: LayeredPainterDeps = {}) {
  const load = deps.loadImage ?? defaultLoad
  const make = deps.createCanvas ?? (() => document.createElement('canvas'))
  const now = deps.now ?? (() => performance.now())
  // The call player chooses the body (its scene clips, accents and blink slots), so the compositor is given no clips: it holds the frame the player drew, with that frame's own head and angle.
  // (Garud's compositor refuses any body that a talk_/blink/expr_ clip also uses; Maya's turned bodies are in her expr_*_left/right clips, and her talk and blink slots are her neutral picture.)
  const manifest = { ...pack.manifest, clips: {}, face } as unknown as LayeredManifest
  const images = new Map<string, CanvasImageSource>()
  const asked = new Set<string>()
  const ask = (src: string) => { if (asked.has(src)) return; asked.add(src); void load(`${pack.base}${src}`).then(image => images.set(src, image), () => { /* that piece stays undrawn: the body under it shows */ }) }
  // Every piece for every angle, up front: they are small patches, and a missing one only leaves the body showing.
  for (const kind of ['mouth', 'eyes', 'brows'] as const) for (const angle of face.angles) for (const src of Object.values(face.pieces[kind][angle] ?? {})) if (src) ask(src)
  const born = now()
  let memory: CallMouthMemory = CALL_MOUTH_REST
  let patch: HTMLCanvasElement | null = null, mask: HTMLCanvasElement | null = null
  const painter = (input: LayeredPaintInput) => {
    const life = (now() - born) / 1000
    const speaking = input.scene === 'speaking'
    const mouth = callMouth({ speaking, level: input.level, audioTime: input.timeSec, reduced: input.reduced }, memory)
    memory = mouth.memory
    const plan = composeCompanionFace({ manifest, bodyFrame: input.frame, time: input.timeSec, motionTime: life, expression: sceneExpression(input.scene), mouth: mouth.sample, reduced: input.reduced })
    if (!plan) return
    const body = plan.bodies[0]!
    const { context: ctx, canvas, rect, bitmap } = input
    // The body's own plan (one scale k for x and y; the disc covers, a video framing is contained): the head anchor and every patch go through the same k, so the face stays on the head at any box.
    const { k, ox, oy, src, dst } = framingPlan(input.framing ?? 'chest', rect, pack.manifest.size, canvas.width, canvas.height)
    const b = bitmap.width / pack.manifest.size.width
    ctx.save()
    try {
      // Breathing moves the body and its face together (a slow transform, never a frame): redraw the body under the breath.
      if (plan.breathY) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (src.sw > 0 && src.sh > 0) ctx.drawImage(bitmap, src.sx * b, src.sy * b, src.sw * b, src.sh * b, dst.x, dst.y + plan.breathY * k, dst.w, dst.h)
      }
      ctx.setTransform(k, 0, 0, k, ox, oy + plan.breathY * k)
      ctx.translate(body.head.x, body.head.y); ctx.rotate(body.head.rot); ctx.scale(body.head.scale, body.head.scale)
      for (const kind of ['mouth', 'eyes', 'brows'] as const) {
        const layers = body.layers.filter(l => l.kind === kind && l.opacity > 0)
        if (!layers.length || layers.some(l => !images.has(l.src))) continue
        drawPatch(ctx, layers)
      }
    } finally { ctx.restore() }
    input.canvas.dataset.faceMouth = mouth.sample.mouth
    input.canvas.dataset.faceEyes = body.layers.find(l => l.kind === 'eyes')?.src ?? ''
    input.canvas.dataset.faceExpression = sceneExpression(input.scene)
  }
  function drawPatch(ctx: CanvasRenderingContext2D, layers: CompanionFaceLayer[]) {
    const r = layers[0]!.patch, width = Math.max(1, Math.ceil(r.w)), height = Math.max(1, Math.ceil(r.h))
    patch ??= make(); mask ??= make()
    if (patch.width !== width) patch.width = width; if (patch.height !== height) patch.height = height
    if (mask.width !== width) mask.width = width; if (mask.height !== height) mask.height = height
    const pc = patch.getContext('2d'), mc = mask.getContext('2d')
    if (!pc || !mc) return
    pc.clearRect(0, 0, width, height)
    // Weighted sum on transparent scratch keeps opaque skin through the 70 ms mouth crossfade (Garud).
    layers.forEach((layer, index) => { pc.globalCompositeOperation = index ? 'lighter' : 'source-over'; pc.globalAlpha = layer.opacity; pc.drawImage(images.get(layer.src)!, 0, 0, width, height) })
    pc.globalAlpha = 1
    mc.globalCompositeOperation = 'source-over'; mc.clearRect(0, 0, width, height); mc.fillStyle = '#fff'; mc.fillRect(0, 0, width, height)
    const feather = Math.max(0, Math.min(layers[0]!.feather, Math.min(width, height) / 2))
    if (feather > 0) {
      mc.globalCompositeOperation = 'destination-in'
      for (const [x0, y0, x1, y1] of [[0, 0, feather, 0], [width, 0, width - feather, 0], [0, 0, 0, feather], [0, height, 0, height - feather]] as const) {
        const g = mc.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, '#fff'); mc.fillStyle = g; mc.fillRect(0, 0, width, height)
      }
      mc.globalCompositeOperation = 'source-over'
    }
    pc.globalCompositeOperation = 'destination-in'; pc.drawImage(mask, 0, 0); pc.globalCompositeOperation = 'source-over'
    ctx.drawImage(patch, r.x, r.y, r.w, r.h)
  }
  return painter
}
