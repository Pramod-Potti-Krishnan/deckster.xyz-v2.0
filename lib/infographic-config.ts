import type {
  InfographicConfig,
  InfographicMode,
  InfographicSegmentCount,
  InfographicV2Segment,
} from '@/types/textlabs'

export interface InfographicGeometry {
  start_col: number
  start_row: number
  width: number
  height: number
}

export interface InfographicConfigInput {
  mode: InfographicMode
  geometry: InfographicGeometry
  segmentCount?: InfographicSegmentCount
  contentMode?: 'automatic' | 'manual'
  manualSegments?: InfographicV2Segment[]
  overrides?: Partial<Pick<
    InfographicConfig,
    | 'aspect_ratio'
    | 'crop_mode'
    | 'target_background'
    | 'fill_internal'
    | 'layout_family'
    | 'template_id'
    | 'segment_colors'
    | 'text_mode'
    | 'show_icons'
  >>
}

const PLACEHOLDER_COPY = /^(?:(?:segment|step|stage|phase|item|point)\s*\d+|tbd|todo|placeholder|sample)$/i
const COPY_LIMITS = {
  label: [2, 36],
  sublabel: [4, 72],
  description: [8, 180],
  icon_hint: [2, 48],
} as const

function trimmedOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function normalizedIconHint(value: string): string {
  const generic = new Set(['icon', 'symbol', 'glyph', 'outline', 'illustration', 'graphic'])
  return value
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token && !generic.has(token))
    .sort()
    .join(' ')
}

export function normalizeManualInfographicSegments(
  segments: InfographicV2Segment[],
): InfographicV2Segment[] {
  return segments.map(segment => ({
    label: segment.label.trim(),
    sublabel: trimmedOptional(segment.sublabel),
    description: trimmedOptional(segment.description),
    icon_hint: trimmedOptional(segment.icon_hint),
    color: trimmedOptional(segment.color),
    connector_side: segment.connector_side ?? undefined,
  }))
}

export function validateManualInfographicSegments(
  segments: InfographicV2Segment[],
): string | null {
  if (segments.length < 2 || segments.length > 8) {
    return 'Manual content requires between 2 and 8 segments.'
  }

  const normalized = normalizeManualInfographicSegments(segments)
  const uniqueValues = {
    label: new Set<string>(),
    sublabel: new Set<string>(),
    description: new Set<string>(),
    icon_hint: new Set<string>(),
  }
  for (const [index, segment] of normalized.entries()) {
    const fields = {
      label: segment.label,
      sublabel: segment.sublabel,
      description: segment.description,
      icon_hint: segment.icon_hint,
    }
    for (const [field, value] of Object.entries(fields) as Array<
      [keyof typeof fields, string | undefined]
    >) {
      const label = field === 'label'
        ? 'heading'
        : field === 'sublabel'
          ? 'explanatory line'
          : field === 'icon_hint'
            ? 'icon hint'
            : 'supporting description'
      if (!value) return `Segment ${index + 1} needs a ${label}.`
      const [min, max] = COPY_LIMITS[field]
      if (value.length < min || value.length > max) {
        return `Segment ${index + 1} ${label} must be ${min}-${max} characters.`
      }
      if (PLACEHOLDER_COPY.test(value)) {
        return `Segment ${index + 1} needs meaningful ${label} copy, not "${value}".`
      }
      const normalizedValue = field === 'icon_hint'
        ? normalizedIconHint(value)
        : value.toLocaleLowerCase()
      if (!normalizedValue) {
        return `Segment ${index + 1} needs a specific icon concept.`
      }
      if (uniqueValues[field].has(normalizedValue)) {
        return `Manual segment ${label}s must be unique.`
      }
      uniqueValues[field].add(normalizedValue)
    }
  }
  return null
}

export function buildSparseInfographicConfig(
  input: InfographicConfigInput,
): Partial<InfographicConfig> {
  const { geometry, mode, overrides = {} } = input
  const config: Partial<InfographicConfig> = {
    mode,
    grid_row: `${geometry.start_row}/${geometry.start_row + geometry.height}`,
    grid_column: `${geometry.start_col}/${geometry.start_col + geometry.width}`,
    start_col: geometry.start_col,
    start_row: geometry.start_row,
    width: geometry.width,
    height: geometry.height,
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null || value === '') continue
    ;(config as Record<string, unknown>)[key] = value
  }

  if (input.contentMode === 'manual') {
    config.content_mode = 'manual'
    config.segments = normalizeManualInfographicSegments(input.manualSegments ?? [])
  } else if (input.segmentCount !== undefined) {
    config.segment_count = input.segmentCount
  }

  return config
}

export function inferExistingInfographicMode(target?: {
  mode?: unknown
  rendererType?: unknown
  metadata?: unknown
  content?: unknown
} | null): InfographicMode {
  const metadata = target?.metadata && typeof target.metadata === 'object'
    ? target.metadata as Record<string, unknown>
    : null
  const explicitMode = target?.mode
    ?? metadata?.mode
    ?? metadata?.generation_mode
    ?? metadata?.renderer
  const normalizedMode = typeof explicitMode === 'string'
    ? explicitMode.toLocaleLowerCase()
    : ''
  if (normalizedMode === 'v2' || normalizedMode.includes('html_v2') || normalizedMode.includes('structured')) {
    return 'v2'
  }
  if (normalizedMode === 'v1' || normalizedMode.includes('image_v1') || normalizedMode.includes('raster')) {
    return 'v1'
  }

  const rendererValue = target?.rendererType
    ?? metadata?.renderer_type
    ?? metadata?.rendererType
  const rendererType = typeof rendererValue === 'string'
    ? rendererValue.toLocaleLowerCase()
    : ''
  if (rendererType.includes('diagram')) return 'v2'
  if (rendererType.includes('image')) return 'v1'

  const content = typeof target?.content === 'string' ? target.content.trim() : ''
  if (/^<img\b/i.test(content)) return 'v1'
  if (content.startsWith('<') && content.endsWith('>')) return 'v2'
  return 'v1'
}
