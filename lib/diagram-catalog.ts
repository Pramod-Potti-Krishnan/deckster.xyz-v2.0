import type { TextLabsDiagramSubtype } from '@/types/textlabs'

export const DIAGRAM_CATALOG_VERSION = '2.1.0'

export interface DiagramCatalogField {
  type: 'enum' | 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object'
  enum?: Array<string | number>
  min?: number
  max?: number
  default?: unknown
  primary?: boolean
  advanced?: boolean
  omit_when_auto?: boolean
}

export interface DiagramCatalogType {
  type: TextLabsDiagramSubtype
  label: string
  component_id: string
  experimental: boolean
  research_capable: boolean
  path: string
  config: Record<string, DiagramCatalogField>
  features?: Record<string, unknown>
  limits?: Record<string, number>
}

export interface DiagramCatalog {
  catalog_version: string
  endpoint_version: string
  geometry: {
    columns: number
    rows: number
    step: number
    pixels_per_unit: number
    pixels_per_step: number
    coordinate_origin: number
    end_rule: string
  }
  types: DiagramCatalogType[]
  orchestration: {
    component_type: 'DIAGRAM_AUTO'
    selection_modes: string[]
    auto_routing: {
      leaf_types: TextLabsDiagramSubtype[]
      fallback_type: TextLabsDiagramSubtype
      strategy: string
      persists: string[]
    }
    code_language_selection: {
      modes: string[]
      auto_omit_leaf_language: boolean
      legacy_omission: string
      persists: string[]
    }
  }
}

const pathFor = (type: TextLabsDiagramSubtype) => `/v1.2/atomic/${type}`

