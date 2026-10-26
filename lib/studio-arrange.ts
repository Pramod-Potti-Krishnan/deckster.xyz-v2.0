// NEXT_PUBLIC_STUDIO_ARRANGE (FRONTEND-2, 26 Oct; exact "true", default off, build-time). The Studio half of the Arrange fix; it pairs with
// Layout MR !260 (LAYOUT_ARRANGE_COMMANDS_ENABLED), and both flags flip together.
//
// Two things change while it is on:
//  1. Selecting an element no longer raises it. The viewer sent bringToFront on every selection (components/presentation-viewer.tsx, the text
//     box and element selection handlers); with Layout's flag on that is a SAVED raise on every click (a background image lifted over its
//     text). Ordering happens only through the Arrange controls or chat. The one guard is studioArrangeRaisesOnSelect() below, so a
//     "raise temporarily while editing" variant can replace it in one place later. (FRONTEND-2's recommendation to PK, pending.)
//  2. The v4 Format inspector admits Arrange (lib/studio-format-native.ts, components/builder/studio-format-inspector.tsx): Order, Align,
//     Position, Size and Lock, sent as Layout's own commands, in SLIDE pixels of the 1920 x 1080 canvas (Layout snaps to its 12 px grid and
//     clamps to the slide). Rotate, Flip and style classes stay disabled ("Not available yet": no Layout schema keeps them); shapes and
//     tables get no Arrange command at all (Layout's autosave does not store them). A locked element is admitted for Unlock only.
//     The inspector shows Lock disabled ("Not available yet", STUDIO_ARRANGE_LOCK_ENABLED = false in the inspector) until Layout lets a locked
//     element be selected again: the inspector closes when Layout autosaves, and a locked element is pointer-events: none.
//     Every Arrange command it sends carries intent 'arrange' (STUDIO_ARRANGE_INTENT): Layout's flag runs a command only with that intent,
//     so the bringToFront {elementId} the older Studio builds send on every select stays the no-op it always was.
//
// Geometry. Layout's elementSelected properties report slide pixels while its flag is on (viewport pixels while it is off). The element's
// grid position, which Layout's getElementGeometry reports in both builds (the logical 32 x 18 grid, minor steps of 0.2), converts to the
// same slide pixels exactly: Layout's own slideGeometry is (physical line - 1) x 12 and physical = GridConverter.toPhysical(logical).
// So an element's properties are admitted only when they ARE that geometry (they are slide pixels: Layout's flag is on); otherwise Arrange
// stays disabled, as today. A text box's selection event carries no properties at all, so its numbers are the grid position's. After a
// confirmed change the page's own native re-read (getElementGeometry again) gives the new numbers.
//
// Plain module: no React, no I/O.

import type { BaseElementProperties } from '@/types/elements'

export const STUDIO_ARRANGE_FLAG = 'NEXT_PUBLIC_STUDIO_ARRANGE'
export const STUDIO_ARRANGE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ARRANGE === 'true'

/** The Arrange commands Layout !260 runs for a text box, image, chart, infographic or diagram. */
export const STUDIO_ARRANGE_COMMANDS = ['bringToFront', 'sendToBack', 'bringForward', 'sendBackward', 'alignElement',
  'resizeElement', 'positionElement', 'lockElement'] as const
export type StudioArrangeCommand = typeof STUDIO_ARRANGE_COMMANDS[number]
/** Shown disabled ("Not available yet"): Layout answers "... not supported for this element yet" for every element. Never admitted. */
export const STUDIO_ARRANGE_NOT_YET = ['rotateElement', 'flipElement', 'setElementClasses'] as const
/** The element types Layout's autosave stores, so their Arrange changes are saved (arrange-commands.js SAVED_Z). */
export const STUDIO_ARRANGE_TYPES = ['textbox', 'image', 'chart', 'infographic', 'diagram'] as const
/** Layout's intent guard (LAYOUT_ARRANGE_COMMANDS_ENABLED): an Arrange command acts only when its params carry intent 'arrange'; without it the
 *  viewer answers "Unknown action", as it did before the flag, so the older builds' select-raise (bringToFront {elementId}) changes and saves nothing. */
export const STUDIO_ARRANGE_INTENT = 'arrange'
/** The params posted for an Arrange command: the validated ones (validateStudioArrangeParams holds the shapes Layout accepts) plus the intent. */
export const studioArrangeCommandParams = (params: Record<string, unknown>): Record<string, unknown> => ({ ...params, intent: STUDIO_ARRANGE_INTENT })

const CELL = 12 // slide px per physical grid line: 1920 / 160 = 1080 / 90
const SCALE = 5 // physical lines per logical line (GridConverter GRID_SCALE)
const COLS = 160
const ROWS = 90

const record = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export const isStudioArrangeCommand = (action: unknown): action is StudioArrangeCommand =>
  typeof action === 'string' && (STUDIO_ARRANGE_COMMANDS as readonly string[]).includes(action)

