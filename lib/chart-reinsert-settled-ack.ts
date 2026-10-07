/**
 * Studio side of ELEMENT's L-04/F10 "chart re-insert ACK" contract (contract v1.1), dark.
 *
 * Layout (flag LAYOUT_CHART_REINSERT_ACK_ENABLED) answers a same-id `insertChart` in two new,
 * per-request opt-in ways:
 *   - `geometryMode: 'apply'` moves the existing chart to the requested box. Without it a same-id
 *     replace keeps the old box.
 *   - `ackMode: 'settled'` defers the one ACK until the chart has rendered and a save sent after
 *     the render has returned, so `ok = applied && rendered && persisted` and `success = ok`. Only the
 *     chart's own script errors flip `rendered` (v1.1); any other page error only increments the
 *     additive `render.page_errors`, which Studio logs as a count.
 *
 * NEXT_PUBLIC_CHART_REINSERT_SETTLED_ACK_ENABLED (exact string 'true'; default off). With it off
 * nothing in this module is reached: the insert is sent exactly as before and the ACK is handled
 * exactly as before. With it on, only a same-id chart insert from a refine sends the opt-ins, and
 * an old-style ACK (Layout's flag off) is still handled as today.
 *
 * `process.env.NEXT_PUBLIC_...` is referenced literally so Next inlines the public value at build.
 */

export function chartReinsertSettledAckEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CHART_REINSERT_SETTLED_ACK_ENABLED === 'true'
}

type SendLayoutCommand = (
  action: string,
  params: Record<string, unknown>,
) => Promise<unknown>

type Warn = (...args: unknown[]) => void

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const LOG_PREFIX = '[chart-reinsert-ack]'

export type ChartReinsertOptIns = {
  ackMode: 'settled'
  geometryMode?: 'apply'
}

/**
 * The opt-in params for one insert, or null (send the insert exactly as today).
 *
 * Only a same-id chart insert (a refine whose chart keeps its element id) opts in.
 * `geometryMode: 'apply'` is sent only when the geometry in the request is authoritative (see
 * chartReinsertGeometryAuthoritative: a manually positioned chart, or a refine whose positionConfig
 * is the chart's live box). Otherwise buildInsertionParams may have fallen back to its 2/4 default
 * box, which must not be applied, so Layout keeps the old box.
 */
export function chartReinsertOptIns(input: {
  enabled: boolean
  action: string
  sameId: boolean
  geometryAuthoritative: boolean
}): ChartReinsertOptIns | null {
  if (!input.enabled || input.action !== 'insertChart' || !input.sameId) return null
  return input.geometryAuthoritative
    ? { ackMode: 'settled', geometryMode: 'apply' }
    : { ackMode: 'settled' }
}

type PositionBox = {
  start_col: number
  start_row: number
  position_width: number
  position_height: number
}

const sameBox = (a: PositionBox, b: PositionBox): boolean => (
  (['start_col', 'start_row', 'position_width', 'position_height'] as const).every(key => (
    Number.isFinite(a[key]) && Number.isFinite(b[key]) && Math.abs(a[key] - b[key]) < 1e-6
  ))
)

/**
 * Is the box in this request one the user chose, or the live box of the chart being refined?
 *
 *   - a manually positioned chart: yes (the user chose it);
 *   - a refine whose positionConfig is the chart's live box (refineContext.gridPosition): yes;
 *   - anything else, in particular a refine whose positionConfig is the chart form's own default
 *     (start 2/4, default size) or a stale saved box: no. That is the box buildInsertionParams falls back
 *     to, which must not be applied to a chart that is somewhere else.
 */
export function chartReinsertGeometryAuthoritative(input: {
  manuallyPositioned: boolean
  refine: boolean
  positionConfig?: PositionBox | null
  liveGridPosition?: PositionBox | null
}): boolean {
  if (input.manuallyPositioned) return true
  return Boolean(
    input.refine
    && input.positionConfig
    && input.liveGridPosition
    && sameBox(input.positionConfig, input.liveGridPosition),
  )
}

/** A settled ACK carries boolean ok, rendered and persisted. An old-style ACK has none of them. */
export function isSettledChartAck(value: unknown): value is Record<string, unknown> & { ok: boolean } {
  return isRecord(value)
    && typeof value.ok === 'boolean'
    && typeof value.rendered === 'boolean'
    && typeof value.persisted === 'boolean'
}

export type SettledChartAckOutcome =
  /** Not a settled ACK (Layout's flag is off): handle exactly as today. */
  | { kind: 'legacy' }
  /** ok: applied, rendered and persisted. */
  | { kind: 'ok' }
  /** The chart is on the slide but its save failed or was not confirmed: never a silent success. */
  | { kind: 'not_saved'; message: string; requestReference: string | null }
  /** Nothing applied, a render failure, or a settle timeout before the save: today's error path.
   *  ok is read strictly: ok:false is never turned into a success. */
  | { kind: 'failed' }

