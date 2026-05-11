type ConsoleArgs = Parameters<typeof console.log>
type ConsoleWarnArgs = Parameters<typeof console.warn>

function isDebugLoggingEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DECKSTER_DEBUG === 'true') return true

  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem('deckster:debug') === 'true'
  } catch {
    return false
  }
}

export function debugLog(...args: ConsoleArgs) {
  if (isDebugLoggingEnabled()) {
    console.log(...args)
  }
}

export function debugWarn(...args: ConsoleWarnArgs) {
  if (isDebugLoggingEnabled()) {
    console.warn(...args)
  }
}
