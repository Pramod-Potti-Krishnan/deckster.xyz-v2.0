import type {
  TemplateBlueprint,
  TemplateBlueprintElement,
  TemplateBlueprintSlide,
  TemplateSnapshot,
  TemplateSlot,
} from '@/hooks/use-templates'

export type TemplateModeOverride = Record<string, unknown>
export type TemplateSlideOverrides = Record<string, unknown>
export type TemplateOverrides = Record<string, TemplateSlideOverrides>

export interface TemplateGridRect {
  x: number
  y: number
  w: number
  h: number
}

export interface TemplateModeElement {
  overrideKey: string
  label: string
  atomType: string
  role: string
  contentIntent: string | null
  geometry: string | null
  gridRect: TemplateGridRect | null
  styleHints: Record<string, unknown> | null
  renderedImageUrl: string | null
  fixedness: TemplateBlueprintElement['fixedness'] | null
  purpose: string | null
  requiredInput: string | null
  populationRule: string | null
  blueprintElement: TemplateBlueprintElement | null
  element: Record<string, unknown> | null
  renderSpec: Record<string, unknown>
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item))
    : []
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasSlideIndex(value: Record<string, unknown> | TemplateSlot): boolean {
  return value.slide_index != null
}

export function getFrozenPlanEntry(
  snapshot: TemplateSnapshot | null | undefined,
  slideIndex: number,
): Record<string, unknown> | null {
  const entries = asRecordArray(snapshot?.frozen_plan)
  return entries.find((entry) => Number(entry.slide_index) === slideIndex)
    ?? (entries.some(hasSlideIndex) ? null : entries[slideIndex])
    ?? null
}

export function getLayoutPlan(entry: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  return asRecord(entry?.layout_plan) ?? asRecord(entry)
}

export function getTemplateSlot(
  snapshot: TemplateSnapshot | null | undefined,
  slideIndex: number,
): TemplateSlot | null {
  const slots = Array.isArray(snapshot?.slots) ? snapshot.slots : []
  return slots.find((slot) => Number(slot.slide_index) === slideIndex)
    ?? (slots.some(hasSlideIndex) ? null : slots[slideIndex])
    ?? null
}

export function getLayoutElements(layoutPlan: Record<string, unknown> | null | undefined): Record<string, unknown>[] {
  return asRecordArray(layoutPlan?.elements)
}

export function getRenderSpecs(layoutPlan: Record<string, unknown> | null | undefined): Record<string, unknown>[] {
  return asRecordArray(layoutPlan?.render_specs)
}

export function getSpecOverrideKey(
  renderSpec: Record<string, unknown>,
  element?: Record<string, unknown> | null,
): string | null {
  return stringValue(renderSpec.spec_id)
    ?? stringValue(renderSpec.source_element_id)
    ?? stringValue(element?.id)
}

export function getElementForSpec(
  renderSpec: Record<string, unknown>,
  elements: Record<string, unknown>[],
): Record<string, unknown> | null {
  const sourceId = stringValue(renderSpec.source_element_id)
  const specId = stringValue(renderSpec.spec_id)
  return elements.find((element) => stringValue(element.id) === sourceId)
    ?? elements.find((element) => stringValue(element.id) === specId)
    ?? null
}

export function getRenderedImageUrl(renderSpec: Record<string, unknown>): string | null {
  const imageHints = asRecord(renderSpec.image_hints)
  return stringValue(imageHints?.rendered_image_url)
}

function getAtomType(renderSpec: Record<string, unknown>, element: Record<string, unknown> | null): string {
  return (
    stringValue(renderSpec.atom_type)
    ?? stringValue(element?.atomic_component_type)
    ?? stringValue(element?.element_type)
    ?? 'element'
  ).toUpperCase()
}

function getRole(renderSpec: Record<string, unknown>, element: Record<string, unknown> | null): string {
  return stringValue(renderSpec.component_role)
    ?? stringValue(element?.component_role)
    ?? stringValue(element?.semantic_role)
    ?? stringValue(element?.accessory_type)
    ?? 'slot'
}

function getGeometry(element: Record<string, unknown> | null): string | null {
  const rect = getGridRect(element)
  if (!rect) return null
  return `x ${rect.x} / y ${rect.y} / w ${rect.w} / h ${rect.h}`
}

