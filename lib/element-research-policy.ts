import type {
  ElementResearchCapabilities,
  ElementResearchMode,
  ElementResearchPolicy,
} from '@/types/textlabs'

export interface ElementResearchSelection {
  web: boolean
  uploadedDocuments: boolean
  knowledgeGraph: boolean
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
