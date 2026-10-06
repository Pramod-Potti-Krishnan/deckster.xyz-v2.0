"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, FileText, FileUp, Layers, LayoutTemplate, Loader2, RefreshCw } from 'lucide-react'
import { TemplateIngestDialog } from '@/components/template-ingest-dialog'
import { StudioWorkflowAction } from './studio-workflow-action'
import { libraryAccountCanStart, libraryAccountIsCurrent, useStudioLibraryAccount } from './library-account-boundary'
import { isTemplateGenerationReady, templateGenerationStatus, templateGenerationStatusLabel, templateGenerationUnavailableReason, useTemplates, type SavedTemplate, type TemplateBlueprintSlide, type TemplateEnrichmentResult, type TemplateSnapshot } from '@/hooks/use-templates'
import { FittedLibraryStage, LibraryLoading, LibraryNotice, LibrarySearch, LibraryWorkspace, MetadataDisclosure, ReadValue, StudioWorkflowLink, libraryDate, type LibraryMode } from './library-controls'
import './templates-fidelity.css'

const TEMPLATES_ENABLED = process.env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED === 'true'
const COMPOSER_ENABLED = process.env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED === 'true'
const INGEST_ENABLED = process.env.NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED === 'true'
type DraftSlide = { title: string; purpose: string; inputs: string }
const EMPTY_SLIDE: DraftSlide = { title: '', purpose: '', inputs: '' }

/** Enrichment acknowledges status only; it cannot replace the saved blueprint. */
function withOptimizationResult<T extends SavedTemplate>(template: T, result: TemplateEnrichmentResult): T {
  return { ...template,
    ...(result.blueprint_enrichment_status !== undefined ? { blueprint_enrichment_status: result.blueprint_enrichment_status } : {}),
    ...(result.blueprint_enrichment_error !== undefined ? { blueprint_enrichment_error: result.blueprint_enrichment_error } : {}),
    ...(result.blueprint_enriched_at !== undefined ? { blueprint_enriched_at: result.blueprint_enriched_at } : {}),
    ...(result.template_purity_status !== undefined ? { template_purity_status: result.template_purity_status } : {}),
    ...(result.template_purity_error !== undefined ? { template_purity_error: result.template_purity_error } : {}),
    ...(result.template_purified_at !== undefined ? { template_purified_at: result.template_purified_at } : {}),
  }
}

function TemplateStatus({ template }: { template: SavedTemplate | TemplateSnapshot }) {
  return <span className={`sl-badge sl-status-${templateGenerationStatus(template)}`}>{templateGenerationStatusLabel(template)}</span>
}

function BlueprintPreview({ title, purpose, role, elements, index, total }: {
  title: string; purpose?: string | null; role?: string | null
  elements?: TemplateBlueprintSlide['elements']; index: number; total: number
}) {
  return <div className="sl-blueprint-slide" aria-label={`Structural preview: ${title}`}>
    <span className="sl-slide-kicker">{role || 'REUSABLE STORY'} / STRUCTURAL PREVIEW</span>
    <h2>{title || 'Your next great story'}</h2><p>{purpose || 'Give this slide a clear job in your story.'}</p>
    <div className="sl-blueprint-elements">{elements?.length ? elements.slice(0, 3).map(element => <div key={element.element_key}><span>{element.atom_contract?.kind || element.atom_type || 'Content'}</span><strong>{element.semantic_role || element.purpose}</strong><small>{element.fixedness === 'locked_media' ? 'Locked media' : element.lock_policy === 'lock_exact' ? 'Keep exactly' : element.fixedness === 'constant' ? 'Constant' : 'Reusable content'}</small></div>) : <div className="sl-blueprint-intent"><Layers size={28} /><span>Intent and structure</span><strong>Your content belongs here.</strong></div>}</div>
    <footer><span>{elements && elements.length > 3 ? `${elements.length} elements · inspect all below` : 'BLUEPRINT GUIDE · NOT A RENDERED SLIDE'}</span><span>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span></footer>
  </div>
}

