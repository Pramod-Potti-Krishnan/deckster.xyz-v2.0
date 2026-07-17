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