/**
 * THE select-raise guard. true: selecting an element sends bringToFront (today). false while NEXT_PUBLIC_STUDIO_ARRANGE is on: selecting
 * never reorders; only the Arrange controls or chat do. Both selection handlers in components/presentation-viewer.tsx ask this, and only this.
 */
export function studioArrangeRaisesOnSelect(): boolean {
  return !STUDIO_ARRANGE_ENABLED
}

/** What the viewer hands the selection handle: elementSelected's raw properties while the flag is on; nothing otherwise (or for a text box). */
export function studioArrangeSelectionInput(eventKind: string, properties: unknown): { arrangeProperties?: unknown } {
  return STUDIO_ARRANGE_ENABLED && eventKind === 'elementSelected' && record(properties) ? { arrangeProperties: properties } : {}
}

/** One logical grid span ("5.4/16.8") -> its physical lines [start, end] (GridConverter.toPhysical), or null. */
function physicalSpan(value: unknown, lines: number): [number, number] | null {
  if (typeof value !== 'string') return null
  const match = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(value)
  if (!match) return null
  const toPhysical = (text: string) => {
    const n = Number(text), major = Math.floor(n), frac = (n - major) * SCALE
    if (Math.abs(frac - Math.round(frac)) > 1e-6) return NaN // not on the minor grid
    return (major - 1) * SCALE + 1 + Math.round(frac)
  }
  const start = toPhysical(match[1]), end = toPhysical(match[2])
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end <= start || end > lines + 1) return null
  return [start, end]
}

/** Slide-pixel position and size from Layout's logical grid position ({gridRow, gridColumn}), or null. */
export function studioArrangeGeometry(position: unknown): { position: { x: number; y: number }; size: { width: number; height: number } } | null {
  if (!record(position)) return null
  const rows = physicalSpan(position.gridRow, ROWS), cols = physicalSpan(position.gridColumn, COLS)
  if (!rows || !cols) return null
  return { position: { x: (cols[0] - 1) * CELL, y: (rows[0] - 1) * CELL }, size: { width: (cols[1] - cols[0]) * CELL, height: (rows[1] - rows[0]) * CELL } }
}

/** elementSelected's properties are slide pixels exactly when they equal the element's grid geometry (Layout's flag on). */
export function studioArrangeSlidePixels(properties: unknown, geometry: ReturnType<typeof studioArrangeGeometry>): boolean {
  if (!record(properties) || !geometry || !record(properties.position) || !record(properties.size)) return false
  const { x, y } = properties.position, { width, height } = properties.size
  return [x, y, width, height].every(finite) && x === geometry.position.x && y === geometry.position.y
    && width === geometry.size.width && height === geometry.size.height
}

export interface StudioArrangeAdmission {
  /** 'textBoxSelected' or 'elementSelected'. */
  eventKind: string
  /** elementSelected's elementType (Layout's registry type: image, chart, infographic, diagram, shape, table ...). */
  elementType?: string
  /** elementSelected's raw properties, as captured at selection. */
  arrangeProperties?: unknown
  /** The getElementGeometry answer of this read. */
  geometry: unknown
  /** A text box's lock as Layout's registry holds it (getTextBoxes), or null. */
  textBoxLocked: boolean | null
  /** The lock state the viewer last confirmed for this selection (a lockElement answer), or null. */
  confirmedLock: boolean | null
  /** True once this selection's properties were found to be slide pixels (the first read checks; later reads follow the grid). */
  slidePixelsConfirmed: boolean
}

/**
 * The read's target with Arrange admitted: native properties (slide pixels) and the commands Layout runs for it. A shape, a table, an
 * element whose properties are not slide pixels, or a geometry that cannot be read: the target comes back as it was (Arrange disabled).
 * A locked element: Unlock only.
 */
export function studioArrangeAdmit<T extends { elementId: string; supportedCommands: readonly string[]; properties: BaseElementProperties | null }>(
  target: T, input: StudioArrangeAdmission): { target: T; slidePixelsConfirmed: boolean } {
  const unchanged = { target, slidePixelsConfirmed: input.slidePixelsConfirmed }
  if (!STUDIO_ARRANGE_ENABLED) return unchanged
  const type = input.eventKind === 'textBoxSelected' ? 'textbox' : input.eventKind === 'elementSelected' ? input.elementType : undefined
  if (!type || !(STUDIO_ARRANGE_TYPES as readonly string[]).includes(type) || !record(input.geometry)) return unchanged
  const geometry = studioArrangeGeometry(input.geometry.position)
  if (!geometry) return unchanged
  let locked: boolean
  let confirmed = input.slidePixelsConfirmed
  if (type === 'textbox') {
    locked = input.confirmedLock ?? input.textBoxLocked ?? false
  } else {
    if (!confirmed && !studioArrangeSlidePixels(input.arrangeProperties, geometry)) return unchanged
    confirmed = true
    const seen = record(input.arrangeProperties) && typeof input.arrangeProperties.locked === 'boolean' ? input.arrangeProperties.locked : null
    if (input.confirmedLock === null && seen === null) return unchanged
    locked = input.confirmedLock ?? (seen as boolean)
  }
  const zIndex = finite(input.geometry.z_index) ? input.geometry.z_index : 100
  const properties: BaseElementProperties = { elementId: target.elementId, position: geometry.position, size: geometry.size, rotation: 0, locked, zIndex }
  const commands = locked ? ['lockElement'] : [...STUDIO_ARRANGE_COMMANDS]
  return { target: { ...target, properties, supportedCommands: [...target.supportedCommands, ...commands.filter(command => !target.supportedCommands.includes(command))] }, slidePixelsConfirmed: confirmed }
}

