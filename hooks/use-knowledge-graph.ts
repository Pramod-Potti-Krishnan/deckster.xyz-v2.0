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

export interface KgCapability {
  source: 'knowledge_graph'
  configured: boolean
  available: boolean
  code: string | null
  reason: string | null
}

const UNKNOWN_CAPABILITY: KgCapability = {
  source: 'knowledge_graph',
  configured: false,
  available: false,
  code: 'KG_CAPABILITY_UNKNOWN',
  reason: 'Knowledge Graph availability has not been verified.',
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
  const [capability, setCapability] = useState<KgCapability>(UNKNOWN_CAPABILITY)

  const userId = session?.user?.id
  // Premium can be granted by a coupon (session user tier) or a Stripe
  // subscription. Coupon users have no subscription, so check both sources.
  const isPremium =
    session?.user?.tier === 'premium' || subscription?.tier === 'premium'

  const fetchSettings = useCallback(async () => {
    if (!userId || !isPremium) {
      setSettings(null)
      setCapability(UNKNOWN_CAPABILITY)
      setIsLoading(false)
      return
    }

    try {
      const resp = await fetch('/api/knowledge-graph/settings')
      if (resp.ok) {
        const body = await resp.json()
        setSettings(body)
        setCapability(body.capability || UNKNOWN_CAPABILITY)
        setError(null)
      } else {
        const body = await resp.json().catch(() => ({}))
        setSettings(null)
        setCapability({
          source: 'knowledge_graph',
          configured: false,
          available: false,
          code: body.code || 'KG_BACKEND_FAILURE',
          reason: body.reason || 'Knowledge Graph availability could not be verified.',
        })
        setError(body.error || 'Failed to fetch Knowledge Graph settings')
      }
    } catch (e) {
      console.error('Failed to fetch KG settings:', e)
      setSettings(null)
      setCapability({
        source: 'knowledge_graph',
        configured: false,
        available: false,
        code: 'KG_BACKEND_FAILURE',
        reason: 'Knowledge Graph availability could not be verified.',
      })
      setError('Knowledge Graph service is temporarily unavailable')
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
    capability,
    settings,
    subscribe,
    unsubscribe,
    purge,
    refetch: fetchSettings,
  }
}
