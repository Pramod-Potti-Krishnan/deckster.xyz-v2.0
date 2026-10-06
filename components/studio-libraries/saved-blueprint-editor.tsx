"use client"

import { useEffect, useRef, useState, type SyntheticEvent, type MutableRefObject } from 'react'
import { libraryAccountCanStart, libraryAccountIsCurrent, useStudioLibraryAccount } from './library-account-boundary'
import { LibraryNotice } from './library-controls'
import { useTemplates, type TemplateBlueprint, type TemplateBlueprintScope, type TemplateSnapshot } from '@/hooks/use-templates'

const EDITOR_ENABLED = process.env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED === 'true'
  && process.env.NEXT_PUBLIC_BLUEPRINT_EDITOR_V2 === 'true'
  && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const optionalText = (value: unknown) => value === undefined || value === null || typeof value === 'string'
const texts = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string')
const optionalRecord = (value: unknown) => value === undefined || value === null || record(value)
const oneOf = (value: unknown, values: string[]) => typeof value === 'string' && values.includes(value)
const optionalChoice = (value: unknown, values: string[]) => value === undefined || value === null || oneOf(value, values)
const scopes = ['period', 'sibling', 'category', 'structure']
const kinds = ['text', 'metric', 'chart', 'diagram', 'infographic', 'image', 'table', 'kanban', 'unknown']
const policies = ['ask_user', 'assume_and_continue', 'reuse_prior_as_placeholder']
const validScope = (value: unknown) => value === undefined || value === null || (record(value) && oneOf(value.level, scopes) && optionalText(value.label))

/** Known canonical shapes only: no inferred minimum counts, prose or index ordering. */
export function isEditableBlueprint(value: unknown): value is TemplateBlueprint {
  if (!record(value) || value.version !== 1 || !oneOf(value.generation_method, ['llm', 'deterministic_fallback'])
    || !optionalText(value.deck_purpose) || !optionalText(value.deck_reuse_instruction) || !validScope(value.abstraction_scope) || !Array.isArray(value.slides)) return false
  return value.slides.every(slide => record(slide) && typeof slide.slide_index === 'number' && Number.isFinite(slide.slide_index)
    && typeof slide.purpose === 'string' && oneOf(slide.population_policy, ['flexible', 'strict'])
    && ['slide_title', 'title_intent', 'subtitle_intent', 'storyline', 'proof_goal', 'narrative_role', 'reuse_instruction'].every(key => optionalText(slide[key]))
    && (slide.required_inputs === undefined || texts(slide.required_inputs)) && optionalRecord(slide.design_constants) && validScope(slide.abstraction_scope)
    && Array.isArray(slide.elements) && slide.elements.every(element => record(element) && typeof element.element_key === 'string' && typeof element.purpose === 'string'
      && oneOf(element.fixedness, ['constant', 'variable', 'locked_media']) && optionalChoice(element.lock_policy, ['lock_exact', 'regenerate'])
      && ['source_element_id', 'spec_id', 'atom_type', 'semantic_role', 'storyline_link', 'content_intent', 'required_input', 'population_rule'].every(key => optionalText(element[key]))
      && optionalRecord(element.visual_constants) && validScope(element.abstraction_scope)
      && (element.atom_contract === undefined || element.atom_contract === null || (record(element.atom_contract)
        && oneOf(element.atom_contract.kind, kinds) && optionalText(element.atom_contract.abstraction_instruction)
        && optionalChoice(element.atom_contract.missing_data_policy, policies)
        && (element.atom_contract.required_data === undefined || texts(element.atom_contract.required_data))
        && (element.atom_contract.reusable_slots === undefined || record(element.atom_contract.reusable_slots))
        && (element.atom_contract.fixed_visual_rules === undefined || record(element.atom_contract.fixed_visual_rules))))))
}

