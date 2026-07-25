import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useSubscription } from './use-subscription'
import { isKgEntitled } from '@/lib/kg-entitlement'

interface KgSettings {
  user_id: string
  subscribed: boolean
  cross_session_enabled: boolean
  consent_version: string | null
  consent_at: string | null
  created_at: string | null
  updated_at: string | null
  /** Set by the proxy when the KG backend is unreachable / not activated. */
  service_unavailable?: boolean
  /** Readiness probe result forwarded by the settings proxy. */
  capability?: KgCapability
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
  const { data: session, status: sessionStatus } = useSession()
  const {
    subscription,
    isLoading: subscriptionLoading,
    accountKey,
  } = useSubscription()
  const [settings, setSettings] = useState<KgSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [serviceAvailable, setServiceAvailable] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [capability, setCapability] = useState<KgCapability>(UNKNOWN_CAPABILITY)
  const settingsGenerationRef = useRef(0)
  const settingsAbortRef = useRef<AbortController | null>(null)
  const mutationGenerationRef = useRef(0)
  const mutationAbortRef = useRef<AbortController | null>(null)

  const userId = session?.user?.id
  // Central entitlement check (lib/kg-entitlement.ts): coupon `premium`
  // user tier OR an active paid subscription (premium/pro/enterprise).
  const isEntitled = isKgEntitled(session?.user?.tier, subscription)
  const entitlementKey = `${accountKey}:${isEntitled ? 'entitled' : 'locked'}`
  const [resolvedEntitlementKey, setResolvedEntitlementKey] = useState<string | null>(null)
  const currentEntitlementKeyRef = useRef(entitlementKey)
  currentEntitlementKeyRef.current = entitlementKey

