import type {
  ElementResearchCapabilities,
  ElementResearchMode,
  ElementResearchPolicy,
  TextLabsAllComponentType,
  TextSlotKind,
} from '@/types/textlabs'

export interface ElementResearchSelection {
  web: boolean
  uploadedDocuments: boolean
  knowledgeGraph: boolean
}

export interface RestoredElementResearchSelection extends ElementResearchSelection {
  mode: ElementResearchMode
}

const NON_RESEARCH_VISUAL_COMPONENTS = new Set<TextLabsAllComponentType>([
  'IMAGE',
  'ICON_LABEL',
  'SHAPE',
  'INFOGRAPHIC',
])

/**
 * Images, icons/labels, shapes, and template logo accessories are visual leaf
 * generation. Research context cannot improve their content and older saved
 * panel state must never re-enable Researcher for them.
 */
export function isNonResearchVisualElement(
  componentType: TextLabsAllComponentType,
  slotKind?: TextSlotKind | null,
  accessoryType?: string | null,
): boolean {
  return NON_RESEARCH_VISUAL_COMPONENTS.has(componentType)
    || slotKind === 'accessory'
    || accessoryType?.toUpperCase() === 'LOGO'
}

function selectedResearchSource(
  provenance: Record<string, unknown> | null,
  sourceType: 'web' | 'uploaded_docs' | 'knowledge_graph',
): boolean {
  const sources = provenance?.sources
  if (!Array.isArray(sources)) return false
  return sources.some(source => (
    source
    && typeof source === 'object'
    && (source as Record<string, unknown>).source_type === sourceType
    && (source as Record<string, unknown>).selected === true
  ))
}

/**
 * Restore saved research provenance only for element types that support it.
 * Visual leaf types must remain off even when an older saved element claims
 * that research was enabled.
 */
export function restoreElementResearchSelection(
  componentType: TextLabsAllComponentType,
  provenance: Record<string, unknown> | null,
  slotKind?: TextSlotKind | null,
  accessoryType?: string | null,
): RestoredElementResearchSelection {
  if (isNonResearchVisualElement(componentType, slotKind, accessoryType)) {
    return {
      mode: 'off',
      web: false,
      uploadedDocuments: false,
      knowledgeGraph: false,
    }
  }

  const web = selectedResearchSource(provenance, 'web')
  const uploadedDocuments = selectedResearchSource(provenance, 'uploaded_docs')
  const knowledgeGraph = selectedResearchSource(provenance, 'knowledge_graph')
  return {
    mode: provenance?.mode === 'on' || web || uploadedDocuments || knowledgeGraph
      ? 'on'
      : 'off',
    web,
    uploadedDocuments,
    knowledgeGraph,
  }
}

export function defaultElementResearchSelection(
  enabled: boolean,
  capabilities: ElementResearchCapabilities,
): ElementResearchSelection {
  return {
    web: enabled && capabilities.web.available,
    uploadedDocuments: enabled && capabilities.uploaded_documents.available,
    knowledgeGraph: enabled && capabilities.knowledge_graph.available,
  }
}

export function buildElementResearchPolicy({
  mode,
  selection,
  capabilities,
  storeName,
  sessionId,
  userId,
}: {
  mode: ElementResearchMode
  selection: ElementResearchSelection
  capabilities: ElementResearchCapabilities
  storeName?: string | null
  sessionId?: string | null
  userId?: string | null
}): ElementResearchPolicy {
  const enabled = mode === 'on'
  const web = enabled && selection.web && capabilities.web.available
  const uploadedDocs = enabled
    && selection.uploadedDocuments
    && capabilities.uploaded_documents.available
    && Boolean(storeName)
  const knowledgeGraph = enabled
    && selection.knowledgeGraph
    && capabilities.knowledge_graph.available

  return {
    mode,
    web,
    uploaded_docs: uploadedDocs,
    use_knowledge_graph: knowledgeGraph,
    user_id: knowledgeGraph ? userId ?? null : null,
    store_name: storeName ?? null,
    session_id: sessionId ?? null,
    source_capabilities: capabilities,
    depth: enabled ? 'standard' : 'quick',
  }
}

export function hasSelectedElementResearchSource(policy: ElementResearchPolicy): boolean {
  return Boolean(policy.web || policy.uploaded_docs || policy.use_knowledge_graph)
}
