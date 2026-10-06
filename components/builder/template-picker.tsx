"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, LayoutTemplate, Loader2, RotateCw, Search, X } from 'lucide-react'
import './studio-template-picker.css'
import { StudioComposerHint } from './studio-composer-hint'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { mergeTemplateRetryAcknowledgement } from '@/lib/template-retry-acknowledgement'
import {
  isTemplateGenerationReady,
  templateGenerationStatus,
  templateGenerationStatusLabel,
  templateGenerationUnavailableReason,
  useTemplates,
  type SavedTemplate,
  type TemplateSelection,
  type TemplateSnapshot,
} from '@/hooks/use-templates'

type TemplatePickerMode = 'generation' | 'review'
const STUDIO_SHELL = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

interface TemplatePickerProps {
  onSelect: (template: TemplateSelection) => void
  disabled?: boolean
  selectionLocked?: boolean
  mode?: TemplatePickerMode
  onOpenLibrary?: () => void
  showSavedTemplates?: boolean
}

interface TemplatePickerContentProps {
  onSelect: (template: TemplateSelection) => void
  isOpen?: boolean
  label?: string
  mode?: TemplatePickerMode
  preferredTemplateId?: string | null
  standalone?: boolean
}

export function TemplatePickerContent({
  onSelect,
  isOpen = true,
  label = 'Reuse a template',
  mode = 'generation',
  preferredTemplateId = null,
  standalone = false,
}: TemplatePickerContentProps) {
  const { toast } = useToast()
  const { listTemplates, loading, reoptimizeTemplate, watchTemplateStatus } = useTemplates()
  const [templates, setTemplates] = useState<SavedTemplate[] | null>(null)
  const [query, setQuery] = useState('')
  const [listError, setListError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const nativeRequest = useRef(0)
  const retryBusy = useRef(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const studioTemplates = useRef<SavedTemplate[] | null>(null)
  const studioLifecycle = useRef({ mounted: false, open: isOpen, epoch: 0 })
  studioLifecycle.current.open = isOpen
  const studioRetryRequest = useRef(0)
  const studioWatches = useRef(new Map<string, { record: SavedTemplate; stop: () => void; done: boolean; epoch: number }>())
  const [watchNotices, setWatchNotices] = useState<Record<string, string>>({})
  const [previousErrors, setPreviousErrors] = useState<Record<string, string[]>>({})

  const stopStudioWatches = useCallback(() => {
    studioWatches.current.forEach(watch => watch.stop())
    studioWatches.current.clear()
  }, [])

  useEffect(() => {
    if (!STUDIO_SHELL) return
    studioLifecycle.current.mounted = true
    studioLifecycle.current.epoch += 1
    retryBusy.current = false
    setRetryingId(null)
    return () => {
      studioLifecycle.current.mounted = false
      studioLifecycle.current.epoch += 1
      studioRetryRequest.current += 1
      retryBusy.current = false
      stopStudioWatches()
    }
  }, [isOpen, stopStudioWatches])

  const savedFromSnapshot = useCallback((snapshot: TemplateSnapshot): SavedTemplate => ({
    ...snapshot,
    slide_count: snapshot.slide_count ?? snapshot.template_blueprint?.slides?.length ?? 0,
  }), [])

  const refresh = useCallback(async () => {
    const request = ++nativeRequest.current
    if (STUDIO_SHELL) {
      studioRetryRequest.current += 1
      retryBusy.current = false
      setRetryingId(null)
      setRefreshing(true); setListError('')
    }
    const res = await listTemplates()
    if (STUDIO_SHELL) {
      if (request !== nativeRequest.current) return
      setRefreshing(false)
      if (!res) { setListError('Saved templates could not be loaded. Refresh to try again.'); return }
    }
    const listed = res?.templates ?? []
    // With the library enabled, Composer carriers use its own open path and
    // cannot enter legacy review or reuse. Preserve flag-off picker behavior.
    const available = process.env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED === 'true'
      ? listed.filter((template) => !('stage_template_summary' in template))
      : listed
    if (STUDIO_SHELL) {
      // An explicit successful refresh starts a fresh bounded observation of
      // the returned records. Old requests cannot overwrite this list owner.
      stopStudioWatches()
      setWatchNotices({})
      studioTemplates.current = available
    }
    setTemplates(available)
  }, [listTemplates, stopStudioWatches])

  useEffect(() => {
    if (isOpen) void refresh()
    if (STUDIO_SHELL) return () => { nativeRequest.current += 1 }
  }, [isOpen, refresh])

  useEffect(() => {
    if (STUDIO_SHELL) return
    if (!isOpen || !templates?.length) return
    const optimizing = templates.filter((template) => templateGenerationStatus(template) === 'optimizing')
    if (optimizing.length === 0) return

    const stops = optimizing.map((template) => watchTemplateStatus(template.id, {
      onUpdate: (snapshot) => {
        const next = savedFromSnapshot(snapshot)
        setTemplates((previous) => previous?.map((item) => (
          item.id === next.id ? { ...item, ...next } : item
        )) ?? previous)
      },
      onReady: (snapshot) => {
        const next = savedFromSnapshot(snapshot)
        setTemplates((previous) => previous?.map((item) => (
          item.id === next.id ? { ...item, ...next } : item
        )) ?? previous)
        toast({
          title: 'Template ready',
          description: `"${next.name}" is ready to reuse.`,
        })
      },
      onFailed: (snapshot) => {
        const next = savedFromSnapshot(snapshot)
        setTemplates((previous) => previous?.map((item) => (
          item.id === next.id ? { ...item, ...next } : item
        )) ?? previous)
      },
    }))

    return () => {
      stops.forEach((stop) => stop())
    }
  }, [isOpen, savedFromSnapshot, templates, toast, watchTemplateStatus])

  useEffect(() => {
    if (!STUDIO_SHELL || !isOpen || !studioLifecycle.current.mounted) return
    const records = studioTemplates.current ?? []
    // Reconcile ownership without returning a templates-dependent cleanup.
    // onUpdate creates new objects; cancelling here on every render would
    // repeatedly reset the shared watcher's 24-attempt budget to attempt one.
    studioWatches.current.forEach((watch, id) => {
      const record = records.find(item => item.id === id)
      if (record !== watch.record || templateGenerationStatus(record) !== 'optimizing') {
        watch.stop()
        studioWatches.current.delete(id)
      }
    })
    for (const record of records) {
      if (templateGenerationStatus(record) !== 'optimizing' || studioWatches.current.has(record.id)) continue
      const watch = { record, stop: () => {}, done: false, epoch: studioLifecycle.current.epoch }
      studioWatches.current.set(record.id, watch)
      const ownsRecord = () => studioLifecycle.current.mounted && studioLifecycle.current.open
        && studioLifecycle.current.epoch === watch.epoch && studioWatches.current.get(record.id) === watch
        && studioTemplates.current?.find(item => item.id === record.id) === watch.record
      const notice = (message: string) => {
        watch.done = true
        watch.stop()
        if (ownsRecord()) setWatchNotices(previous => ({ ...previous, [record.id]: message }))
      }
      const applySnapshot = (snapshot: TemplateSnapshot) => {
        if (!ownsRecord() || watch.done || snapshot.id !== record.id) return false
        const next = { ...watch.record, ...savedFromSnapshot(snapshot) }
        const old = watch.record
        watch.record = next
        studioTemplates.current = studioTemplates.current!.map(item => item === old ? next : item)
        setTemplates(studioTemplates.current)
        return true
      }
      watch.stop = watchTemplateStatus(record.id, {
        onUpdate: snapshot => { applySnapshot(snapshot) },
        onReady: snapshot => {
          if (!ownsRecord() || watch.done) return
          if (snapshot.id !== record.id) { notice('The status response did not match this template. Refresh to check again.'); return }
          if (!applySnapshot(snapshot)) return
          watch.done = true
          toast({ title: 'Template ready', description: `"${snapshot.name}" is ready to reuse.` })
        },
        onFailed: snapshot => {
          if (!ownsRecord() || watch.done) return
          if (snapshot.id !== record.id) { notice('The status response did not match this template. Refresh to check again.'); return }
          applySnapshot(snapshot)
          watch.done = true
        },
        onTimeout: () => {
          if (ownsRecord() && !watch.done) notice('Automatic status checks paused. Refresh to check this template again.')
        },
      })
    }
  }, [isOpen, savedFromSnapshot, templates, toast, watchTemplateStatus])

  const toSelection = (template: SavedTemplate): TemplateSelection => ({
    id: template.id,
    name: template.name,
    blueprint_generation_method: template.blueprint_generation_method,
    blueprint_enrichment_status: template.blueprint_enrichment_status,
    blueprint_enrichment_error: template.blueprint_enrichment_error,
    template_purity_status: template.template_purity_status,
    template_purity_error: template.template_purity_error,
  })

  const handleTemplateClick = (template: SavedTemplate) => {
    const ready = isTemplateGenerationReady(template)
    if (mode === 'generation' && !ready) {
      const status = templateGenerationStatus(template)
      toast({
        title: status === 'failed'
          ? 'Template not ready'
          : status === 'optimizing'
            ? 'Template optimizing'
            : status === 'needs_cleanup'
              ? 'Template needs cleanup'
              : 'Template needs optimization',
        description: templateGenerationUnavailableReason(template),
        variant: status === 'failed' || status === 'needs_cleanup' ? 'destructive' : undefined,
      })
      return
    }
    onSelect(toSelection(template))
  }

  const handleRetryOptimization = async (template: SavedTemplate) => {
    const result = await reoptimizeTemplate(template.id)
    if (!result) {
      toast({
        title: 'Could not retry optimization',
        description: 'Director could not start template optimization. Please try again.',
        variant: 'destructive',
      })
      return
    }
    toast({
      title: 'Optimizing template',
      description: `"${template.name}" will unlock for generation when optimization completes.`,
    })
    setTemplates((previous) => previous?.map((item) => item.id === template.id
      ? {
          ...item,
          blueprint_enrichment_status: result.blueprint_enrichment_status ?? 'queued',
          blueprint_enrichment_error: null,
          template_purity_status: result.template_purity_status === 'clean' ? 'clean' : 'pending',
          template_purity_error: null,
        }
      : item
    ) ?? previous)
  }

  const retryNative = async (template: SavedTemplate) => {
    const current = studioTemplates.current?.find(item => item.id === template.id)
    if (retryBusy.current || !studioLifecycle.current.mounted || !studioLifecycle.current.open || current !== template) return
    const request = ++studioRetryRequest.current
    const epoch = studioLifecycle.current.epoch
    const listRequest = nativeRequest.current
    const ownsRecord = () => studioLifecycle.current.mounted && studioLifecycle.current.open
      && studioLifecycle.current.epoch === epoch && studioRetryRequest.current === request
      && nativeRequest.current === listRequest && studioTemplates.current?.find(item => item.id === template.id) === current
    retryBusy.current = true; setRetryingId(template.id)
    try {
      const result = await reoptimizeTemplate(template.id)
      if (!ownsRecord()) return
      const acknowledgement = mergeTemplateRetryAcknowledgement(current, result)
      if (!acknowledgement) {
        toast({ title: 'Could not retry optimization', description: 'Director did not return a matching template acknowledgement. Please try again.', variant: 'destructive' })
        return
      }
      studioWatches.current.get(template.id)?.stop()
      studioWatches.current.delete(template.id)
      setWatchNotices(previous => { const next = { ...previous }; delete next[template.id]; return next })
      setPreviousErrors(previous => ({ ...previous, [template.id]: [...new Set([...(previous[template.id] ?? []), ...acknowledgement.previousErrors])] }))
      studioTemplates.current = studioTemplates.current!.map(item => item === current ? acknowledgement.template : item)
      setTemplates(studioTemplates.current)
      const status = templateGenerationStatus(acknowledgement.template)
      toast({ title: status === 'optimizing' ? 'Optimizing template' : status === 'ready' ? 'Template ready' : 'Optimization response received',
        description: status === 'ready' ? `"${current.name}" is ready to reuse.` : templateGenerationUnavailableReason(acknowledgement.template) })
    } catch {
      if (ownsRecord()) toast({ title: 'Could not retry optimization', description: 'Director could not start template optimization. Please try again.', variant: 'destructive' })
    } finally {
      if (studioRetryRequest.current === request && studioLifecycle.current.mounted) { retryBusy.current = false; setRetryingId(null) }
    }
  }

  if (STUDIO_SHELL) {
    const matches = templates?.filter(template => `${template.name} ${template.description || ''}`.toLowerCase().includes(query.trim().toLowerCase())) ?? []
    const preferred = templates?.find(template => template.id === preferredTemplateId)
    const requestedMissing = Boolean(preferredTemplateId && templates !== null && !refreshing && !listError && !preferred)
    const row = (template: SavedTemplate) => {
      const ready = isTemplateGenerationReady(template)
      const status = templateGenerationStatus(template)
      const errors = [template.blueprint_enrichment_error, template.template_purity_error].filter(Boolean).join(' · ')
      return <><span className="stp-mini" aria-hidden="true"><i /><i /><i /></span><span className="stp-copy"><span className="stp-title">{template.name}</span><span className="stp-description">{template.slide_count != null ? `${template.slide_count} slides` : 'Saved template'}{template.description ? ` · ${template.description}` : ''}</span><span className="stp-status" data-status={status}>{ready ? <CheckCircle2 size={12} /> : status === 'optimizing' ? <Loader2 size={12} /> : <AlertTriangle size={12} />}{templateGenerationStatusLabel(template)}</span>{!ready && <span className="stp-reason">{mode === 'review' ? 'Review available. ' : ''}{templateGenerationUnavailableReason(template)}</span>}{errors && <span className="stp-reason break-words">Current diagnostics: {errors}</span>}{Boolean(previousErrors[template.id]?.length) && <span className="stp-reason break-words">Previous attempt: {previousErrors[template.id].join(' · ')}</span>}{watchNotices[template.id] && <span className="stp-reason" role="status">{watchNotices[template.id]}</span>}{template.id === preferredTemplateId && <span className="stp-preferred">From your library · not applied</span>}</span></>
    }
    const refreshControl = standalone ? <button type="button" className="stp-icon-button" aria-label="Refresh saved templates" disabled={refreshing || Boolean(retryingId)} onClick={() => void refresh()}><RotateCw size={14} /></button> : <DropdownMenuItem className="stp-icon-button" aria-label="Refresh saved templates" disabled={refreshing || Boolean(retryingId)} onSelect={event => { event.preventDefault(); void refresh() }}><RotateCw size={14} /></DropdownMenuItem>
    return <section data-studio-template-picker="true" data-standalone={standalone ? 'true' : undefined} aria-label={label}>
      <div className="stp-heading"><div><strong>{label}</strong><p>{mode === 'review' ? 'Inspect saved structure, including templates that are not ready to generate.' : 'Choose verified reusable structure for the next build.'}</p></div>{refreshControl}</div>
      <div className="stp-search"><Search size={15} aria-hidden="true" /><input ref={searchInput} aria-label="Search saved templates" placeholder="Find a story structure" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key.length === 1 || ['Backspace', 'Delete', 'Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.stopPropagation() }} />{query && <button type="button" aria-label="Clear saved template search" onClick={() => { setQuery(''); searchInput.current?.focus() }}><X size={14} /></button>}</div>
      {preferred && <div className="stp-notice"><strong>From your library: {preferred.name}</strong><p>Highlighted only. This template has not been selected or applied.{query && !matches.some(template => template.id === preferred.id) ? ' Clear your search to see it.' : ''}</p></div>}
      {requestedMissing && <div className="stp-notice">The requested template is not in this available saved-template list. Refresh, or open the full library to find its current workflow.</div>}
      {listError && <div className="stp-notice stp-error" role="alert">{listError}{templates !== null && <p>Showing the last loaded records; their status may have changed.</p>}</div>}
      <p className="stp-count" role="status">{refreshing ? templates === null ? 'Loading saved templates…' : 'Refreshing saved templates…' : templates === null ? 'Library not loaded' : `${matches.length} ${matches.length === 1 ? 'template' : 'templates'}${query ? ' match' : ' available'}`}</p>
      <div className="stp-list">{refreshing && templates === null ? <div className="stp-empty"><Loader2 size={20} /><strong>Loading your story structures…</strong></div> : templates === null && listError ? <div className="stp-empty"><AlertTriangle size={20} /><strong>Library unavailable</strong><p>Refresh to load your saved templates.</p></div> : matches.length ? matches.map(template => {
        const ready = isTemplateGenerationReady(template)
        const status = templateGenerationStatus(template)
        const content = standalone ? <button type="button" className="stp-main" aria-disabled={mode === 'generation' && !ready} onClick={() => handleTemplateClick(template)}>{row(template)}</button> : <DropdownMenuItem className="stp-main" aria-disabled={mode === 'generation' && !ready} onSelect={event => { if (mode === 'generation' && !ready) event.preventDefault() }} onClick={() => handleTemplateClick(template)}>{row(template)}</DropdownMenuItem>
        const retry = <><RotateCw size={12} />{retryingId === template.id ? 'Requesting…' : 'Retry optimization'}</>
        return <div key={template.id} className="stp-card" data-preferred={template.id === preferredTemplateId ? 'true' : undefined}>{content}{(status === 'failed' || status === 'needs_cleanup') && <div className="stp-recovery">{standalone ? <button type="button" className="stp-retry" disabled={Boolean(retryingId)} onClick={() => void retryNative(template)}>{retry}</button> : <DropdownMenuItem className="stp-retry" disabled={Boolean(retryingId)} onSelect={event => { event.preventDefault(); void retryNative(template) }}>{retry}</DropdownMenuItem>}</div>}</div>
      }) : <div className="stp-empty"><LayoutTemplate size={22} /><strong>{query ? 'No matching templates' : 'Your best stories belong here.'}</strong><p>{query ? 'Try another name or description, or clear the search above.' : 'Build a deck and use Save as Template to create a reusable story.'}</p></div>}</div>
      <div className="stp-footer"><span>{mode === 'review' ? 'Review does not start generation.' : 'Readiness and build locks still apply.'}</span><Link href="/studio/templates">Open full library</Link></div>
    </section>
  }

  return (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {loading && templates === null ? (
        <div className="flex items-center gap-2 px-2 py-3 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="px-2 py-3 text-sm text-gray-500">
          No saved templates yet. Build a deck and use “Save as Template”.
        </div>
      ) : (
        templates.map((t) => {
          const ready = isTemplateGenerationReady(t)
          const status = templateGenerationStatus(t)
          const failed = status === 'failed'
          const optimizing = status === 'optimizing'
          const needsCleanup = status === 'needs_cleanup'
          const needsOptimization = status === 'needs_optimization'
          const statusLabel = templateGenerationStatusLabel(t)
          return (
            <DropdownMenuItem
              key={t.id}
              className={cn(
                "flex-col items-start gap-0.5",
                mode === 'generation' && !ready ? "cursor-not-allowed opacity-90" : "cursor-pointer",
              )}
              onSelect={(event) => {
                if (mode === 'generation' && !ready) event.preventDefault()
              }}
              onClick={() => handleTemplateClick(t)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{t.name}</span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    ready && "bg-emerald-50 text-emerald-700",
                    failed && "bg-rose-50 text-rose-700",
                    needsCleanup && "bg-rose-50 text-rose-700",
                    optimizing && "bg-amber-50 text-amber-700",
                    needsOptimization && "bg-slate-100 text-slate-600",
                  )}
                >
                  {ready
                    ? <CheckCircle2 className="h-3 w-3" />
                    : optimizing
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <AlertTriangle className="h-3 w-3" />}
                  {statusLabel}
                </span>
              </span>
              <span className="text-xs text-gray-500">
                {t.slide_count != null ? `${t.slide_count} slides` : 'template'}
                {t.description ? ` · ${t.description}` : ''}
              </span>
              {!ready && (
                <span className="flex w-full items-center justify-between gap-2 pt-0.5 text-[11px] text-gray-500">
                  <span>
                    {mode === 'generation'
                      ? optimizing
                        ? 'Review only until ready'
                        : needsCleanup
                          ? 'Needs cleanup before generation'
                          : 'Needs optimization before generation'
                      : 'Review available'}
                  </span>
                  {(failed || needsCleanup) && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-rose-700 hover:bg-rose-50"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void handleRetryOptimization(t)
                      }}
                    >
                      <RotateCw className="h-3 w-3" />
                      Retry
                    </button>
                  )}
                </span>
              )}
            </DropdownMenuItem>
          )
        })
      )}
    </>
  )
}

