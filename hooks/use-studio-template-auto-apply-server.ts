// FRONTEND-2 (PK, 2 Nov 17:48Z: the template auto-apply check is per USER across devices; flag NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER, default off): the I/O half of lib/studio-template-auto-apply-server.ts.
// hooks/use-studio-template-match.ts (#559's store) calls the two functions below from marked lines; every decision (what to adopt, what to retry, which answer stops the calls) is the pure lib.
//   autoApplyServerAsk(user, handlers)  once per page and user, when the Director socket first opens: GET the stored preference; a boolean that differs from the cache is handed to the store (adopt).
//   autoApplyServerSave(user, enabled)  the check was toggled, or a taken frame changed the preference: PUT it (fire-and-forget, in order, one more try after a network error or a 5xx; a failure keeps the local value).
// Nothing here logs: not the user, not a value, not an error. Flag off (or the template match off): both return at once and nothing is fetched.
import {
  STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED,
  TEMPLATE_AUTO_APPLY_SERVER_PATH,
  parseServerPreference,
  serverPreferenceBody,
  serverPreferenceToAdopt,
  serverPreferenceUnavailable,
  shouldRetryServerPut,
} from "@/lib/studio-template-auto-apply-server"

/** What the store hands over: who it works for now, the preference as it holds it, and how to take a stored value (cache, check and the re-sent template_auto_apply are the store's). */
export interface AutoApplyServerHandlers {
  user: () => string | null
  current: () => boolean
  adopt: (enabled: boolean) => void
}

/** The wait before the one retry of a PUT. */
export const AUTO_APPLY_SERVER_RETRY_MS = 1500

let askedFor: string | null = null
let changes = 0
let stopped = false
let queue: Promise<void> = Promise.resolve()

async function call(method: "GET" | "PUT", body?: unknown): Promise<{ status: number | null; json: unknown }> {
  try {
    const response = await fetch(TEMPLATE_AUTO_APPLY_SERVER_PATH, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }),
    })
    let json: unknown = null
    if (response.ok) { try { json = await response.json() } catch { json = null } }
    return { status: response.status, json }
  } catch {
    return { status: null, json: null }
  }
}

/** The first time a socket opens for this user on this page: ask for the stored preference. Never throws, never waits for the caller. */
export function autoApplyServerAsk(user: string | null, handlers: AutoApplyServerHandlers): void {
  if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED || stopped || !user || askedFor === user) return
  askedFor = user
  const mark = changes
  void call("GET").then(({ status, json }) => {
    if (serverPreferenceUnavailable(status)) { stopped = true; return }
    const next = serverPreferenceToAdopt({ server: parseServerPreference(json), local: handlers.current(), changedSinceAsk: changes !== mark || handlers.user() !== user })
    if (next !== null) handlers.adopt(next)
  }).catch(() => {})
}

/** The preference changed on this device (the check, or a taken frame): save it for the user. Any answer to a GET still on its way is now stale. Never throws. */
export function autoApplyServerSave(user: string | null, enabled: boolean): void {
  if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED || !user) return
  changes += 1
  if (stopped) return
  const body = serverPreferenceBody(enabled)
  queue = queue.then(async () => {
    for (let attempt = 0; ; attempt += 1) {
      const { status } = await call("PUT", body)
      if (status !== null && status >= 200 && status < 300) return
      if (serverPreferenceUnavailable(status)) { stopped = true; return }
      if (!shouldRetryServerPut(status, attempt)) return
      await new Promise<void>(resolve => setTimeout(resolve, AUTO_APPLY_SERVER_RETRY_MS))
    }
  }).catch(() => {})
}

/** For the proof: back to rest. */
export function autoApplyServerReset(): void {
  askedFor = null
  changes = 0
  stopped = false
  queue = Promise.resolve()
}
