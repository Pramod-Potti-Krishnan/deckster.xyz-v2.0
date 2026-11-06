import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
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

function usePaidKnowledgeGraph(enabled: boolean) {
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
  const paidMountedRef = useRef(true)

  const userId = session?.user?.id
  // Central entitlement check (lib/kg-entitlement.ts): coupon `premium`
  // user tier OR an active paid subscription (premium/pro/enterprise).
  const isEntitled = isKgEntitled(session?.user?.tier, subscription)
  const entitlementKey = `${accountKey}:${isEntitled ? 'entitled' : 'locked'}`
  const paidContextKey = `${enabled}:${entitlementKey}`
  const paidContextRef = useRef({ key: paidContextKey, lifetime: 0 })
  if (paidContextRef.current.key !== paidContextKey) paidContextRef.current.lifetime += 1
  paidContextRef.current.key = paidContextKey
  const paidLifetime = paidContextRef.current.lifetime
  const [resolvedPaidLifetime, setResolvedPaidLifetime] = useState<number | null>(null)
  const [resolvedEntitlementKey, setResolvedEntitlementKey] = useState<string | null>(null)
  const currentEntitlementKeyRef = useRef(entitlementKey)
  currentEntitlementKeyRef.current = entitlementKey

  const fetchSettings = useCallback(async () => {
    if (!paidMountedRef.current || paidContextRef.current.lifetime !== paidLifetime) return
    const generation = ++settingsGenerationRef.current
    settingsAbortRef.current?.abort()
    const controller = new AbortController()
    settingsAbortRef.current = controller
    const isCurrent = () =>
      paidMountedRef.current && !controller.signal.aborted &&
      settingsGenerationRef.current === generation &&
      currentEntitlementKeyRef.current === entitlementKey &&
      paidContextRef.current.lifetime === paidLifetime

    if (!enabled) {
      if (isCurrent()) {
        setSettings(null)
        setIsLoading(false)
        setResolvedEntitlementKey(entitlementKey)
        setResolvedPaidLifetime(paidLifetime)
      }
      return
    }

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
        setResolvedPaidLifetime(paidLifetime)
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
        setResolvedPaidLifetime(paidLifetime)
      }
    }
  }, [enabled, paidLifetime, entitlementKey, isEntitled, sessionStatus, subscriptionLoading, userId])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    // Mutations are scoped to the account/entitlement that initiated them.
    // Abort them as soon as that ownership boundary changes.
    mutationAbortRef.current?.abort()
    mutationGenerationRef.current += 1
  }, [entitlementKey, enabled, paidLifetime])

  useLayoutEffect(() => {
    paidMountedRef.current = true
    return () => {
      paidMountedRef.current = false
      settingsAbortRef.current?.abort()
      mutationAbortRef.current?.abort()
      settingsGenerationRef.current += 1
      mutationGenerationRef.current += 1
    }
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!paidMountedRef.current || !enabled || !userId || paidContextRef.current.lifetime !== paidLifetime) return false
    settingsAbortRef.current?.abort()
    settingsGenerationRef.current += 1
    const requestKey = entitlementKey
    const generation = ++mutationGenerationRef.current
    mutationAbortRef.current?.abort()
    const controller = new AbortController()
    mutationAbortRef.current = controller
    const isCurrent = () =>
      paidMountedRef.current && !controller.signal.aborted &&
      mutationGenerationRef.current === generation &&
      currentEntitlementKeyRef.current === requestKey && paidContextRef.current.lifetime === paidLifetime
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
        setResolvedPaidLifetime(paidLifetime)
      }
    }
  }, [enabled, paidLifetime, entitlementKey, userId])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!paidMountedRef.current || !enabled || !userId || paidContextRef.current.lifetime !== paidLifetime) return false
    settingsAbortRef.current?.abort()
    settingsGenerationRef.current += 1
    const requestKey = entitlementKey
    const generation = ++mutationGenerationRef.current
    mutationAbortRef.current?.abort()
    const controller = new AbortController()
    mutationAbortRef.current = controller
    const isCurrent = () =>
      paidMountedRef.current && !controller.signal.aborted &&
      mutationGenerationRef.current === generation &&
      currentEntitlementKeyRef.current === requestKey && paidContextRef.current.lifetime === paidLifetime
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
        setResolvedPaidLifetime(paidLifetime)
      }
    }
  }, [enabled, paidLifetime, entitlementKey, userId])

  const purge = useCallback(async (): Promise<PurgeResult | null> => {
    if (!paidMountedRef.current || !enabled || !userId || paidContextRef.current.lifetime !== paidLifetime) return null
    settingsAbortRef.current?.abort()
    settingsGenerationRef.current += 1
    const requestKey = entitlementKey
    const generation = ++mutationGenerationRef.current
    mutationAbortRef.current?.abort()
    const controller = new AbortController()
    mutationAbortRef.current = controller
    const isCurrent = () =>
      paidMountedRef.current && !controller.signal.aborted &&
      mutationGenerationRef.current === generation &&
      currentEntitlementKeyRef.current === requestKey && paidContextRef.current.lifetime === paidLifetime
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
        setResolvedPaidLifetime(paidLifetime)
      }
    }
  }, [enabled, paidLifetime, entitlementKey, userId])

  const accessResolved = resolvedEntitlementKey === entitlementKey && resolvedPaidLifetime === paidLifetime
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
    userId,
    sessionStatus,
    isEntitlementLoading: sessionStatus === 'loading' || subscriptionLoading,
  }
}