const DIAGRAM_CATALOG_RAW: DiagramCatalog = {
  catalog_version: DIAGRAM_CATALOG_VERSION,
  endpoint_version: '1.11.0',
  geometry: {
    columns: 32,
    rows: 18,
    step: 0.2,
    pixels_per_unit: 60,
    pixels_per_step: 12,
    coordinate_origin: 1,
    end_rule: 'start - 1 + size <= bound',
  },
  types: [
    {
      type: 'CODE_DISPLAY',
      label: 'Code Display',
      component_id: 'code_display',
      experimental: false,
      research_capable: false,
      path: pathFor('CODE_DISPLAY'),
      config: {
        language_mode: {
          type: 'enum',
          enum: ['auto', 'manual', 'legacy'],
          default: 'auto',
          primary: true,
        },
        color_theme: {
          type: 'enum',
          enum: ['github_light', 'github_dark', 'monokai', 'solarized_dark', 'dracula'],
          default: 'github_dark',
          primary: true,
        },
        language: {
          type: 'enum',
          enum: [
            'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'sql',
            'bash', 'ruby', 'kotlin', 'swift', 'scala', 'php',
          ],
          default: 'python',
          advanced: true,
        },
        position_preset: {
          type: 'enum',
          enum: [
            'full_content', 'left_half', 'right_half', 'left_third',
            'center_third', 'right_third', 'top_half', 'bottom_half',
          ],
          advanced: true,
        },
      },
    },
    {
      type: 'KANBAN_BOARD',
      label: 'Kanban Board',
      component_id: 'kanban_board',
      experimental: false,
      research_capable: true,
      path: pathFor('KANBAN_BOARD'),
      config: {
        column_count: {
          type: 'enum',
          enum: [3, 4, 5],
          primary: true,
          omit_when_auto: true,
        },
        theme: {
          type: 'enum',
          enum: ['auto', 'default', 'dark', 'minimal'],
          default: 'auto',
          advanced: true,
          omit_when_auto: true,
        },
        theme_mode: { type: 'enum', enum: ['light', 'dark'], default: 'light', advanced: true },
        position_preset: {
          type: 'enum',
          enum: ['full_content', 'left_two_thirds', 'right_two_thirds'],
          advanced: true,
        },
      },
    },
    {
      type: 'GANTT_CHART',
      label: 'Gantt Chart',
      component_id: 'gantt_chart',
      experimental: false,
      research_capable: true,
      path: pathFor('GANTT_CHART'),
      config: {
        time_unit: { type: 'enum', enum: ['days', 'weeks', 'months'], default: 'weeks', primary: true },
        task_column_width_px: {
          type: 'integer',
          min: 270,
          max: 405,
          default: 270,
          advanced: true,
        },
        theme: {
          type: 'enum',
          enum: ['auto', 'default', 'ocean', 'forest'],
          default: 'auto',
          advanced: true,
          omit_when_auto: true,
        },
        theme_mode: { type: 'enum', enum: ['light', 'dark'], default: 'light', advanced: true },
        position_preset: { type: 'enum', enum: ['full_content', 'left_four_fifths'], advanced: true },
      },
    },
    {
      type: 'CHEVRON_MATURITY',
      label: 'Maturity',
      component_id: 'chevron_maturity',
      experimental: false,
      research_capable: true,
      path: pathFor('CHEVRON_MATURITY'),
      config: {
        num_stages: {
          type: 'integer',
          min: 3,
          max: 6,
          primary: true,
          omit_when_auto: true,
        },
        time_unit: {
          type: 'enum',
          enum: ['quarters', 'months', 'years', 'stages'],
          default: 'stages',
          primary: true,
        },
        row_label_width_px: {
          type: 'integer',
          min: 180,
          max: 270,
          default: 180,
          advanced: true,
        },
        theme: {
          type: 'enum',
          enum: ['auto', 'default', 'emerald', 'purple'],
          default: 'auto',
          advanced: true,
          omit_when_auto: true,
        },
        theme_mode: { type: 'enum', enum: ['light', 'dark'], default: 'light', advanced: true },
        position_preset: { type: 'enum', enum: ['full_content', 'left_four_fifths'], advanced: true },
      },
    },
    {
      type: 'IDEA_BOARD',
      label: 'Idea Board',
      component_id: 'idea_board',
      experimental: false,
      research_capable: true,
      path: pathFor('IDEA_BOARD'),
      config: {
        axis_preset: {
          type: 'enum',
          enum: ['impact_urgency', 'effort_value', 'risk_reward', 'cost_benefit', 'feasibility_desirability'],
          default: 'impact_urgency',
          primary: true,
        },
        theme: {
          type: 'enum',
          enum: ['auto', 'default', 'emerald', 'purple', 'ocean'],
          default: 'auto',
          advanced: true,
          omit_when_auto: true,
        },
        theme_mode: { type: 'enum', enum: ['light', 'dark'], default: 'light', advanced: true },
        position_preset: { type: 'enum', enum: ['full_content', 'left_four_fifths'], advanced: true },
      },
    },
    {
      type: 'CLOUD_ARCHITECTURE',
      label: 'Cloud Architecture',
      component_id: 'cloud_architecture',
      experimental: false,
      research_capable: true,
      path: pathFor('CLOUD_ARCHITECTURE'),
      config: {
        provider: {
          type: 'enum',
          enum: ['auto', 'aws', 'gcp', 'azure', 'generic'],
          default: 'auto',
          primary: true,
          omit_when_auto: true,
        },
        theme_mode: { type: 'enum', enum: ['light', 'dark'], default: 'light', advanced: true },
        position_preset: { type: 'enum', enum: ['full_content', 'left_four_fifths'], advanced: true },
      },
    },
    {
      type: 'LOGICAL_ARCHITECTURE',
      label: 'Logical Architecture',
      component_id: 'logical_architecture',
      experimental: false,
      research_capable: true,
      path: pathFor('LOGICAL_ARCHITECTURE'),
      config: {
        theme_mode: { type: 'enum', enum: ['light', 'dark'], default: 'light', advanced: true },
        position_preset: { type: 'enum', enum: ['full_content', 'left_four_fifths'], advanced: true },
      },
    },
    {
      type: 'DATA_ARCHITECTURE',
      label: 'Data Architecture',
      component_id: 'data_architecture',
      experimental: false,
      research_capable: true,
      path: pathFor('DATA_ARCHITECTURE'),
      config: {
        theme_mode: { type: 'enum', enum: ['light', 'dark'], default: 'light', advanced: true },
        position_preset: { type: 'enum', enum: ['full_content', 'left_four_fifths'], advanced: true },
      },
    },
    {
      type: 'CUSTOM',
      label: 'Custom',
      component_id: 'custom',
      experimental: true,
      research_capable: true,
      path: pathFor('CUSTOM'),
      config: {
        layout_hint: {
          type: 'enum',
          enum: ['auto', 'flow', 'hierarchy', 'radial', 'matrix', 'network'],
          default: 'auto',
          primary: true,
          omit_when_auto: true,
        },
        theme_mode: { type: 'enum', enum: ['light', 'dark'], default: 'light', advanced: true },
        position_preset: { type: 'enum', enum: ['full_content', 'left_four_fifths'], advanced: true },
      },
      features: {
        existing_ir_refinement: true,
        node_detail_popups: true,
        semantic_edge_kinds: [
          'default', 'power', 'process', 'signal', 'control', 'safety',
        ],
      },
      limits: {
        prompt_max_chars: 1200,
        nodes_max: 36,
        edges_max: 64,
        groups_max: 8,
        annotations_max: 16,
      },
    },
  ],
  orchestration: {
    component_type: 'DIAGRAM_AUTO',
    selection_modes: ['auto', 'manual'],
    auto_routing: {
      leaf_types: [
        'CODE_DISPLAY',
        'KANBAN_BOARD',
        'GANTT_CHART',
        'CHEVRON_MATURITY',
        'IDEA_BOARD',
        'CLOUD_ARCHITECTURE',
        'LOGICAL_ARCHITECTURE',
        'DATA_ARCHITECTURE',
        'CUSTOM',
      ],
      fallback_type: 'CUSTOM',
      strategy: 'lexical_then_intent_classifier',
      persists: [
        'selection_mode',
        'resolved_type',
        'routing_confidence',
        'routing_source',
      ],
    },
    code_language_selection: {
      modes: ['auto', 'manual'],
      auto_omit_leaf_language: true,
      legacy_omission: 'python',
      persists: ['language_selection', 'resolved_language', 'source_code'],
    },
  },
}

