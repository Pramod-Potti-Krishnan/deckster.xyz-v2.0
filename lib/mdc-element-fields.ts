/**
 * MDC element fields (FRONTEND-2, B44; E2E-2 B1b rows 40 and 41, root cause by DIRECTOR-2). Flag NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS: the exact value "true", default off,
 * build-time. Off, nothing here is read and a chat add is exactly what it was.
 *
 * THE DEFECT. A chat add ("Add a label saying 'Pilot stores'", "Add a rectangle shape") reaches lib/mdc-element-directive.ts as element_type + prompt only, which builds
 * `iconLabelConfig: {}` (Text Labs then defaults to mode "icon", so the label came out with EMPTY text) and `shapeConfig: {}` (no shape_type, so Text Labs takes custom-prompt
 * mode and Illustrator rejects "A rectangle shape"). The Element panel's own forms never do either: the Icon/Label form sends `mode: 'label'` with the label text as the
 * prompt (components/generation-panel/forms/icon-label-form.tsx handleSubmit), the Shape form sends `shape_type` for a preset with `prompt: null` (shape-form.tsx handleSubmit).
 *
 * THE CONTRACT (DIRECTOR-2, Director flag DIRECTOR_MDC_ELEMENT_FIELDS_ENABLED). On the element_directive payload, beside element_type / prompt / slide_index / grid_hint, three
 * optional snake_case keys: `icon_label_mode` ("label" | "icon", ICON_LABEL adds only), `label_text` (1 to 20 characters, only with mode "label": the user's own words),
 * `shape_type` (SHAPE adds only, one of the 24 preset names below, verbatim). Studio IGNORES anything off the contract and then builds today's config: a wrong type, an empty or
 * whitespace-only text, a text over 20 characters, a shape_type outside the set, mode "label" without a label_text, the keys on another element_type.
 *
 * THE MAPPING (flag on, a valid field): each result is what the panel's form sends for the same choice, field for field.
 *   ICON_LABEL, mode "label" + label_text -> prompt = label_text, iconLabelConfig = { operation: 'generate', mode: 'label' }   (the form: label mode, no explicit style/size/font/color)
 *   ICON_LABEL, mode "icon"               -> the directive's own prompt, iconLabelConfig = { operation: 'generate', mode: 'icon' }
 *   SHAPE, a preset shape_type            -> the directive's own prompt, shapeConfig = { shape_type, prompt: null }              (the form's routing intent)
 * The panel's own geometry fields (shape x / y / width_px / height_px and the grid start / size) are NOT sent: a chat add has no panel geometry, and Text Labs fills every one of
 * them itself when it is absent (text-labs chat_routes.py, the SHAPE branch: start_col 2, start_row 4, the component's default size, pixels from the grid). They are today's `{}` too.
 *
 * Pure: no React, no DOM, no network, no import at run time (types only).
 */
import type { IconLabelConfig, ShapeConfig, TextLabsShapeType } from '@/types/textlabs'

export const STUDIO_MDC_ELEMENT_FIELDS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS === 'true'

/** The longest label_text Director sends (it sends no directive for a longer one), counted in characters (code points), as Director counts them. */
export const MDC_LABEL_TEXT_MAX_CHARS = 20

/** Illustrator's BasicShapeType (app/models/atomic_shape_models.py) = the Shape form's presets (every option but 'custom'). */
export const MDC_PRESET_SHAPE_TYPES: readonly Exclude<TextLabsShapeType, 'custom'>[] = [
  'circle', 'ellipse', 'square', 'rectangle', 'triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon',
  'rhombus', 'parallelogram', 'trapezoid', 'kite', 'line-horizontal', 'line-vertical', 'line-diagonal',
  'star', 'cross', 'arrow', 'doughnut', 'cloud', 'heart', 'crescent', 'polygon',
]

/** The parts of the form data a valid field replaces; everything else in the form data stays as the executor built it. */
export interface MdcElementFieldsPatch {
  prompt?: string
  iconLabelConfig?: Partial<IconLabelConfig>
  shapeConfig?: Partial<ShapeConfig>
}

/** A label_text Studio will use: a string with at least one visible character and at most 20 characters. The text itself is used exactly as sent. */
export function isValidMdcLabelText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && Array.from(value).length <= MDC_LABEL_TEXT_MAX_CHARS
}

/** A shape_type Studio will use: one of the 24 presets, verbatim (no case folding, no trimming, never 'custom'). */
export function isMdcPresetShapeType(value: unknown): value is Exclude<TextLabsShapeType, 'custom'> {
  return typeof value === 'string' && (MDC_PRESET_SHAPE_TYPES as readonly string[]).includes(value)
}

/**
 * What the directive's new fields change in the form data for `componentType`, or null (flag off, no usable field, another element type): then the form data is today's.
 * `fields` is the element_directive payload as it arrived; nothing on it is trusted.
 */
export function mdcElementFieldsPatch(componentType: string, fields: unknown, enabled: boolean = STUDIO_MDC_ELEMENT_FIELDS_ENABLED): MdcElementFieldsPatch | null {
  if (!enabled || !fields || typeof fields !== 'object') return null
  const bag = fields as Record<string, unknown>
  if (componentType === 'ICON_LABEL') {
    if (bag.icon_label_mode === 'icon') return { iconLabelConfig: { operation: 'generate', mode: 'icon' } }
    if (bag.icon_label_mode === 'label' && isValidMdcLabelText(bag.label_text)) return { prompt: bag.label_text, iconLabelConfig: { operation: 'generate', mode: 'label' } }
    return null
  }
  if (componentType === 'SHAPE') {
    return isMdcPresetShapeType(bag.shape_type) ? { shapeConfig: { shape_type: bag.shape_type, prompt: null } } : null
  }
  return null
}
