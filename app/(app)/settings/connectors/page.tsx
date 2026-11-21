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
import { STUDIO_CONNECTORS_CARD_REASONS, gdriveFailureDetail, gdriveResultLine, takeGdriveResultWord } from "@/lib/studio-connectors-card-reasons" // CARD-REASONS

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
  const [resultLine, setResultLine] = useState<string | null>(null) // CARD-REASONS (NEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS, default off): the one line for how the Google sign-in ended (from the callback's ?gdrive= word, read once on mount)
  const [listDetail, setListDetail] = useState<string | null>(null) // CARD-REASONS: the small print of a failed list call (code: <error_code> or service error <status>)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/connectors/gdrive/items", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (STUDIO_CONNECTORS_CARD_REASONS && !res.ok) setListDetail(gdriveFailureDetail(res.status, data)) // CARD-REASONS: a failed list call keeps its words (the line below) and gains small print: the relayed CONNECTOR_ code, else the HTTP status (it goes when the message does: the effect below)
      if (!res.ok) { setMessage(data.error || "Could not load Google Drive."); return }
      setState(data)
    } catch { setMessage("Could not load Google Drive. Please try again.") }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { // CARD-REASONS (NEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS, default off): once, on mount, the callback's ?gdrive= word becomes one fixed sentence on the card (any other value: nothing) and is taken off the address bar, so a reload or a shared address does not say it again
    if (!STUDIO_CONNECTORS_CARD_REASONS) return // CARD-REASONS: flag off, nothing here runs
    const taken = takeGdriveResultWord(window.location.search) // CARD-REASONS: the Settings landing carries no one-time marker (the callback adds one only when it returns to a chat), so none is asked for here; the composer's marker rule is not touched
    const line = gdriveResultLine(taken.word) // CARD-REASONS
    if (line) setResultLine(line) // CARD-REASONS: only a line is ever set here, so a second run of this effect (Strict Mode's re-mount in development), which finds the word already gone, leaves it
    if (taken.found) { try { window.history.replaceState(null, "", `${window.location.pathname}${taken.search}${window.location.hash}`) } catch { /* the word stays in the address bar; this page view still says it once */ } } // CARD-REASONS: the word comes off the address bar (the composer does the same for its own return)
  }, []) // CARD-REASONS
  useEffect(() => { if (STUDIO_CONNECTORS_CARD_REASONS && busy) setResultLine(null) }, [busy]) // CARD-REASONS: the person acted (Add files, Disconnect, Remove): the line was read, and it does not come back (it is set on mount only)
  useEffect(() => { if (STUDIO_CONNECTORS_CARD_REASONS && message === null) setListDetail(null) }, [message]) // CARD-REASONS: the small print belongs to its own message and goes when the message does

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
        {STUDIO_CONNECTORS_CARD_REASONS && resultLine && <Alert data-connectors-gdrive-result="true"><AlertDescription>{resultLine}</AlertDescription></Alert>}{/* CARD-REASONS: how the Google sign-in ended, one fixed sentence */}
        {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
        {STUDIO_CONNECTORS_CARD_REASONS && message && listDetail && <p className="text-xs text-slate-500 dark:text-slate-400" style={{ marginTop: "0.25rem" }} data-connectors-gdrive-detail="true">{listDetail}</p>}{/* CARD-REASONS: small print for a failed list call, under its message */}
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
