'use client'

import { useEffect, useState } from 'react'
import { LAYOUT_SERVICE_URL } from '@/lib/layout-service-client'
import type { ThemePalette } from '@/types/textlabs'

export interface DeckThemeToken {
  id: 'primary' | 'accent_1' | 'accent_2' | 'surface' | 'heading_text' | 'body_text'
  label: string
  color: string
}

function asHex(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : undefined
}

function derivePalette(vars: Record<string, unknown>): ThemePalette | null {
  const primary = asHex(vars['--theme-primary'] ?? vars['--theme-color-primary'] ?? vars.primary)
  const secondary = asHex(vars['--theme-primary-dark'] ?? vars['--theme-secondary'] ?? vars['--theme-accent'] ?? vars.secondary)
  const text = asHex(vars['--theme-text-primary'] ?? vars['--theme-text-body'] ?? vars['--theme-text'] ?? vars.text)
  const background = asHex(vars['--theme-bg'] ?? vars['--theme-background'] ?? vars['--theme-bg-alt'] ?? vars.background)
  const accentCandidates = [
    vars['--theme-accent'],
    vars['--theme-accent-1'],
    vars['--theme-accent-2'],
    vars['--theme-accent-3'],
    vars['--theme-primary-light'],
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

function deriveTokens(vars: Record<string, unknown>): DeckThemeToken[] {
  const candidates: Array<[DeckThemeToken['id'], string, unknown]> = [
    ['primary', 'Primary', vars['--theme-primary'] ?? vars['--theme-color-primary'] ?? vars.primary],
    ['accent_1', 'Accent 1', vars['--theme-accent-1'] ?? vars['--theme-accent'] ?? vars['--theme-primary-light']],
    ['accent_2', 'Accent 2', vars['--theme-accent-2'] ?? vars['--theme-secondary'] ?? vars['--theme-tertiary']],
    ['surface', 'Surface', vars['--theme-surface'] ?? vars['--theme-bg-alt'] ?? vars['--theme-background'] ?? vars['--theme-bg']],
    ['heading_text', 'Heading Text', vars['--theme-text-heading'] ?? vars['--theme-text-primary'] ?? vars['--theme-text']],
    ['body_text', 'Body Text', vars['--theme-text-body'] ?? vars['--theme-text-secondary'] ?? vars['--theme-text']],
  ]
  return candidates.flatMap(([id, label, value]) => {
    const color = asHex(value)
    return color ? [{ id, label, color }] : []
  })
}

export function useDeckThemePalette(presentationId?: string | null) {
  const [palette, setPalette] = useState<ThemePalette | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<DeckThemeToken[]>([])

  useEffect(() => {
    if (!presentationId) {
      setPalette(null)
      setTokens([])
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
        const vars = data?.css_variables && typeof data.css_variables === 'object'
          ? data.css_variables
          : data
        setPalette(derivePalette(vars || {}))
        setTokens(deriveTokens(vars || {}))
      })
      .catch(err => {
        if (cancelled) return
        setPalette(null)
        setTokens([])
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [presentationId])

  return { palette, tokens, loading, error }
}
