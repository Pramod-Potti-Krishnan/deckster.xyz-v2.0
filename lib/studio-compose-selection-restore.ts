import { parseStudioNativeSlideOrder } from './studio-native-slide-order';

export interface StudioComposeRestoreOwner {
  /** Existing immutable presentation/version owner object; replace on ABA. */
  token: object;
  userId: string;
  sessionId: string;
  presentationId: string;
  activeVersion: string;
  mountGeneration: number;
}

export interface StudioComposeRestoreState {
  owner: StudioComposeRestoreOwner;
  active: boolean;
  latestRequestSequence: number;
  reloadRevision: number;
  interactionRevision: number;
  structureRevision: number;
  /** Fresh identity for actual ready iframe/source/window, including same-src reload. */
  frameEpoch: object | null;
  templateMode: boolean;
  dirty: boolean;
  saving: boolean;
  structuralWork: boolean;
}

export interface StudioComposeRestoreTarget {
  readonly owner: Readonly<StudioComposeRestoreOwner>;
  readonly requestSequence: number;
  readonly reloadRevision: number;
  readonly interactionRevision: number;
  readonly structureRevision: number;
  readonly slideId: string;
  readonly returnedLayoutIndex: number;
  /** Optional actual native total, never slides_built or a parent count guess. */
  readonly authoritativeNativeCount: number | null;
}

const exactId = (value: unknown): value is string => typeof value === 'string' && Boolean(value)
  && value === value.trim();
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const token = (value: unknown): value is object => value !== null && typeof value === 'object';

function validOwner(owner: StudioComposeRestoreOwner): boolean {
  return token(owner.token) && exactId(owner.userId) && exactId(owner.sessionId)
    && owner.sessionId !== 'new' && exactId(owner.presentationId)
    && ['blank', 'strawman', 'final'].includes(owner.activeVersion) && revision(owner.mountGeneration);
}

function sameOwner(a: StudioComposeRestoreOwner, b: StudioComposeRestoreOwner): boolean {
  return validOwner(a) && validOwner(b) && a.token === b.token && a.userId === b.userId
    && a.sessionId === b.sessionId && a.presentationId === b.presentationId
    && a.activeVersion === b.activeVersion && a.mountGeneration === b.mountGeneration;
}

/** Capture after an admitted synchronous result, before setting refresh state.
 * The caller's private request sequence comes from request START, not arrival.
 * Missing real identity refuses automatic restore; an index is not an ID.
 */
export function createStudioComposeRestoreTarget(input: {
  owner: StudioComposeRestoreOwner;
  requestSequence: number;
  reloadRevision: number;
  interactionRevision: number;
  structureRevision: number;
  result: { status?: unknown; presentation_id?: unknown; slide_index?: unknown;
    real_slide_id?: unknown; slide_id?: unknown; kind?: unknown };
  authoritativeNativeCount?: number | null;
}): StudioComposeRestoreTarget | null {
  const { result } = input;
  const slideId = result.real_slide_id ?? result.slide_id;
  const count = input.authoritativeNativeCount ?? null;
  if (!validOwner(input.owner) || !revision(input.requestSequence)
    || !revision(input.reloadRevision) || !revision(input.interactionRevision) || !revision(input.structureRevision)
    || result.status !== 'built' || (result.kind !== undefined && result.kind !== 'compose')
    || result.presentation_id !== input.owner.presentationId || !revision(result.slide_index)
    || !exactId(slideId)
    || (result.real_slide_id != null && result.slide_id != null && result.real_slide_id !== result.slide_id)
    || (count !== null && (!Number.isSafeInteger(count) || count < 1 || (result.slide_index as number) >= count))) return null;
  return Object.freeze({ owner: Object.freeze({ ...input.owner }), requestSequence: input.requestSequence,
    reloadRevision: input.reloadRevision, interactionRevision: input.interactionRevision,
    structureRevision: input.structureRevision, slideId, returnedLayoutIndex: result.slide_index as number,
    authoritativeNativeCount: count });
}

export function isStudioComposeRestoreTargetCurrent(target: StudioComposeRestoreTarget, state: StudioComposeRestoreState): boolean {
  return state.active === true && sameOwner(target.owner, state.owner)
    && target.requestSequence === state.latestRequestSequence
    && target.reloadRevision === state.reloadRevision
    && target.interactionRevision === state.interactionRevision
    && target.structureRevision === state.structureRevision;
}

/** Latest request wins even if older HTTP responses arrive later. Retain the
 * previous target on a refused candidate; no count/history/deck state changes.
 */
export function admitStudioComposeRestoreTarget(previous: StudioComposeRestoreTarget | null,
  candidate: StudioComposeRestoreTarget | null, state: StudioComposeRestoreState): StudioComposeRestoreTarget | null {
  return candidate && isStudioComposeRestoreTargetCurrent(candidate, state) ? candidate : previous;
}