export function getGridRect(element: Record<string, unknown> | null): TemplateGridRect | null {
  if (!element) return null
  const values = ['x', 'y', 'w', 'h'].map((key) => numberValue(element[key]))
  if (values.some((value) => value == null)) return null
  const [x, y, w, h] = values as number[]
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

export function getTemplateBlueprint(
  snapshot: TemplateSnapshot | null | undefined,
): TemplateBlueprint | null {
  const blueprint = snapshot?.template_blueprint
  return blueprint && Array.isArray(blueprint.slides) ? blueprint : null
}

export function getBlueprintSlide(
  snapshot: TemplateSnapshot | null | undefined,
  slideIndex: number,
): TemplateBlueprintSlide | null {
  const blueprint = getTemplateBlueprint(snapshot)
  const slides = blueprint?.slides ?? []
  return slides.find((slide) => Number(slide.slide_index) === slideIndex)
    ?? (slides.some((slide) => slide.slide_index != null) ? null : slides[slideIndex])
    ?? null
}

export function getBlueprintElement(
  snapshot: TemplateSnapshot | null | undefined,
  slideIndex: number,
  elementKey: string | null | undefined,
): TemplateBlueprintElement | null {
  if (!elementKey) return null
  const slide = getBlueprintSlide(snapshot, slideIndex)
  return slide?.elements.find((element) => element.element_key === elementKey) ?? null
}

function getBlueprintVisualConstants(element: TemplateBlueprintElement): Record<string, unknown> | null {
  return asRecord(element.visual_constants)
}

function getBlueprintGridRect(element: TemplateBlueprintElement): TemplateGridRect | null {
  return getGridRect(asRecord(getBlueprintVisualConstants(element)?.geometry))
}

function getBlueprintRenderSpec(element: TemplateBlueprintElement): Record<string, unknown> {
  const constants = getBlueprintVisualConstants(element) ?? {}
  return {
    ...constants,
    spec_id: element.spec_id ?? undefined,
    source_element_id: element.source_element_id ?? undefined,
    atom_type: element.atom_type ?? undefined,
    component_role: element.semantic_role ?? undefined,
    content_intent: element.content_intent ?? undefined,
  }
}

function getBlueprintModeElements(
  snapshot: TemplateSnapshot | null | undefined,
  slideIndex: number,
): TemplateModeElement[] | null {
  const slide = getBlueprintSlide(snapshot, slideIndex)
  if (!slide) return null

  return slide.elements.flatMap((blueprintElement) => {
    const overrideKey = stringValue(blueprintElement.element_key)
    if (!overrideKey) return []

    const constants = getBlueprintVisualConstants(blueprintElement)
    const atomType = (stringValue(blueprintElement.atom_type) ?? 'element').toUpperCase()
    const role = stringValue(blueprintElement.semantic_role) ?? 'slot'
    const renderSpec = getBlueprintRenderSpec(blueprintElement)
    const contentIntent = stringValue(blueprintElement.content_intent) ?? stringValue(blueprintElement.purpose)

    return [{
      overrideKey,
      label: `${role}${atomType ? ` (${atomType})` : ''}`,
      atomType,
      role,
      contentIntent,
      geometry: getGeometry(asRecord(constants?.geometry)),
      gridRect: getBlueprintGridRect(blueprintElement),
      styleHints: asRecord(constants?.style_hints),
      renderedImageUrl: stringValue(constants?.rendered_image_url) ?? getRenderedImageUrl(renderSpec),
      fixedness: blueprintElement.fixedness,
      purpose: stringValue(blueprintElement.purpose),
      requiredInput: stringValue(blueprintElement.required_input),
      populationRule: stringValue(blueprintElement.population_rule),
      blueprintElement,
      element: null,
      renderSpec,
    } satisfies TemplateModeElement]
  })
}

export function getTemplateModeElements(
  snapshot: TemplateSnapshot | null | undefined,
  slideIndex: number,
): TemplateModeElement[] {
  const blueprintElements = getBlueprintModeElements(snapshot, slideIndex)
  if (blueprintElements) return blueprintElements

  const entry = getFrozenPlanEntry(snapshot, slideIndex)
  const layoutPlan = getLayoutPlan(entry)
  const elements = getLayoutElements(layoutPlan)

  return getRenderSpecs(layoutPlan).flatMap((renderSpec) => {
    const element = getElementForSpec(renderSpec, elements)
    const overrideKey = getSpecOverrideKey(renderSpec, element)
    if (!overrideKey) return []

    const atomType = getAtomType(renderSpec, element)
    const role = getRole(renderSpec, element)
    const contentIntent = stringValue(element?.content_intent) ?? stringValue(renderSpec.content_intent)

    return [{
      overrideKey,
      label: `${role}${atomType ? ` (${atomType})` : ''}`,
      atomType,
      role,
      contentIntent,
      geometry: getGeometry(element),
      gridRect: getGridRect(element),
      styleHints: asRecord(element?.style_hints),
      renderedImageUrl: getRenderedImageUrl(renderSpec),
      fixedness: null,
      purpose: null,
      requiredInput: null,
      populationRule: null,
      blueprintElement: null,
      element,
      renderSpec,
    } satisfies TemplateModeElement]
  })
}

export function summarizeRecord(value: unknown, maxItems = 4): string | null {
  const record = asRecord(value)
  if (!record) return null
  const entries = Object.entries(record).filter(([, item]) => item != null)
  if (entries.length === 0) return null
  return entries
    .slice(0, maxItems)
    .map(([key, item]) => `${key}: ${typeof item === 'object' ? 'set' : String(item)}`)
    .join(', ')
}
