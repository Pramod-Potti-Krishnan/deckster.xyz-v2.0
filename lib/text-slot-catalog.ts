import type {
  TemplateSlotCatalog,
  TemplateTextSlot,
  TextLabsPositionConfig,
  TextSemanticRole,
  TextSlotKind,
} from '@/types/textlabs'

const TEXT_ROLES = new Set<TextSemanticRole>([
  'BODY_TEXT',
  'SLIDE_TITLE',
  'SLIDE_SUBTITLE',
  'PRESENTATION_TITLE',
  'PRESENTATION_SUBTITLE',
  'EYEBROW',
  'AUTHOR_INFO',
  'SECTION_NUMBER',
  'SECTION_TITLE',
  'SECTION_SUBTITLE',
  'CLOSING_TITLE',
  'CLOSING_SUBTITLE',
  'CONTACT_INFO',
  'QUOTE_ATTRIBUTION',
  'FOOTER',
  'SOURCES',
])

export const BODY_TEXT_AUTO_SLOT = '__body_text_auto__'

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function optionalBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeRole(value: unknown): TextSemanticRole | null {
  const normalized = optionalString(value)?.toUpperCase().replace(/[ -]+/g, '_')
  return normalized && TEXT_ROLES.has(normalized as TextSemanticRole)
    ? normalized as TextSemanticRole
    : null
}

function normalizeKind(value: unknown, role: TextSemanticRole | null, accessoryType: string | null): TextSlotKind {
  const normalized = optionalString(value)?.toLowerCase()
  if (normalized === 'accessory' || accessoryType) return 'accessory'
  if (normalized === 'system' || role === 'SOURCES' || role === 'FOOTER') return 'system'
  if (normalized === 'body' || role === 'BODY_TEXT') return 'body'
  return 'structural'
}

function normalizeGeometry(value: unknown): Partial<TextLabsPositionConfig> | null {
  const source = record(value)
  if (!source) return null
  const geometry: Partial<TextLabsPositionConfig> = {}
  for (const [key, aliases] of Object.entries({
    start_col: ['start_col', 'startCol'],
    start_row: ['start_row', 'startRow'],
    position_width: ['position_width', 'grid_width', 'gridWidth', 'width'],
    position_height: ['position_height', 'grid_height', 'gridHeight', 'height'],
  })) {
    const found = aliases.map(alias => source[alias]).find(item => typeof item === 'number')
    if (typeof found === 'number') geometry[key as keyof TextLabsPositionConfig] = found as never
  }
  return Object.keys(geometry).length ? geometry : null
}

function titleCase(value: string): string {
  return value.toLowerCase().split('_').map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')
}

function normalizeSlot(value: unknown): TemplateTextSlot | null {
  const source = record(value)
  if (!source) return null
  const role = normalizeRole(source.role ?? source.semantic_role ?? source.semanticRole)
  const accessoryType = optionalString(source.accessory_type ?? source.accessoryType)?.toUpperCase() ?? null
  const slotName = optionalString(source.slot_name ?? source.slotName ?? source.name ?? source.id)
  if (!slotName) return null
  const kind = normalizeKind(source.kind ?? source.slot_kind ?? source.slotKind, role, accessoryType)
  if (!role && kind !== 'accessory') return null
  return {
    slot_name: slotName,
    label: optionalString(source.label ?? source.display_name ?? source.displayName)
      ?? (accessoryType ? titleCase(accessoryType) : titleCase(role!)),
    role,
    kind,
    accessory_type: accessoryType,
    supported: optionalBoolean(source.supported ?? source.available, true),
    optional: optionalBoolean(source.optional),
    single_instance: optionalBoolean(source.single_instance ?? source.singleInstance, role !== 'BODY_TEXT'),
    system_managed: optionalBoolean(source.system_managed ?? source.systemManaged, kind === 'system'),
    geometry: normalizeGeometry(source.geometry ?? source.grid_position ?? source.gridPosition),
    typography: record(source.typography),
  }
}

/** Parse Layout's live template-slot response without hardcoding template definitions. */
export function parseTemplateSlotCatalog(value: unknown): TemplateSlotCatalog {
  const source = record(value)
  if (!source) return { slots: [] }
  const payload = record(source.catalog ?? source.data) ?? source
  const rawSlots = Array.isArray(payload.slots) ? payload.slots : []
  const seen = new Set<string>()
  const slots = rawSlots.flatMap(item => {
    const slot = normalizeSlot(item)
    if (!slot || !slot.supported || seen.has(slot.slot_name)) return []
    seen.add(slot.slot_name)
    return [slot]
  })
  return {
    canvas_type: optionalString(payload.canvas_type ?? payload.canvasType),
    template_id: optionalString(payload.template_id ?? payload.templateId ?? payload.layout_id ?? payload.layoutId),
    slots,
  }
}

export function slotSelectionValue(slot: TemplateTextSlot): string {
  return `slot:${slot.slot_name}`
}

export function findSelectedSlot(catalog: TemplateSlotCatalog, value: string): TemplateTextSlot | null {
  if (value === BODY_TEXT_AUTO_SLOT) return null
  const slotName = value.startsWith('slot:') ? value.slice(5) : value
  return catalog.slots.find(slot => slot.slot_name === slotName) ?? null
}

export function selectionForExistingTarget(
  catalog: TemplateSlotCatalog,
  target?: { semanticRole?: TextSemanticRole | null; slotName?: string | null; accessoryType?: string | null } | null,
): string {
  if (!target) return BODY_TEXT_AUTO_SLOT
  if (target.slotName && catalog.slots.some(slot => slot.slot_name === target.slotName)) {
    return `slot:${target.slotName}`
  }
  const matchingRole = catalog.slots.find(slot => slot.role === target.semanticRole)
  if (matchingRole) return slotSelectionValue(matchingRole)
  const matchingAccessory = catalog.slots.find(slot => slot.accessory_type === target.accessoryType)
  return matchingAccessory ? slotSelectionValue(matchingAccessory) : BODY_TEXT_AUTO_SLOT
}