export interface StudioComposeRestoreLease {
  readonly target: StudioComposeRestoreTarget;
  readonly frameEpoch: object;
  readonly visualIndex: number;
  readonly slideId: string;
  readonly nativeCount: number;
}

export type StudioComposeRestoreDecision =
  | { kind: 'retired' }
  | { kind: 'waiting'; reason: 'frame' | 'work' | 'native-order' | 'count' | 'identity' }
  | { kind: 'ready'; lease: StudioComposeRestoreLease };

export interface StudioComposeNativeReceipt {
  /** Private read-admission wrapper, never supplied by the native payload. */
  ownerToken: object;
  presentationId: string;
  frameEpoch: object;
  structureRevision: number;
  receipt: unknown;
}

function receiptIsCurrent(read: StudioComposeNativeReceipt | null, state: StudioComposeRestoreState): read is StudioComposeNativeReceipt {
  return Boolean(read && read.ownerToken === state.owner.token && read.presentationId === state.owner.presentationId
    && read.frameEpoch === state.frameEpoch && read.structureRevision === state.structureRevision);
}

/** Receipt must be obtained through the current trusted native command API.
 * The parser verifies shape/order/count, not receipt provenance. It refuses
 * placeholders, so existing async placeholder/refine lanes remain separate.
 */
export function resolveStudioComposeRestore(pending: StudioComposeRestoreTarget | null,
  state: StudioComposeRestoreState, nativeRead: StudioComposeNativeReceipt | null): StudioComposeRestoreDecision {
  if (!pending || !isStudioComposeRestoreTargetCurrent(pending, state)) return { kind: 'retired' };
  if (!token(state.frameEpoch)) return { kind: 'waiting', reason: 'frame' };
  if (state.templateMode !== false || state.dirty !== false || state.saving !== false || state.structuralWork !== false)
    return { kind: 'waiting', reason: 'work' };
  const order = receiptIsCurrent(nativeRead, state) ? parseStudioNativeSlideOrder(nativeRead.receipt) : null;
  if (!order) return { kind: 'waiting', reason: 'native-order' };
  if (pending.authoritativeNativeCount !== null && order.nativeCount !== pending.authoritativeNativeCount)
    return { kind: 'waiting', reason: 'count' };
  const visualIndex = order.slideIds.indexOf(pending.slideId);
  if (visualIndex < 0) return { kind: 'waiting', reason: 'identity' };
  // Current exact identity/order is authoritative; returned index can precede
  // the insertion reorder settling. Never resolve a different ID by old index.
  return { kind: 'ready', lease: Object.freeze({ target: pending, frameEpoch: state.frameEpoch!,
    visualIndex, slideId: pending.slideId, nativeCount: order.nativeCount }) };
}

/** Recheck before every native read/navigation and after every await. A caught
 * old failure must not requeue its target over a newer one; leave the pending
 * pointer in place while running and clear only this lease's exact target.
 */
export function isStudioComposeRestoreLeaseCurrent(lease: StudioComposeRestoreLease,
  pending: StudioComposeRestoreTarget | null, state: StudioComposeRestoreState): boolean {
  return pending === lease.target && state.frameEpoch === lease.frameEpoch
    && isStudioComposeRestoreTargetCurrent(lease.target, state)
    && state.templateMode === false && state.dirty === false && state.saving === false && state.structuralWork === false;
}

/** Confirm native current identity/count after navigation; never turn an ACK
 * alone into parent selection/count updates or a completed restore claim. */
export function verifyStudioComposeRestoreSelection(lease: StudioComposeRestoreLease,
  pending: StudioComposeRestoreTarget | null, state: StudioComposeRestoreState,
  nativeRead: StudioComposeNativeReceipt | null): boolean {
  if (!isStudioComposeRestoreLeaseCurrent(lease, pending, state) || !receiptIsCurrent(nativeRead, state)) return false;
  const order = parseStudioNativeSlideOrder(nativeRead.receipt);
  return Boolean(order && order.nativeCount === lease.nativeCount && order.currentVisualIndex === lease.visualIndex
    && order.slideIds[lease.visualIndex] === lease.slideId);
}

export interface StudioComposeClarificationScope {
  /** Existing panel lifetime/context token; replace on mode/owner/context ABA. */
  owner: object;
  /** Base request intent, excluding questions/answers/progress and retry number. */
  intentKey: string;
}

/** UI clarification belongs to a base request, not to the latest answer text.
 * Editing answers or continuing/retrying the same request preserves questions.
 * Changed prompt/real effective selection/research/theme/owner retires both
 * needsInput and answers. The request's existing ownsDraft guards still apply.
 */
export function shouldRetireStudioComposeClarification(previous: StudioComposeClarificationScope | null,
  current: StudioComposeClarificationScope): boolean {
  return previous !== null && (previous.owner !== current.owner || previous.intentKey !== current.intentKey);
}