  const fetchSettings = useCallback(async () => {
    const generation = ++settingsGenerationRef.current
    settingsAbortRef.current?.abort()
    const controller = new AbortController()
    settingsAbortRef.current = controller
    const isCurrent = () =>
      !controller.signal.aborted &&
      settingsGenerationRef.current === generation &&
      currentEntitlementKeyRef.current === entitlementKey

    if (sessionStatus === 'loading' || subscriptionLoading) {
      if (isCurrent()) setIsLoading(true)
      return
    }
    if (!userId || !isEntitled) {
      if (isCurrent()) {
        setSettings(null)
        setCapability(UNKNOWN_CAPABILITY)
        setServiceAvailable(true)
        setError(null)
        setIsLoading(false)
        setResolvedEntitlementKey(entitlementKey)
      }
      return
    }

    if (isCurrent()) setIsLoading(true)
    try {
      const resp = await fetch('/api/knowledge-graph/settings', { signal: controller.signal })
      if (resp.ok) {
        const body: KgSettings = await resp.json()
        if (isCurrent()) {
          setSettings(body)
          setCapability(body.capability || UNKNOWN_CAPABILITY)
          setServiceAvailable(body.capability?.available !== false)
          setError(null)
        }
      } else {
        const body = await resp.json().catch(() => ({}))
        if (isCurrent()) {
          setSettings(null)
          setCapability({
            source: 'knowledge_graph',
            configured: false,
            available: false,
            code: body.code || 'KG_BACKEND_FAILURE',
            reason: body.reason || 'Knowledge Graph availability could not be verified.',
          })
          setServiceAvailable(resp.status !== 503)
          setError(body.error || 'Failed to load knowledge graph settings')
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error('Failed to fetch KG settings:', e)
        if (isCurrent()) {
          setSettings(null)
          setCapability({
            source: 'knowledge_graph',
            configured: false,
            available: false,
            code: 'KG_BACKEND_FAILURE',
            reason: 'Knowledge Graph availability could not be verified.',
          })
          setServiceAvailable(false)
          setError('Knowledge graph settings are temporarily unavailable')
        }
      }
    } finally {
      if (isCurrent()) {
        setIsLoading(false)
        setResolvedEntitlementKey(entitlementKey)
      }
    }
  }, [entitlementKey, isEntitled, sessionStatus, subscriptionLoading, userId])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    // Mutations are scoped to the account/entitlement that initiated them.
    // Abort them as soon as that ownership boundary changes.
    mutationAbortRef.current?.abort()
    mutationGenerationRef.current += 1
  }, [entitlementKey])

  useEffect(() => () => {
    settingsAbortRef.current?.abort()
    mutationAbortRef.current?.abort()
    settingsGenerationRef.current += 1
    mutationGenerationRef.current += 1
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) return false
    settingsAbortRef.current?.abort()
    settingsGenerationRef.current += 1
    const requestKey = entitlementKey
    const generation = ++mutationGenerationRef.current
    mutationAbortRef.current?.abort()
    const controller = new AbortController()
    mutationAbortRef.current = controller
    const isCurrent = () =>
      !controller.signal.aborted &&
      mutationGenerationRef.current === generation &&
      currentEntitlementKeyRef.current === requestKey
    try {
      const resp = await fetch('/api/knowledge-graph/subscribe', {
        method: 'POST',
        signal: controller.signal,
      })
      if (resp.ok) {
        const body: KgSettings = await resp.json()
        if (!isCurrent()) return false
        setSettings(body)
        setServiceAvailable(!body.service_unavailable)
        setError(null)
        return !body.service_unavailable
      }
      const body = await resp.json().catch(() => ({}))
      if (!isCurrent()) return false
      if (resp.status === 503 || body.service_unavailable) {
        setServiceAvailable(false)
      }
      setError(body.error || 'Failed to enable knowledge graph')
      return false
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error('KG subscribe error:', e)
        if (isCurrent()) {
          setServiceAvailable(false)
          setError('Network error. Please try again.')
        }
      }
      return false
    } finally {
      if (isCurrent()) {
        setIsLoading(false)
        setResolvedEntitlementKey(requestKey)
      }
    }
  }, [entitlementKey, userId])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) return false
    settingsAbortRef.current?.abort()
    settingsGenerationRef.current += 1
    const requestKey = entitlementKey
    const generation = ++mutationGenerationRef.current
    mutationAbortRef.current?.abort()
    const controller = new AbortController()
    mutationAbortRef.current = controller
    const isCurrent = () =>
      !controller.signal.aborted &&
      mutationGenerationRef.current === generation &&
      currentEntitlementKeyRef.current === requestKey
    try {
      // Durable pause on the backend — keeps graph data, stops KG engagement.
      const resp = await fetch('/api/knowledge-graph/unsubscribe', {
        method: 'POST',
        signal: controller.signal,
      })
      if (resp.ok) {
        const body: KgSettings = await resp.json()
        if (!isCurrent()) return false
        setSettings(body)
        setServiceAvailable(!body.service_unavailable)
        setError(null)
        return !body.service_unavailable
      }
      const body = await resp.json().catch(() => ({}))
      if (!isCurrent()) return false
      if (resp.status === 503 || body.service_unavailable) {
        setServiceAvailable(false)
      }
      setError(body.error || 'Failed to pause knowledge graph')
      return false
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error('KG unsubscribe error:', e)
        if (isCurrent()) {
          setServiceAvailable(false)
          setError('Network error. Please try again.')
        }
      }
      return false
    } finally {
      if (isCurrent()) {
        setIsLoading(false)
        setResolvedEntitlementKey(requestKey)
      }
    }
  }, [entitlementKey, userId])

  const purge = useCallback(async (): Promise<PurgeResult | null> => {
    if (!userId) return null
    settingsAbortRef.current?.abort()
    settingsGenerationRef.current += 1
    const requestKey = entitlementKey
    const generation = ++mutationGenerationRef.current
    mutationAbortRef.current?.abort()
    const controller = new AbortController()
    mutationAbortRef.current = controller
    const isCurrent = () =>
      !controller.signal.aborted &&
      mutationGenerationRef.current === generation &&
      currentEntitlementKeyRef.current === requestKey
    try {
      const resp = await fetch('/api/knowledge-graph/purge', {
        method: 'DELETE',
        signal: controller.signal,
      })
      if (resp.ok) {
        const result: PurgeResult = await resp.json()
        if (!isCurrent()) return null
        setSettings(null)
        setError(null)
        return result
      }
      const body = await resp.json().catch(() => ({}))
      if (!isCurrent()) return null
      if (resp.status === 503 || body.service_unavailable) {
        setServiceAvailable(false)
      }
      setError(body.error || 'Failed to delete knowledge graph')
      return null
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error('KG purge error:', e)
        if (isCurrent()) {
          setServiceAvailable(false)
          setError('Network error. Please try again.')
        }
      }
      return null
    } finally {
      if (isCurrent()) {
        setIsLoading(false)
        setResolvedEntitlementKey(requestKey)
      }
    }
  }, [entitlementKey, userId])

  const accessResolved = resolvedEntitlementKey === entitlementKey
  const currentSettings = accessResolved ? settings : null
  const isSubscribed = !!(currentSettings?.subscribed && currentSettings?.cross_session_enabled)
  const accessLoading =
    sessionStatus === 'loading' ||
    subscriptionLoading ||
    isLoading ||
    !accessResolved

  return {
    /** @deprecated alias of isEntitled, kept for existing call sites */
    isPremium: isEntitled,
    isEntitled,
    isSubscribed,
    serviceAvailable: accessResolved ? serviceAvailable : true,
    isLoading: accessLoading,
    error: accessResolved ? error : null,
    capability,
    settings: currentSettings,
    accountKey,
    entitlementKey,
    subscribe,
    unsubscribe,
    purge,
    refetch: fetchSettings,
  }
}
