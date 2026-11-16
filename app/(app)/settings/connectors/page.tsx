"use client"

import { useCallback, useEffect, useState } from "react"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { isGdriveConnectorEnabled } from "@/lib/connectors-gdrive-flag"
import { openDrivePicker } from "@/lib/gdrive-picker-loader"
import { useToast } from "@/hooks/use-toast"
import { DriveRemoveButton } from "@/components/settings/gdrive-remove-item"
import { removeDriveItem } from "@/lib/connectors-gdrive-remove"
import { driveFileHref } from "@/lib/connectors-gdrive-citations"

export const dynamic = "force-dynamic"

/** P4-15 slice 1 (DARK). Flag NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED exact "true"; off → 404. Tier gate pending PK decision C1. */
interface DriveItem { id?: string; title?: string | null; modified_time?: string | null; url?: string | null; status?: string | null; error?: string | null }
interface DriveState { connected?: boolean; account_label?: string | null; items?: DriveItem[] }

export default function ConnectorsSettingsPage() {
  if (!isGdriveConnectorEnabled()) notFound()
  return <GoogleDriveCard />
}

function GoogleDriveCard() {
  const [state, setState] = useState<DriveState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/connectors/gdrive/items", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage(data.error || "Could not load Google Drive."); return }
      setState(data)
    } catch { setMessage("Could not load Google Drive. Please try again.") }
  }, [])
  useEffect(() => { void load() }, [load])

  const run = async (fn: () => Promise<void>) => { setBusy(true); setMessage(null); try { await fn() } catch (e) { setMessage(e instanceof Error ? e.message : "Something went wrong.") } finally { setBusy(false) } }
  const addFiles = () => run(async () => {
    const ids = await openDrivePicker()
    if (!ids.length) return
    const res = await fetch("/api/connectors/gdrive/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_ids: ids }) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not add those files.")
    await load()
  })
  const disconnect = () => run(async () => {
    const res = await fetch("/api/connectors/gdrive/disconnect", { method: "POST" })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not disconnect.")
    await load()
  })
  // Piece C: real erase of one library item. Success is only what Researcher confirms (toast); everything else is an alert saying what state the item is in.
  const removeItem = (id: string) => run(async () => {
    const out = await removeDriveItem(id)
    if (out.kind === "removed") toast({ description: out.message })
    else setMessage(out.message)
    if (out.refresh) await load()
  })

  return (
    <Card data-connectors-gdrive="true">
      <CardHeader>
        <CardTitle>Google Drive</CardTitle>
        <CardDescription>Pick individual files to use as research sources. Deckster can read only the files you pick.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
        <div className="flex flex-wrap gap-2">
          {state?.connected ? (
            <>
              <span className="text-sm text-slate-600 dark:text-slate-400">Connected{state.account_label ? ` as ${state.account_label}` : ""}</span>
              <Button disabled={busy} onClick={addFiles}>Add files from Drive</Button>
              <Button variant="outline" disabled={busy} onClick={disconnect}>Disconnect</Button>
            </>
          ) : (
            <Button asChild disabled={busy}><a href="/api/connectors/gdrive/start">Connect Google Drive</a></Button>
          )}
        </div>
        {state?.items && state.items.length > 0 && (
          <ul className="divide-y text-sm" aria-label="Files added from Google Drive">
            {state.items.map((item, i) => (
              <li key={item.id ?? i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{driveFileHref(item.url) ? <a href={driveFileHref(item.url)} target="_blank" rel="noopener noreferrer">{item.title ?? "Untitled"}</a> : (item.title ?? "Untitled")}{/* hardening (REVIEW-1 #6): the citation badge's host rule (https drive.google.com / docs.google.com only); anything else is plain text */}</span>
                <span className="text-slate-500">{item.modified_time ? `Modified ${new Date(item.modified_time).toLocaleString()}` : ""}</span>
                <span>{item.status ?? "queued"}{item.error ? `: ${item.error}` : ""}</span>
                {item.id && <DriveRemoveButton title={item.title} disabled={busy} onConfirm={() => removeItem(item.id!)} />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
