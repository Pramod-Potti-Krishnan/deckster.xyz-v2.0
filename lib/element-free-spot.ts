/**
 * PASS2D (flag NEXT_PUBLIC_STUDIO_ELEMENT_FREE_SPOT, Studio shell only, default off).
 *
 * Add Element used to put every new element at grid column 2, row 4, whatever was already on the slide, so the second element landed on
 * top of the first. With the flag on, choosing an Add Element card first asks the viewer where the slide's elements are and puts the new
 * element in the first free spot of the content area. No room (or an unreadable answer) keeps the old position, so the worst case is
 * today's behaviour.
 *
 * What the viewer tells Studio (layout-builder viewer/presentation-viewer.html `getSlideGenerationContext`, which Studio already sends before
 * every Generate): one entry per element on the slide with `position: { gridRow: "4/10", gridColumn: "2/12" }` on the logical 32 x 18
 * grid (grid lines 1..33 and 1..19, fractions on the 0.2 minor grid). It lists the elements Layout has registered for the slide: the Add
 * Element boxes, the box elements of a C-series or hero slide (a hero's full-bleed backdrop image among them), and nothing else. The raw
 * rich-content body of an L-series slide (L25) is not an element and no viewer message reports its box, so such a body is not avoided.
 *
 * No imports: the placement is a pure function of the occupied boxes and the size, so a test can load this file as it stands.
 */

export const STUDIO_ELEMENT_FREE_SPOT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ELEMENT_FREE_SPOT === 'true'

export interface FreeSpotRect {
  startCol: number
  startRow: number
  endCol: number
  endRow: number
}

export interface FreeSpot {
  startCol: number
  startRow: number
}

export type FreeSpotCommandSender = (action: string, params: Record<string, any>) => Promise<any>

/** The content area an element may be placed in, as grid LINES: columns 2..32, rows 4..18 (the title band above and the footer row below stay clear). */
export const FREE_SPOT_BOUNDS = Object.freeze({ minCol: 2, maxCol: 32, minRow: 4, maxRow: 18 })
/** Free space kept between the new element and its neighbours when there is room for it (grid units); without room the gap is dropped. */
export const FREE_SPOT_GAP = 1
/** An element covering this share of the whole 32 x 18 canvas is a backdrop (the full-bleed image behind a hero slide), not something to avoid. */
export const FREE_SPOT_BACKDROP_SHARE = 0.9
/** The viewer answers a read in a few milliseconds; if it does not, the panel opens at the old position rather than wait for it. */
export const FREE_SPOT_READ_TIMEOUT_MS = 2000

const CANVAS_AREA = 32 * 18

const snapToMinorGrid = (value: number) => Math.round(value * 5) / 5

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** "4/10" -> [4, 10]; fractions are snapped to the 0.2 grid; anything else (a missing, reversed or non-numeric span) is null. */
export function parseFreeSpotSpan(value: unknown): [number, number] | null {
  if (typeof value !== 'string') return null
  const parts = value.split('/')
  if (parts.length !== 2) return null
  const start = Number(parts[0])
  const end = Number(parts[1])
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  const snappedStart = snapToMinorGrid(start)
  const snappedEnd = snapToMinorGrid(end)
  return snappedStart >= 1 && snappedStart < snappedEnd ? [snappedStart, snappedEnd] : null
}

/**
 * The boxes the slide's elements occupy, from a `getSlideGenerationContext` answer. Null when the answer cannot be trusted (not a success, a
 * different slide, no element list, or a list cut short): the caller then keeps the old position. An element whose position cannot be read, a
 * hidden element and a backdrop are left out.
 */
export function occupiedRectsFromContext(response: unknown, slideIndex: number): FreeSpotRect[] | null {
  const root = asRecord(response)
  if (!root || root.success !== true) return null
  if (Number(root.slide_index ?? root.slideIndex) !== slideIndex) return null
  if (!Array.isArray(root.elements) || root.truncated === true) return null
  const rects: FreeSpotRect[] = []
  for (const raw of root.elements) {
    const element = asRecord(raw)
    const position = asRecord(element?.position)
    if (!position || asRecord(element?.properties)?.visible === false) continue
    const rows = parseFreeSpotSpan(position.gridRow ?? position.grid_row)
    const cols = parseFreeSpotSpan(position.gridColumn ?? position.grid_column)
    if (!rows || !cols) continue
    if ((rows[1] - rows[0]) * (cols[1] - cols[0]) >= CANVAS_AREA * FREE_SPOT_BACKDROP_SHARE) continue
    rects.push({ startCol: cols[0], startRow: rows[0], endCol: cols[1], endRow: rows[1] })
  }
  return rects
}

/**
 * The first spot, reading left to right and then top to bottom from the top-left of the content area, where a `width` x `height` box
 * touches none of the occupied boxes (and, on the first pass, keeps FREE_SPOT_GAP clear of them). Null when there is none. On an empty
 * slide that is column 2, row 4: the position Add Element has always used.
 */
export function chooseFreeSpot(occupied: readonly FreeSpotRect[], width: number, height: number): FreeSpot | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  const { minCol, maxCol, minRow, maxRow } = FREE_SPOT_BOUNDS
  for (const gap of [FREE_SPOT_GAP, 0]) {
    for (let row = minRow; row + height <= maxRow; row++) {
      for (let col = minCol; col + width <= maxCol; col++) {
        const clear = occupied.every(box => (
          col + width <= box.startCol - gap || box.endCol + gap <= col
          || row + height <= box.startRow - gap || box.endRow + gap <= row
        ))
        if (clear) return { startCol: col, startRow: row }
      }
    }
  }
  return null
}

/** Ask the viewer for the slide's elements and pick a free spot for a `width` x `height` box. Null on any failure, a slow answer or no room. */
export async function pickElementFreeSpot(input: {
  sendElementCommand: FreeSpotCommandSender
  slideIndex: number
  width: number
  height: number
  timeoutMs?: number
}): Promise<FreeSpot | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const response = await Promise.race([
      input.sendElementCommand('getSlideGenerationContext', { slideIndex: input.slideIndex }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Slide read timed out')), input.timeoutMs ?? FREE_SPOT_READ_TIMEOUT_MS) }),
    ])
    const occupied = occupiedRectsFromContext(response, input.slideIndex)
    return occupied ? chooseFreeSpot(occupied, input.width, input.height) : null
  } catch {
    return null
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
