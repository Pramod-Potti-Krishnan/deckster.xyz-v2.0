/**
 * PROGRAM-1 E5 (4 Nov, Sunday checklist): chat add free slot (NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED, exact "true", default off, read at build time).
 *
 * Defect. "add a bar chart of revenue by region to slide 2" via chat runs the Element panel pipeline (hooks/use-textlabs-generation.ts, invocation kind
 * 'chat-add'), but the free-spot read (lib/element-free-spot.ts, PASS2D) runs only when the panel opens, never for a chat add. The chat add is therefore
 * inserted at the directive's fixed position and, with CHAT_ADD_STACKING on (z 1000), is painted OVER the slide's existing text.
 *
 * With the flag on, right before the insert a chat add asks the viewer for the slide's elements (getSlideGenerationContext, the same read the panel uses)
 * and MOVES the element to the first free spot of the content area at its own size. PROGRAM-1's ruling: move only, never shrink. No room at full size,
 * an unreadable answer or a slow viewer: the position is left exactly as before (today's behaviour); a timed-out read says so in one log line.
 * A picture with a caption row (captionInsertParams in the hook) moves as one block with its caption: the box that holds both is placed, and the caption is
 * shifted by the picture's offset. A caption whose position cannot be read keeps both where they were (never split).
 * Layout renders at creation only, so the placement is decided BEFORE the insert (no PATCH afterwards). Flag off: nothing here runs.
 */
import { chooseFreeSpot, occupiedRectsFromContext, parseFreeSpotSpan, FREE_SPOT_READ_TIMEOUT_MS, type FreeSpotCommandSender, type FreeSpotRect } from '@/lib/element-free-spot'

export const CHAT_ADD_FREE_SLOT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED === 'true'

export interface ChatAddSlot { startCol: number; startRow: number; width: number; height: number }

const snap = (value: number) => Math.round(value * 5) / 5

/** Pure: the first free slot for a width x height box among the occupied boxes, at that size (never shrunk). Null when nothing fits. */
export function chooseChatAddSlot(occupied: readonly FreeSpotRect[], width: number, height: number): ChatAddSlot | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  const spot = chooseFreeSpot(occupied, width, height)
  return spot ? { startCol: spot.startCol, startRow: spot.startRow, width, height } : null
}

const SLOW_READ = 'Slide read timed out'

/** The params' grid box, or null when its gridRow / gridColumn cannot be read. */
function boxOf(params: Record<string, unknown>): { col: [number, number]; row: [number, number] } | null {
  const col = parseFreeSpotSpan(params.gridColumn)
  const row = parseFreeSpotSpan(params.gridRow)
  return col && row ? { col, row } : null
}

function shift(params: Record<string, unknown>, box: { col: [number, number]; row: [number, number] }, dCol: number, dRow: number) {
  params.gridRow = `${snap(box.row[0] + dRow)}/${snap(box.row[1] + dRow)}`
  params.gridColumn = `${snap(box.col[0] + dCol)}/${snap(box.col[1] + dCol)}`
}

/**
 * Moves the insert params (and their caption row, when given) in place to a free slot on the slide, at full size. Returns the slot of the
 * element, or null when nothing was touched.
 */
export async function applyChatAddFreeSlot(input: {
  params: Record<string, unknown>
  sendElementCommand: FreeSpotCommandSender | null | undefined
  slideIndex: number
  /** The caption row inserted right after a picture (captionInsertParams): moved by the same offset, or nothing moves. */
  caption?: Record<string, unknown> | null
  timeoutMs?: number
}): Promise<ChatAddSlot | null> {
  const { params, sendElementCommand, slideIndex, caption } = input
  const width = Number(params.positionWidth)
  const height = Number(params.positionHeight)
  if (!sendElementCommand || !Number.isFinite(width) || !Number.isFinite(height)) return null
  const own = boxOf(params)
  const captionBox = caption ? boxOf(caption) : null
  if (caption && (!own || !captionBox)) return null // a caption must move with its picture: unreadable boxes keep both in place
  const timeoutMs = input.timeoutMs ?? FREE_SPOT_READ_TIMEOUT_MS
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const response = await Promise.race([
      sendElementCommand('getSlideGenerationContext', { slideIndex }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(SLOW_READ)), timeoutMs) }),
    ])
    const occupied = occupiedRectsFromContext(response, slideIndex)
    if (!occupied) return null
    if (caption && own && captionBox) {
      // the picture and its caption as one block
      const left = Math.min(own.col[0], captionBox.col[0]), top = Math.min(own.row[0], captionBox.row[0])
      const right = Math.max(own.col[1], captionBox.col[1]), bottom = Math.max(own.row[1], captionBox.row[1])
      const block = chooseChatAddSlot(occupied, right - left, bottom - top)
      if (!block) return null
      const dCol = block.startCol - left, dRow = block.startRow - top
      shift(params, own, dCol, dRow)
      shift(caption, captionBox, dCol, dRow)
      return { startCol: snap(own.col[0] + dCol), startRow: snap(own.row[0] + dRow), width, height }
    }
    const slot = chooseChatAddSlot(occupied, width, height)
    if (!slot) return null
    params.gridRow = `${slot.startRow}/${snap(slot.startRow + slot.height)}`
    params.gridColumn = `${slot.startCol}/${snap(slot.startCol + slot.width)}`
    return slot
  } catch (error) {
    if (error instanceof Error && error.message === SLOW_READ) {
      console.warn(`[chat-add-free-slot] the viewer's free-spot read timed out after ${timeoutMs} ms (FREE_SPOT_READ_TIMEOUT_MS); the chat add keeps its position`)
    }
    return null
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
