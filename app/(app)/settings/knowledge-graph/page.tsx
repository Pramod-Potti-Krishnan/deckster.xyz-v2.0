"use client"

import "@/components/knowledge/studio-knowledge-settings.css"

import { useEffect, useRef, useState } from "react"
import { useKnowledgeGraph } from "@/hooks/use-knowledge-graph"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Brain, Trash2, AlertTriangle, Lock, ArrowLeft, RefreshCw } from "lucide-react"
import Link from "next/link"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

const STUDIO_SHELL = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"

type KnowledgeGraphAccess = ReturnType<typeof useKnowledgeGraph>

function recordedDate(value: string | null | undefined) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")
}

export default function KnowledgeGraphSettingsPage() {
  const kg = useKnowledgeGraph()

  // Keep confirmation text and in-progress controls owned by one account.
  // A user switch remounts this state before the next account is rendered.
  const content = <KnowledgeGraphSettingsForAccount key={kg.accountKey} kg={kg} />
  return STUDIO_SHELL ? <section data-studio-knowledge-settings="true" aria-label="Knowledge Graph settings"><Link data-studio-knowledge-settings-back="true" href="/knowledge"><ArrowLeft size={14} />Back to Knowledge</Link>{content}</section> : content
}

function KnowledgeGraphSettingsForAccount({ kg }: { kg: KnowledgeGraphAccess }) {
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)
  const [toggleLoading, setToggleLoading] = useState(false)
  const [purgeLoading, setPurgeLoading] = useState(false)
  const [purgeUnconfirmed, setPurgeUnconfirmed] = useState(false)
  const actionGenerationRef = useRef(0)
  // Guard the interval before React rerenders as well as the visible controls.
  const mutationBusyRef = useRef(false)
  const settingsReady = !!(kg.settings && kg.capability.available && kg.serviceAvailable)

  useEffect(() => () => {
    // Network requests are aborted and generation-guarded by the KG hook;
    // this also prevents their awaiting UI continuations from touching a
    // remounted account workspace.
    actionGenerationRef.current += 1
  }, [])

  // Resolve auth and live billing before choosing between the paid and locked
  // states; otherwise a paid user briefly sees an incorrect upgrade card.
  if (kg.isLoading) {
    return (
      <Card data-studio-knowledge-settings-card={STUDIO_SHELL ? "loading" : undefined} aria-busy="true">
        <CardHeader data-studio-knowledge-settings-role={STUDIO_SHELL ? "header" : undefined}>
          <CardTitle data-studio-knowledge-settings-role={STUDIO_SHELL ? "title" : undefined} className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Knowledge Graph
          </CardTitle>
          <CardDescription data-studio-knowledge-settings-role={STUDIO_SHELL ? "description" : undefined}>Checking your Knowledge access…</CardDescription>
        </CardHeader>
        <CardContent data-studio-knowledge-settings-role={STUDIO_SHELL ? "body" : undefined}>
          <div data-studio-knowledge-settings-role={STUDIO_SHELL ? "loading" : undefined} aria-hidden={STUDIO_SHELL ? true : undefined} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </CardContent>
      </Card>
    )
  }

  // Non-entitled users see a locked/upsell state
  if (!kg.isEntitled) {
    return (
      <Card data-studio-knowledge-settings-card={STUDIO_SHELL ? "locked" : undefined}>
        <CardHeader data-studio-knowledge-settings-role={STUDIO_SHELL ? "header" : undefined}>
          <CardTitle data-studio-knowledge-settings-role={STUDIO_SHELL ? "title" : undefined} className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Knowledge Graph
          </CardTitle>
          <CardDescription data-studio-knowledge-settings-role={STUDIO_SHELL ? "description" : undefined}>
            Build a knowledge graph across your decks so agents learn your domain over time
          </CardDescription>
        </CardHeader>
        <CardContent data-studio-knowledge-settings-role={STUDIO_SHELL ? "body" : undefined}>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div data-studio-knowledge-settings-role={STUDIO_SHELL ? "locked-icon" : undefined} className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Premium Feature</p>
              <p className="text-sm text-muted-foreground">
                Knowledge Graph is available on Pro plans and above. Upgrade to build
                a persistent knowledge graph that enriches every new deck you create.
              </p>
            </div>
            <Button data-studio-knowledge-settings-primary={STUDIO_SHELL ? "true" : undefined} asChild>
              <Link href="/pricing">View Plans</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-studio-knowledge-settings-card={STUDIO_SHELL ? "controls" : undefined}>
      <CardHeader data-studio-knowledge-settings-role={STUDIO_SHELL ? "header" : undefined}>
        <CardTitle data-studio-knowledge-settings-role={STUDIO_SHELL ? "title" : undefined} className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Knowledge Graph
        </CardTitle>
        <CardDescription data-studio-knowledge-settings-role={STUDIO_SHELL ? "description" : undefined}>
          Build a knowledge graph across your decks so agents learn your domain over time
        </CardDescription>
      </CardHeader>
      <CardContent data-studio-knowledge-settings-role={STUDIO_SHELL ? "body" : undefined} className="space-y-4">
        {!kg.isLoading && !kg.serviceAvailable && (
          <Alert data-studio-knowledge-settings-service={STUDIO_SHELL ? "true" : undefined}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The Knowledge Graph backend is not reachable right now. Your
              settings can&apos;t be read or changed until it&apos;s back.
            </AlertDescription>
          </Alert>
        )}
        {STUDIO_SHELL && <div data-studio-knowledge-settings-status="true">
          <strong>{!kg.settings || !kg.serviceAvailable || !kg.capability.available ? "Settings availability unverified" : kg.isSubscribed ? "Knowledge enrichment enabled" : "Knowledge enrichment disabled"}</strong>
          {kg.capability.reason && <p>{kg.capability.reason}</p>}
          {toggleLoading && <p role="status">Updating your Knowledge consent…</p>}
          {(!kg.settings || !kg.serviceAvailable || kg.error) && <Button data-studio-knowledge-settings-outline={STUDIO_SHELL ? "true" : undefined} variant="outline" size="sm" data-studio-knowledge-settings-retry="true" disabled={toggleLoading || purgeLoading} onClick={() => { if (!mutationBusyRef.current) void kg.refetch() }}><RefreshCw size={13} className="mr-1.5" />Retry settings</Button>}
        </div>}
        <div data-studio-knowledge-settings-consent={STUDIO_SHELL ? "true" : undefined} className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="knowledge-graph-subscription">
              Build a knowledge graph across my decks
            </Label>
            <p id={STUDIO_SHELL ? "knowledge-graph-subscription-help" : undefined} className="text-sm text-muted-foreground">
              When enabled, research from each deck enriches future decks on related topics
            </p>
          </div>
          <Switch
            id="knowledge-graph-subscription"
            aria-label="Build a knowledge graph across my decks"
            aria-describedby={STUDIO_SHELL ? "knowledge-graph-subscription-help" : undefined}
            aria-busy={STUDIO_SHELL ? toggleLoading : undefined}
            checked={kg.isSubscribed}
            disabled={kg.isLoading || toggleLoading || purgeLoading || showPurgeConfirm || !settingsReady}
            onCheckedChange={async (checked) => {
              if (mutationBusyRef.current || showPurgeConfirm || !settingsReady) return
              mutationBusyRef.current = true
              const generation = ++actionGenerationRef.current
              setToggleLoading(true)
              setPurgeResult(null)
              try {
                if (checked) {
                  await kg.subscribe()
                } else {
                  await kg.unsubscribe()
                }
              } finally {
                if (actionGenerationRef.current === generation) {
                  mutationBusyRef.current = false
                  setToggleLoading(false)
                }
              }
            }}
          />
        </div>

        {kg.error && <p data-studio-knowledge-settings-error={STUDIO_SHELL ? "true" : undefined} role={STUDIO_SHELL ? "alert" : undefined} className="text-sm text-red-600">{kg.error}</p>}

        {purgeResult && <p data-studio-knowledge-settings-result={STUDIO_SHELL ? "true" : undefined} role={STUDIO_SHELL ? "status" : undefined} className="text-sm text-green-600">{purgeResult}</p>}

        {STUDIO_SHELL && kg.settings && kg.capability.available && kg.serviceAvailable && <details data-studio-knowledge-settings-record="true"><summary>Recorded consent details</summary><dl><dt>Subscription</dt><dd>{kg.settings.subscribed ? "Enabled" : "Disabled"}</dd><dt>Across decks</dt><dd>{kg.settings.cross_session_enabled ? "Enabled" : "Disabled"}</dd><dt>Consent version</dt><dd>{kg.settings.consent_version || "Not recorded"}</dd><dt>Consent recorded</dt><dd>{recordedDate(kg.settings.consent_at)}</dd><dt>Last updated</dt><dd>{recordedDate(kg.settings.updated_at)}</dd></dl></details>}

        {kg.isSubscribed && (
          <>
            <Separator />
            {!showPurgeConfirm ? (
              <div data-studio-knowledge-settings-delete={STUDIO_SHELL ? "true" : undefined} className="flex items-center justify-between rounded-lg border border-red-200 p-4 dark:border-red-900/50">
                <div className="flex items-center gap-3">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      Delete my knowledge graph
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Permanently removes all stored knowledge
                    </p>
                  </div>
                </div>
                <Button
                  data-studio-knowledge-settings-outline={STUDIO_SHELL ? "true" : undefined} variant="outline"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={toggleLoading || purgeLoading || !settingsReady}
                  onClick={() => {
                    if (mutationBusyRef.current || !settingsReady) return
                    setPurgeUnconfirmed(false)
                    setPurgeResult(null)
                    setShowPurgeConfirm(true)
                  }}
                >
                  Delete
                </Button>
              </div>
            ) : (
              <Alert data-studio-knowledge-settings-confirm={STUDIO_SHELL ? "true" : undefined} className="border-red-200 dark:border-red-900/50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="space-y-4">
                  <p>
                    This will permanently delete your entire knowledge graph.
                    This cannot be undone.
                  </p>
                  {purgeLoading && <p role="status">Deleting your recorded knowledge… Wait for the result before changing consent.</p>}
                  {purgeUnconfirmed && <p role="alert">Deletion was not confirmed. Review the error or retry settings to check the current record before trying again.</p>}
                  <div data-studio-knowledge-settings-actions={STUDIO_SHELL ? "true" : undefined} className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={toggleLoading || purgeLoading || !settingsReady}
                      aria-busy={purgeLoading}
                      onClick={async () => {
                        if (mutationBusyRef.current || !settingsReady) return
                        mutationBusyRef.current = true
                        const generation = ++actionGenerationRef.current
                        setPurgeLoading(true)
                        setPurgeUnconfirmed(false)
                        setPurgeResult(null)
                        try {
                          const result = await kg.purge()
                          if (actionGenerationRef.current !== generation) return
                          if (result) {
                            setShowPurgeConfirm(false)
                            setPurgeResult(
                              `Deleted ${result.nodes_deleted} entities, ${result.edges_deleted} relations, and ${result.evidence_deleted} evidence items.`
                            )
                          } else {
                            setPurgeUnconfirmed(true)
                          }
                        } catch {
                          if (actionGenerationRef.current === generation) setPurgeUnconfirmed(true)
                        } finally {
                          if (actionGenerationRef.current === generation) {
                            mutationBusyRef.current = false
                            setPurgeLoading(false)
                          }
                        }
                      }}
                    >
                      {purgeLoading ? "Deleting…" : "Yes, Delete Everything"}
                    </Button>
                    <Button
                      data-studio-knowledge-settings-outline={STUDIO_SHELL ? "true" : undefined} variant="outline"
                      size="sm"
                      disabled={purgeLoading}
                      onClick={() => {
                        if (mutationBusyRef.current) return
                        setPurgeUnconfirmed(false)
                        setShowPurgeConfirm(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
