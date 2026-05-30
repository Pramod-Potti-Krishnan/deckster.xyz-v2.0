import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSubscription } from './use-subscription'

interface KgSettings {
  user_id: string
  subscribed: boolean
  cross_session_enabled: boolean
  consent_version: string | null
  consent_at: string | null
  created_at: string | null
  updated_at: string | null
}

interface PurgeResult {
  user_id: string
  settings_deleted: boolean
  nodes_deleted: number
  edges_deleted: number
  evidence_deleted: number
}

export function useKnowledgeGraph() {
  const { data: session } = useSession()
  const { subscription } = useSubscription()
  const [settings, setSettings] = useState<KgSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userId = session?.user?.id
  const isPremium = subscription?.tier === 'premium'

  const fetchSettings = useCallback(async () => {
    if (!userId || !isPremium) {
      setSettings(null)
      setIsLoading(false)
      return
    }

    try {
      const resp = await fetch('/api/knowledge-graph/settings')
      if (resp.ok) {
        setSettings(await resp.json())
      } else {
        setSettings(null)
      }
      setError(null)
    } catch (e) {
      console.error('Failed to fetch KG settings:', e)
      setSettings(null)
      // Don't show error for network issues — just treat as unsubscribed
    } finally {
      setIsLoading(false)
    }
  }, [userId, isPremium])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) return false
    try {
      const resp = await fetch('/api/knowledge-graph/subscribe', {
        method: 'POST',
      })
      if (resp.ok) {
        setSettings(await resp.json())
        setError(null)
        return true
      }
      const body = await resp.json().catch(() => ({}))
      setError(body.error || 'Failed to enable knowledge graph')
      return false
    } catch (e) {
      console.error('KG subscribe error:', e)
      setError('Network error. Please try again.')
      return false
    }
  }, [userId])

  const unsubscribe = useCallback(() => {
    if (settings) {
      setSettings({ ...settings, subscribed: false, cross_session_enabled: false })
    }
  }, [settings])

  const purge = useCallback(async (): Promise<PurgeResult | null> => {
    if (!userId) return null
    try {
      const resp = await fetch('/api/knowledge-graph/purge', {
        method: 'DELETE',
      })
      if (resp.ok) {
        const result: PurgeResult = await resp.json()
        setSettings(null)
        setError(null)
        return result
      }
      const body = await resp.json().catch(() => ({}))
      setError(body.error || 'Failed to delete knowledge graph')
      return null
    } catch (e) {
      console.error('KG purge error:', e)
      setError('Network error. Please try again.')
      return null
    }
  }, [userId])

  const isSubscribed = !!(settings?.subscribed && settings?.cross_session_enabled)

  return {
    isPremium,
    isSubscribed,
    isLoading,
    error,
    settings,
    subscribe,
    unsubscribe,
    purge,
    refetch: fetchSettings,
  }
}
