/** Local navigation only: opening an existing workflow never executes its action. */
export type StudioWorkflowAction = 'templates' | 'theme' | 'master' | 'brief'
export type StudioWorkflowRequest = { action: Exclude<StudioWorkflowAction, 'brief'>; key: string; itemId?: string | null }
const ACTIONS: readonly string[] = ['templates', 'theme', 'master', 'brief']
export function parseStudioWorkflowAction(value: string | null): StudioWorkflowAction | null {
  return value && ACTIONS.includes(value) ? value as StudioWorkflowAction : null
}
export function getStudioWorkflowHref(action: StudioWorkflowAction, sessionId?: string | null, itemId?: string | null) {
  const params = new URLSearchParams({ studio_action: action })
  if (sessionId && sessionId !== 'new') params.set('session_id', sessionId)
  if (itemId) params.set('studio_item', itemId)
  return `/builder?${params.toString()}`
}
/** Keep only an allowed Studio review intent while the native hook assigns its session. */
export function getInitializedBuilderHref(params: Pick<URLSearchParams, 'get'>, sessionId: string, studioShell: boolean) {
  const action = studioShell ? parseStudioWorkflowAction(params.get('studio_action')) : null
  return action ? getStudioWorkflowHref(action, sessionId, params.get('studio_item'))
    : `/builder?${new URLSearchParams({ session_id: sessionId }).toString()}`
}
export function draftKey(userId: string) { return `deckster:studio-workflow-draft:${userId}` }
export function parseStudioWorkflowDraft(value: string | null, now = Date.now()): string | null {
  if (!value) return null
  try {
    const draft: unknown = JSON.parse(value)
    if (!draft || typeof draft !== 'object') return null
    const d = draft as Record<string, unknown>
    return d.version === 1 && typeof d.createdAt === 'number' && Number.isFinite(d.createdAt)
      && d.createdAt <= now + 60000 && now - d.createdAt <= 3600000
      && typeof d.text === 'string' && d.text.trim().length > 0 && d.text.length <= 20000
      ? d.text : null
  } catch { return null }
}
