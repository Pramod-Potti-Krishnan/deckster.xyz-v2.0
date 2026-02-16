import { ElementType } from '@/types/elements'
import { TextLabsComponentType } from '@/types/textlabs'

/**
 * Maps iframe ElementType → TextLabsComponentType.
 * Returns null for types that have no TextLabs equivalent (e.g. 'hero').
 */
const IFRAME_TO_TEXTLABS: Record<ElementType, TextLabsComponentType | null> = {
  text: 'TEXT_BOX',
  image: 'IMAGE',
  table: 'TABLE',
  chart: 'CHART',
  infographic: 'INFOGRAPHIC',
  diagram: 'DIAGRAM',
  hero: null,
}

export function iframeTypeToTextLabs(type: ElementType): TextLabsComponentType | null {
  return IFRAME_TO_TEXTLABS[type] ?? null
}

export function isTextLabsMappable(type: ElementType): boolean {
  return IFRAME_TO_TEXTLABS[type] != null
}
