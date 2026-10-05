"use client"

import "@/components/knowledge/studio-knowledge-settings.css"
import { useLayoutEffect, useRef, useState } from "react"
import { useKnowledgeGraph } from "@/hooks/use-knowledge-graph"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Brain, Trash2, AlertTriangle, Lock, ArrowLeft, RefreshCw } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"
const STUDIO_SHELL = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"
type KnowledgeGraphAccess = ReturnType<typeof useKnowledgeGraph>

function recordedDate(value: string | null | undefined) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")
}

export default function KnowledgeGraphSettingsPage() {
  const kg = useKnowledgeGraph({ mode: "management" })
  const content = <KnowledgeGraphSettingsForAccount key={kg.accountKey} kg={kg} />
  return STUDIO_SHELL ? <section data-studio-knowledge-settings="true" aria-label="Knowledge Graph settings"><Link data-studio-knowledge-settings-back="true" href="/knowledge"><ArrowLeft size={14} />Back to Knowledge</Link>{content}</section> : content
}

function KnowledgeGraphSettingsForAccount({ kg }: { kg: KnowledgeGraphAccess }) {
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)
  const [toggleLoading, setToggleLoading] = useState(false)
  const [purgeLoading, setPurgeLoading] = useState(false)
  const [purgeUnconfirmed, setPurgeUnconfirmed] = useState(false)
  const [operationNotice, setOperationNotice] = useState<string | null>(null)
  const actionGenerationRef = useRef(0)
  const mutationBusyRef = useRef(false)
  const confirmationRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const ownerLifetime = `${kg.accountKey}:${kg.managementLifetime}`
  const liveRef = useRef({ ownerLifetime, authenticated: kg.isAuthenticated, ready: kg.managementReady, canEnable: false })
  liveRef.current = { ownerLifetime, authenticated: kg.isAuthenticated, ready: kg.managementReady,
    canEnable: kg.managementReady && kg.isEntitled && !kg.isEntitlementLoading }
  const retiredLifetimeRef = useRef(ownerLifetime)
  const interruptedRef = useRef(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef(false)
  const currentPresentation = retiredLifetimeRef.current === ownerLifetime
  const confirmationVisible = showPurgeConfirm && currentPresentation
  const isCurrent = () => mountedRef.current && liveRef.current.authenticated && liveRef.current.ownerLifetime === ownerLifetime
  const canStart = () => isCurrent() && liveRef.current.ready && !mutationBusyRef.current && !kg.isMutating && !kg.settingsRefreshing
  const recordVerified = !!(kg.settings && kg.capability.available && kg.serviceAvailable)
  const consentEnabled = !!(recordVerified && kg.settings?.cross_session_enabled)

  useLayoutEffect(() => {
    if (retiredLifetimeRef.current === ownerLifetime) return
    retiredLifetimeRef.current = ownerLifetime
    interruptedRef.current = interruptedRef.current || mutationBusyRef.current
    actionGenerationRef.current += 1
    mutationBusyRef.current = false
    confirmationRef.current = null
    returnFocusRef.current = false
    setShowPurgeConfirm(false)
    setPurgeResult(null)
    setToggleLoading(false)
    setPurgeLoading(false)
    setPurgeUnconfirmed(interruptedRef.current)
    setOperationNotice(interruptedRef.current ? "A previous management request is unconfirmed after access changed. Already dispatched work may have completed. Check the current settings before deciding whether to send another request." : null)
  }, [ownerLifetime])
  useLayoutEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; actionGenerationRef.current += 1; confirmationRef.current = null; mutationBusyRef.current = false }
  }, [])

  useLayoutEffect(() => {
    if (kg.isLoading || !kg.isAuthenticated) return
    if (confirmationVisible) cancelButtonRef.current?.focus()
    else if (returnFocusRef.current) { returnFocusRef.current = false; deleteButtonRef.current?.focus() }
  }, [confirmationVisible, kg.isLoading, kg.isAuthenticated])

  if (kg.isLoading) return <Card data-studio-knowledge-settings-card={STUDIO_SHELL ? "loading" : undefined} aria-busy="true"><CardHeader data-studio-knowledge-settings-role={STUDIO_SHELL ? "header" : undefined}><CardTitle data-studio-knowledge-settings-role={STUDIO_SHELL ? "title" : undefined} className="flex items-center gap-2"><Brain className="h-5 w-5" />Knowledge Graph</CardTitle><CardDescription data-studio-knowledge-settings-role={STUDIO_SHELL ? "description" : undefined}>Checking authenticated management settings…</CardDescription></CardHeader><CardContent data-studio-knowledge-settings-role={STUDIO_SHELL ? "body" : undefined}><div data-studio-knowledge-settings-role={STUDIO_SHELL ? "loading" : undefined} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" /></CardContent></Card>
  if (!kg.isAuthenticated) return <Card data-studio-knowledge-settings-card={STUDIO_SHELL ? "signed-out" : undefined}><CardHeader><CardTitle>Knowledge Graph</CardTitle><CardDescription>Sign in to review your recorded consent and manage retained Knowledge Graph data.</CardDescription></CardHeader><CardContent><Button asChild><Link href="/auth/signin">Sign in</Link></Button></CardContent></Card>

  const busy = toggleLoading || purgeLoading || kg.isMutating || kg.settingsRefreshing
  const retrySettings = () => { if (!isCurrent() || mutationBusyRef.current || kg.isMutating) return; void kg.refetch() }
  const toggleConsent = async (checked: boolean) => {
    if (!canStart() || confirmationRef.current || (checked && !liveRef.current.canEnable)) return
    mutationBusyRef.current = true
    interruptedRef.current = false
    const generation = ++actionGenerationRef.current
    setToggleLoading(true)
    setOperationNotice(null)
    setPurgeResult(null)
    setPurgeUnconfirmed(false)
    try {
      const confirmed = checked ? await kg.subscribe() : await kg.unsubscribe()
      if (!isCurrent() || actionGenerationRef.current !== generation) return
      setOperationNotice(confirmed ? checked ? "Across-deck consent enabled and checked against the current record." : "Across-deck consent paused and checked against the current record. Retained Knowledge Graph data was not requested for deletion." : "The consent change was not confirmed. Already dispatched work may have completed. Retry settings to review the current record before trying again.")
    } catch {
      if (isCurrent() && actionGenerationRef.current === generation) setOperationNotice("The consent change was not confirmed. Check the current settings before trying again.")
    } finally {
      if (isCurrent() && actionGenerationRef.current === generation) { mutationBusyRef.current = false; setToggleLoading(false) }
    }
  }
  const deleteKnowledge = async () => {
    if (!canStart() || confirmationRef.current !== ownerLifetime) return
    mutationBusyRef.current = true
    interruptedRef.current = false
    const generation = ++actionGenerationRef.current
    setPurgeLoading(true)
    setPurgeUnconfirmed(false)
    setPurgeResult(null)
    setOperationNotice(null)
    try {
      const result = await kg.purge()
      if (!isCurrent() || actionGenerationRef.current !== generation) return
      const valid = result && result.user_id === kg.userId && typeof result.settings_deleted === "boolean" &&
        [result.nodes_deleted, result.edges_deleted, result.evidence_deleted].every(value => Number.isSafeInteger(value) && value >= 0)
      if (valid) {
        confirmationRef.current = null
        returnFocusRef.current = true
        setShowPurgeConfirm(false)
        setPurgeResult(`Deletion receipt acknowledged: ${result.nodes_deleted} entities, ${result.edges_deleted} relations, and ${result.evidence_deleted} evidence items removed. Settings record removed: ${result.settings_deleted ? "yes" : "no"}. This receipt does not describe uploaded files or presentations.`)
      } else setPurgeUnconfirmed(true)
    } catch {
      if (isCurrent() && actionGenerationRef.current === generation) setPurgeUnconfirmed(true)
    } finally {
      if (isCurrent() && actionGenerationRef.current === generation) { mutationBusyRef.current = false; setPurgeLoading(false) }
    }
  }

  return <Card data-studio-knowledge-settings-card={STUDIO_SHELL ? "controls" : undefined}>
    <CardHeader data-studio-knowledge-settings-role={STUDIO_SHELL ? "header" : undefined}>
      <CardTitle data-studio-knowledge-settings-role={STUDIO_SHELL ? "title" : undefined} className="flex items-center gap-2"><Brain className="h-5 w-5" />Knowledge Graph</CardTitle>
      <CardDescription data-studio-knowledge-settings-role={STUDIO_SHELL ? "description" : undefined}>Review recorded consent and manage retained Knowledge Graph data.</CardDescription>
    </CardHeader>
    <CardContent data-studio-knowledge-settings-role={STUDIO_SHELL ? "body" : undefined} className="space-y-4">
      <div data-studio-knowledge-settings-status="true">
        <strong>{recordVerified ? consentEnabled ? "Recorded across-deck consent enabled" : "Recorded across-deck consent disabled" : "Management readiness unverified"}</strong>
        {!recordVerified && <p>The current response does not establish whether retained Knowledge Graph data exists. Management changes remain inactive until availability is verified.</p>}
        {kg.capability.reason && <p>{kg.capability.reason}</p>}
        {kg.settingsRefreshing && <p role="status">Checking the current settings record…</p>}
        {toggleLoading && <p role="status">Updating recorded Knowledge consent…</p>}
        <Button data-studio-knowledge-settings-outline={STUDIO_SHELL ? "true" : undefined} variant="outline" size="sm" data-studio-knowledge-settings-retry="true" disabled={busy} onClick={retrySettings}><RefreshCw size={13} className="mr-1.5" />{kg.settingsRefreshing ? "Checking settings…" : "Retry settings"}</Button>
      </div>
      <section data-studio-knowledge-settings-eligibility="true" aria-label="Paid Knowledge enrichment eligibility">
        <p>{kg.isEntitlementLoading ? "Checking eligibility for new or re-enabled consent. Authenticated retained-data management is available independently of that check." : kg.isEntitled ? "You can choose whether research from future decks may contribute to your Knowledge Graph." : "New or re-enabled across-deck Knowledge requires a Pro plan or above. You can still review, pause, or delete retained Knowledge Graph data when management readiness is verified."}</p>
        {!kg.isEntitlementLoading && !kg.isEntitled && <Button asChild variant="outline" data-studio-knowledge-settings-outline={STUDIO_SHELL ? "true" : undefined}><Link href="/pricing"><Lock size={13} className="mr-1.5" />View plans</Link></Button>}
      </section>
      <div data-studio-knowledge-settings-consent={STUDIO_SHELL ? "true" : undefined} className="flex items-center justify-between">
        <div className="space-y-0.5"><Label htmlFor="knowledge-graph-subscription">Across-deck Knowledge consent</Label><p id="knowledge-graph-subscription-help" className="text-sm text-muted-foreground">Pause existing consent to stop engagement while retaining graph data. Enabling or resuming requires verified paid eligibility.</p></div>
        <Switch id="knowledge-graph-subscription" aria-label="Across-deck Knowledge consent" aria-describedby="knowledge-graph-subscription-help" aria-busy={toggleLoading} checked={consentEnabled} disabled={busy || confirmationVisible || !kg.managementReady || (!consentEnabled && (kg.isEntitlementLoading || !kg.isEntitled))} onCheckedChange={toggleConsent} />
      </div>
      {kg.error && <p data-studio-knowledge-settings-error={STUDIO_SHELL ? "true" : undefined} role="alert" className="text-sm text-red-600">{kg.error}</p>}
      {currentPresentation && operationNotice && <p data-studio-knowledge-settings-notice="true" role="status" className="text-sm">{operationNotice}</p>}
      {currentPresentation && purgeResult && <p data-studio-knowledge-settings-result={STUDIO_SHELL ? "true" : undefined} role="status" className="text-sm text-green-600">{purgeResult}</p>}
      {recordVerified && kg.settings && <details data-studio-knowledge-settings-record="true"><summary>Recorded consent details</summary><dl><dt>Subscription record</dt><dd>{kg.settings.subscribed ? "Enabled" : "Disabled"}</dd><dt>Across decks</dt><dd>{kg.settings.cross_session_enabled ? "Enabled" : "Disabled"}</dd><dt>Consent version</dt><dd>{kg.settings.consent_version || "Not recorded"}</dd><dt>Consent recorded</dt><dd>{recordedDate(kg.settings.consent_at)}</dd><dt>Last updated</dt><dd>{recordedDate(kg.settings.updated_at)}</dd></dl><p className="px-3 pb-3 text-xs">These settings do not report the contents or size of retained graph data.</p></details>}
      <Separator />
      {!confirmationVisible ? <div data-studio-knowledge-settings-delete={STUDIO_SHELL ? "true" : undefined} className="flex items-center justify-between rounded-lg border border-red-200 p-4 dark:border-red-900/50">
        <div className="flex items-center gap-3"><Trash2 className="h-5 w-5 text-red-500" /><div><p className="font-medium text-red-700 dark:text-red-400">Delete retained Knowledge Graph data</p><p className="text-sm text-muted-foreground">This requests deletion of graph records, not uploaded files or presentations. Availability does not establish how much data is retained.</p></div></div>
        <Button ref={deleteButtonRef} data-studio-knowledge-settings-outline={STUDIO_SHELL ? "true" : undefined} variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy || !kg.managementReady} onClick={() => { if (!canStart()) return; confirmationRef.current = ownerLifetime; setPurgeUnconfirmed(false); setPurgeResult(null); setShowPurgeConfirm(true) }}>Delete</Button>
      </div> : <Alert data-studio-knowledge-settings-confirm={STUDIO_SHELL ? "true" : undefined} className="border-red-200 dark:border-red-900/50"><AlertTriangle className="h-4 w-4 text-red-600" /><AlertDescription className="space-y-4">
        <p>This requests deletion of your retained Knowledge Graph entities, relations, evidence, and settings. Deletion cannot be undone once the service performs it. Uploaded files and presentations are not included in this request.</p>
        {purgeLoading && <p role="status">Waiting for the deletion receipt. Do not change consent while this request is pending.</p>}
        {purgeUnconfirmed && <p role="alert">Deletion was not confirmed. Already dispatched work may have completed. Retry settings to check the current record before deciding whether to send another request.</p>}
        <div data-studio-knowledge-settings-actions={STUDIO_SHELL ? "true" : undefined} className="flex gap-2"><Button variant="destructive" size="sm" disabled={busy || !kg.managementReady} aria-busy={purgeLoading} onClick={deleteKnowledge}>{purgeLoading ? "Deleting…" : "Delete Knowledge data"}</Button><Button ref={cancelButtonRef} data-studio-knowledge-settings-outline={STUDIO_SHELL ? "true" : undefined} variant="outline" size="sm" disabled={purgeLoading || kg.isMutating} onClick={() => { if (!isCurrent() || mutationBusyRef.current) return; confirmationRef.current = null; returnFocusRef.current = true; setPurgeUnconfirmed(false); setShowPurgeConfirm(false) }}>Cancel</Button></div>
      </AlertDescription></Alert>}
    </CardContent>
  </Card>
}
