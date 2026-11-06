"use client"

// VERSION-HISTORY-V2 (flag NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2, default off; Pass 2 row PRO-09). The deck's Version history: the list, and a Restore that saves the current deck first and never
// overwrites. The words, the envelope the viewer reads and the restore rules are in lib/studio-version-history-v2.ts. components/version-history-panel.tsx (the old, unreachable panel) is untouched.

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { X, RotateCcw, Clock, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLayoutViewerOrigin, isTrustedLayoutViewerMessage } from '@/lib/layout-viewer-messaging'
import { RESTORE_FLUSH_ACK_TIMEOUT_MS, RESTORE_FLUSH_SAVE_TIMEOUT_MS, createSaveStatusTracker, flushViewerBeforeRestore, requestViewerAck, type ViewerChannel } from '@/lib/studio-slide-ops-via-viewer'
import { reportDeckChange } from '@/lib/studio-deck-changed-notice'
import { STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED, studioSlideDeleteRefresh } from '@/lib/studio-slide-delete-refresh'
import {
  RESTORE_UNCONFIRMED_MESSAGE,
  RESTORED_NOTICE,
  RESTORED_RELOADING_NOTICE,
  VERSION_HISTORY_FAILED_MESSAGE,
  VERSION_HISTORY_FETCH_TIMEOUT_MS,
  VERSION_PAGE_SIZE,
  VERSION_RESTORE_TIMEOUT_MS,
  findPreRestoreBackup,
  formatVersionTime,
  getVersionHistoryRequest,
  parseVersionHistoryReply,
  restoreBlockedReason,
  restoreResultFromAck,
  restoreResultFromList,
  restoredNoticeWithBackup,
  restoreVersionSafely,
  versionAuthorLabel,
  versionSummary,
  type RestorePhase,
  type RestoreSendResult,
  type VersionRow,
  type ViewerRequest,
} from '@/lib/studio-version-history-v2'
import './studio-editor-dialogs.css'
import './version-history-panel-v2.css'

interface VersionHistoryPanelV2Props {
  isOpen: boolean
  onClose: () => void
  iframeRef: RefObject<HTMLIFrameElement | null>
  viewerOrigin: string
  /** Changes when another deck (or another frame lifetime) is on screen: the list is read again. */
  deckKey?: string | null
  /** The deck is being built: Restore waits. */
  building?: boolean
  /** Studio shell: the shared Studio dialog look and place. */
  studio?: boolean
}

/** How long Restore stays off after a restore was acknowledged, waiting for the viewer's own reload (the next frame load clears it sooner). */
const RELOAD_WAIT_MS = 20_000

function viewerChannel(iframe: HTMLIFrameElement, viewerOrigin: string, prefix: string): ViewerChannel {
  return {
    post: message => { iframe.contentWindow?.postMessage(message, getLayoutViewerOrigin(iframe, viewerOrigin)) },
    listen: handler => {
      const onMessage = (event: MessageEvent) => { if (isTrustedLayoutViewerMessage(event, iframe, viewerOrigin)) handler(event.data) }
      window.addEventListener('message', onMessage)
      return () => window.removeEventListener('message', onMessage)
    },
    newRequestId: () => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }
}

/**
 * The viewer's restoreVersion command. It reloads the page itself once Layout has restored, so its acknowledgement can lose the race with the reload. A frame load after the command went out
 * is then checked, not trusted: the list read from the reloaded viewer must hold the safety copy Layout writes before it restores (restoreResultFromList), else the outcome is unconfirmed.
 */
