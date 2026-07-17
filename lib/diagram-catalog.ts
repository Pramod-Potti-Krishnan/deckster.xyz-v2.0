import type { TextLabsDiagramSubtype } from '@/types/textlabs'

export const DIAGRAM_CATALOG_VERSION = '2.0.0'

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
}

const pathFor = (type: TextLabsDiagramSubtype) => `/v1.2/atomic/${type}`

const DIAGRAM_CATALOG_RAW: DiagramCatalog = {
  catalog_version: DIAGRAM_CATALOG_VERSION,
  endpoint_version: '1.10.0',
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
          primary: true,
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
        column_count: { type: 'enum', enum: [3, 4, 5], default: 4, primary: true },
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
        num_stages: { type: 'integer', min: 3, max: 6, default: 5, primary: true },
        time_unit: {
          type: 'enum',
          enum: ['quarters', 'months', 'years', 'stages'],
          default: 'stages',
          primary: true,
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
    },
  ],
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

function isCatalog(value: unknown): value is DiagramCatalog {
  if (!value || typeof value !== 'object') return false
  const catalog = value as Partial<DiagramCatalog>
  return typeof catalog.catalog_version === 'string'
    && Array.isArray(catalog.types)
    && catalog.types.length > 0
    && catalog.types.every(item => (
      item
      && typeof item === 'object'
      && typeof item.type === 'string'
      && typeof item.label === 'string'
      && item.config
      && typeof item.config === 'object'
    ))
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
    if (!isCatalog(payload)) throw new Error('Diagram catalog response is invalid')
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