/**
 * In-chat template picker — a sibling of the attach button. Click → lists the
 * user's saved templates → selecting one "locks it in" (handled by the parent,
 * which then carries template_mode/template_id on the next send). See
 * TEMPLATE_PLAN.md §6 (retrieval = in-chat control beside attach).
 */
export function TemplatePicker({ onSelect, disabled, selectionLocked = false, mode = 'generation', onOpenLibrary, showSavedTemplates = true }: TemplatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <StudioComposerHint enabled={STUDIO_SHELL} label="Reuse a template" suppressed={open}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center rounded-lg p-1.5 text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-200 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || (selectionLocked && !onOpenLibrary)}
          title={STUDIO_SHELL ? undefined : "Reuse a saved template"}
          aria-label="Reuse a saved template"
        >
          <LayoutTemplate className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      </StudioComposerHint>
      <DropdownMenuContent align="start" className="w-64">
        {onOpenLibrary && <DropdownMenuItem onSelect={() => { setOpen(false); onOpenLibrary() }}>
          <LayoutTemplate className="mr-2 h-4 w-4" /> Template library
        </DropdownMenuItem>}
        {onOpenLibrary && showSavedTemplates && <DropdownMenuSeparator />}
        {showSavedTemplates && (selectionLocked && onOpenLibrary
          ? <DropdownMenuItem disabled>Template selection is locked for this deck</DropdownMenuItem>
          : <TemplatePickerContent onSelect={onSelect} isOpen={open} mode={mode} />)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