function ackText(ack: Record<string, unknown>, key: string): string | null {
  const value = ack[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function classifySettledChartAck(ack: unknown): SettledChartAckOutcome {
  if (!isSettledChartAck(ack)) return { kind: 'legacy' }
  if (ack.ok && ack.rendered && ack.persisted) return { kind: 'ok' }
  // applied:false means the slide is unchanged (INVALID_GEOMETRY, a script that does not compile,
  // RECREATE_REQUIRED): Layout's own message is the right one.
  if (ack.applied === false) return { kind: 'failed' }

  const errorCode = ackText(ack, 'errorCode')
  const persist = isRecord(ack.persist) ? ack.persist : null
  if (!ack.persisted || errorCode === 'CHART_PERSIST_FAILED') {
    const requestReference = persist ? ackText(persist, 'request_reference') : null
    const reference = requestReference ? ` Request reference: ${requestReference}.` : ''
    const unconfirmed = errorCode === 'CHART_SETTLE_TIMEOUT' || persist?.status === 'timeout'
    const renderNote = !ack.rendered && ackText(ack, 'error')
      ? ` The chart also did not render: ${ackText(ack, 'error')}`
      : ''
    return {
      kind: 'not_saved',
      requestReference,
      message: unconfirmed
        ? `The chart was updated on the slide, but saving it was not confirmed in time. Check that the slide has saved before leaving it.${reference}${renderNote}`
        : `The chart was updated on the slide but could not be saved. Your changes are still pending; use Save to retry.${reference}${renderNote}`,
    }
  }
  return { kind: 'failed' }
}

/**
 * `render.page_errors` (contract v1.1, additive, diagnostic): uncaught page errors during the settle
 * window that were not the chart's own. One console.warn with the count and nothing else.
 */
function warnPageErrors(ack: Record<string, unknown>, warn: Warn): void {
  const render = isRecord(ack.render) ? ack.render : null
  const count = render?.page_errors
  if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
    warn(`${LOG_PREFIX} render.page_errors: ${Math.floor(count)}`)
  }
}

/** The verified box the chart ended on (logical grid, "start/end" strings), or null. */
export function settledAckGeometry(ack: unknown): { gridRow: string; gridColumn: string } | null {
  if (!isSettledChartAck(ack) || ack.applied === false) return null
  const geometry = ack.geometry
  if (!isRecord(geometry)) return null
  const { gridRow, gridColumn } = geometry
  const span = /^\s*\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?\s*$/
  if (typeof gridRow !== 'string' || typeof gridColumn !== 'string') return null
  if (!span.test(gridRow) || !span.test(gridColumn)) return null
  return { gridRow, gridColumn }
}

export class ChartReinsertNotSavedError extends Error {
  readonly code = 'CHART_REINSERT_NOT_SAVED'
  readonly ack: Record<string, unknown>
  constructor(message: string, ack: Record<string, unknown>, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ChartReinsertNotSavedError'
    this.ack = ack
  }
}

/**
 * presentation-viewer's sendCommand rejects every success:false ACK with just its error text. A
 * settled ACK uses success = ok, so its rendered/persisted/errorCode would be lost; keep the ACK
 * on the rejection (only for a request that asked for ackMode 'settled').
 */
export function attachSettledChartAck<E extends Error>(error: E, ack: unknown): E {
  if (isSettledChartAck(ack)) (error as E & { layoutAck?: unknown }).layoutAck = ack
  return error
}

function settledAckFromError(error: unknown): Record<string, unknown> | null {
  const ack = isRecord(error) ? error.layoutAck : null
  return isSettledChartAck(ack) ? ack : null
}

/** A settled ACK read through the contract. Throws when the ACK says the chart did not save. */
function applySettledChartAck(ack: Record<string, unknown>, warn: Warn): Record<string, unknown> {
  warnPageErrors(ack, warn)
  const outcome = classifySettledChartAck(ack)
  switch (outcome.kind) {
    case 'not_saved':
      throw new ChartReinsertNotSavedError(outcome.message, ack)
    case 'failed':
      // Normally already success:false. A success ACK that contradicts itself (rendered:false)
      // is not trusted either.
      return ack.success === true ? { ...ack, success: false } : ack
    default:
      return ack
  }
}

/**
 * Wrap the Layout command sender for ONE same-id chart insert that sent ackMode 'settled'. The
 * wrapper only reads the ACK; it never changes what is sent.
 *
 *   - success ACK (ok): returned as is.
 *   - failure ACK with persisted:false or CHART_PERSIST_FAILED: ChartReinsertNotSavedError, which the
 *     caller's existing generation-error path shows. Never a silent success.
 *   - any other failure (render failure, nothing applied, ...): rethrown as today, Layout's text.
 *     ok is read strictly: ok:false is never turned into a success.
 *   - `render.page_errors` > 0 on any settled ACK: one console.warn with the count only.
 *   - a lost ACK: the caller's command-timeout reconciliation reads the mutation receipt through this
 *     same wrapper, so the receipt's settled ACK is read the same way.
 *   - an old-style ACK: passed through untouched.
 */
export function settledChartAckSender(
  send: SendLayoutCommand,
  options: { warn?: Warn } = {},
): SendLayoutCommand {
  const warn: Warn = options.warn ?? ((...args) => console.warn(...args))
  return async (action, params) => {
    if (action === 'insertChart') {
      let response: unknown
      try {
        response = await send(action, params)
      } catch (error) {
        const ack = settledAckFromError(error)
        if (!ack) throw error
        const read = applySettledChartAck(ack, warn)
        if (read.success === true) return read
        throw error
      }
      if (!isSettledChartAck(response)) return response
      const read = applySettledChartAck(response, warn)
      // A success ACK that contradicts itself (rendered:false) is never a silent success.
      if (read.success !== true) throw new Error(ackText(read, 'error') ?? 'Command failed')
      return read
    }
    if (action === 'getElementMutationReceipt') {
      const receipt = await send(action, params)
      if (isRecord(receipt) && receipt.status === 'completed' && isSettledChartAck(receipt.result)) {
        warnPageErrors(receipt.result, warn)
        const outcome = classifySettledChartAck(receipt.result)
        if (outcome.kind === 'not_saved') {
          // The reconciliation loop swallows errors thrown here, so say it in the receipt's result.
          return { ...receipt, result: { ...receipt.result, success: false, error: outcome.message } }
        }
      }
      return receipt
    }
    return send(action, params)
  }
}
