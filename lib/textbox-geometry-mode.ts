import type { TextGeometryMode, TextManualGeometryOverrides } from '@/types/textlabs'

export interface EffectiveTextGeometry {
  geometryMode: TextGeometryMode
  manualGeometryOverrides?: TextManualGeometryOverrides
}

export function effectiveTextGeometry(
  geometryMode: TextGeometryMode,
  manualGeometryOverrides: TextManualGeometryOverrides,
): EffectiveTextGeometry {
  if (geometryMode !== 'MANUAL' || Object.keys(manualGeometryOverrides).length === 0) {
    return { geometryMode: 'AUTO' }
  }
  return {
    geometryMode: 'MANUAL',
    manualGeometryOverrides,
  }
}