const keysWithin = (params: Record<string, unknown>, allowed: readonly string[]) => Object.keys(params).every(key => allowed.includes(key))
const absent = (value: unknown) => value === undefined

/** The exact params Studio may send for an Arrange command (the shapes Layout !260 accepts); anything else is refused before it is sent. */
export function validateStudioArrangeParams(action: string, params: Record<string, unknown>, target: { elementId: string; supportedCommands: readonly string[] }): boolean {
  if (!isStudioArrangeCommand(action) || !record(params) || params.elementId !== target.elementId || !target.supportedCommands.includes(action)) return false
  switch (action) {
    case 'bringToFront': case 'sendToBack': case 'bringForward': case 'sendBackward':
      return keysWithin(params, ['elementId'])
    case 'alignElement':
      return keysWithin(params, ['elementId', 'horizontal', 'vertical']) && (!absent(params.horizontal) || !absent(params.vertical))
        && (absent(params.horizontal) || ['left', 'center', 'right'].includes(String(params.horizontal)))
        && (absent(params.vertical) || ['top', 'middle', 'bottom'].includes(String(params.vertical)))
    case 'positionElement':
      return keysWithin(params, ['elementId', 'x', 'y']) && finite(params.x) && finite(params.y)
    case 'resizeElement': {
      const size = (value: unknown) => absent(value) || (finite(value) && value > 0)
      return keysWithin(params, ['elementId', 'width', 'height', 'maintainAspectRatio']) && size(params.width) && size(params.height)
        && (!absent(params.width) || !absent(params.height)) && (absent(params.maintainAspectRatio) || typeof params.maintainAspectRatio === 'boolean')
    }
    case 'lockElement':
      return keysWithin(params, ['elementId', 'locked']) && typeof params.locked === 'boolean'
  }
  return false
}

/** Layout's error for an Arrange command, in plain words for the inspector's notice. Studio's own messages (selection changed, timeout) pass through. */
export function studioArrangeErrorText(message: string): string {
  if (message === 'Element is locked') return 'This element is locked. Unlock it to move, resize or align it.'
  if (message === 'Edit mode required') return 'The slide left edit mode. Select the element again, then try again.'
  if (message === 'Element not found' || message === 'Element is not on a slide') return 'This element is no longer on the slide. Select it again.'
  if (/^Unknown action: /.test(message) || / is not available$/.test(message)) return 'Arranging is not available on this deck yet.'
  if (/ not supported for this element yet$/.test(message)) return 'Not available yet for this element.'
  if (message === 'The change was applied but could not be marked for saving') return 'The change shows on the slide, but it could not be saved.'
  if (/must be finite numbers|must be positive numbers|must be true or false|^horizontal must be/.test(message)) return 'Enter a valid number and try again.'
  return message
}

/**
 * The selection's own Arrange command, from just before it is posted until its answer is in. Layout marks the change for autosave while it
 * runs the command, so its saveStatusChanged "unsaved" reaches Studio BEFORE the command's answer. The viewer retires every selection on a
 * save status other than "saved" (components/presentation-viewer.tsx bumps its interaction intent), which made the answer to every changing
 * Arrange command read as "The selected element changed before confirmation.". That one frame is the command's own consequence on the same
 * element, so it does not retire the selection; any other save status, and any "unsaved" outside the window (a change made by anyone else),
 * still does.
 */
let ownCommand: object | null = null
export function studioArrangeOwnCommand<T>(run: () => Promise<T>): Promise<T> {
  if (!STUDIO_ARRANGE_ENABLED) return run()
  const token = {}
  ownCommand = token
  return run().finally(() => { if (ownCommand === token) ownCommand = null })
}
/** True for Layout's "unsaved" while the selection's own Arrange command is in flight (the viewer then leaves the selection current). */
export function studioArrangeOwnsSaveStatus(status: unknown): boolean {
  return STUDIO_ARRANGE_ENABLED && ownCommand !== null && status === 'unsaved'
}

/** The lock state a confirmed lockElement answer reports (Layout echoes `locked`), else the previous one. */
export function studioArrangeConfirmedLock(previous: boolean | null, action: string, answer: unknown): boolean | null {
  return action === 'lockElement' && record(answer) && answer.success === true && typeof answer.locked === 'boolean' ? answer.locked : previous
}
