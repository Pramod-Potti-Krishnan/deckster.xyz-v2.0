'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BUILD_FINGERPRINT,
  BUILD_FINGERPRINT_SHORT,
} from '@/lib/build-version'
import {
  DIAGRAM_CATALOG_VERSION,
  isCompatibleDiagramCatalog,
} from '@/lib/diagram-catalog'

type VersionIssue = {
  title: string
  detail: string
}

const ELEMENTOR_URL =
  process.env.NEXT_PUBLIC_ELEMENTOR_URL
  || 'https://web-production-3b42.up.railway.app'

export function BuildFingerprintBadge() {
  return (
    <span
      className="inline rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
      aria-label={`Deckster build ${BUILD_FINGERPRINT}`}
      title={`Deckster build ${BUILD_FINGERPRINT}`}
    >
      build {BUILD_FINGERPRINT_SHORT}
    </span>
  )
}

export function BuildVersionGuard() {
  const [issue, setIssue] = useState<VersionIssue | null>(null)
  const checkingRef = useRef(false)
  const lastCheckedAtRef = useRef(0)

  const checkVersion = useCallback(async (force = false) => {
    if (process.env.NODE_ENV !== 'production' || checkingRef.current || issue) return
    const now = Date.now()
    if (!force && now - lastCheckedAtRef.current < 30_000) return
    checkingRef.current = true
    lastCheckedAtRef.current = now
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5_000)
    try {
      const versionResponse = await fetch(`/api/version?t=${now}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      if (versionResponse.ok) {
        const deployed = await versionResponse.json()
        if (
          typeof deployed?.build_sha === 'string'
          && deployed.build_sha
          && deployed.build_sha !== BUILD_FINGERPRINT
        ) {
          setIssue({
            title: 'Deckster UAT was updated',
            detail: 'This tab is running an older frontend build. Reload before generating another element.',
          })
          return
        }
      }

      const catalogResponse = await fetch(
        `${ELEMENTOR_URL}/api/diagram/catalog?guard=${now}`,
        {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        },
      )
      if (catalogResponse.ok) {
        const catalog = await catalogResponse.json()
        if (!isCompatibleDiagramCatalog(catalog)) {
          const deployedVersion = typeof catalog?.catalog_version === 'string'
            ? catalog.catalog_version
            : 'unknown'
          setIssue({
            title: 'Diagram services are on different versions',
            detail: `This builder requires diagram catalog v${DIAGRAM_CATALOG_VERSION} capabilities, but UAT is serving v${deployedVersion} without the required Auto, language, or nine-renderer contract. Reload after the deployment finishes.`,
          })
        }
      } else if (catalogResponse.status === 400 || catalogResponse.status === 404) {
        setIssue({
          title: 'Diagram services are still updating',
          detail: `This builder requires the diagram catalog v${DIAGRAM_CATALOG_VERSION} endpoint, but UAT does not expose it yet. Reload after the backend deployment finishes.`,
        })
      }
    } catch {
      // A health/version probe must never turn a transient network issue into a
      // second, misleading generation blocker.
    } finally {
      window.clearTimeout(timeout)
      checkingRef.current = false
    }
  }, [issue])

  useEffect(() => {
    void checkVersion(true)
    const onFocus = () => void checkVersion()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkVersion()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(() => void checkVersion(), 5 * 60_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
    }
  }, [checkVersion])

  if (!issue) return null
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="deckster-version-title"
      aria-describedby="deckster-version-detail"
    >
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-5 shadow-2xl dark:border-amber-800 dark:bg-slate-900">
        <h2 id="deckster-version-title" className="text-base font-semibold text-slate-950 dark:text-white">
          {issue.title}
        </h2>
        <p id="deckster-version-detail" className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
          {issue.detail}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Current tab: {BUILD_FINGERPRINT_SHORT}
        </p>
        <button
          type="button"
          className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          onClick={() => window.location.reload()}
        >
          Reload UAT now
        </button>
      </div>
    </div>
  )
}