export const DIAGRAM_CATALOG_FALLBACK: DiagramCatalog = {
  ...DIAGRAM_CATALOG_RAW,
  types: DIAGRAM_CATALOG_RAW.types.map(item => ({
    ...item,
    config: Object.fromEntries(
      Object.entries(item.config).map(([key, field]) => [
        key,
        {
          ...field,
          primary: field.primary ?? false,
          advanced: field.advanced ?? false,
        },
      ]),
    ),
  })),
}

let cachedCatalog: { value: DiagramCatalog; expiresAt: number } | null = null

const REQUIRED_DIAGRAM_TYPES: TextLabsDiagramSubtype[] = [
  'CODE_DISPLAY',
  'KANBAN_BOARD',
  'GANTT_CHART',
  'CHEVRON_MATURITY',
  'IDEA_BOARD',
  'CLOUD_ARCHITECTURE',
  'LOGICAL_ARCHITECTURE',
  'DATA_ARCHITECTURE',
  'CUSTOM',
]

function stringArrayIncludesEvery(value: unknown, required: readonly string[]): boolean {
  return Array.isArray(value)
    && required.every(item => value.includes(item))
}

function parseSemver(version: unknown): [number, number, number] | null {
  if (typeof version !== 'string') return null
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim())
  return match
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : null
}

export function isCompatibleDiagramCatalogVersion(version: unknown): boolean {
  const parsed = parseSemver(version)
  if (!parsed) return false
  const [major, minor] = parsed
  return major === 2 && minor >= 1
}

export function isCompatibleDiagramCatalog(value: unknown): value is DiagramCatalog {
  if (!value || typeof value !== 'object') return false
  const catalog = value as Partial<DiagramCatalog>
  if (!isCompatibleDiagramCatalogVersion(catalog.catalog_version)) return false
  if (
    !Array.isArray(catalog.types)
    || !catalog.types.length
    || !catalog.types.every(item => (
      item
      && typeof item === 'object'
      && typeof item.type === 'string'
      && typeof item.label === 'string'
      && item.config
      && typeof item.config === 'object'
    ))
  ) return false
  if (!stringArrayIncludesEvery(
    catalog.types.map(item => item.type),
    REQUIRED_DIAGRAM_TYPES,
  )) return false

  const orchestration = catalog.orchestration as DiagramCatalog['orchestration'] | undefined
  return orchestration?.component_type === 'DIAGRAM_AUTO'
    && stringArrayIncludesEvery(orchestration.selection_modes, ['auto', 'manual'])
    && stringArrayIncludesEvery(
      orchestration.auto_routing?.leaf_types,
      REQUIRED_DIAGRAM_TYPES,
    )
    && orchestration.auto_routing?.fallback_type === 'CUSTOM'
    && stringArrayIncludesEvery(
      orchestration.code_language_selection?.modes,
      ['auto', 'manual'],
    )
    && orchestration.code_language_selection?.auto_omit_leaf_language === true
}

