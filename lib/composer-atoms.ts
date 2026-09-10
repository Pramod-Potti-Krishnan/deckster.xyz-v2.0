/** The accepted Composer source envelope. Renderer collection is storage only. */
export const COMPOSER_VARIANTS = {
  TEXT_BOX: ['rich_text', 'card', 'scenario_card', 'comparison_row', 'callout'],
  METRICS: ['single', 'card', 'pill', 'total_band', 'shared_panel'],
  TABLE: ['plain'],
  INFOGRAPHIC: ['timeline.alternating_milestones', 'process.connected_steps'],
} as const
export type ComposerFamily = keyof typeof COMPOSER_VARIANTS
export interface ComposerMetadata {
  schema_version: 'deckster-element-source-v1'
  owning_family: ComposerFamily
  variant_id: string
  variant_registry_version: 'composer-taxonomy-v1'
  render_mode: 'precise'
  source: { carrier: 'render_spec' | 'generation_config'; request_pointer: string; params_schema: string; request_sha256: string }
  regeneration_mode: 'deterministic_rerender'
}
export interface ComposerTarget {
  presentationId: string
  slideIndex: number
  collection: 'textboxes' | 'infographics'
  elementId: string
  metadata: ComposerMetadata
}
export interface ComposerSlot { id: string; label: string; role: string; path: string }
export interface ComposerSource { element: Record<string, any>; request: Record<string, any>; metadata: ComposerMetadata; slots: ComposerSlot[] }
export const composerDirectEnabled = () => process.env.NEXT_PUBLIC_COMPOSER_DIRECT_REGENERATE === 'true'

export function validateComposerMetadata(value: unknown): ComposerMetadata {
  const m = value as ComposerMetadata | undefined
  if (!m || m.schema_version !== 'deckster-element-source-v1' || m.variant_registry_version !== 'composer-taxonomy-v1'
    || m.render_mode !== 'precise' || m.regeneration_mode !== 'deterministic_rerender'
    || !Object.hasOwn(COMPOSER_VARIANTS, m.owning_family)
    || !(COMPOSER_VARIANTS[m.owning_family] as readonly string[]).includes(m.variant_id)
    || !/^[a-f0-9]{64}$/.test(m.source?.request_sha256 ?? '')) throw new Error('This saved Composer variant is unsupported.')
  const infographic = m.owning_family === 'INFOGRAPHIC'
  if (m.source.carrier !== (infographic ? 'generation_config' : 'render_spec')
    || m.source.request_pointer !== (infographic ? '/request' : '/generation/request')
    || m.source.params_schema !== (infographic ? 'composer-infographic-atom-v1' : 'composer-text-atom-v2')) {
    throw new Error('This saved Composer source schema is unsupported.')
  }
  return m
}

export function pointerParts(path: string): string[] {
  if (!path.startsWith('/') || /~(?![01])/u.test(path)) throw new Error('Invalid source slot pointer.')
  const parts = path.slice(1).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (parts.some(p => ['__proto__', 'constructor', 'prototype'].includes(p))) throw new Error('Unsafe source slot pointer.')
  return parts
}
export function readPointer(source: any, path: string): any {
  return pointerParts(path).reduce((node, key) => {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, key)
      || (Array.isArray(node) && !/^(0|[1-9][0-9]*)$/.test(key))) return undefined
    return node[key]
  }, source)
}
export function hydrateComposerSource(element: Record<string, any>): ComposerSource {
  const metadata = validateComposerMetadata(element.element_metadata)
  const carrier = element[metadata.source.carrier]
  const request = readPointer(carrier, metadata.source.request_pointer)
  const sourceHash = metadata.source.carrier === 'render_spec' ? carrier?.generation?.request_sha256 : carrier?.request_sha256
  if (element.component_type !== metadata.owning_family || element.frame_owner !== 'layout'
    || element.style_owner !== (metadata.owning_family === 'INFOGRAPHIC' ? 'illustrator' : 'text_service')
    || carrier?.schema_version !== metadata.source.params_schema || sourceHash !== metadata.source.request_sha256
    || !request || request.render_mode !== 'precise' || request.schema_version !== metadata.source.params_schema || request.component_type !== metadata.owning_family
    || request.variant_id !== metadata.variant_id || !Array.isArray(request.editable_slots) || !request.editable_slots.length) {
    throw new Error('The stored source does not match this element’s metadata.')
  }
  const ids = new Set<string>(), paths = new Set<string>()
  const roles = new Set(['heading', 'body', 'value', 'label', 'delta', 'note', 'date', 'stage', 'cell'])
  for (const slot of request.editable_slots) {
    if (!slot || typeof slot.id !== 'string' || typeof slot.label !== 'string' || !roles.has(slot.role)
      || typeof slot.path !== 'string' || !/^\/scene\/(?:node\/params|zone\/units\/(?:0|[1-9][0-9]*)\/atoms\/(?:0|[1-9][0-9]*)\/params)(?:\/cells\/(?:0|[1-9][0-9]*)\/text|\/(?:value|label|delta))?\/paragraphs\/(?:0|[1-9][0-9]*)\/runs\/(?:0|[1-9][0-9]*)\/text$/.test(slot.path)
      || typeof readPointer(request, slot.path) !== 'string' || ids.has(slot.id) || paths.has(slot.path)) {
      throw new Error('The stored editable slots are invalid.')
    }
    ids.add(slot.id); paths.add(slot.path)
  }
  return { element, metadata, request, slots: request.editable_slots }
}