type KnowledgeGraphMode = 'graph' | 'management'
type ManagementRecord = { lifetime: number; settings: KgSettings | null; capability: KgCapability; error: string | null; verified: boolean }

function isCapability(value: unknown): value is KgCapability {
  if (!value || typeof value !== 'object') return false
  const body = value as Record<string, unknown>
  return body.source === 'knowledge_graph' && typeof body.configured === 'boolean' && typeof body.available === 'boolean' &&
    ['code', 'reason'].every(key => body[key] === undefined || body[key] === null || typeof body[key] === 'string')
}

function isSettingsReceipt(value: unknown, owner: string): value is KgSettings {
  if (!value || typeof value !== 'object') return false
  const body = value as Record<string, unknown>
  return body.user_id === owner && typeof body.subscribed === 'boolean' && typeof body.cross_session_enabled === 'boolean' &&
    ['consent_version', 'consent_at', 'created_at', 'updated_at'].every(key => body[key] === null || typeof body[key] === 'string') &&
    (body.service_unavailable === undefined || body.service_unavailable === false) &&
    (body.capability === undefined || isCapability(body.capability))
}

function isPurgeReceipt(value: unknown, owner: string): value is PurgeResult {
  if (!value || typeof value !== 'object') return false
  const body = value as Record<string, unknown>
  return body.user_id === owner && typeof body.settings_deleted === 'boolean' &&
    ['nodes_deleted', 'edges_deleted', 'evidence_deleted'].every(key => Number.isSafeInteger(body[key]) && Number(body[key]) >= 0) &&
    (body.service_unavailable === undefined || body.service_unavailable === false)
}

