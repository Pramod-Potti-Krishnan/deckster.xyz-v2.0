"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, LayoutTemplate, Loader2, Plus, RotateCw, Search, X } from 'lucide-react'
import './studio-template-picker.css'
import { ThemeDropdownPicker, type ThemeDropdownCopy, type ThemeDropdownOption } from '@/components/theme-dropdown-picker'
import {
  DECKSTER_PROVIDED_TEMPLATES, composerTemplateActions, composerTemplateSlideCount, keepPopupOpenForDropdownList, loadComposerTemplates, templateLibraryTarget,
  type ComposerLibraryRequest, type ComposerTemplateAction,
} from '@/lib/studio-composer-popups'
import type { ComposerTemplate } from '@/lib/composer-library'
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
// PASS2-COMPOSER-POPUPS fix (flag on only): the Templates page works only with saved templates connected (the page's own rule), and the
// composer library's actions follow the library dialog's flags. Read here as the dialog and the page read them.
const TEMPLATES_PAGE_ENABLED = process.env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED === 'true'
const COMPOSER_DITTO_ENABLED = process.env.NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED === 'true'
const COMPOSER_NEW_TOPIC_ENABLED = process.env.NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED === 'true'

interface TemplatePickerProps {
  onSelect: (template: TemplateSelection) => void
  disabled?: boolean
  selectionLocked?: boolean
  mode?: TemplatePickerMode
  onOpenLibrary?: () => void
  showSavedTemplates?: boolean
  /** PASS2-COMPOSER-POPUPS (flag NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2, set by the composer): the popup is two dropdowns, "Deckster templates" and "My templates". */
  dropdowns?: boolean
  /** PASS2-COMPOSER-POPUPS: the composer owns the open-state, so only one composer popup is open at a time. Absent: the picker keeps its own. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** PASS2-COMPOSER-POPUPS: the template the composer has locked in, shown as the chosen value of "My templates". */
  selectedTemplateId?: string | null
  /** PASS2-COMPOSER-POPUPS fix: runs a composer library action (Use original, Rebuild, New topic) in the library dialog. Absent: no composer library. */
  onComposerAction?: (request: ComposerLibraryRequest) => void
  /** PASS2-COMPOSER-POPUPS fix: the signed-in identity, read as the library dialog reads it (id, else email). Without it nothing is listed. */
  composerUserId?: string | null
}

interface TemplatePickerContentProps {
  onSelect: (template: TemplateSelection) => void
  isOpen?: boolean
  label?: string
  mode?: TemplatePickerMode
  preferredTemplateId?: string | null
  standalone?: boolean
  /** PASS2-COMPOSER-POPUPS: draw the composer popup (two dropdowns and the library actions) instead of the search box and cards. */
  dropdowns?: ComposerTemplateDropdowns
}

/** What the composer's template popup needs beyond the records: the chosen template, the lock, and the two actions below the dropdowns. */
export interface ComposerTemplateDropdowns {
  selectedTemplateId: string | null
  locked: boolean
  /** False when saved templates are not enabled in this environment: the popup then offers only the two actions. */
  savedTemplates: boolean
  onClose: () => void
  /** The existing upload flow (the composer library dialog); absent when the environment has none. */
  onNewTemplate?: () => void
  /** PASS2-COMPOSER-POPUPS fix: "Template library" opens the composer library dialog; absent when the environment has none. */
  onLibrary?: () => void
  /** PASS2-COMPOSER-POPUPS fix: the composer library's own templates, listed in "My templates" with the library dialog's actions. */
  composer?: ComposerTemplateList
}

/** PASS2-COMPOSER-POPUPS fix: the composer library's list as the template popup shows it, and what its actions do. */
export interface ComposerTemplateList {
  /** null until the first answer. */
  templates: ComposerTemplate[] | null
  loading: boolean
  error: string | null
  /** As the library dialog reads it; without it nothing is loaded and the actions are off, as the dialog's buttons are. */
  userId: string | null
  /** The template picked in "My templates", whose actions are shown. */
  chosenId: string | null
  onChoose: (id: string | null) => void
  actions: { action: ComposerTemplateAction; label: string }[]
  onAction: (request: ComposerLibraryRequest) => void
  refresh: () => void
}