export function isBlueprintReceipt(value: unknown, id: string, owner: string): value is TemplateSnapshot & { template_blueprint: TemplateBlueprint } {
  return record(value) && value.id === id && typeof value.name === 'string'
    && (value.user_id === undefined || value.user_id === owner) && isEditableBlueprint(value.template_blueprint)
    && ['description', 'created_at', 'updated_at', 'source_session_id', 'source_presentation_id', 'presentation_brief', 'deck_arc', 'slide_style_preset'].every(key => optionalText(value[key]))
    && ['usage_count', 'slide_count'].every(key => value[key] === undefined || typeof value[key] === 'number' && Number.isFinite(value[key]))
    && (value.slots === undefined || Array.isArray(value.slots) && value.slots.every(slot => record(slot) && typeof slot.slot_id === 'string' && typeof slot.slide_index === 'number' && Number.isFinite(slot.slide_index)
      && ['name', 'element_type', 'slide_title', 'slide_subtitle', 'narrative_role', 'key_message', 'content_type', 'canvas_type', 'chart_subtype', 'infographic_subtype', 'text_subtype', 'diagram_subtype', 'abstract_intent'].every(key => optionalText(slot[key]))))
    && optionalChoice(value.blueprint_generation_method, ['llm', 'deterministic_fallback'])
    && ['blueprint_enrichment_status', 'blueprint_enrichment_error', 'blueprint_enriched_at', 'template_purity_status', 'template_purity_error', 'template_purified_at'].every(key => optionalText(value[key]))
}

export function blueprintEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => blueprintEqual(item, right[index]))
  if (record(left) && record(right)) {
    const keys = Object.keys(left)
    return keys.length === Object.keys(right).length && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && blueprintEqual(left[key], right[key]))
  }
  return false
}

/** A server may add metadata; it must still echo the authored submitted values. */
export function blueprintContains(receipt: unknown, submitted: unknown): boolean {
  if (Array.isArray(submitted)) return Array.isArray(receipt) && receipt.length === submitted.length && submitted.every((item, index) => blueprintContains(receipt[index], item))
  if (record(submitted)) return record(receipt) && Object.keys(submitted).every(key => Object.prototype.hasOwnProperty.call(receipt, key) && blueprintContains(receipt[key], submitted[key]))
  return receipt === submitted
}

/** Array positions are reusable only while their saved identities remain aligned. */
export function blueprintIdentityAligned(before: TemplateBlueprint, after: TemplateBlueprint): boolean {
  return before.slides.length === after.slides.length && before.slides.every((slide, index) => {
    const next = after.slides[index]
    return slide.slide_index === next.slide_index && slide.elements.length === next.elements.length
      && slide.elements.every((element, at) => ['element_key', 'source_element_id', 'spec_id'].every(key =>
        (element as unknown as Record<string, unknown>)[key] === (next.elements[at] as unknown as Record<string, unknown>)[key]))
  })
}

/** Carry added receipt metadata into a newer local draft without replacing edits. */
export function addBlueprintMetadata(current: unknown, submitted: unknown, receipt: unknown): unknown {
  if (Array.isArray(current) && Array.isArray(submitted) && Array.isArray(receipt)) return current.map((item, index) => addBlueprintMetadata(item, submitted[index], receipt[index]))
  if (record(current) && record(submitted) && record(receipt)) {
    const result = { ...current }
    for (const key of Object.keys(receipt)) {
      if (!Object.prototype.hasOwnProperty.call(submitted, key)) {
        if (!Object.prototype.hasOwnProperty.call(current, key)) Object.defineProperty(result, key, { value: receipt[key], enumerable: true, writable: true, configurable: true })
        else if (record(current[key]) && record(receipt[key])) Object.defineProperty(result, key, { value: addBlueprintMetadata(current[key], {}, receipt[key]), enumerable: true, writable: true, configurable: true })
      } else if (Object.prototype.hasOwnProperty.call(current, key)) Object.defineProperty(result, key, { value: addBlueprintMetadata(current[key], submitted[key], receipt[key]), enumerable: true, writable: true, configurable: true })
    }
    return result
  }
  return current
}

export function patchBlueprintScope(scope: TemplateBlueprintScope | null | undefined, level: string): TemplateBlueprintScope | null {
  return level === 'inherit' ? null : { ...scope, level: level as TemplateBlueprintScope['level'] }
}
// Authored lines remain exact strings; blank lines are valid canonical array entries.
export const blueprintLines = (value: string) => value === '' ? [] : value.split('\n')
const cloneBlueprint = (value: TemplateBlueprint) => JSON.parse(JSON.stringify(value)) as TemplateBlueprint

export type BlueprintNavigation = MutableRefObject<((next: () => void) => void) | null>