/** Authenticated retained-data management only. Never grants paid graph use. */
function useKnowledgeManagement(enabled: boolean, paid: ReturnType<typeof usePaidKnowledgeGraph>) {
  const authenticated = paid.sessionStatus === 'authenticated' && Boolean(paid.userId)
  const contextKey = `${enabled}:${paid.accountKey}:${paid.sessionStatus}:${paid.userId || ''}`
  const contextRef = useRef({ key: contextKey, lifetime: 0 })
  if (contextRef.current.key !== contextKey) contextRef.current.lifetime += 1
  contextRef.current.key = contextKey
  const lifetime = contextRef.current.lifetime
  const actionKey = `${contextKey}:${paid.entitlementKey}:${paid.isEntitlementLoading}`
  const actionRef = useRef({ key: actionKey, lifetime: 0 })
  if (actionRef.current.key !== actionKey) actionRef.current.lifetime += 1
  actionRef.current.key = actionKey
  const actionLifetime = actionRef.current.lifetime
  const owner = paid.userId || ''
  const [record, setRecord] = useState<ManagementRecord | null>(null)
  const [readState, setReadState] = useState<{ lifetime: number; loading: boolean } | null>(null)
  const [mutationState, setMutationState] = useState<{ lifetime: number; pending: boolean; unconfirmed: boolean } | null>(null)
  const mountedRef = useRef(true)
  const readGenerationRef = useRef(0)
  const readAbortRef = useRef<AbortController | null>(null)
  const readBusyRef = useRef(false)
  const mutationGenerationRef = useRef(0)
  const mutationAbortRef = useRef<AbortController | null>(null)
  const mutationBusyRef = useRef(false)
  const dispatchedRef = useRef<{ owner: string; action: string } | null>(null)
  const readbackNeededRef = useRef(false)
  const currentRecord = record?.lifetime === lifetime ? record : null
  const currentReadLoading = readState?.lifetime === lifetime && readState.loading
  const currentMutation = mutationState?.lifetime === actionLifetime ? mutationState : null
  const managementReady = !!(enabled && authenticated && currentRecord?.verified && currentRecord.settings &&
    currentRecord.capability.available && !currentReadLoading && !currentMutation?.pending && !currentMutation?.unconfirmed)
  const liveRef = useRef({ enabled, authenticated, owner, lifetime, actionLifetime, managementReady, canEnable: false })
  liveRef.current = { enabled, authenticated, owner, lifetime, actionLifetime, managementReady,
    canEnable: managementReady && paid.isEntitled && !paid.isEntitlementLoading }

  const readSettings = useCallback(async (): Promise<KgSettings | null> => {
    const live = liveRef.current
    if (!mountedRef.current || !enabled || !authenticated || live.lifetime !== lifetime || live.owner !== owner || mutationBusyRef.current) return null
    const generation = ++readGenerationRef.current
    readAbortRef.current?.abort()
    const controller = new AbortController()
    readAbortRef.current = controller
    readBusyRef.current = true
    const isCurrent = () => mountedRef.current && !controller.signal.aborted && readGenerationRef.current === generation &&
      liveRef.current.enabled && liveRef.current.authenticated && liveRef.current.owner === owner && liveRef.current.lifetime === lifetime
    setReadState({ lifetime, loading: true })
    try {
      const response = await fetch('/api/knowledge-graph/settings', { signal: controller.signal })
      if (!isCurrent()) return null
      const body = await response.json().catch(() => null)
      if (!isCurrent()) return null
      if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : 'Knowledge management settings could not be verified.')
      if (!isSettingsReceipt(body, owner)) throw new Error('The settings response could not be verified for this account. No management change is confirmed.')
      const capability = body.capability ? { ...body.capability, code: body.capability.code ?? null, reason: body.capability.reason ?? null } : undefined
      const verified = !!(capability?.source === 'knowledge_graph' && capability.configured === true && capability.available === true)
      setRecord({ lifetime, settings: body, capability: capability || UNKNOWN_CAPABILITY,
        verified, error: verified ? null : 'Management readiness is unverified. This response does not establish whether retained Knowledge Graph data exists.' })
      setMutationState(current => current?.lifetime === actionRef.current.lifetime ? { ...current, unconfirmed: false } : current)
      return verified ? body : null
    } catch (failure) {
      if (isCurrent()) setRecord({ lifetime, settings: null, capability: UNKNOWN_CAPABILITY, verified: false,
        error: failure instanceof Error ? failure.message : 'Knowledge management settings could not be verified.' })
      return null
    } finally {
      if (isCurrent()) {
        readBusyRef.current = false
        setReadState({ lifetime, loading: false })
      }
    }
  }, [enabled, authenticated, owner, lifetime])

  useLayoutEffect(() => {
    readAbortRef.current?.abort()
    readGenerationRef.current += 1
    readBusyRef.current = false
  }, [lifetime])

  useLayoutEffect(() => {
    const dispatched = dispatchedRef.current
    mutationAbortRef.current?.abort()
    mutationGenerationRef.current += 1
    mutationBusyRef.current = false
    dispatchedRef.current = null
    if (dispatched && enabled && authenticated && dispatched.owner === owner) {
      readbackNeededRef.current = true
      setRecord(current => current?.lifetime === lifetime ? { ...current, verified: false,
        error: 'A previous management request is unconfirmed after access changed. Already dispatched work may have completed. Check the current settings before trying again.' } : current)
      setMutationState({ lifetime: actionLifetime, pending: false, unconfirmed: true })
    }
  }, [enabled, authenticated, owner, lifetime, actionLifetime])

  useEffect(() => { if (enabled && authenticated) void readSettings() }, [enabled, authenticated, readSettings])
  useEffect(() => {
    if (enabled && authenticated && readbackNeededRef.current) {
      readbackNeededRef.current = false
      void readSettings()
    }
  }, [enabled, authenticated, actionLifetime, readSettings])
  useLayoutEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      readAbortRef.current?.abort()
      mutationAbortRef.current?.abort()
      readGenerationRef.current += 1
      mutationGenerationRef.current += 1
      readBusyRef.current = false
      mutationBusyRef.current = false
      dispatchedRef.current = null
    }
  }, [])

  const mutate = useCallback(async (action: 'subscribe' | 'unsubscribe' | 'purge'): Promise<KgSettings | PurgeResult | null> => {
    const live = liveRef.current
    if (!mountedRef.current || !enabled || !authenticated || live.owner !== owner || live.lifetime !== lifetime ||
      live.actionLifetime !== actionLifetime || !live.managementReady || readBusyRef.current || mutationBusyRef.current ||
      (action === 'subscribe' && !live.canEnable)) return null
    mutationBusyRef.current = true
    const generation = ++mutationGenerationRef.current
    const controller = new AbortController()
    mutationAbortRef.current = controller
    const isCurrent = () => mountedRef.current && !controller.signal.aborted && mutationGenerationRef.current === generation &&
      liveRef.current.enabled && liveRef.current.authenticated && liveRef.current.owner === owner &&
      liveRef.current.lifetime === lifetime && liveRef.current.actionLifetime === actionLifetime
    setMutationState({ lifetime: actionLifetime, pending: true, unconfirmed: false })
    let receipt: KgSettings | PurgeResult | null = null
    try {
      dispatchedRef.current = { owner, action }
      const response = await fetch(`/api/knowledge-graph/${action}`, { method: action === 'purge' ? 'DELETE' : 'POST', signal: controller.signal })
      if (!isCurrent()) return null
      const body = await response.json().catch(() => null)
      if (!isCurrent()) return null
      if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : 'The management request was not confirmed.')
      if (action === 'purge' ? !isPurgeReceipt(body, owner) : !isSettingsReceipt(body, owner)) throw new Error('The returned receipt could not be verified for this account. The request outcome is unconfirmed.')
      if (action === 'subscribe' && !(body.subscribed && body.cross_session_enabled)) throw new Error('Enabling consent was not confirmed by the returned record.')
      if (action === 'unsubscribe' && body.cross_session_enabled !== false) throw new Error('Pausing consent was not confirmed by the returned record.')
      receipt = body
      if (action !== 'purge') setRecord(current => current?.lifetime === lifetime && isCurrent() ? { ...current, settings: body, error: null } : current)
    } catch (failure) {
      if (isCurrent()) {
        setRecord(current => current?.lifetime === lifetime ? { ...current, verified: false,
          error: `${failure instanceof Error ? failure.message : 'The management request was not confirmed.'} Already dispatched work may have completed. Retry settings before deciding whether to send another request.` } : current)
        setMutationState({ lifetime: actionLifetime, pending: false, unconfirmed: true })
      }
      return null
    } finally {
      if (isCurrent()) {
        mutationBusyRef.current = false
        dispatchedRef.current = null
        setMutationState(current => current?.lifetime === actionLifetime ? { ...current, pending: false } : current)
      }
    }
    if (!receipt || !isCurrent()) return null
    const readback = await readSettings()
    if (!isCurrent()) return null
    if (action !== 'purge' && (!readback || (action === 'subscribe' ? !(readback.subscribed && readback.cross_session_enabled) : readback.cross_session_enabled !== false))) {
      setRecord(current => current?.lifetime === lifetime ? { ...current, verified: false,
        error: 'The consent receipt was acknowledged, but current settings could not confirm the requested state. Check settings before trying again.' } : current)
      setMutationState({ lifetime: actionLifetime, pending: false, unconfirmed: true })
      return null
    }
    return receipt
  }, [enabled, authenticated, owner, lifetime, actionLifetime, readSettings])

  const subscribe = useCallback(async () => Boolean(await mutate('subscribe')), [mutate])
  const unsubscribe = useCallback(async () => Boolean(await mutate('unsubscribe')), [mutate])
  const purge = useCallback(async (): Promise<PurgeResult | null> => {
    const receipt = await mutate('purge')
    return receipt && 'nodes_deleted' in receipt ? receipt : null
  }, [mutate])

  return {
    settings: currentRecord?.settings || null,
    capability: currentRecord?.capability || UNKNOWN_CAPABILITY,
    serviceAvailable: !!currentRecord?.verified,
    error: currentRecord?.error || null,
    isSubscribed: !!(currentRecord?.verified && currentRecord.settings?.subscribed && currentRecord.settings.cross_session_enabled),
    isLoading: paid.sessionStatus === 'loading' || (enabled && authenticated && (!currentRecord || currentReadLoading && !currentRecord.settings)),
    settingsRefreshing: !!currentReadLoading,
    isMutating: !!currentMutation?.pending,
    mutationUnconfirmed: !!currentMutation?.unconfirmed,
    isAuthenticated: authenticated,
    managementReady,
    managementLifetime: `${lifetime}:${actionLifetime}`,
    subscribe, unsubscribe, purge, refetch: readSettings,
  }
}

/** Default callers retain paid graph semantics; only settings opts into management. */
export function useKnowledgeGraph(options?: { mode?: KnowledgeGraphMode }) {
  const managementMode = options?.mode === 'management'
  const paid = usePaidKnowledgeGraph(!managementMode)
  const management = useKnowledgeManagement(managementMode, paid)
  return managementMode ? { ...paid, ...management, managementMode: true } : {
    ...paid, managementMode: false, settingsRefreshing: false, isMutating: false, mutationUnconfirmed: false,
    isAuthenticated: paid.sessionStatus === 'authenticated' && Boolean(paid.userId), managementReady: false,
    managementLifetime: `graph:${paid.entitlementKey}`,
  }
}
