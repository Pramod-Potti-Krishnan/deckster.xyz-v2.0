import type { MetricsConfig } from '@/types/textlabs'

export const METRICS_CARD_COLOR_PRESETS = [
  { name: 'purple', label: 'Purple', hex: '#805AA0', pastelHex: '#C9A6E8' },
  { name: 'blue', label: 'Blue', hex: '#2980B9', pastelHex: '#90C4E8' },
  { name: 'green', label: 'Green', hex: '#27AE60', pastelHex: '#8ED4A8' },
  { name: 'red', label: 'Red', hex: '#C0392B', pastelHex: '#E8A09A' },
  { name: 'cyan', label: 'Cyan', hex: '#0097A7', pastelHex: '#80D4DE' },
  { name: 'orange', label: 'Orange', hex: '#E65100', pastelHex: '#F4B88A' },
  { name: 'pink', label: 'Pink', hex: '#C2185B', pastelHex: '#E890B2' },
  { name: 'yellow', label: 'Gold', hex: '#D39E1E', pastelHex: '#EDD08E' },
  { name: 'teal', label: 'Teal', hex: '#00796B', pastelHex: '#80C4BB' },
  { name: 'indigo', label: 'Indigo', hex: '#3949AB', pastelHex: '#9CA6D8' },
] as const

export type MetricsCardColorName = typeof METRICS_CARD_COLOR_PRESETS[number]['name']
export type MetricsCardColorChoice = 'auto' | 'transparent' | MetricsCardColorName

export function resolveMetricsCardColorPatch(
  currentSurface: MetricsConfig['color_scheme'] | undefined,
  choice: MetricsCardColorChoice,
): Pick<Partial<MetricsConfig>, 'color_scheme' | 'color_variant'> {
  if (choice === 'auto') {
    return {
      color_scheme: currentSurface === 'transparent' ? undefined : currentSurface,
      color_variant: undefined,
    }
  }
  if (choice === 'transparent') {
    return {
      color_scheme: 'transparent',
      color_variant: undefined,
    }
  }
  return {
    color_scheme: currentSurface ?? 'solid',
    color_variant: choice,
  }
}
