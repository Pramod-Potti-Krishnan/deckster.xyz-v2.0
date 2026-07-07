'use client'

import { useEffect, useState } from 'react'
import { LAYOUT_SERVICE_URL } from '@/lib/layout-service-client'
import type { ThemePalette } from '@/types/textlabs'

function asHex(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : undefined
}

function derivePalette(vars: Record<string, unknown>): ThemePalette | null {
  const primary = asHex(vars['--theme-primary'] ?? vars['--theme-color-primary'] ?? vars.primary)
  const secondary = asHex(vars['--theme-secondary'] ?? vars['--theme-color-secondary'] ?? vars.secondary)
  const text = asHex(vars['--theme-text'] ?? vars['--theme-text-primary'] ?? vars.text)
  const background = asHex(vars['--theme-background'] ?? vars['--theme-surface'] ?? vars.background)
  const accentCandidates = [
    vars['--theme-accent'],
    vars['--theme-accent-1'],
    vars['--theme-accent-2'],
    vars['--theme-accent-3'],
    vars['--theme-tertiary'],
    vars.accent,
    vars.tertiary,
  ]
  const accents = accentCandidates.map(asHex).filter((value): value is string => Boolean(value))
  const mode = typeof vars['--theme-mode'] === 'string' && vars['--theme-mode'] === 'dark' ? 'dark' : undefined

  if (!primary && !secondary && !text && !background && accents.length === 0) return null
  return {
    primary,
    secondary,
    accents,
    text,
    background,
    mode,
  }
}

export function useDeckThemePalette(presentationId?: string | null) {
  const [palette, setPalette] = useState<ThemePalette | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!presentationId) {
      setPalette(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${LAYOUT_SERVICE_URL}/api/presentations/${encodeURIComponent(presentationId)}/theme/css-variables`, {
      cache: 'no-store',
    })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then(data => {
        if (cancelled) return
        setPalette(derivePalette(data || {}))
      })
      .catch(err => {
        if (cancelled) return
        setPalette(null)
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [presentationId])

  return { palette, loading, error }
}
