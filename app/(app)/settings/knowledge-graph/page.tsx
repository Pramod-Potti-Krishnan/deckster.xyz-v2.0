"use client"

import { useState } from "react"
import { useKnowledgeGraph } from "@/hooks/use-knowledge-graph"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Brain, Trash2, AlertTriangle, Lock } from "lucide-react"
import Link from "next/link"

// Force dynamic rendering to prevent build-time errors
export const dynamic = "force-dynamic"

export default function KnowledgeGraphSettingsPage() {
  const kg = useKnowledgeGraph()
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)
  const [toggleLoading, setToggleLoading] = useState(false)

  // Non-premium users see a locked/upsell state
  if (!kg.isPremium) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Knowledge Graph
          </CardTitle>
          <CardDescription>
            Build a knowledge graph across your decks so agents learn your domain over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Max Feature</p>
              <p className="text-sm text-muted-foreground">
                Knowledge Graph is available on Max plans. Upgrade to build
                a persistent knowledge graph that enriches every new deck you create.
              </p>
            </div>
            <Button asChild>
              <Link href="/pricing">View Plans</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Knowledge Graph
        </CardTitle>
        <CardDescription>
          Build a knowledge graph across your decks so agents learn your domain over time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Build a knowledge graph across my decks</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, research from each deck enriches future decks on related topics
            </p>
          </div>
          <Switch
            checked={kg.isSubscribed}
            disabled={kg.isLoading || toggleLoading}
            onCheckedChange={async (checked) => {
              setToggleLoading(true)
              if (checked) {
                await kg.subscribe()
              } else {
                kg.unsubscribe()
              }
              setToggleLoading(false)
            }}
          />
        </div>

        {kg.error && <p className="text-sm text-red-600">{kg.error}</p>}

        {purgeResult && <p className="text-sm text-green-600">{purgeResult}</p>}

        {kg.isSubscribed && (
          <>
            <Separator />
            {!showPurgeConfirm ? (
              <div className="flex items-center justify-between rounded-lg border border-red-200 p-4 dark:border-red-900/50">
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
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setShowPurgeConfirm(true)}
                >
                  Delete
                </Button>
              </div>
            ) : (
              <Alert className="border-red-200 dark:border-red-900/50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="space-y-4">
                  <p>
                    This will permanently delete your entire knowledge graph.
                    This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        const result = await kg.purge()
                        setShowPurgeConfirm(false)
                        if (result) {
                          setPurgeResult(
                            `Deleted ${result.nodes_deleted} entities, ${result.edges_deleted} relations, and ${result.evidence_deleted} evidence items.`
                          )
                        }
                      }}
                    >
                      Yes, Delete Everything
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPurgeConfirm(false)}
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