function sendRestoreCommand(iframe: HTMLIFrameElement, viewerOrigin: string, channel: ViewerChannel, request: ViewerRequest, before: VersionRow[]): Promise<RestoreSendResult> {
  return new Promise(resolve => {
    let settled = false
    const onLoad = () => {
      const probe = getVersionHistoryRequest()
      requestViewerAck(viewerChannel(iframe, viewerOrigin, 'restore-check'), probe.action, probe.params, VERSION_HISTORY_FETCH_TIMEOUT_MS).then(
        reply => finish(restoreResultFromList(before, reply, String(request.params.versionId))),
        () => finish({ ok: false, unconfirmed: true, message: RESTORE_UNCONFIRMED_MESSAGE }),
      )
    }
    const finish = (result: RestoreSendResult) => {
      if (settled) return
      settled = true
      iframe.removeEventListener('load', onLoad)
      resolve(result)
    }
    iframe.addEventListener('load', onLoad)
    void restoreResultFromAck(requestViewerAck(channel, request.action, request.params, VERSION_RESTORE_TIMEOUT_MS)).then(finish)
  })
}

export function VersionHistoryPanelV2({ isOpen, onClose, iframeRef, viewerOrigin, deckKey = null, building = false, studio = false }: VersionHistoryPanelV2Props) {
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [currentVersionId, setCurrentVersionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [shown, setShown] = useState(VERSION_PAGE_SIZE)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<{ versionId: string; phase: RestorePhase } | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)
  const [frameEpoch, setFrameEpoch] = useState(0)
  const [saveTracker] = useState(() => createSaveStatusTracker()) // the last save status the viewer reported: it must be recording before the panel is opened
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const mountedRef = useRef(true)
  const versionsRef = useRef<VersionRow[]>([])
  const fetchSeq = useRef(0)
  const restoringRef = useRef(false)
  const frameLoadsRef = useRef(0) // frame lifetimes seen on this deck's iframe: the same count the canvas veil compares
  const restoreCheckRef = useRef<{ before: VersionRow[]; versionId: string } | null>(null)
  versionsRef.current = versions

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // The viewer reports every save status; Restore needs the last one.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedLayoutViewerMessage(event, iframeRef.current, viewerOrigin)) return
      saveTracker.record(event.data)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [iframeRef, viewerOrigin, saveTracker, deckKey])

  // A new frame lifetime (the viewer reloaded itself after a restore, or another deck came up): read the list again.
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const onLoad = () => { frameLoadsRef.current += 1; setReloading(false); setFrameEpoch(epoch => epoch + 1) }
    iframe.addEventListener('load', onLoad)
    return () => iframe.removeEventListener('load', onLoad)
  }, [iframeRef, deckKey])

  // Another deck: nothing of the last deck's list or messages stays.
  useEffect(() => {
    setVersions([]); setCurrentVersionId(''); setListError(null); setShown(VERSION_PAGE_SIZE)
    setConfirming(null); setRestoreError(null); setNotice(null); setReloading(false)
    restoreCheckRef.current = null
  }, [deckKey])

  const fetchVersions = useCallback(async () => {
    const iframe = iframeRef.current
    if (!iframe) { setListError('The deck is not ready yet.'); return }
    const seq = ++fetchSeq.current
    setLoading(true)
    setListError(null)
    try {
      const request = getVersionHistoryRequest()
      const reply = await requestViewerAck(viewerChannel(iframe, viewerOrigin, 'versions'), request.action, request.params, VERSION_HISTORY_FETCH_TIMEOUT_MS)
      if (!mountedRef.current || seq !== fetchSeq.current) return
      const parsed = parseVersionHistoryReply(reply)
      if (!parsed.ok) { setListError(parsed.message); return }
      setVersions(parsed.history.versions)
      setCurrentVersionId(parsed.history.currentVersionId)
      const check = restoreCheckRef.current
      if (check) { // the list read after a restore: name the safety copy Layout wrote (its restore reply does not carry the id)
        restoreCheckRef.current = null
        const backup = findPreRestoreBackup(check.before, parsed.history.versions, check.versionId)
        setNotice(backup ? restoredNoticeWithBackup(backup) : RESTORED_NOTICE)
      }
    } catch (error) {
      if (!mountedRef.current || seq !== fetchSeq.current) return
      const detail = error instanceof Error ? error.message : ''
      setListError(detail && !/command timeout/i.test(detail) ? detail : VERSION_HISTORY_FAILED_MESSAGE)
    } finally {
      if (mountedRef.current && seq === fetchSeq.current) setLoading(false)
    }
  }, [iframeRef, viewerOrigin])

  useEffect(() => {
    if (isOpen) void fetchVersions()
  }, [isOpen, deckKey, frameEpoch, fetchVersions])

  // A restore was acknowledged but no new frame has loaded: read the list again rather than leave the old one on screen.
  useEffect(() => {
    if (!reloading) return
    const timer = setTimeout(() => { setReloading(false); if (isOpen) void fetchVersions() }, RELOAD_WAIT_MS)
    return () => clearTimeout(timer)
  }, [reloading, isOpen, fetchVersions])

  // The menu item that opened the panel is closing at the same moment and Radix hands focus back to its trigger: take it into the panel once that settles.
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      const panel = panelRef.current
      if (panel && !panel.contains(document.activeElement)) closeRef.current?.focus()
    }, 200)
    return () => clearTimeout(timer)
  }, [isOpen])

  const runRestore = useCallback(async (versionId: string) => {
    const iframe = iframeRef.current
    if (restoringRef.current) return
    if (!iframe) { setRestoreError('The deck is not ready yet.'); return }
    restoringRef.current = true
    setConfirming(null)
    setRestoreError(null)
    setNotice(null)
    setRestoring({ versionId, phase: 'saving' })
    const before = versionsRef.current
    const loadsAtSend = frameLoadsRef.current
    const channel = viewerChannel(iframe, viewerOrigin, 'restore')
    const outcome = await restoreVersionSafely({
      versionId,
      onPhase: phase => { if (mountedRef.current) setRestoring({ versionId, phase }) },
      saveCurrent: () => flushViewerBeforeRestore({
        tracker: saveTracker,
        forceSave: () => requestViewerAck(channel, 'forceSave', {}, RESTORE_FLUSH_ACK_TIMEOUT_MS),
        saveTimeoutMs: RESTORE_FLUSH_SAVE_TIMEOUT_MS,
      }),
      sendRestore: request => sendRestoreCommand(iframe, viewerOrigin, channel, request, before),
    })
    restoringRef.current = false
    if (!mountedRef.current) return
    setRestoring(null)
    if (!outcome.ok) {
      setRestoreError(outcome.message)
      if (outcome.stage === 'unconfirmed') void fetchVersions() // the restore may have happened: show what the list says now
      return
    }
    reportDeckChange('slide') // other tabs on this deck hear about it (no-op unless NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE)
    restoreCheckRef.current = { before, versionId }
    if (frameLoadsRef.current === loadsAtSend) { // the viewer has not reloaded yet: its old document is still on screen, and it must not be edited
      if (STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studio) studioSlideDeleteRefresh.acknowledged({ revisionAtSend: loadsAtSend, revisionNow: frameLoadsRef.current }) // PASS2D B4's veil: covers the canvas until the reloaded frame loads
      setNotice(RESTORED_RELOADING_NOTICE)
      setReloading(true) // the frame load reads the list again
    } else { setNotice(RESTORED_NOTICE); void fetchVersions() } // the reload already happened: read the list again so the safety copy is named
  }, [iframeRef, viewerOrigin, saveTracker, fetchVersions, studio])

  const blockedReason = restoreBlockedReason({ building })
  const restoreDisabled = Boolean(blockedReason) || restoring !== null || reloading
  const now = new Date()
  const visible = useMemo(() => versions.slice(0, shown), [versions, shown])

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      data-studio-v4-dialog={studio ? 'versions' : undefined}
      role="dialog"
      aria-modal="false"
      aria-label="Version history"
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}
      className="fixed inset-y-0 right-0 w-80 max-w-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-gray-200 dark:border-slate-700"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-600 dark:text-slate-300" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Version history</h2>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close version history" title="Close" className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
          <X className="h-4 w-4 text-gray-500 dark:text-slate-300" aria-hidden="true" />
        </button>
      </div>

      <div className={cn('flex-1 overflow-y-auto', !studio && 'px-4')} aria-busy={loading}>
        {notice && <p role="status" className="mt-3 rounded-md bg-green-50 dark:bg-green-950/40 px-3 py-2 text-xs text-green-800 dark:text-green-300">{notice}</p>}
        {restoreError && <p role="alert" className="mt-3 rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">{restoreError}</p>}
        {blockedReason && <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">{blockedReason}</p>}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" aria-hidden="true" />
            <span className="ml-2 text-sm text-gray-500 dark:text-slate-400">Loading versions...</span>
          </div>
        )}

        {listError && !loading && (
          <div className="mt-3 rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-3">
            <p role="alert" className="text-sm text-red-600 dark:text-red-300">{listError}</p>
            <button type="button" onClick={() => void fetchVersions()} className="mt-2 text-xs text-red-700 dark:text-red-300 underline hover:no-underline">Try again</button>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700">
            {visible.map(version => {
              const isCurrent = version.versionId === currentVersionId
              const isRestoring = restoring?.versionId === version.versionId
              const summary = versionSummary(version)
              return (
                <li key={version.versionId} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-slate-100" title={version.createdAt ? new Date(version.createdAt).toLocaleString() : undefined}>{formatVersionTime(version.createdAt, now)}</span>
                        {isCurrent && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded">Current</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <User className="h-3 w-3 text-gray-400" aria-hidden="true" />
                        <span className="text-xs text-gray-500 dark:text-slate-400">{versionAuthorLabel(version.createdBy)}</span>
                      </div>
                      {summary && <p className="mt-1 text-xs text-gray-600 dark:text-slate-300 line-clamp-2">{summary}</p>}
                    </div>
                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => { setRestoreError(null); setConfirming(version.versionId) }}
                        disabled={restoreDisabled}
                        title={blockedReason ?? 'Restore this version'}
                        aria-label={`Restore the version from ${formatVersionTime(version.createdAt, now)}`}
                        className={cn('flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors', restoreDisabled ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed opacity-60' : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200')}
                      >
                        {isRestoring ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-3 w-3" aria-hidden="true" />}
                        <span>{isRestoring ? (restoring?.phase === 'saving' ? 'Saving your deck...' : 'Restoring...') : 'Restore'}</span>
                      </button>
                    )}
                  </div>
                  {confirming === version.versionId && !isRestoring && (
                    <div className="mt-3 rounded-md bg-gray-50 dark:bg-slate-800 px-3 py-3">
                      <p className="text-xs text-gray-700 dark:text-slate-200">Restore this version? Your current deck is saved as a new version first, so you can come back to it.</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => void runRestore(version.versionId)} disabled={restoreDisabled} className="px-2.5 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Restore this version</button>
                        <button type="button" onClick={() => setConfirming(null)} className="px-2.5 py-1 text-xs rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600">Cancel</button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {!loading && versions.length > shown && (
          <button type="button" onClick={() => setShown(count => count + VERSION_PAGE_SIZE)} className="my-3 w-full rounded-md bg-gray-100 dark:bg-slate-800 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700">Show older versions ({versions.length - shown} more)</button>
        )}

        {!loading && !listError && versions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Clock className="h-10 w-10 text-gray-300 dark:text-slate-600 mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-500 dark:text-slate-400">No earlier versions yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">A version is kept each time your deck changes.</p>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
        <p className="text-xs text-gray-500 dark:text-slate-400">Restoring never overwrites your deck: it is saved as a new version first.</p>
      </div>
    </div>
  )
}