const DECKSTER_TEMPLATES_COPY: ThemeDropdownCopy = { label: 'Deckster templates', help: null, placeholder: 'Search Deckster templates', singular: 'template', plural: 'templates', groups: false, none: 'No Deckster templates yet.' }
const MY_TEMPLATES_COPY: ThemeDropdownCopy = { label: 'My templates', help: null, placeholder: 'Search your templates', singular: 'template', plural: 'templates', groups: false, none: 'No saved templates yet.' }
// PASS2-COMPOSER-POPUPS fix: why a list is empty, in plain words, under the control (never a blank control).
const DECKSTER_TEMPLATES_EMPTY = 'Deckster has no ready-made templates yet. Templates you upload are listed under My templates.'
const SAVED_TEMPLATES_EMPTY = 'No saved templates yet. Build a deck and use Save as Template to add one.'
/** Composer library options carry this prefix in the merged "My templates" list, so they can never be mistaken for a saved template. */
const COMPOSER_OPTION = 'composer:'

export function TemplatePickerContent({
  onSelect,
  isOpen = true,
  label = 'Reuse a template',
  mode = 'generation',
  preferredTemplateId = null,
  standalone = false,
  dropdowns,
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

  if (STUDIO_SHELL && dropdowns) {
    // PASS2-COMPOSER-POPUPS: the same records, selection handler, readiness rules, retry and watchers as the cards below; only the picture changes.
    const optionOf = (template: SavedTemplate): ThemeDropdownOption => {
      const ready = isTemplateGenerationReady(template)
      const slides = template.slide_count != null ? `${template.slide_count} slides` : 'Saved template'
      return { id: template.id, name: template.name, hint: template.description || templateGenerationUnavailableReason(template), swatches: [], current: false,
        sub: `${slides} · ${templateGenerationStatusLabel(template)}`, search: `${template.name} ${template.description || ''}`, muted: mode === 'generation' && !ready }
    }
    const mine = (templates ?? []).map(optionOf)
    const deckster: ThemeDropdownOption[] = DECKSTER_PROVIDED_TEMPLATES.map(item => ({ id: item.id, name: item.name, hint: item.description ?? '', swatches: [], current: false,
      sub: item.slideCount != null ? `${item.slideCount} slides` : '', search: `${item.name} ${item.description ?? ''}` }))
    const choose = (id: string) => {
      const template = templates?.find(item => item.id === id)
      if (!template) return
      handleTemplateClick(template)
      // As with the menu rows before: a template that can be used closes the popup; one that is not ready explains why and stays.
      if (mode !== 'generation' || isTemplateGenerationReady(template)) dropdowns.onClose()
    }
    const attention = (templates ?? []).filter(template => ['failed', 'needs_cleanup'].includes(templateGenerationStatus(template)))
    const loadingFirst = refreshing && templates === null
    // PASS2-COMPOSER-POPUPS fix: with the composer library, "My templates" lists its templates first (the uploads the library dialog shows),
    // then any saved templates. A composer template is picked in the list and then used through the library dialog's own actions; a saved
    // template is chosen exactly as before. "Template library" opens the working library, never a page that is disabled here.
    const composer = dropdowns.composer
    const library = templateLibraryTarget({ composerLibrary: Boolean(dropdowns.onLibrary), templatesPage: TEMPLATES_PAGE_ENABLED })
    const composerOptions: ThemeDropdownOption[] = (composer?.templates ?? []).map(template => ({ id: `${COMPOSER_OPTION}${template.id}`, name: template.name, hint: template.name,
      swatches: [], current: false, sub: `${composerTemplateSlideCount(template)} slides`, search: template.name }))
    // A locked deck still offers the composer templates (each one opens a new deck, as in the library dialog), but no saved ones.
    const savedOptions = dropdowns.savedTemplates && !(composer && dropdowns.locked) ? mine : []
    const myOptions = composer ? [...composerOptions, ...savedOptions] : mine
    const chosen = composer?.templates?.find(template => template.id === composer.chosenId) ?? null
    const chooseMine = (id: string) => {
      if (composer && composerOptions.some(option => option.id === id)) composer.onChoose(id.slice(COMPOSER_OPTION.length))
      else { composer?.onChoose(null); choose(id) }
    }
    // Why "My templates" is empty, if it is. With the composer library: signed out, failed, still loading, or nothing uploaded yet.
    const savedPending = dropdowns.savedTemplates && !dropdowns.locked && templates === null && !listError
    const composerState = !composer || myOptions.length > 0 ? null : !composer.userId ? 'signed-out' as const
      : composer.templates === null && composer.error ? 'failed' as const : composer.templates === null || savedPending ? 'loading' as const : 'empty' as const
    const myEmpty = !composer ? (dropdowns.savedTemplates && templates !== null && templates.length === 0 && !listError ? SAVED_TEMPLATES_EMPTY : null)
      : composerState === 'signed-out' ? 'Sign in to see your templates.'
        : composerState === 'failed' ? `Your templates could not be loaded: ${composer.error} Use Refresh to try again.`
          : composerState === 'loading' ? 'Loading your templates…'
            : composerState === 'empty' ? dropdowns.onNewTemplate ? 'You have no templates yet. Upload a PowerPoint with New template… and it is listed here.' : 'You have no templates yet.'
              : null
    const myPlaceholder = composerState === 'loading' ? 'Loading your templates…' : composerState === 'failed' ? 'Library unavailable' : composerState ? 'No templates yet' : MY_TEMPLATES_COPY.placeholder
    const refreshBusy = refreshing || Boolean(retryingId) || Boolean(composer?.loading)
    const refreshButton = <button type="button" className="stcd-icon-button" aria-label={composer ? 'Refresh templates' : 'Refresh saved templates'} disabled={refreshBusy}
      onClick={() => { if (!composer || dropdowns.savedTemplates) void refresh(); composer?.refresh() }}><RotateCw size={13} aria-hidden="true" className={refreshing || composer?.loading ? 'stcd-spin' : undefined} /></button>
    const decksterField = <div className="stcd-field" data-studio-template-dd="deckster">
      <ThemeDropdownPicker options={deckster} selectedId={null} locked={dropdowns.locked || deckster.length === 0} onSelect={choose}
        copy={deckster.length === 0 ? { ...DECKSTER_TEMPLATES_COPY, placeholder: 'No Deckster templates yet' } : DECKSTER_TEMPLATES_COPY} />
      {deckster.length === 0 && <p className="stcd-empty" data-studio-template-empty="deckster">{DECKSTER_TEMPLATES_EMPTY}</p>}
    </div>
    return <section data-studio-template-dropdowns="true" aria-label={label} className="stcd">
      <div className="stcd-heading">
        <strong>{label}</strong>
        {refreshButton}
        <button type="button" className="stcd-icon-button" data-studio-template-action="close" aria-label="Close template options" onClick={dropdowns.onClose}><X size={14} aria-hidden="true" /></button>
      </div>
      {!composer && dropdowns.savedTemplates && <>
      {dropdowns.locked && <p className="stcd-note">Template selection is locked for this deck.</p>}
      {decksterField}
      <div className="stcd-field" data-studio-template-dd="mine">
        <ThemeDropdownPicker options={mine} selectedId={dropdowns.selectedTemplateId} locked={dropdowns.locked || loadingFirst || (templates === null && Boolean(listError))} onSelect={choose}
          copy={{ ...MY_TEMPLATES_COPY, placeholder: loadingFirst ? 'Loading your templates…' : templates === null && listError ? 'Library unavailable' : MY_TEMPLATES_COPY.placeholder }} />
        {myEmpty && <p className="stcd-empty" data-studio-template-empty="mine">{myEmpty}</p>}
      </div>
      </>}
      {composer && <>
      {dropdowns.savedTemplates && dropdowns.locked && <p className="stcd-note">Saved templates are locked for this deck.</p>}
      {decksterField}
      <div className="stcd-field" data-studio-template-dd="mine">
        <ThemeDropdownPicker options={myOptions} selectedId={chosen ? `${COMPOSER_OPTION}${chosen.id}` : dropdowns.selectedTemplateId} locked={myOptions.length === 0} onSelect={chooseMine}
          copy={{ ...MY_TEMPLATES_COPY, none: 'No templates yet.', placeholder: myPlaceholder }} />
        {myEmpty && <p className="stcd-empty" role="status" data-studio-template-empty="mine">{myEmpty}</p>}
        {composer.error && composer.templates !== null && <p className="stcd-note stcd-error" role="alert">Your templates could not be refreshed: {composer.error} Showing the last loaded list.</p>}
      </div>
      {chosen && <div className="stcd-composer" role="group" aria-label={`What to do with ${chosen.name}`} data-studio-template-composer={chosen.id}>
        <p className="stcd-composer-name"><strong>{chosen.name}</strong> · {composerTemplateSlideCount(chosen)} slides</p>
        <div className="stcd-composer-actions">
          {composer.actions.map(({ action, label: actionLabel }) => <button key={action} type="button" data-studio-template-composer-action={action} disabled={!composer.userId}
            onClick={() => composer.onAction({ action, template: chosen })}>{actionLabel}</button>)}
        </div>
        <p className="stcd-hint">Each opens a new deck; the template library shows its progress.</p>
      </div>}
      </>}
      {dropdowns.savedTemplates && listError && <p className="stcd-note stcd-error" role="alert">{listError}{templates !== null && ' Showing the last loaded records; their status may have changed.'}</p>}
      {dropdowns.savedTemplates && attention.length > 0 && <div className="stcd-attention" role="group" aria-label="Templates that need attention">
        {attention.map(template => {
          const errors = [template.blueprint_enrichment_error, template.template_purity_error].filter(Boolean).join(' · ')
          return <div key={template.id} className="stcd-attention-row">
            <div className="stcd-attention-head">
              <span><strong>{template.name}</strong> · {templateGenerationStatusLabel(template)}</span>
              <button type="button" className="stcd-retry" disabled={Boolean(retryingId)} onClick={() => void retryNative(template)}><RotateCw size={11} aria-hidden="true" />{retryingId === template.id ? 'Requesting…' : 'Retry'}</button>
            </div>
            <small>{templateGenerationUnavailableReason(template)}{errors ? ` Current diagnostics: ${errors}` : ''}{previousErrors[template.id]?.length ? ` Previous attempt: ${previousErrors[template.id].join(' · ')}` : ''}</small>
            {watchNotices[template.id] && <small role="status">{watchNotices[template.id]}</small>}
          </div>
        })}
      </div>}
      {dropdowns.savedTemplates && <p className="stcd-hint">{mode === 'review' ? 'Review does not start generation.' : 'Readiness and build locks still apply.'}</p>}
      <div className="stcd-footer">
        {library === 'dialog' && <button type="button" data-studio-template-action="library" onClick={dropdowns.onLibrary}>Template library <ArrowRight size={12} aria-hidden="true" /></button>}
        {library === 'page' && <Link href="/studio/templates" data-studio-template-action="library" onClick={dropdowns.onClose}>Template library <ArrowRight size={12} aria-hidden="true" /></Link>}
        {dropdowns.onNewTemplate && <button type="button" data-studio-template-action="new" onClick={dropdowns.onNewTemplate}><Plus size={12} aria-hidden="true" />New template…</button>}
      </div>
    </section>
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
 * PASS2-COMPOSER-POPUPS fix (flag on only): the template popup's body, with the composer library's list. The list is the library dialog's own
 * request, made under the dialog's rule (while open, and only for a signed-in user); the actions are handed to the dialog, which runs them
 * with its own handlers. Without a composer library (`onComposerAction` absent) nothing is requested and the body is the saved-template one.
 */
export function ComposerTemplatePopupBody({ onSelect, open, mode, showSavedTemplates, selectionLocked, selectedTemplateId, onClose, onOpenLibrary,
  onComposerAction, composerUserId }: {
  onSelect: (template: TemplateSelection) => void
  open: boolean
  mode: TemplatePickerMode
  showSavedTemplates: boolean
  selectionLocked: boolean
  selectedTemplateId: string | null
  onClose: () => void
  onOpenLibrary?: () => void
  onComposerAction?: (request: ComposerLibraryRequest) => void
  composerUserId: string | null
}) {
  const [templates, setTemplates] = useState<ComposerTemplate[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const listRequest = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++listRequest.current
    setLoading(true)
    setError(null)
    try {
      const listed = await loadComposerTemplates()
      if (request === listRequest.current) setTemplates(listed)
    } catch (reason) {
      if (request === listRequest.current) setError(reason instanceof Error ? reason.message : 'Could not load templates.')
    } finally {
      if (request === listRequest.current) setLoading(false)
    }
  }, [])
  const listing = Boolean(onComposerAction && open && composerUserId)
  useEffect(() => {
    if (!listing) return
    void refresh()
    return () => { listRequest.current += 1; setLoading(false) }
  }, [listing, refresh])

  const composer: ComposerTemplateList | undefined = onComposerAction ? {
    templates, loading, error, userId: composerUserId, chosenId, onChoose: setChosenId,
    actions: composerTemplateActions({ ditto: COMPOSER_DITTO_ENABLED, newTopic: COMPOSER_NEW_TOPIC_ENABLED }),
    onAction: request => { setChosenId(null); onClose(); onComposerAction(request) },
    refresh: () => { if (composerUserId) void refresh() },
  } : undefined
  return <TemplatePickerContent onSelect={onSelect} isOpen={open && showSavedTemplates} mode={mode} label="Reuse a template"
    dropdowns={{ selectedTemplateId, locked: selectionLocked, savedTemplates: showSavedTemplates, onClose,
      onNewTemplate: onOpenLibrary ? () => { onClose(); onOpenLibrary() } : undefined,
      onLibrary: onOpenLibrary ? () => { onClose(); onOpenLibrary() } : undefined,
      composer }} />
}

/**
 * In-chat template picker — a sibling of the attach button. Click → lists the
 * user's saved templates → selecting one "locks it in" (handled by the parent,
 * which then carries template_mode/template_id on the next send). See
 * TEMPLATE_PLAN.md §6 (retrieval = in-chat control beside attach).
 */
export function TemplatePicker({ onSelect, disabled, selectionLocked = false, mode = 'generation', onOpenLibrary, showSavedTemplates = true,
  dropdowns = false, open: controlledOpen, onOpenChange, selectedTemplateId = null, onComposerAction, composerUserId = null }: TemplatePickerProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  // Without the composer's V2 flag nothing is passed in: the open-state is the picker's own, as before.
  const open = controlledOpen ?? ownOpen
  const setOpen = controlledOpen === undefined ? setOwnOpen : (next: boolean) => onOpenChange?.(next)

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
      {dropdowns && STUDIO_SHELL ? (
        <DropdownMenuContent align="start" data-studio-composer-menu="template" data-studio-composer-dd="true" data-studio-v4-chrome={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === 'true' ? 'true' : undefined} data-studio-v4-menu="template" className="studio-template-popover"
          onEscapeKeyDown={keepPopupOpenForDropdownList}
          onKeyDownCapture={event => {
            // Native Tab traversal inside the form-like popup must run before Radix menu key handling (as in the theme popup).
            if (event.key === 'Tab') event.stopPropagation()
          }}>
          <ComposerTemplatePopupBody onSelect={onSelect} open={open} mode={mode} showSavedTemplates={showSavedTemplates} selectionLocked={selectionLocked}
            selectedTemplateId={selectedTemplateId} onClose={() => setOpen(false)} onOpenLibrary={onOpenLibrary} onComposerAction={onComposerAction} composerUserId={composerUserId} />
        </DropdownMenuContent>
      ) : (
      <DropdownMenuContent align="start" className="w-64">
        {onOpenLibrary && <DropdownMenuItem onSelect={() => { setOpen(false); onOpenLibrary() }}>
          <LayoutTemplate className="mr-2 h-4 w-4" /> Template library
        </DropdownMenuItem>}
        {onOpenLibrary && showSavedTemplates && <DropdownMenuSeparator />}
        {showSavedTemplates && (selectionLocked && onOpenLibrary
          ? <DropdownMenuItem disabled>Template selection is locked for this deck</DropdownMenuItem>
          : <TemplatePickerContent onSelect={onSelect} isOpen={open} mode={mode} />)}
      </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}
