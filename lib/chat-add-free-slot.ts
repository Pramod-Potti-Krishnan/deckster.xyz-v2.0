/**
 * PROGRAM-1 E5 (4 Nov, Sunday checklist): chat add free slot (NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED, exact "true", default off, read at build time).
 *
 * Defect. "add a bar chart of revenue by region to slide 2" via chat runs the Element panel pipeline (hooks/use-textlabs-generation.ts, invocation kind
 * 'chat-add'), but the free-spot read (lib/element-free-spot.ts, PASS2D) runs only when the panel opens, never for a chat add. The chat add is therefore
 * inserted at the directive's fixed position and, with CHAT_ADD_STACKING on (z 1000), is painted OVER the slide's existing text.
 *
 * With the flag on, right before the insert a chat add asks the viewer for the slide's elements (getSlideGenerationContext, the same read the panel uses)
 * and moves the element to the first free spot of the content area at its own size. No room at full size: the box is shrunk in steps (keeping its aspect,
 * down to FREE_SLOT_MIN_*) until it fits. Still no room, an unreadable answer or a slow viewer: the position is left exactly as before (today's behaviour).
 * Layout renders at creation only, so the placement is decided BEFORE the insert (no PATCH afterwards). Flag off: nothing here runs.
 */
import { chooseFreeSpot, occupiedRectsFromContext, FREE_SPOT_READ_TIMEOUT_MS, type FreeSpotCommandSender, type FreeSpotRect } from '@/lib/element-free-spot'

export const CHAT_ADD_FREE_SLOT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED === 'true'

/** Smallest box a chat add is shrunk to (grid units); below this a chart or table is unreadable, so the old position is kept instead. */
export const FREE_SLOT_MIN_WIDTH = 8
export const FREE_SLOT_MIN_HEIGHT = 5
/** Shrink steps tried after the full size, as a share of the original width and height. */
export const FREE_SLOT_SCALES = Object.freeze([1, 0.85, 0.7, 0.55, 0.4])

export interface ChatAddSlot { startCol: number; startRow: number; width: number; height: number }

const snap = (value: number) => Math.round(value * 5) / 5

/** Pure: the first free slot for a width x height box among the occupied boxes, shrinking it if needed. Null when nothing fits. */
export function chooseChatAddSlot(occupied: readonly FreeSpotRect[], width: number, height: number): ChatAddSlot | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  for (const scale of FREE_SLOT_SCALES) {
    const w = scale === 1 ? width : Math.max(FREE_SLOT_MIN_WIDTH, snap(width * scale))
    const h = scale === 1 ? height : Math.max(FREE_SLOT_MIN_HEIGHT, snap(height * scale))
    if (scale !== 1 && (w > width || h > height)) continue
    const spot = chooseFreeSpot(occupied, w, h)
    if (spot) return { startCol: spot.startCol, startRow: spot.startRow, width: w, height: h }
  }
  return null
}

/**
 * Rewrites the insert params' geometry in place to a free slot on the slide. Returns the slot used, or null when the params were left untouched.
 */
export async function applyChatAddFreeSlot(input: {
  params: Record<string, unknown>
  sendElementCommand: FreeSpotCommandSender | null | undefined
  slideIndex: number
  timeoutMs?: number
}): Promise<ChatAddSlot | null> {
  const { params, sendElementCommand, slideIndex } = input
  const width = Number(params.positionWidth)
  const height = Number(params.positionHeight)
  if (!sendElementCommand || !Number.isFinite(width) || !Number.isFinite(height)) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const response = await Promise.race([
      sendElementCommand('getSlideGenerationContext', { slideIndex }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Slide read timed out')), input.timeoutMs ?? FREE_SPOT_READ_TIMEOUT_MS) }),
    ])
    const occupied = occupiedRectsFromContext(response, slideIndex)
    if (!occupied) return null
    const slot = chooseChatAddSlot(occupied, width, height)
    if (!slot) return null
    params.gridRow = `${slot.startRow}/${snap(slot.startRow + slot.height)}`
    params.gridColumn = `${slot.startCol}/${snap(slot.startCol + slot.width)}`
    params.positionWidth = slot.width
    params.positionHeight = slot.height
    return slot
  } catch {
    return null
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