function TemplateInspector({ snapshot, slide }: { snapshot: TemplateSnapshot; slide?: TemplateBlueprintSlide }) {
  const studio = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const [scope, setScope] = useState<'deck' | 'slide' | 'element' | 'source'>(slide ? 'slide' : 'deck')
  const [elementIndex, setElementIndex] = useState(0)
  const [slotIndex, setSlotIndex] = useState(0)
  const elements = slide?.elements ?? []
  const element = elements[Math.min(elementIndex, Math.max(0, elements.length - 1))]
  const slots = snapshot.slots ?? []
  const slot = slots[Math.min(slotIndex, Math.max(0, slots.length - 1))]
  return <details className="sl-disclosure sl-inspector" data-studio-template-read-region={studio ? 'true' : undefined} tabIndex={studio ? 0 : undefined} role={studio ? 'group' : undefined} aria-label={studio ? 'Template details: deck, slide, element and source metadata' : undefined}><summary>Explore template details <span>Deck · slide · element · source</span></summary>
    <div className="sl-segment" aria-label="Template detail scope">{(['deck', 'slide', 'element', 'source'] as const).map(value => <button type="button" key={value} aria-pressed={scope === value} onClick={() => setScope(value)}>{value === 'source' ? 'Source slots' : value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    <dl className="sl-read-grid">{scope === 'deck' ? <><ReadValue label="Description" value={snapshot.description} /><ReadValue label="Purpose" value={snapshot.template_blueprint?.deck_purpose} /><ReadValue label="Reuse instruction" value={snapshot.template_blueprint?.deck_reuse_instruction} /><ReadValue label="Abstraction scope" value={snapshot.template_blueprint?.abstraction_scope?.label || snapshot.template_blueprint?.abstraction_scope?.level} /><ReadValue label="Presentation brief" value={snapshot.presentation_brief} /><ReadValue label="Deck arc" value={snapshot.deck_arc} /><ReadValue label="Blueprint method" value={snapshot.blueprint_generation_method || snapshot.template_blueprint?.generation_method || 'Not recorded'} /><ReadValue label="Optimization status" value={snapshot.blueprint_enrichment_status || 'Not recorded'} /><ReadValue label="Source cleanup status" value={snapshot.template_purity_status || 'Not recorded'} /></> : scope === 'slide' ? slide ? <><ReadValue label="Purpose" value={slide.purpose} /><ReadValue label="Storyline" value={slide.storyline} /><ReadValue label="Proof goal" value={slide.proof_goal} /><ReadValue label="Narrative role" value={slide.narrative_role} /><ReadValue label="Title intent" value={slide.title_intent} /><ReadValue label="Subtitle intent" value={slide.subtitle_intent} /><ReadValue label="Reuse instruction" value={slide.reuse_instruction} /><ReadValue label="Population policy" value={slide.population_policy} /><ReadValue label="Required inputs" value={slide.required_inputs?.join('\n')} /></> : <p className="sl-helper">This saved template has no slide blueprint. Its original metadata remains available below.</p> : null}</dl>
    {scope === 'element' && (element ? <><label className="sl-field">Element<select value={Math.min(elementIndex, elements.length - 1)} onChange={event => setElementIndex(Number(event.target.value))}>{elements.map((item, index) => <option key={item.element_key} value={index}>{item.semantic_role || item.purpose || item.element_key}</option>)}</select></label><dl className="sl-read-grid"><ReadValue label="Purpose" value={element.purpose} /><ReadValue label="Content intent" value={element.content_intent} /><ReadValue label="Required input" value={element.required_input} /><ReadValue label="Population rule" value={element.population_rule} /><ReadValue label="Fixedness" value={element.fixedness} /><ReadValue label="Lock policy" value={element.lock_policy} /><ReadValue label="Storyline link" value={element.storyline_link} /><ReadValue label="Missing data policy" value={element.atom_contract?.missing_data_policy} /><ReadValue label="Abstraction instruction" value={element.atom_contract?.abstraction_instruction} /></dl><MetadataDisclosure label="Full element contract" value={element} /></> : <p className="sl-helper">No element blueprint is available for this slide.</p>)}
    {scope === 'slide' && slide && <MetadataDisclosure label="Full slide contract" value={slide} />}
    {scope === 'source' && (slot ? <><p className="sl-helper">Original saved slots are source metadata, not a rendered slide or a verified content-free blueprint.</p><label className="sl-field">Source slot<select value={Math.min(slotIndex, slots.length - 1)} onChange={event => setSlotIndex(Number(event.target.value))}>{slots.map((item, index) => <option key={`${item.slot_id}-${index}`} value={index}>Slide {item.slide_index + 1} · {item.name || item.abstract_intent || item.slot_id}</option>)}</select></label><dl className="sl-read-grid"><ReadValue label="Slide title" value={slot.slide_title} /><ReadValue label="Slide subtitle" value={slot.slide_subtitle} /><ReadValue label="Intent" value={slot.abstract_intent} /><ReadValue label="Role" value={slot.narrative_role} /><ReadValue label="Key message" value={slot.key_message} /><ReadValue label="Element type" value={slot.element_type} /><ReadValue label="Content type" value={slot.content_type} /><ReadValue label="Canvas type" value={slot.canvas_type} /></dl><MetadataDisclosure label="Complete source slot" value={slot} /></> : <p className="sl-helper">This saved template has no original slot metadata.</p>)}
    {scope === 'deck' && <dl className="sl-read-grid"><ReadValue label="Created (UTC)" value={libraryDate(snapshot.created_at)} /><ReadValue label="Updated (UTC)" value={libraryDate(snapshot.updated_at)} /><ReadValue label="Recorded uses" value={typeof snapshot.usage_count === 'number' ? String(snapshot.usage_count) : undefined} /></dl>}
    <MetadataDisclosure label="Complete saved snapshot & source metadata" value={snapshot} />
  </details>
}

export function TemplatesWorkspace() {
  const account = useStudioLibraryAccount()
  const accountOwner = account?.owner
  const accountCurrent = account?.current
  const accountReady = account === null || account.ready
  const standaloneStudio = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && account !== null
  const { listTemplates, getTemplate, reoptimizeTemplate, watchTemplateStatus } = useTemplates()
  const [mode, setMode] = useState<LibraryMode>('create')
  const [templates, setTemplates] = useState<SavedTemplate[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<TemplateSnapshot | null>(null)
  const [loading, setLoading] = useState(TEMPLATES_ENABLED)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [slideIndex, setSlideIndex] = useState(0)
  const [draftName, setDraftName] = useState('')
  const [draftPurpose, setDraftPurpose] = useState('')
  const [draftScope, setDraftScope] = useState('structure')
  const [draftSlides, setDraftSlides] = useState<DraftSlide[]>([{ ...EMPTY_SLIDE }])
  const [draftIndex, setDraftIndex] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [discardPrompt, setDiscardPrompt] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [optimizingId, setOptimizingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [watchExpired, setWatchExpired] = useState(false)
  const optimizeBusy = useRef(false)
  const mounted = useRef(true)
  const mountEpoch = useRef({})
  const renderedEpoch = mountEpoch.current
  const [, refreshMountHandlers] = useState(0)
  const initialLoadStarted = useRef(false)
  const previewPending = useRef(false)
  const watchRequest = useRef(0)
  const stopWatch = useRef<(() => void) | null>(null)
  const importTrigger = useRef<HTMLButtonElement | null>(null)
  const importFocusRequest = useRef<{ href: string } | null>(null)
  const isCurrentAccount = useCallback(() => mounted.current && mountEpoch.current === renderedEpoch && (account === null || libraryAccountIsCurrent(account)), [accountOwner, accountCurrent, renderedEpoch])
  const canStartAccountAction = useCallback(() => isCurrentAccount() && (account === null || libraryAccountCanStart(account)), [isCurrentAccount, accountOwner, accountCurrent])
  // The dialog owns its request/route/mount fence and closes before navigating.
  const isCurrentImportAccount = useCallback(() => account === null || libraryAccountIsCurrent(account), [accountOwner, accountCurrent])
  const canStartImportAccount = useCallback(() => account === null || libraryAccountCanStart(account), [accountOwner, accountCurrent])
  useEffect(() => {
    const request = importFocusRequest.current
    if (importOpen || !request || !standaloneStudio) return
    importFocusRequest.current = null
    let leaving = false
    const pageHide = () => { leaving = true }
    window.addEventListener('pagehide', pageHide)
    // Run after native modal teardown/autofocus. A successful import closes
    // before hard navigation, so it must never reclaim focus in the old page.
    const timer = window.setTimeout(() => {
      const trigger = importTrigger.current
      if (leaving || window.location.href !== request.href || !canStartAccountAction() || !trigger?.isConnected || trigger.disabled || !trigger.getClientRects().length) return
      const focused = document.activeElement
      if (focused && focused !== document.body && focused !== document.documentElement) return
      trigger.focus({ preventScroll: true })
    }, 0)
    return () => { window.clearTimeout(timer); window.removeEventListener('pagehide', pageHide) }
  }, [importOpen, standaloneStudio, canStartAccountAction])
  const listRequest = useRef(0)
  const detailRequest = useRef(0)
  const optimizationRequest = useRef(0)
  const currentMode = useRef(mode)
  currentMode.current = mode
  const currentSelection = useRef(selectedId)
  currentSelection.current = selectedId
  const selected = templates?.find(template => template.id === selectedId)
  const isComposerCarrier = Boolean(selected && 'stage_template_summary' in selected)

  const refresh = useCallback(async () => {
    if (!TEMPLATES_ENABLED || !canStartAccountAction()) return
    const request = ++listRequest.current
    setLoading(true)
    const response = await listTemplates()
    if (!isCurrentAccount() || request !== listRequest.current) return
    setLoading(false)
    if (!response) { setListError('Your templates could not be loaded. Refresh to try again.'); return }
    setListError(''); setTemplates(response.templates)
    setSelectedId(current => response.templates.some(template => template.id === current) ? current : response.templates[0]?.id ?? null)
  }, [listTemplates, canStartAccountAction, isCurrentAccount])

  const loadPreview = useCallback(async (id: string) => {
    if (!canStartAccountAction() || id !== currentSelection.current) return
    const request = ++detailRequest.current
    previewPending.current = true
    setPreviewLoading(true); setPreviewError(''); setSnapshot(null)
    const result = await getTemplate(id)
    if (!isCurrentAccount() || request !== detailRequest.current || id !== currentSelection.current) return
    previewPending.current = false
    setPreviewLoading(false)
    if (!result || result.id !== id) { setPreviewError('This template preview could not be loaded. Your library is still available.'); return }
    setSnapshot(result)
    setSlideIndex(current => Math.min(current, Math.max(0, (result.template_blueprint?.slides.length ?? 0) - 1)))
    setTemplates(current => current?.map(template => template.id === id ? { ...template, ...result } : template) ?? current)
  }, [getTemplate, canStartAccountAction, isCurrentAccount])

  useEffect(() => {
    mounted.current = true
    if (mountEpoch.current !== renderedEpoch) {
      setOptimizingId(null); setPreviewLoading(false)
      refreshMountHandlers(value => value + 1)
    }
    return () => {
      mounted.current = false; mountEpoch.current = {}
      listRequest.current += 1; detailRequest.current += 1; optimizationRequest.current += 1; watchRequest.current += 1
      optimizeBusy.current = false; previewPending.current = false; initialLoadStarted.current = false
      stopWatch.current?.(); stopWatch.current = null
    }
  }, [])
  useEffect(() => {
    if (!initialLoadStarted.current && canStartAccountAction()) { initialLoadStarted.current = true; void refresh() }
  }, [refresh, canStartAccountAction, accountReady])
  useEffect(() => {
    setSlideIndex(0)
    if (mode !== 'library' || !selectedId || isComposerCarrier || !TEMPLATES_ENABLED) { detailRequest.current += 1; setSnapshot(null); setPreviewError(''); setPreviewLoading(false); return }
    void loadPreview(selectedId)
    return () => { detailRequest.current += 1; previewPending.current = false }
  }, [selectedId, isComposerCarrier, mode, loadPreview])
  // A preview deferred by same-owner verification may start once ready.
  useEffect(() => {
    if (accountReady && mode === 'library' && selectedId && !isComposerCarrier && TEMPLATES_ENABLED && !previewPending.current && snapshot?.id !== selectedId) void loadPreview(selectedId)
  }, [accountReady, loadPreview])
  const watchingId = mode === 'library' && snapshot && snapshot.id === selectedId && templateGenerationStatus(snapshot) === 'optimizing' ? snapshot.id : null
  useEffect(() => {
    const request = ++watchRequest.current
    setWatchExpired(false)
    if (!watchingId || !isCurrentAccount()) return
    const current = () => isCurrentAccount() && request === watchRequest.current && currentMode.current === 'library' && currentSelection.current === watchingId
    const stop = watchTemplateStatus(watchingId, {
      ...(account === null ? {} : { canStart: canStartAccountAction, isCurrent: current }),
      onUpdate: next => {
        if (!current() || next.id !== watchingId) return
        setSnapshot(previous => previous?.id === next.id ? next : previous)
        setSlideIndex(previous => Math.min(previous, Math.max(0, (next.template_blueprint?.slides.length ?? 0) - 1)))
        setTemplates(previous => previous?.map(template => template.id === next.id ? { ...template, ...next } : template) ?? previous)
      },
      onReady: next => { if (current() && next.id === watchingId) setActionNotice(`“${next.name}” is ready to reuse. Optimization and source cleanup are complete.`) },
      onTimeout: () => { if (current()) setWatchExpired(true) },
    })
    stopWatch.current = stop
    return () => { watchRequest.current += 1; stop(); if (stopWatch.current === stop) stopWatch.current = null }
  }, [watchingId, watchTemplateStatus, isCurrentAccount, canStartAccountAction])
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  const filtered = templates?.filter(template => `${template.name} ${template.description || ''}`.toLowerCase().includes(query.toLowerCase()) && (statusFilter === 'all' || (!('stage_template_summary' in template) && templateGenerationStatus(template) === statusFilter))) ?? []
  const slides = snapshot?.template_blueprint?.slides ?? []
  const slide = slides[slideIndex]
  const updateDraftSlide = (patch: Partial<DraftSlide>) => { setDraftSlides(current => current.map((item, index) => index === draftIndex ? { ...item, ...patch } : item)); setDirty(true) }
  const resetDraft = () => { setDraftName(''); setDraftPurpose(''); setDraftScope('structure'); setDraftSlides([{ ...EMPTY_SLIDE }]); setDraftIndex(0); setDirty(false); setDiscardPrompt(false) }
  const draftSlide = draftSlides[draftIndex]
  const draftBrief = [
    `Help me plan a presentation that I can later save as a reusable template.`,
    draftName.trim() && `Template name: ${draftName.trim()}`,
    draftPurpose.trim() && `Deck purpose: ${draftPurpose.trim()}`,
    `Reuse scope: ${draftScope}`,
    ...draftSlides.map((item, index) => `Slide ${index + 1}: ${item.title.trim() || 'Title to be decided'}\nPurpose: ${item.purpose.trim() || 'To be decided'}${item.inputs.trim() ? `\nRequired inputs:\n${item.inputs.trim()}` : ''}`),
    'Review this brief with me before building. Preserve the purpose and required inputs of each slide.',
  ].filter(Boolean).join('\n\n')

  async function optimize() {
    if (!canStartAccountAction() || !selectedId || selectedId !== currentSelection.current || !snapshot || snapshot.id !== selectedId || isComposerCarrier || optimizeBusy.current || templateGenerationStatus(snapshot) === 'optimizing' || isTemplateGenerationReady(snapshot)) return
    const id = selectedId
    const name = snapshot.name
    const request = ++optimizationRequest.current
    listRequest.current += 1; detailRequest.current += 1; previewPending.current = false; setLoading(false); setPreviewLoading(false)
    optimizeBusy.current = true; setOptimizingId(id); setActionError(''); setActionNotice('')
    try {
      const result = await reoptimizeTemplate(id)
      if (!isCurrentAccount() || request !== optimizationRequest.current) return
      if (!result || result.id !== id) { setActionError('Optimization was not confirmed. Refresh this template before retrying to check its current status.'); return }
      setSnapshot(current => current?.id === id ? withOptimizationResult(current, result) : current)
      setTemplates(current => current?.map(template => template.id === id ? withOptimizationResult(template, result) : template) ?? current)
      setActionNotice(result.blueprint_enrichment_status === 'queued' || result.blueprint_enrichment_status === 'running'
        ? `“${name}” optimization requested. Generation remains locked until optimization and source cleanup are verified.`
        : `“${name}” optimization status received. Review its recorded readiness; refresh to check the latest result.`)
    } catch {
      if (isCurrentAccount() && request === optimizationRequest.current) setActionError('Optimization was not confirmed. Refresh this template before retrying to check its current status.')
    } finally {
      if (request === optimizationRequest.current) {
        optimizeBusy.current = false
        if (isCurrentAccount()) setOptimizingId(null)
      }
    }
  }

  return <LibraryWorkspace introScreen={standaloneStudio ? "templates" : undefined} introAutoStart={standaloneStudio} introEnabled={accountReady && !importOpen} title="Templates" description={standaloneStudio ? 'Reusable story structure, slide roles, and content slots.' : 'Start with the shape of a story. Bring fresh content, evidence, and your own theme.'} mode={mode} onModeChange={setMode} actions={INGEST_ENABLED ? <button ref={standaloneStudio ? importTrigger : undefined} type="button" className="sl-button" disabled={!accountReady} onClick={() => { if (canStartAccountAction()) setImportOpen(true) }} title="Import PowerPoint or PDF into a new Studio session"><FileUp size={15} />Import presentation</button> : undefined}>
    <div className="sl-context" data-studio-templates-fidelity={standaloneStudio ? 'true' : undefined}><Layers size={15} /><span>Reusable structure, intent, and content roles</span><span>{mode === 'create' ? 'Local planning draft' : 'Your saved library'}</span></div>
    {!accountReady && <LibraryNotice>Verifying your account… Your current library and local draft are still here. Connected actions resume after verification.</LibraryNotice>}
    {!TEMPLATES_ENABLED && <LibraryNotice>Saved templates are not enabled in this environment. You can sketch a local draft; connected creation and reuse remain in Studio when enabled.</LibraryNotice>}
    {actionError && <LibraryNotice error>{actionError}</LibraryNotice>}{actionNotice && <LibraryNotice>{actionNotice}</LibraryNotice>}
    {discardPrompt && <div className="sl-confirm" role="alert"><span>Discard this local template draft?</span><button type="button" onClick={resetDraft}>Discard & start again</button><button type="button" onClick={() => setDiscardPrompt(false)}>Keep draft</button></div>}
    <div className="sl-split">
      <aside className="sl-side" style={standaloneStudio && mode === 'create' ? { order: -2 } : undefined}>
        {mode === 'create' ? <>
          <div className="sl-side-heading"><p className="sl-eyebrow">DESIGN THE STORY</p><h2>Give every slide a purpose.</h2><p>Sketch the narrative you want to reuse, with a clear role and fresh inputs for each slide.</p></div>
          <div className="sl-form-scroll"><div className="sl-fields"><label className="sl-field">Template name<input placeholder="e.g. Quarterly business review" value={draftName} onChange={event => { setDraftName(event.target.value); setDirty(true) }} /></label>
            <label className="sl-field">Deck purpose<textarea rows={3} placeholder="What should this story help your audience understand or decide?" value={draftPurpose} onChange={event => { setDraftPurpose(event.target.value); setDirty(true) }} /></label>
            <label className="sl-field">Reuse scope<select value={draftScope} onChange={event => { setDraftScope(event.target.value); setDirty(true) }}><option value="period">Period · same story, new period</option><option value="sibling">Sibling · a similar subject</option><option value="category">Category · related subjects</option><option value="structure">Structure · a different subject</option></select></label>
            <div className="sl-section-line"><h3>Slide {draftIndex + 1}</h3><span className="sl-badge">Local draft</span></div>
            <label className="sl-field">Slide title<input value={draftSlide.title} placeholder="The central idea" onChange={event => updateDraftSlide({ title: event.target.value })} /></label>
            <label className="sl-field">Slide purpose<textarea rows={3} value={draftSlide.purpose} placeholder="What is this slide’s job in the story?" onChange={event => updateDraftSlide({ purpose: event.target.value })} /></label>
            <label className="sl-field">Required inputs · one per line<textarea rows={3} value={draftSlide.inputs} placeholder={'Current results\nSupporting evidence'} onChange={event => updateDraftSlide({ inputs: event.target.value })} /></label>
            <div className="sl-actions"><button type="button" className="sl-button" onClick={() => { setDraftSlides(current => [...current, { ...EMPTY_SLIDE }]); setDraftIndex(draftSlides.length); setDirty(true) }}>Add a slide</button><button type="button" className="sl-text-button" disabled={draftSlides.length < 2} onClick={() => { setDraftSlides(current => current.filter((_, index) => index !== draftIndex)); setDraftIndex(Math.max(0, draftIndex - 1)); setDirty(true) }}>Remove this slide</button></div>
            <div className="sl-draft-summary"><FileText size={16} /><div><strong>{draftPurpose || 'A clear purpose connects the story.'}</strong><p>{draftSlide.inputs.trim() ? `Inputs for this slide: ${draftSlide.inputs.trim().split('\n').filter(Boolean).join(' · ')}` : 'Add the inputs this slide will need each time the template is reused.'}</p></div></div>
            <LibraryNotice>This is a local planning draft. Continue in Studio to review the brief with Director; it will be placed in the composer for you to send. Save as Template becomes available from an eligible completed deck.</LibraryNotice>
          </div></div>
          <div className="sl-side-footer"><StudioWorkflowAction canStart={account === null ? undefined : canStartAccountAction} action="brief" brief={draftBrief} className="sl-primary" disabled={!accountReady || (!draftName.trim() && !draftPurpose.trim() && !draftSlides.some(item => item.title.trim() || item.purpose.trim() || item.inputs.trim()))}>Continue planning in Studio <ArrowRight size={14} /></StudioWorkflowAction><span>{dirty ? 'Unsaved brief · review before sending' : 'Start with a name and purpose'}</span></div>
        </> : <>
          <div className="sl-side-heading"><div className="sl-section-line"><h2>Your templates</h2><button className="sl-icon-button" type="button" onClick={() => { void refresh(); if (selectedId && !isComposerCarrier) void loadPreview(selectedId) }} disabled={loading || previewLoading || Boolean(optimizingId) || !TEMPLATES_ENABLED || !accountReady} aria-label="Refresh templates"><RefreshCw size={15} /></button></div><LibrarySearch label="Search saved templates" value={query} onChange={setQuery} /><label className="sl-field sl-filter">Readiness<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All templates</option><option value="ready">Ready</option><option value="optimizing">Optimizing</option><option value="needs_optimization">Needs optimization</option><option value="needs_cleanup">Needs cleanup</option><option value="failed">Failed</option></select></label></div>
          {listError && <LibraryNotice error>{listError}{templates && <p>Showing the last loaded library. Refresh to check for updates.</p>}</LibraryNotice>}
          <div className="sl-library-list">{loading && templates === null ? <LibraryLoading /> : filtered.length ? filtered.map(template => <button type="button" key={template.id} className="sl-record sl-template-record" aria-pressed={template.id === selectedId} disabled={!accountReady} onClick={() => { if (canStartAccountAction()) setSelectedId(template.id) }}><div className="sl-mini-blueprint" aria-hidden="true"><i /><i /><i /></div><span><strong>{template.name}</strong><small>{template.slide_count != null ? `${template.slide_count} slides` : 'Saved template'}{template.description ? ` · ${template.description}` : ''}</small>{'stage_template_summary' in template ? <span className="sl-badge">Composer template</span> : <TemplateStatus template={template} />}</span></button>) : <div className="sl-empty"><LayoutTemplate size={26} /><h3>{listError && templates === null ? 'Library unavailable' : query || statusFilter !== 'all' ? 'No matching templates' : listError ? 'Library unavailable' : 'Your best stories belong here.'}</h3><p>{listError && templates === null ? 'Refresh to load your templates.' : query || statusFilter !== 'all' ? 'Try another search or readiness filter.' : listError ? 'Refresh to try again.' : TEMPLATES_ENABLED ? 'Build a deck in Studio, then use Save as Template to create your first reusable story.' : 'The connected template library is not enabled.'}</p>{listError && <button type="button" className="sl-button" disabled={!accountReady || loading || Boolean(optimizingId)} onClick={() => void refresh()}>Retry library</button>}{(query || statusFilter !== 'all') && <button type="button" className="sl-button" onClick={() => { setQuery(''); setStatusFilter('all') }}>Clear filters</button>}</div>}</div>
          <div className="sl-side-footer"><p className="sl-result-count" role="status">{loading ? templates === null ? 'Loading library…' : 'Refreshing library…' : templates === null ? 'Library not loaded' : `${filtered.length} ${filtered.length === 1 ? 'template' : 'templates'}${query || statusFilter !== 'all' ? ' match' : ' in your library'}`}</p><p className="sl-helper">A template is ready for generation only after optimization completes and source cleanup is verified.</p></div>
        </>}
      </aside>
      <section className="sl-preview-panel" aria-label="Template preview">
        <div className="sl-preview-heading"><div><p className="sl-eyebrow">{mode === 'create' ? 'YOUR STORY BLUEPRINT' : 'SAVED BLUEPRINT'}</p><h2>{mode === 'create' ? draftName || 'Your reusable story' : selected?.name || 'Explore a reusable story'}</h2></div>{mode === 'library' && selected && !isComposerCarrier ? <TemplateStatus template={snapshot || selected} /> : <span className="sl-badge">{mode === 'create' ? 'Local draft' : 'Preview'}</span>}</div>
        {mode === 'create' ? <>
          <div className="sl-slide-strip" aria-label="Draft slide sequence">{draftSlides.map((item, index) => <button key={index} type="button" aria-pressed={draftIndex === index} onClick={() => setDraftIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span>{item.title || `Slide ${index + 1}`}</button>)}</div>
          <FittedLibraryStage><BlueprintPreview title={draftSlide.title} purpose={draftSlide.purpose} index={draftIndex} total={draftSlides.length} /></FittedLibraryStage>
          <div className="sl-preview-caption"><span>Structural guide · not a generated presentation</span><button className="sl-text-button" type="button" onClick={() => dirty ? setDiscardPrompt(true) : resetDraft()}>Start another draft</button></div>
        </> : previewLoading ? <LibraryLoading>Loading template details…</LibraryLoading> : previewError ? <div className="sl-empty"><LibraryNotice error>{previewError}</LibraryNotice><button className="sl-button" type="button" disabled={!accountReady} onClick={() => selectedId && void loadPreview(selectedId)}>Retry preview</button></div> : isComposerCarrier ? <div className="sl-preview-empty"><Layers size={34} /><h3>Open this template in Studio.</h3><p>{COMPOSER_ENABLED ? 'Composer templates use their own library, preparation, and review flow in Studio.' : 'This is a Composer template. Its dedicated Studio workflow is not enabled in this environment.'}</p>{COMPOSER_ENABLED && selected && <StudioWorkflowAction canStart={account === null ? undefined : canStartAccountAction} action="templates" itemId={selected.id} className="sl-primary" disabled={!accountReady}>Open Composer library in Studio <ArrowRight size={14} /></StudioWorkflowAction>}<MetadataDisclosure label="Saved Composer summary" value={selected} /></div> : snapshot ? <>
          {slide ? <><div className="sl-slide-strip" aria-label="Saved slide sequence">{slides.map((item, index) => <button key={`${item.slide_index}-${index}`} type="button" aria-pressed={slideIndex === index} onClick={() => setSlideIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span>{item.slide_title || `Slide ${index + 1}`}</button>)}</div><FittedLibraryStage><BlueprintPreview title={slide.slide_title || slide.title_intent || `Slide ${slideIndex + 1}`} purpose={slide.purpose} role={slide.narrative_role} elements={slide.elements} index={slideIndex} total={slides.length} /></FittedLibraryStage><div className="sl-preview-caption"><span>Blueprint structure · original styling is available in Studio</span><div className="sl-pagination"><button type="button" disabled={slideIndex === 0} aria-label="Previous template slide" onClick={() => setSlideIndex(value => value - 1)}><ArrowLeft size={15} /></button><span>{slideIndex + 1} / {slides.length}</span><button type="button" disabled={slideIndex >= slides.length - 1} aria-label="Next template slide" onClick={() => setSlideIndex(value => value + 1)}><ArrowRight size={15} /></button></div></div></> : <div className="sl-preview-empty"><FileText size={32} /><h3>Saved structure available for review.</h3><p>{snapshot.description || snapshot.presentation_brief || 'This record has no semantic slide blueprint. Inspect its original saved slots and metadata below.'}</p></div>}
          {!isTemplateGenerationReady(snapshot) && <LibraryNotice readingLabel="Template generation readiness" error={['failed', 'needs_cleanup'].includes(templateGenerationStatus(snapshot))}>{templateGenerationUnavailableReason(snapshot)}{snapshot.blueprint_enrichment_error && <p>{templateGenerationStatus(snapshot) === 'optimizing' ? 'Last recorded optimization:' : 'Optimization:'} {snapshot.blueprint_enrichment_error}</p>}{snapshot.template_purity_error && <p>{templateGenerationStatus(snapshot) === 'optimizing' ? 'Last recorded cleanup:' : 'Cleanup:'} {snapshot.template_purity_error}</p>}</LibraryNotice>}
          {watchExpired && <LibraryNotice>Automatic status checks have paused. Refresh to check whether optimization has completed.</LibraryNotice>}
          <div className="sl-actions"><StudioWorkflowAction canStart={account === null ? undefined : canStartAccountAction} action="templates" itemId={snapshot.id} className="sl-primary" disabled={!accountReady}>{isTemplateGenerationReady(snapshot) ? 'Choose this template in Studio' : 'Review this template in Studio'} <ArrowRight size={14} /></StudioWorkflowAction>{!isTemplateGenerationReady(snapshot) && templateGenerationStatus(snapshot) !== 'optimizing' && <button type="button" className="sl-button" disabled={!accountReady || Boolean(optimizingId)} onClick={() => void optimize()}>{optimizingId === snapshot.id ? <Loader2 size={14} className="sl-spin" /> : <RefreshCw size={14} />}{optimizingId === snapshot.id ? 'Requesting…' : ['failed', 'needs_cleanup'].includes(templateGenerationStatus(snapshot)) ? 'Retry optimization' : 'Optimize template'}</button>}</div>
          <TemplateInspector key={snapshot.id} snapshot={snapshot} slide={slide} />
        </> : <div className="sl-preview-empty"><LayoutTemplate size={34} /><h3>A strong story has a clear shape.</h3><p>Select a saved template to explore its slide sequence, content roles, and reuse instructions.</p></div>}
        <div className="sl-preview-bottom">{account === null ? <StudioWorkflowLink disclosure>{mode === 'create' ? 'Create a deck, then use Save as Template. Import and template chat continue through their existing Studio workflows when enabled.' : isComposerCarrier ? 'Use the Composer library in Studio for this template’s dedicated preparation and review flow.' : 'Choose this template in Studio’s template picker to review or edit it. Generation remains subject to its readiness and session locks.'}</StudioWorkflowLink>: <div className="sl-workflow-link"><div><details className="sl-disclosure"><summary>Continue in Studio</summary><p>{mode === 'create' ? 'Create a deck, then use Save as Template. Import and template chat continue through their existing Studio workflows when enabled.' : isComposerCarrier ? 'Use the Composer library in Studio for this template’s dedicated preparation and review flow.' : 'Choose this template in Studio’s template picker to review or edit it. Generation remains subject to its readiness and session locks.'}</p></details></div><StudioWorkflowAction action="templates" canStart={canStartAccountAction} disabled={!accountReady}>Back to {process.env.NEXT_PUBLIC_STUDIO_V4_LABELS === 'true' ? 'Studio' : 'builder'}</StudioWorkflowAction><ArrowRight size={14} aria-hidden="true" /></div>}</div>
      </section>
    </div>
    {INGEST_ENABLED && importOpen && <TemplateIngestDialog canStart={account === null ? undefined : canStartImportAccount} isCurrent={account === null ? undefined : isCurrentImportAccount} open={importOpen} onOpenChange={next => { if (isCurrentAccount() && (!next || canStartAccountAction())) { if (!next && standaloneStudio) importFocusRequest.current = { href: window.location.href }; setImportOpen(next) } }} />}
  </LibraryWorkspace>
}
