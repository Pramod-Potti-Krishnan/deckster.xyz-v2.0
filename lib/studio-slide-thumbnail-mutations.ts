/** Pure remapping of already received preview/metadata values. No image creation,
 * service calls, URL construction, persistence or native navigation occurs here. */
export interface StudioSlideThumbnailOwner {
  readonly userId: string
  readonly sessionId: string
  readonly presentationId: string
  readonly source: string
  readonly activeVersion: 'blank' | 'strawman' | 'final'
  /** Monotonic across frame load/reload, mount, owner and ABA transitions. */
  readonly epoch: number
}

export interface StudioSlideThumbnailCapture {
  readonly owner: StudioSlideThumbnailOwner
  readonly nativeRevision: number
  readonly metadataRevision: number
  /** Proven physical native count before this serialized command, not Director count. */
  readonly nativeCount: number
}

export type StudioSlideThumbnailMutation =
  | { kind: 'add' }
  | { kind: 'duplicate'; sourceIndex: number; insertAfter: boolean }
  | { kind: 'delete' }
  | { kind: 'reorder'; fromIndex: number; toIndex: number }
  | { kind: 'change'; index: number }

export interface StudioSlideThumbnailMutationPlan {
  readonly mode: 'mapped' | 'clear' | 'retired'
  readonly reason: string
  readonly beforeCount: number
  readonly nativeCount: number
  /** A null slot has no proven unchanged prior image/title/slide identity. */
  readonly oldIndexByNewIndex: ReadonlyArray<number | null>
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1
}
function index(value: unknown, limit: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < limit
}
function revision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}
function owned(owner: StudioSlideThumbnailOwner): boolean {
  return Boolean(owner) && ['userId', 'sessionId', 'presentationId', 'source'].every(key => {
    const value = owner[key as keyof StudioSlideThumbnailOwner]
    return typeof value === 'string' && Boolean(value.trim()) && value.trim() === value
  }) && owner.sessionId !== 'new' && revision(owner.epoch)
    && ['blank', 'strawman', 'final'].includes(owner.activeVersion)
}
/** Top-level/nested aliases may agree; conflicting or coercible fields are not proof. */
function field(ack: Record<string, unknown>, keys: string[]): unknown {
  const values = [ack, ...(record(ack.data) ? [ack.data] : [])]
    .flatMap(value => keys.filter(key => Object.prototype.hasOwnProperty.call(value, key)).map(key => value[key]))
  if (!values.length || values.some(value => value !== values[0])) return undefined
  return values[0]
}

export function planStudioSlideThumbnailMutation({
  captured,
  current,
  mutation,
  acknowledgement,
  verifiedNativeCount,
}: {
  captured: StudioSlideThumbnailCapture
  current: StudioSlideThumbnailCapture
  mutation: StudioSlideThumbnailMutation
  acknowledgement: unknown
  /** Separately observed post-command physical native count. Required for reorder/change. */
  verifiedNativeCount?: number
}): StudioSlideThumbnailMutationPlan {
  const beforeCount = count(captured.nativeCount) ? captured.nativeCount : 0
  let fallbackCount = count(verifiedNativeCount) ? verifiedNativeCount : count(current.nativeCount) ? current.nativeCount : 0
  const result = (mode: StudioSlideThumbnailMutationPlan['mode'], reason: string, nativeCount = fallbackCount, mapping: Array<number | null> = []): StudioSlideThumbnailMutationPlan => ({ mode, reason, beforeCount, nativeCount, oldIndexByNewIndex: mapping })
  // Object identity is intentional: equal fields after A→B→A are a new owner.
  if (captured.owner !== current.owner || !owned(current.owner)
    || !revision(captured.nativeRevision) || !revision(captured.metadataRevision)
    || captured.nativeRevision !== current.nativeRevision
    || captured.metadataRevision !== current.metadataRevision
    || captured.nativeCount !== current.nativeCount) return result('retired', 'owner or native/metadata proof changed')
  if (!beforeCount || !record(acknowledgement) || acknowledgement.success !== true) return result('clear', 'no exact successful native receipt')
  const ack = acknowledgement
  const expectedAction = { add: 'addSlide', duplicate: 'duplicateSlide', delete: 'deleteSlides', reorder: 'reorderSlides', change: 'changeSlideLayout' }[mutation.kind]
  if (ack.action !== undefined && ack.action !== expectedAction) return result('clear', 'receipt action mismatch')
  const reportedCount = mutation.kind === 'add' || mutation.kind === 'duplicate'
    ? field(ack, ['slide_count', 'slideCount'])
    : mutation.kind === 'delete' ? field(ack, ['remaining_slide_count']) : undefined
  if (verifiedNativeCount === undefined && count(reportedCount)) fallbackCount = reportedCount
  const oldOrder: Array<number | null> = Array.from({ length: beforeCount }, (_, i) => i)
  let nextCount = beforeCount
  if (mutation.kind === 'add' || mutation.kind === 'duplicate') {
    const inserted = field(ack, mutation.kind === 'add' ? ['slide_index', 'slideIndex'] : ['new_slide_index', 'newSlideIndex'])
    const after = field(ack, ['slide_count', 'slideCount'])
    if (!index(inserted, beforeCount + 1) || after !== beforeCount + 1) return result('clear', 'unknown insertion index/count')
    if (mutation.kind === 'duplicate' && (!index(mutation.sourceIndex, beforeCount)
      || typeof mutation.insertAfter !== 'boolean'
      || inserted !== mutation.sourceIndex + (mutation.insertAfter ? 1 : 0))) return result('clear', 'duplicate receipt disagrees with captured command')
    oldOrder.splice(inserted, 0, null)
    nextCount = after
  } else if (mutation.kind === 'delete') {
    const deleted = field(ack, ['deleted_indices'])
    const deletedCount = field(ack, ['deleted_count'])
    const after = field(ack, ['remaining_slide_count'])
    if (!Array.isArray(deleted) || !deleted.length || deleted.some(value => !index(value, beforeCount))
      || new Set(deleted).size !== deleted.length || deletedCount !== deleted.length
      || !count(after) || after !== beforeCount - deleted.length) return result('clear', 'unknown exact deleted indices/count')
    const removed = new Set(deleted)
    oldOrder.splice(0, oldOrder.length, ...oldOrder.filter(value => !removed.has(value)))
    nextCount = after
  } else if (mutation.kind === 'reorder') {
    // Native slide_order contains layout labels, not unique slide IDs. Its length
    // is not a fresh native count or a proof of identity/order.
    if (!index(mutation.fromIndex, beforeCount) || !index(mutation.toIndex, beforeCount)
      || verifiedNativeCount !== beforeCount) return result('clear', 'reorder needs captured indices and fresh native count')
    const [moved] = oldOrder.splice(mutation.fromIndex, 1)
    oldOrder.splice(mutation.toIndex, 0, moved)
  } else if (mutation.kind === 'change') {
    if (!index(mutation.index, beforeCount) || verifiedNativeCount !== beforeCount) return result('clear', 'changed slot needs exact index and native count')
    oldOrder[mutation.index] = null
  } else return result('clear', 'unsupported mutation')
  if (verifiedNativeCount !== undefined && verifiedNativeCount !== nextCount) return result('clear', 'native count disagrees with receipt')
  return result('mapped', 'exact owned native index mapping', nextCount, oldOrder)
}