export function applyComposerEdits(source: ComposerSource, edits: Record<string, unknown>, variant: string) {
  if (!(COMPOSER_VARIANTS[source.metadata.owning_family] as readonly string[]).includes(variant)) throw new Error('Unsupported structural variant.')
  const request = structuredClone(source.request)
  const allowed = new Map(source.slots.map(slot => [slot.id, slot]))
  for (const [id, value] of Object.entries(edits)) {
    const slot = allowed.get(id)
    if (!slot || typeof value !== 'string' || value.length > 20000) throw new Error('Only explicit text slot edits are accepted.')
    const parts = pointerParts(slot.path), key = parts.pop()!
    const parent = parts.reduce((node, part) => node[part], request)
    parent[key] = value
  }
  request.variant_id = variant
  return request
}

/** Structural JSON equality, independent of object key ordering. Not a hasher. */
export function sameComposerJson(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object'
    || Array.isArray(left) !== Array.isArray(right)) return false
  const a = Object.keys(left), b = Object.keys(right)
  return a.length === b.length && a.every(key => Object.hasOwn(right, key)
    && sameComposerJson((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]))
}

export function buildComposerReplacement(source: ComposerSource, renderRequest: Record<string, any>, rendered: Record<string, any>) {
  const infographic = source.metadata.owning_family === 'INFOGRAPHIC'
  const carrier = source.element[source.metadata.source.carrier]
  if (rendered.success !== true || rendered.component_type !== source.metadata.owning_family
    || rendered.schema_version !== renderRequest.schema_version || rendered.render_mode !== 'precise'
    || rendered.variant_id !== renderRequest.variant_id || rendered.variant_registry_version !== 'composer-taxonomy-v1'
    || !sameComposerJson(rendered.render_request, renderRequest)
    || !sameComposerJson(rendered.editable_slots, renderRequest.editable_slots)
    || !sameComposerJson(rendered.frame, carrier.frame)
    || !/^[a-f0-9]{64}$/.test(rendered.request_sha256 ?? '') || !/^[a-f0-9]{64}$/.test(rendered.html_sha256 ?? '')
    || rendered.content_sha256 !== rendered.html_sha256 || typeof rendered.html !== 'string' || !rendered.html) {
    throw new Error('The owning service changed the explicit replacement source, identity, frame or content binding.')
  }
  const replacement = structuredClone(source.element)
  for (const key of ['id', 'parent_slide_id', 'created_at', 'updated_at']) delete replacement[key]
  replacement.element_metadata.variant_id = rendered.variant_id
  replacement.element_metadata.source.request_sha256 = rendered.request_sha256
  if (infographic) {
    replacement.html_content = rendered.html
    // `items` is legacy persisted data, not the new typed source. Its original
    // null/array value remains untouched when editing source text.
    replacement.infographic_type = rendered.render_request.scene.zone.kind
    replacement.generation_config = { ...carrier, request: rendered.render_request, request_sha256: rendered.request_sha256, content_sha256: rendered.html_sha256, frame: rendered.frame }
  } else {
    replacement.content = rendered.html
    replacement.render_spec = { ...carrier, frame: rendered.frame, content_sha256: rendered.html_sha256, generation: { ...carrier.generation, request: rendered.render_request, request_sha256: rendered.request_sha256 } }
  }
  return replacement
}

export function verifyComposerReadback(before: Record<string, any>, after: Record<string, any>, collection: 'textboxes' | 'infographics', oldId: string, newId: string) {
  const storage = collection === 'textboxes' ? 'text_boxes' : 'infographics'
  for (const key of ['text_boxes', 'infographics', 'images', 'charts', 'diagrams']) {
    const oldItems = before[key] ?? [], newItems = after[key] ?? []
    const oldIds = oldItems.map((item: any) => item.id), newIds = newItems.map((item: any) => item.id)
    const expected = oldIds.map((id: string) => key === storage && id === oldId ? newId : id)
    if (new Set(newIds).size !== newIds.length || !sameComposerJson(expected, newIds)) throw new Error('Replacement changed the slide element-ID census.')
    for (const original of oldItems) {
      if (key === storage && original.id === oldId) continue
      if (!sameComposerJson(original, newItems.find((item: any) => item.id === original.id))) throw new Error('Replacement readback changed another element.')
    }
  }
}