export function SavedBlueprintEditor({ snapshot, latestSnapshot, isTargetCurrent, onConfirmed, onClose, onBusyChange, navigation }: {
  snapshot: TemplateSnapshot & { template_blueprint: TemplateBlueprint }
  latestSnapshot: TemplateSnapshot | null
  isTargetCurrent: () => boolean
  onConfirmed: (snapshot: TemplateSnapshot) => void
  onClose: () => void
  onBusyChange: (busy: boolean) => void
  navigation: BlueprintNavigation
}) {
  const account = useStudioLibraryAccount()
  const { updateTemplateBlueprint, getTemplate } = useTemplates()
  const [draft, setDraft] = useState(() => cloneBlueprint(snapshot.template_blueprint))
  const draftRef = useRef(draft); draftRef.current = draft
  const confirmed = useRef(snapshot.template_blueprint)
  const lastSubmitted = useRef<TemplateBlueprint | null>(null)
  const [scope, setScope] = useState<'deck' | 'slide' | 'element'>('deck')
  const [slideIndex, setSlideIndex] = useState(0)
  const [elementIndex, setElementIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const physicalBusy = useRef(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [needsRead, setNeedsRead] = useState(false)
  const recoveryRequired = useRef(false)
  const [leave, setLeave] = useState<{ next: () => void } | null>(null)
  const leaveRef = useRef(leave); leaveRef.current = leave
  const cancelButton = useRef<HTMLButtonElement | null>(null)
  const keepButton = useRef<HTMLButtonElement | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const focusFrame = useRef<number | null>(null)
  const focusOccurrence = useRef<object | null>(null)
  const mounted = useRef(true)
  const mountEpoch = useRef({})
  const renderedMount = mountEpoch.current
  const [, rerender] = useState(0)
  const request = useRef(0)
  const ready = !!account && account.ready
  const context = useRef({ owner: account?.owner, current: account?.current, ready, target: snapshot.id, epoch: {} })
  if (context.current.owner !== account?.owner || context.current.current !== account?.current || context.current.ready !== ready || context.current.target !== snapshot.id) {
    if (physicalBusy.current) recoveryRequired.current = true
    context.current = { owner: account?.owner, current: account?.current, ready, target: snapshot.id, epoch: {} }
    request.current += 1
  }
  const renderedContext = context.current
  const renderedRequest = request.current
  const selection = useRef({ scope, slideIndex, elementIndex, epoch: {} })
  if (selection.current.scope !== scope || selection.current.slideIndex !== slideIndex || selection.current.elementIndex !== elementIndex) selection.current = { scope, slideIndex, elementIndex, epoch: {} }
  const renderedSelection = selection.current
  const current = () => mounted.current && mountEpoch.current === renderedMount && context.current === renderedContext
    && EDITOR_ENABLED && !!account && libraryAccountIsCurrent(account) && isTargetCurrent()
  const canStart = () => current() && libraryAccountCanStart(account)
  const controlCurrent = () => canStart() && draftRef.current === draft && selection.current === renderedSelection
  const dirty = !blueprintEqual(draft, confirmed.current)

  useEffect(() => {
    mounted.current = true
    if (mountEpoch.current !== renderedMount) rerender(value => value + 1)
    heading.current?.focus()
    return () => { mounted.current = false; mountEpoch.current = {}; request.current += 1; if (focusFrame.current !== null) window.cancelAnimationFrame(focusFrame.current) }
  }, [])
  useEffect(() => {
    if (!recoveryRequired.current) { if (!ready) { setNotice(''); setError(''); setLeave(null) }; return }
    setNeedsRead(true)
    setNotice('Verification changed during a request. A dispatched save may still complete. Refresh the saved template before deciding whether to save again.')
    setError(''); setLeave(null)
  }, [ready])
  useEffect(() => {
    if (!latestSnapshot || !canStart() || physicalBusy.current) return
    if (!account || !isBlueprintReceipt(latestSnapshot, snapshot.id, account.owner)) {
      recoveryRequired.current = true; setNeedsRead(true)
      setError('The refreshed semantic Blueprint could not be verified. Your local draft is retained; refresh its saved state before saving.')
      return
    }
    const next = latestSnapshot.template_blueprint
    if (blueprintEqual(next, confirmed.current)) return
    if (!blueprintIdentityAligned(confirmed.current, next) || !blueprintContains(next, confirmed.current)) {
      recoveryRequired.current = true; setNeedsRead(true)
      setError('The refreshed saved Blueprint has changed. Your local draft is retained; cancel editing and reopen the saved template to review its current values before saving.')
      return
    }
    const merged = addBlueprintMetadata(draftRef.current, confirmed.current, next) as TemplateBlueprint
    confirmed.current = cloneBlueprint(next); draftRef.current = merged; setDraft(merged)
  }, [latestSnapshot, ready, busy])
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  useEffect(() => {
    const guarded = (next: () => void) => {
      if (!canStart() || physicalBusy.current) return
      if (dirty) { const decision = { next }; leaveRef.current = decision; setLeave(decision) }
      else { onClose(); next() }
    }
    navigation.current = guarded
    return () => { if (navigation.current === guarded) navigation.current = null }
  })
  useEffect(() => { if (leave && canStart()) keepButton.current?.focus() }, [leave])

  // Native focus/input/keys may scroll only the caret. Once that settles,
  // reveal the whole current control/ring using the existing scroll ancestors.
  function revealFocusedControl(event: SyntheticEvent<HTMLElement>) {
    const target = event.target
    const host = event.currentTarget
    if (!controlCurrent() || request.current !== renderedRequest || !(target instanceof HTMLElement) || !target.matches('button,input,textarea,select') || !host.contains(target) || document.activeElement !== target) return
    if (focusFrame.current !== null) window.cancelAnimationFrame(focusFrame.current)
    const occurrence = event.type === 'focus' ? {} : focusOccurrence.current
    if (!occurrence) return
    if (event.type === 'focus') focusOccurrence.current = occurrence
    const focusRequest = request.current
    // Typing may replace the draft after this current focus event is admitted.
    // Revealing this same field changes no values; all other authorities retire it.
    const stillFocused = () => canStart() && selection.current === renderedSelection && request.current === focusRequest
      && focusOccurrence.current === occurrence && target.isConnected && host.isConnected && host.contains(target) && document.activeElement === target
    focusFrame.current = window.requestAnimationFrame(() => {
      if (!stillFocused()) { focusFrame.current = null; return }
      focusFrame.current = window.requestAnimationFrame(() => {
        focusFrame.current = null
        if (stillFocused()) target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      })
    })
  }

  function change(next: TemplateBlueprint) {
    if (!controlCurrent()) return
    draftRef.current = next; setDraft(next); setError(''); setLeave(null)
  }
  function patchDeck(patch: Partial<TemplateBlueprint>) { change({ ...draft, ...patch }) }
  function patchSlide(patch: Record<string, unknown>) { change({ ...draft, slides: draft.slides.map((item, index) => index === slideIndex ? { ...item, ...patch } : item) }) }
  function patchElement(patch: Record<string, unknown>) { change({ ...draft, slides: draft.slides.map((item, index) => index === slideIndex ? { ...item, elements: item.elements.map((element, at) => at === elementIndex ? { ...element, ...patch } : element) } : item) }) }
  const slide = draft.slides[slideIndex]
  const element = slide?.elements[elementIndex]
  const image = element?.atom_contract?.kind === 'image' || !!element?.atom_type?.toUpperCase().includes('IMAGE')
  const dataBearing = !!element?.atom_contract && ['metric', 'chart', 'table', 'kanban', 'diagram'].includes(element.atom_contract.kind)
  const locked = (element?.lock_policy ?? (element?.fixedness === 'constant' || element?.fixedness === 'locked_media' ? 'lock_exact' : 'regenerate')) === 'lock_exact'
  function patchContract(patch: Record<string, unknown>) { if (element) patchElement({ atom_contract: { ...(element.atom_contract ?? { kind: 'unknown' }), ...patch } }) }
  function patchScopeLevel(level: string) {
    if (scope === 'deck') patchDeck({ abstraction_scope: patchBlueprintScope(draft.abstraction_scope, level) })
    else if (scope === 'slide' && slide) patchSlide({ abstraction_scope: patchBlueprintScope(slide.abstraction_scope, level) })
    else if (element) patchElement({ abstraction_scope: patchBlueprintScope(element.abstraction_scope, level) })
  }
  const activeScope = scope === 'deck' ? draft.abstraction_scope : scope === 'slide' ? slide?.abstraction_scope : element?.abstraction_scope
  function patchScopeLabel(label: string) {
    const next = { ...activeScope, level: activeScope?.level ?? 'period', label }
    if (scope === 'deck') patchDeck({ abstraction_scope: next })
    else if (scope === 'slide' && slide) patchSlide({ abstraction_scope: next })
    else if (element) patchElement({ abstraction_scope: next })
  }
  function select(nextScope: typeof scope, nextSlide = slideIndex, nextElement = elementIndex) {
    if (!controlCurrent() || (nextScope === scope && nextSlide === slideIndex && nextElement === elementIndex)) return
    selection.current = { scope: nextScope, slideIndex: nextSlide, elementIndex: nextElement, epoch: {} }
    setScope(nextScope); setSlideIndex(nextSlide); setElementIndex(nextElement); setLeave(null)
  }
  function finishRequest() {
    physicalBusy.current = false
    // Busy describes this physical request; it may settle after its authority retired.
    if (mounted.current && account && libraryAccountIsCurrent(account) && isTargetCurrent()) { setBusy(false); onBusyChange(false) }
  }
  async function readBack(id: string, operationCurrent: () => boolean, submitted?: TemplateBlueprint) {
    if (!operationCurrent()) return
    const baseline = confirmed.current
    const result = await getTemplate(id)
    if (!operationCurrent()) return
    if (!account || !isBlueprintReceipt(result, id, account.owner)) {
      recoveryRequired.current = true; setNeedsRead(true)
      setError(submitted ? 'The update was acknowledged, but the saved template could not be refreshed. Retry the read without sending another save.' : 'The saved template could not be verified. Your local draft is still here; retry the read before saving.')
      return
    }
    onConfirmed(result)
    if (!blueprintIdentityAligned(baseline, result.template_blueprint)) {
      recoveryRequired.current = true; setNeedsRead(true)
      setError('The saved Blueprint structure has changed. Your local draft is retained; cancel editing and reopen the saved template before saving.')
      return
    }
    if (!blueprintContains(result.template_blueprint, baseline) && !(lastSubmitted.current && blueprintContains(result.template_blueprint, lastSubmitted.current))) {
      recoveryRequired.current = true; setNeedsRead(true)
      setError('The saved Blueprint values have changed. Your local draft is retained; cancel editing and reopen the saved template to review its current values before saving.')
      return
    }
    const next = addBlueprintMetadata(draftRef.current, baseline, result.template_blueprint) as TemplateBlueprint
    draftRef.current = next; setDraft(next)
    confirmed.current = cloneBlueprint(result.template_blueprint)
    lastSubmitted.current = null; recoveryRequired.current = false; setNeedsRead(false); setError('')
    setNotice(submitted ? blueprintContains(result.template_blueprint, submitted) ? 'Update acknowledged and saved template refreshed. Review its recorded readiness; newer local changes remain in your draft.' : 'Update acknowledged and saved template refreshed, but its returned values differ from your submitted draft. Your local draft is retained for review.' : 'Saved template refreshed. Your local draft is retained; compare its changes before explicitly saving.')
  }
  async function save() {
    if (!controlCurrent() || physicalBusy.current || !dirty || recoveryRequired.current || !isEditableBlueprint(draft)) return
    const id = snapshot.id
    const submitted = cloneBlueprint(draft)
    lastSubmitted.current = submitted
    const token = ++request.current
    const operationCurrent = () => canStart() && token === request.current
    physicalBusy.current = true; setBusy(true); onBusyChange(true); setError(''); setNotice(''); setLeave(null)
    try {
      const result = await updateTemplateBlueprint(id, submitted)
      if (!operationCurrent()) return
      if (!account || !isBlueprintReceipt(result, id, account.owner)) {
        recoveryRequired.current = true; setNeedsRead(true)
        setError('The save was not confirmed for this template. Your draft is retained. Refresh its saved state before an explicit retry; a dispatched write may still have applied.')
        return
      }
      lastSubmitted.current = null
      onConfirmed(result)
      if (!blueprintContains(result.template_blueprint, submitted)) {
        recoveryRequired.current = true; setNeedsRead(true)
        setNotice('An update response was received for this template, but its values differ from your submitted draft. Your draft is retained. Refresh the saved state before deciding what to save.')
        return
      }
      const next = addBlueprintMetadata(draftRef.current, submitted, result.template_blueprint) as TemplateBlueprint
      draftRef.current = next; setDraft(next); confirmed.current = cloneBlueprint(result.template_blueprint)
      setNotice('Update acknowledged for this template. Checking its saved state…')
      await readBack(id, operationCurrent, submitted)
    } catch {
      if (!operationCurrent()) return
      recoveryRequired.current = true; setNeedsRead(true); setError('The save could not be confirmed. Your draft is retained. Refresh the saved state before an explicit retry.')
    } finally { finishRequest() }
  }
  async function retryRead() {
    if (!controlCurrent() || physicalBusy.current) return
    const id = snapshot.id; const token = ++request.current
    const operationCurrent = () => canStart() && token === request.current
    physicalBusy.current = true; setBusy(true); onBusyChange(true); setError(''); setLeave(null)
    try { await readBack(id, operationCurrent) }
    catch { if (operationCurrent()) { recoveryRequired.current = true; setNeedsRead(true); setError('The saved template could not be refreshed. Your local draft is retained.') } }
    finally { finishRequest() }
  }

  const field = (label: string, value: string | null | undefined, update: (value: string) => void) => <label className="sl-field">{label}<textarea rows={2} value={value ?? ''} onChange={event => update(event.target.value)} /></label>
  return <section className="sl-saved-editor" aria-label="Saved Blueprint intent editor" onFocusCapture={revealFocusedControl} onInputCapture={revealFocusedControl} onKeyUpCapture={revealFocusedControl}>
    <div className="sl-section-line"><h3 ref={heading} tabIndex={-1}>Customize template</h3><span className="sl-badge">{needsRead ? 'Read verification needed' : busy ? 'Checking changes' : dirty ? 'Unsaved changes' : 'Saved values'}</span></div>
    <p className="sl-helper">Edit the intent of this saved Blueprint. Source layout, media and metadata stay in its contract; generation still requires verified readiness.</p>
    {!ready && <LibraryNotice>Verifying your account… This private draft is retained. Editing and connected actions resume after verification.</LibraryNotice>}
    {notice && <LibraryNotice>{notice}</LibraryNotice>}{error && <LibraryNotice error>{error}</LibraryNotice>}
    {leave && <div className="sl-confirm" role="alert"><span>Discard unsaved Blueprint changes?</span><button type="button" disabled={!ready || busy} onClick={() => { if (!controlCurrent() || physicalBusy.current || leaveRef.current !== leave) return; const next = leave.next; onClose(); next() }}>Discard changes</button><button ref={keepButton} type="button" disabled={!ready} onClick={() => { if (!controlCurrent() || leaveRef.current !== leave) return; leaveRef.current = null; setLeave(null); cancelButton.current?.focus() }}>Keep editing</button></div>}
    {ready && <fieldset className="sl-editor-fields">
      <legend className="sr-only">Saved Blueprint intent</legend>
      <div className="sl-segment" aria-label="Blueprint edit scope">{(['deck', 'slide', 'element'] as const).map(value => <button key={value} type="button" aria-pressed={scope === value} onClick={() => select(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
      {scope !== 'deck' && <label className="sl-field">Story moment<select value={slideIndex} disabled={!draft.slides.length} onChange={event => select(scope, Number(event.target.value), 0)}>{draft.slides.map((item, index) => <option key={index} value={index}>{index + 1} · {item.slide_title || item.purpose || `Slide ${item.slide_index}`}</option>)}</select></label>}
      {scope === 'element' && slide && <label className="sl-field">Blueprint element<select value={elementIndex} disabled={!slide.elements.length} onChange={event => select(scope, slideIndex, Number(event.target.value))}>{slide.elements.map((item, index) => <option key={index} value={index}>{item.semantic_role || item.purpose || item.element_key}</option>)}</select></label>}
      {(scope === 'deck' || scope === 'slide' && slide || scope === 'element' && element) && <><label className="sl-field">Abstraction scope<select value={activeScope?.level ?? 'inherit'} onChange={event => patchScopeLevel(event.target.value)}><option value="inherit">Inherit / no explicit scope</option>{scopes.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>{activeScope && <label className="sl-field">Scope label<input value={activeScope.label ?? ''} onChange={event => patchScopeLabel(event.target.value)} /></label>}</>}
      {scope === 'deck' && <>{field('Deck purpose', draft.deck_purpose, value => patchDeck({ deck_purpose: value }))}{field('Deck reuse instruction', draft.deck_reuse_instruction, value => patchDeck({ deck_reuse_instruction: value }))}</>}
      {scope === 'slide' && (slide ? <>{field('Slide purpose', slide.purpose, value => patchSlide({ purpose: value }))}{field('Storyline', slide.storyline, value => patchSlide({ storyline: value }))}{field('Proof goal', slide.proof_goal, value => patchSlide({ proof_goal: value }))}{field('Title intent', slide.title_intent, value => patchSlide({ title_intent: value }))}{field('Subtitle intent', slide.subtitle_intent, value => patchSlide({ subtitle_intent: value }))}{field('Slide reuse instruction', slide.reuse_instruction, value => patchSlide({ reuse_instruction: value }))}<label className="sl-field">Required inputs · one per line<textarea rows={3} value={slide.required_inputs?.join('\n') ?? ''} onChange={event => patchSlide({ required_inputs: blueprintLines(event.target.value) })} /></label><label className="sl-field">Population policy<select value={slide.population_policy} onChange={event => patchSlide({ population_policy: event.target.value })}><option value="strict">Strict · recorded requirements</option><option value="flexible">Flexible</option></select></label></> : <p className="sl-helper">This Blueprint has no slide entries. Its deck intent remains editable.</p>)}
      {scope === 'element' && (element ? <>{field('Element purpose', element.purpose, value => patchElement({ purpose: value }))}{field('Storyline link', element.storyline_link, value => patchElement({ storyline_link: value }))}<label className="sl-field">Content policy<select value={element.lock_policy ?? ''} onChange={event => { const value = event.target.value; if (value) patchElement({ lock_policy: value, fixedness: value === 'lock_exact' ? image ? 'locked_media' : 'constant' : 'variable' }) }}><option value="" disabled>No explicit policy · {element.fixedness}</option><option value="lock_exact">Keep exact content{image ? ' / media' : ''}</option><option value="regenerate">Regenerate for new content</option></select></label><p className="sl-helper">{locked ? 'Exact content keeps its existing data rules; they are inactive for regeneration.' : 'Regeneration uses this element’s recorded intent and data rules.'} Visual/session overrides remain available in Studio.</p>{dataBearing && <><label className="sl-field">Missing data policy<select disabled={locked} value={element.atom_contract?.missing_data_policy ?? ''} onChange={event => patchContract({ missing_data_policy: event.target.value || null })}><option value="">No explicit policy</option><option value="ask_user">Ask user</option><option value="assume_and_continue">Assume and continue</option><option value="reuse_prior_as_placeholder">Reuse prior as placeholder</option></select></label><label className="sl-field">Required data · one per line<textarea rows={3} disabled={locked} value={element.atom_contract?.required_data?.join('\n') ?? ''} onChange={event => patchContract({ required_data: blueprintLines(event.target.value) })} /></label></>}{image && field('Image abstraction instruction', element.atom_contract?.abstraction_instruction, value => patchContract({ abstraction_instruction: value }))}</> : <p className="sl-helper">This story moment has no element entries. Deck and slide intent remain available.</p>)}
    </fieldset>}
    <div className="sl-actions"><button type="button" className="sl-primary" disabled={!ready || busy || !dirty || needsRead} onClick={() => void save()}>{busy ? 'Checking changes…' : 'Save Blueprint changes'}</button><button ref={cancelButton} type="button" className="sl-button" disabled={!ready || busy} onClick={() => { if (controlCurrent()) navigation.current?.(() => {}) }}>Cancel</button>{needsRead && <button type="button" className="sl-button" disabled={!ready || busy} onClick={() => void retryRead()}>Refresh saved template</button>}</div>
    <p className="sl-helper">{needsRead ? 'Read recovery sends no PATCH. Save again only after reviewing the current saved state.' : dirty ? 'Only an explicit Save sends this complete Blueprint to its existing template.' : 'Generation readiness comes from the recorded template, not from editing.'} A dispatched server write cannot be undone here.</p>
  </section>
}
