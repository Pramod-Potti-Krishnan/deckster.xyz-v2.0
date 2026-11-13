'use client'

import { useEffect, useState } from 'react'
import {
  checkBrandExtractFile,
  isStudioBrandKitEnabled,
  parseBrandExtract,
  readBrandResponse,
  type BrandApiCode,
  type BrandExtractCode,
  type BrandExtractResult,
  type BrandRecord,
} from '@/lib/studio-brand-kit'
import type { ApiResult } from '@/lib/studio-brand-kit-state'

// BRAND-KIT-CALLER (FRONTEND-1, Brand Kit, Studio caller half; BK-C3 hook functions, BK-C14, BK-C16): the browser's three calls and the one read a new deck makes, beside useThemeProfiles (hooks/use-theme-profiles.ts).
// Plain async functions (the component keeps the state, lib/studio-brand-kit-state.ts), so each is one request and nothing is retried here: a retry is always a fresh click.
// The browser only ever talks to Studio's own routes (/api/brand/extract, /api/themes/{id}/brand); it never calls Theme Builder, never holds a key and never sees a signature.

const EXTRACT_CODES: readonly BrandExtractCode[] = ['type', 'size', 'empty', 'unreadable', 'unavailable', 'no_colors', 'cap', 'failed', 'timeout', 'network', 'signin', 'unconfigured']
const BRAND_CODES: readonly BrandApiCode[] = ['kit_unavailable', 'theme_not_found', 'entitlement', 'entitlement_unavailable', 'invalid_brand', 'unavailable', 'director_error', 'director_unreachable', 'signin', 'bad_request', 'too_large', 'clear_refused', 'unconfigured']

async function bodyOf(res: Response): Promise<unknown> {
  try { return await res.json() } catch { return null }
}
const codeIn = <T extends string>(body: unknown, allowed: readonly T[]): T | null => {
  const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined
  return typeof code === 'string' && (allowed as readonly string[]).includes(code) ? (code as T) : null
}

/**
 * ONE extraction: the file's own bytes, as the body, with its own Content-Type (no multipart, no base64, no other header). The browser pre-check (PNG or JPEG, up to 4 MiB) runs first and sends nothing when it fails.
 * Called only from the button that follows the person's consent; never from an edit, a render, an effect or a reconnect.
 */
export async function extractBrand(file: File | { type: string; size: number }): Promise<ApiResult<BrandExtractResult, BrandExtractCode>> {
  const checked = checkBrandExtractFile(file)
  if (!checked.ok) return { ok: false, status: 0, code: checked.code }
  try {
    const res = await fetch('/api/brand/extract', { method: 'POST', headers: { 'Content-Type': checked.mime }, body: file as BodyInit, cache: 'no-store' })
    const body = await bodyOf(res)
    if (res.ok) {
      const parsed = parseBrandExtract(body)
      return parsed ? { ok: true, value: parsed } : { ok: false, status: res.status, code: 'failed' }
    }
    if (res.status === 404) return { ok: false, status: 404, code: 'unavailable' }
    return { ok: false, status: res.status, code: codeIn(body, EXTRACT_CODES) ?? (res.status === 401 ? 'signin' : 'failed') }
  } catch {
    return { ok: false, status: 0, code: 'network' }
  }
}

/** Read one theme's brand record (BK-C14). { ok, value: null } is "no kit set". Only for the selected theme and the standard theme: never one call per list row. */
export async function getBrandKit(themeId: string, init: { signal?: AbortSignal } = {}): Promise<ApiResult<BrandRecord | null, BrandApiCode>> {
  try {
    const res = await fetch(`/api/themes/${encodeURIComponent(themeId)}/brand`, { cache: 'no-store', signal: init.signal })
    const body = await bodyOf(res)
    if (res.ok) {
      const read = readBrandResponse(body)
      return read ? { ok: true, value: read.brand } : { ok: false, status: res.status, code: 'director_error' }
    }
    return { ok: false, status: res.status, code: codeIn(body, BRAND_CODES) ?? (res.status === 404 ? 'kit_unavailable' : 'director_error') }
  } catch {
    return { ok: false, status: 0, code: 'director_unreachable' }
  }
}

/** PUT the whole record (it replaces). Never called with an empty record by this code. The answer is the stored record. */
export async function saveBrandKit(themeId: string, record: BrandRecord): Promise<ApiResult<BrandRecord | null, BrandApiCode>> {
  try {
    const res = await fetch(`/api/themes/${encodeURIComponent(themeId)}/brand`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record), cache: 'no-store' })
    const body = await bodyOf(res)
    if (res.ok) {
      const read = readBrandResponse(body)
      return read ? { ok: true, value: read.brand } : { ok: false, status: res.status, code: 'director_error' }
    }
    const retryable = typeof body === 'object' && body !== null ? (body as { retryable?: unknown }).retryable : undefined
    return { ok: false, status: res.status, code: codeIn(body, BRAND_CODES) ?? 'director_error', ...(typeof retryable === 'boolean' ? { retryable } : {}) }
  } catch {
    return { ok: false, status: 0, code: 'director_unreachable', retryable: true }
  }
}

/** How long a new deck waits for the standard theme's kit before it goes on without one (BK-C16: the read never blocks a build). */
export const STANDARD_BRAND_KIT_TIMEOUT_MS = 5000

/**
 * The standard theme's brand record, read once when `enabled` (the Brand Kit flag AND the deck-identity flag): GET /api/themes/standard for the id, then GET /api/themes/{id}/brand. Null while it loads and on ANY error,
 * a missing standard theme, a kit that is off or unset, or a timeout: the Builder then uses the browser copy and a build is never held back. Director applies the STANDARD theme's kit, so that is the one read (never the theme
 * a deck happens to use, which would be a second, competing source).
 */
export function useStandardBrandKit(enabled: boolean): BrandRecord | null {
  const [kit, setKit] = useState<BrandRecord | null>(null)
  useEffect(() => {
    if (!enabled || !isStudioBrandKitEnabled() || typeof window === 'undefined') return
    let live = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), STANDARD_BRAND_KIT_TIMEOUT_MS)
    ;(async () => {
      try {
        const standard = await fetch('/api/themes/standard', { cache: 'no-store', signal: controller.signal })
        if (!standard.ok) return
        const data = (await standard.json()) as { theme?: { id?: unknown } | null }
        const id = typeof data?.theme?.id === 'string' ? data.theme.id : ''
        if (!id) return
        const res = await getBrandKit(id, { signal: controller.signal })
        if (live && res.ok) setKit(res.value)
      } catch {
        // fail soft: the browser copy stands
      } finally {
        clearTimeout(timer)
      }
    })()
    return () => { live = false; clearTimeout(timer); controller.abort() }
  }, [enabled])
  return kit
}