export async function fetchDiagramCatalog(
  baseUrl = process.env.NEXT_PUBLIC_ELEMENTOR_URL || 'https://web-production-3b42.up.railway.app',
  signal?: AbortSignal,
): Promise<DiagramCatalog> {
  const now = Date.now()
  if (cachedCatalog && cachedCatalog.expiresAt > now) return cachedCatalog.value

  try {
    const response = await fetch(`${baseUrl}/api/diagram/catalog`, {
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!response.ok) throw new Error(`Diagram catalog request failed: ${response.status}`)
    const payload: unknown = await response.json()
    if (!isCompatibleDiagramCatalog(payload)) {
      throw new Error('Diagram catalog is missing the required v2.1 orchestration capabilities')
    }
    cachedCatalog = { value: payload, expiresAt: now + 5 * 60_000 }
    return payload
  } catch (error) {
    if (signal?.aborted) throw error
    console.warn('[DiagramCatalog] Using the versioned fallback catalog:', error)
    cachedCatalog = { value: DIAGRAM_CATALOG_FALLBACK, expiresAt: now + 60_000 }
    return DIAGRAM_CATALOG_FALLBACK
  }
}

export function catalogType(
  catalog: DiagramCatalog,
  type: TextLabsDiagramSubtype,
): DiagramCatalogType {
  return catalog.types.find(item => item.type === type)
    ?? DIAGRAM_CATALOG_FALLBACK.types.find(item => item.type === type)!
}

function normalizedCatalogString(
  field: DiagramCatalogField | undefined,
  value: unknown,
  fallback: string | null,
  aliases: Record<string, string> = {},
): string | null {
  if (typeof value !== 'string') return fallback
  const mapped = aliases[value.trim().toLowerCase()] ?? value.trim().toLowerCase()
  const allowed = (field?.enum ?? []).filter((item): item is string => typeof item === 'string')
  return allowed.includes(mapped) ? mapped : fallback
}

function normalizedCatalogNumber(
  field: DiagramCatalogField | undefined,
  value: unknown,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const allowed = (field?.enum ?? []).filter((item): item is number => typeof item === 'number')
  if (allowed.length) {
    return allowed.reduce((closest, candidate) => (
      Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
    ), allowed[0])
  }
  return Math.round(Math.min(field?.max ?? value, Math.max(field?.min ?? value, value)))
}

/**
 * Translate persisted pre-catalog diagram settings into the current strict
 * leaf contract. Unknown fields are intentionally dropped, Auto values are
 * omitted, and only aliases with unambiguous semantics are migrated.
 */
export function normalizePersistedDiagramSettings(
  catalog: DiagramCatalog,
  type: TextLabsDiagramSubtype,
  persisted: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const input = persisted ?? {}
  const config = catalogType(catalog, type).config
  const normalized: Record<string, unknown> = {}
  const theme = normalizedCatalogString(config.theme, input.theme, null)
  const position = normalizedCatalogString(config.position_preset, input.position_preset, null)
  if (theme && theme !== 'auto') normalized.theme = theme
  if (position && position !== 'auto') normalized.position_preset = position

  switch (type) {
    case 'CODE_DISPLAY':
      normalized.language = normalizedCatalogString(config.language, input.language, 'python')
      normalized.color_theme = normalizedCatalogString(
        config.color_theme,
        input.color_theme,
        'github_dark',
        { solarized: 'solarized_dark', nord: 'github_dark' },
      )
      normalized.text_size = ['small', 'medium', 'large'].includes(String(input.text_size))
        ? input.text_size
        : 'medium'
      normalized.show_line_numbers = typeof input.show_line_numbers === 'boolean'
        ? input.show_line_numbers
        : true
      normalized.show_copy_button = typeof input.show_copy_button === 'boolean'
        ? input.show_copy_button
        : true
      normalized.corner_style = input.corner_style === 'square' ? 'square' : 'rounded'
      break
    case 'KANBAN_BOARD':
      if (input.column_count !== undefined && input.column_count !== null) {
        normalized.column_count = normalizedCatalogNumber(config.column_count, input.column_count, 4)
      }
      break
    case 'GANTT_CHART':
      normalized.time_unit = normalizedCatalogString(
        config.time_unit, input.time_unit, 'weeks', { quarters: 'months' },
      )
      break
    case 'CHEVRON_MATURITY':
      if (input.num_stages !== undefined && input.num_stages !== null) {
        normalized.num_stages = normalizedCatalogNumber(config.num_stages, input.num_stages, 5)
      }
      normalized.time_unit = normalizedCatalogString(config.time_unit, input.time_unit, 'stages')
      break
    case 'IDEA_BOARD':
      normalized.axis_preset = normalizedCatalogString(
        config.axis_preset,
        input.axis_preset,
        'impact_urgency',
        { impact_effort: 'effort_value', custom: 'impact_urgency' },
      )
      break
    case 'CLOUD_ARCHITECTURE':
      normalized.show_layers = typeof input.show_layers === 'boolean' ? input.show_layers : true
      {
        const provider = normalizedCatalogString(config.provider, input.provider, null)
        if (provider && provider !== 'auto') normalized.provider = provider
      }
      break
    case 'DATA_ARCHITECTURE':
      normalized.show_data_types = typeof input.show_data_types === 'boolean'
        ? input.show_data_types
        : true
      normalized.show_nullable = typeof input.show_nullable === 'boolean'
        ? input.show_nullable
        : true
      break
    case 'CUSTOM': {
      const layout = normalizedCatalogString(config.layout_hint, input.layout_hint, null)
      if (layout && layout !== 'auto') normalized.layout_hint = layout
      break
    }
    case 'LOGICAL_ARCHITECTURE':
      break
  }
  return normalized
}

export function normalizePersistedDiagramSubtype(value: unknown): TextLabsDiagramSubtype | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase().replace(/[-\s]+/g, '_')
  return DIAGRAM_CATALOG_FALLBACK.types.some(item => item.type === normalized)
    ? normalized as TextLabsDiagramSubtype
    : null
}