/** Copies only unchanged received values. New/changed slots are deliberately empty. */
export function remapStudioSlideThumbnailValues<T>(
  current: Readonly<Record<number, T>>,
  plan: StudioSlideThumbnailMutationPlan,
): Readonly<Record<number, T>> {
  if (plan.mode === 'retired') return current
  if (plan.mode !== 'mapped') return {}
  const next: Record<number, T> = {}
  plan.oldIndexByNewIndex.forEach((oldIndex, newIndex) => {
    if (oldIndex !== null && Object.prototype.hasOwnProperty.call(current, oldIndex)) next[newIndex] = current[oldIndex]
  })
  return next
}

export interface StudioSlideThumbnailRow {
  slideNumber: number
  slideIndex?: number
  actualSlideIndex?: number
  slideId?: string | null
  title?: string
  content?: string
  thumbnailUrl?: string
}

/** Canonical physical native slots only, excluding compose placeholders/jobs. */
export function remapStudioSlideThumbnailRows<T extends StudioSlideThumbnailRow>(
  current: readonly T[],
  plan: StudioSlideThumbnailMutationPlan,
): ReadonlyArray<T | StudioSlideThumbnailRow> {
  if (plan.mode === 'retired') return current
  const canMap = plan.mode === 'mapped' && current.length === plan.beforeCount
  return Array.from({ length: plan.nativeCount }, (_, newIndex) => {
    const oldIndex = canMap ? plan.oldIndexByNewIndex[newIndex] : null
    const old = oldIndex === null || oldIndex === undefined ? undefined : current[oldIndex]
    const position = { slideNumber: newIndex + 1, slideIndex: newIndex, actualSlideIndex: newIndex }
    return old ? { ...old, ...position } : { ...position, title: `Slide ${newIndex + 1}` }
  })
}

/** A refreshed/reloaded row array cannot be admitted by count alone. Bind the
 * read to the same owner/revisions and independently observed native ID order.
 * Missing native IDs keep the richer metadata unproved; no IDs are invented. */
export function canAdmitStudioSlideThumbnailMetadata({
  captured,
  current,
  rows,
  nativeSlideIds,
}: {
  captured: StudioSlideThumbnailCapture
  current: StudioSlideThumbnailCapture
  rows: readonly StudioSlideThumbnailRow[]
  nativeSlideIds: readonly (string | null | undefined)[]
}): boolean {
  if (captured.owner !== current.owner || !owned(current.owner)
    || !revision(captured.nativeRevision) || !revision(captured.metadataRevision)
    || captured.nativeRevision !== current.nativeRevision
    || captured.metadataRevision !== current.metadataRevision
    || captured.nativeCount !== current.nativeCount || !count(current.nativeCount)
    || rows.length !== current.nativeCount || nativeSlideIds.length !== current.nativeCount) return false
  const ids = nativeSlideIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()) && id === id.trim())
  return ids.length === current.nativeCount && new Set(ids).size === ids.length
    && rows.every((row, position) => row.slideId === ids[position]
      && row.slideNumber === position + 1
      && (row.slideIndex === undefined || row.slideIndex === position)
      && (row.actualSlideIndex === undefined || row.actualSlideIndex === position))
}
