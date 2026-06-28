import { useCallback, useState } from 'react'
import type { BuildThemeSelection } from '@/lib/theme-builder'

export interface SavedThemeProfile {
  id: string
  name: string
  description?: string | null
  theme_payload: BuildThemeSelection
  is_standard?: boolean
  usage_count?: number
  created_at?: string | null
  updated_at?: string | null
}

export interface ThemeProfilesResponse {
  themes: SavedThemeProfile[]
  count: number
}

export function useThemeProfiles() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const listThemes = useCallback(async (): Promise<ThemeProfilesResponse | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/themes', { cache: 'no-store' })
      if (!res.ok) throw new Error(`list failed: HTTP ${res.status}`)
      const data = await res.json()
      return { themes: data.themes ?? [], count: data.count ?? 0 }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const saveTheme = useCallback(async (args: {
    name: string
    theme: BuildThemeSelection
    description?: string
    setStandard?: boolean
  }): Promise<SavedThemeProfile | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: args.name,
          description: args.description ?? null,
          theme: args.theme,
          set_standard: args.setStandard ?? false,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || `save failed: HTTP ${res.status}`)
      }
      return data as SavedThemeProfile
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const setStandardTheme = useCallback(async (id: string): Promise<SavedThemeProfile | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/themes/${encodeURIComponent(id)}/standard`, { method: 'PUT' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || `standard failed: HTTP ${res.status}`)
      }
      return data.theme as SavedThemeProfile
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clearStandardTheme = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/themes/standard', { method: 'DELETE' })
      return res.ok
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteTheme = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/themes/${encodeURIComponent(id)}`, { method: 'DELETE' })
      return res.ok
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    listThemes,
    saveTheme,
    setStandardTheme,
    clearStandardTheme,
    deleteTheme,
  }
}
