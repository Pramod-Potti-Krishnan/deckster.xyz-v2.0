export function layoutCommandSucceeded(response: unknown): boolean {
  return Boolean(
    response
    && typeof response === 'object'
    && (response as Record<string, unknown>).success === true
  )
}

export function assertLayoutCommandSucceeded(response: unknown, action: string): void {
  if (layoutCommandSucceeded(response)) return
  const error = response && typeof response === 'object'
    ? (response as Record<string, unknown>).error
    : null
  throw new Error(
    typeof error === 'string' && error.trim()
      ? `${action} failed: ${error.trim()}`
      : `${action} did not return a success receipt`,
  )
}

type SendLayoutCommand = (
  action: string,
  params: Record<string, unknown>,
) => Promise<unknown>

type MutationReceipt = {
  success?: boolean
  status?: string
  result?: unknown
  error?: string
}

export type LayoutMutationReconciliationOptions = {
  attempts?: number
  delayMs?: number
  wait?: (delayMs: number) => Promise<void>
}

export class LayoutMutationAmbiguousError extends Error {
  readonly code = 'LAYOUT_MUTATION_AMBIGUOUS'
}

export function layoutMutationStateIsAmbiguous(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && (error as { code?: unknown }).code === 'LAYOUT_MUTATION_AMBIGUOUS'
  )
}

function isCommandTimeout(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && typeof (error as { message?: unknown }).message === 'string'
    && /command timeout/i.test((error as { message: string }).message)
  )
}

function defaultWait(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs))
}

/**
 * Execute a caller-idempotent Layout mutation and reconcile a lost/late
 * postMessage acknowledgement against the viewer's mutation receipt registry.
 *
 * Only command timeouts are reconciled. Explicit failure receipts remain
 * failures, and an unresolved timeout is intentionally left ambiguous rather
 * than guessing and potentially deleting both the old and new elements.
 */
export async function sendLayoutMutationWithReconciliation(
  sendCommand: SendLayoutCommand,
  action: string,
  params: Record<string, unknown>,
  mutationId: string,
  options: LayoutMutationReconciliationOptions = {},
): Promise<Record<string, unknown>> {
  const mutationParams = { ...params, mutationId }
  try {
    const response = await sendCommand(action, mutationParams)
    assertLayoutCommandSucceeded(response, action)
    return response as Record<string, unknown>
  } catch (error) {
    if (!isCommandTimeout(error)) throw error

    const attempts = Math.max(1, options.attempts ?? 8)
    const delayMs = Math.max(0, options.delayMs ?? 250)
    const wait = options.wait ?? defaultWait
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0 && delayMs > 0) await wait(delayMs)
      let receipt: MutationReceipt
      try {
        receipt = await sendCommand('getElementMutationReceipt', {
          mutationId,
        }) as MutationReceipt
      } catch {
        continue
      }
      if (receipt.status !== 'completed') continue
      assertLayoutCommandSucceeded(receipt.result, action)
      return receipt.result as Record<string, unknown>
    }

    throw new LayoutMutationAmbiguousError(
      `${action} acknowledgement timed out and its final state could not be reconciled. `
      + 'Reload the slide before retrying; no automatic rollback was attempted.',
      { cause: error },
    )
  }
}

export function createLayoutMutationId(prefix: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}:${suffix}`
}
