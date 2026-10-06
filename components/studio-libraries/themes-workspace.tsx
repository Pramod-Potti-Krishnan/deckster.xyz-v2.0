"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Copy, Palette, RefreshCw, RotateCcw, Save, Star, Trash2 } from 'lucide-react'
import { useThemeProfiles, type SavedThemeProfile } from '@/hooks/use-theme-profiles'
import { FALLBACK_THEME_PRESETS, isCanonicalThemePresetId, isValidThemeHex, normalizeThemePresetId, selectCanonicalThemePreset, type BuildThemeSelection } from '@/lib/theme-builder'
import { FittedLibraryStage, LibraryLoading, LibraryNotice, LibrarySearch, LibraryWorkspace, MetadataDisclosure, ReadValue, libraryDate, type LibraryMode } from './library-controls'
import { THEME_TOKENS, ThemePreview, ThemeSwatches, themePreviewPalette, type ThemeSpecimen } from './theme-preview'
import { StudioWorkflowAction } from './studio-workflow-action'
import { libraryAccountCanStart, libraryAccountIsCurrent, useStudioLibraryAccount } from './library-account-boundary'
import { keepStudioScrollFocusVisible } from '@/lib/studio-inspector-focus'
import './themes-fidelity.css'

const INITIAL_THEME: BuildThemeSelection = { mode: 'preset', preset_id: 'minimal' }
const CUSTOM_FIELDS = [['primary_hex', 'Primary / brand'], ['secondary_hex', 'Secondary'], ['tertiary_hex', 'Tertiary'], ['neutral_hex', 'Neutral']] as const

type ThemeDeleteFeedback = { acknowledged: boolean; message: string; owner: string | null; id: string | null; name?: string }
type ThemeDeleteActivity = { phase: 'delete' | 'verify'; context: object; target: object; theme: SavedThemeProfile; acknowledged: boolean }

function revealStudioThemeColor(target: EventTarget | null, group: HTMLElement | null, invalid: boolean) {
  // The shared helper skips a complete group when it exceeds viewport clearance.
  if (invalid && group) keepStudioScrollFocusVisible(group, '.sl-form-scroll')
  keepStudioScrollFocusVisible(target, '.sl-form-scroll')
}

function ColorField({ label, value, fallback, onChange, onReset }: {
  label: string; value?: string; fallback: string; onChange: (value: string) => void; onReset: () => void
}) {
  const warningId = useId()
  const colorRef = useRef<HTMLDivElement | null>(null)
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const invalid = value !== undefined && !isValidThemeHex(value)
  useLayoutEffect(() => {
    if (!studioShell) return
    const revealActive = () => {
      const active = document.activeElement
      if (active && colorRef.current?.contains(active)) revealStudioThemeColor(active, colorRef.current, invalid)
    }
    revealActive()
    // The warning or Reset control can resize the form while this field owns focus.
    const frame = requestAnimationFrame(revealActive)
    return () => cancelAnimationFrame(frame)
  }, [studioShell, value, invalid])
  return <div ref={studioShell ? colorRef : undefined} onFocusCapture={studioShell ? event => revealStudioThemeColor(event.target, event.currentTarget, invalid) : undefined} data-studio-theme-color-group={studioShell ? label : undefined} className="sl-color-field"><div><span>{label}</span>{value === undefined ? <small>Theme-linked</small> : <button type="button" onClick={onReset} aria-label={`Reset ${label} to theme`}><RotateCcw size={11} />Reset</button>}</div>
    <label><input type="color" aria-label={`${label} color`} value={isValidThemeHex(value) ? value : fallback} onChange={event => onChange(event.target.value)} /><input aria-label={`${label} hex value`} value={value ?? ''} placeholder={fallback} onChange={event => onChange(event.target.value)} aria-invalid={invalid} aria-describedby={studioShell && invalid ? warningId : undefined} data-studio-theme-color-hex={studioShell ? label : undefined} spellCheck={false} /></label>
    {invalid && <small id={studioShell ? warningId : undefined} data-studio-theme-color-warning={studioShell ? label : undefined} role={studioShell ? 'alert' : undefined} className="sl-field-error">Use a six-digit hex color, such as #287F85.</small>}
  </div>
}

export function ThemesWorkspace() {
  const { listThemes, saveTheme, setStandardTheme, clearStandardTheme, deleteTheme } = useThemeProfiles()
  const account = useStudioLibraryAccount()
  const accountScope = useRef(account)
  accountScope.current = account
  // A null context preserves non-standalone consumers. Live readiness controls starts.
  const accountReady = account === null || account.ready
  const accountIsCurrent = (scope = accountScope.current) => scope === null || libraryAccountIsCurrent(scope)
  const accountCanStart = () => accountScope.current === null || libraryAccountCanStart(accountScope.current)
  const [mode, setMode] = useState<LibraryMode>('create')
  const [themes, setThemes] = useState<SavedThemeProfile[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'standard'>('all')
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [operation, setOperation] = useState<'save' | 'standard' | 'delete' | 'verify-delete' | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<BuildThemeSelection>({ ...INITIAL_THEME })
  const [dirty, setDirty] = useState(false)
  const [specimen, setSpecimen] = useState<ThemeSpecimen>('title')
  const [compareBase, setCompareBase] = useState(false)
  const [replacePrompt, setReplacePrompt] = useState<SavedThemeProfile | 'blank' | null>(null)
  const mounted = useRef(true)
  const busy = useRef(false)
  const listRequest = useRef(0)
  const libraryRequested = useRef(false)
  const operationRequest = useRef(0)
  const retiredOperation = useRef(false)
  const currentSelection = useRef(selectedId)
  currentSelection.current = selectedId
  const draftKey = JSON.stringify([name, description, draft])
  const currentDraft = useRef(draftKey)
  currentDraft.current = draftKey

  const [deletePrompt, setDeletePrompt] = useState<{ theme: SavedThemeProfile; lifetime: object } | null>(null)
  const [deleteFeedback, setDeleteFeedback] = useState<ThemeDeleteFeedback | null>(null)
  const deleteButton = useRef<HTMLButtonElement | null>(null)
  const keepButton = useRef<HTMLButtonElement | null>(null)
  const deleteMounted = useRef(false)
  const deleteActivity = useRef<ThemeDeleteActivity | null>(null)
  const interruptedDelete = useRef<boolean | null>(null)
  const deleteContext = useRef({ owner: account?.owner ?? null, ready: accountReady, lifetime: {} })
  if (deleteContext.current.owner !== (account?.owner ?? null) || deleteContext.current.ready !== accountReady) {
    deleteContext.current = { owner: account?.owner ?? null, ready: accountReady, lifetime: {} }
  }
  const contextLifetime = deleteContext.current.lifetime
  const deleteTarget = useRef({ context: contextLifetime, mode, selectedId, loading, lifetime: {} })
  if (deleteTarget.current.context !== contextLifetime || deleteTarget.current.mode !== mode || deleteTarget.current.selectedId !== selectedId || deleteTarget.current.loading !== loading) {
    deleteTarget.current = { context: contextLifetime, mode, selectedId, loading, lifetime: {} }
  }
  const targetLifetime = deleteTarget.current.lifetime
  const draftResetScope = useRef({ target: targetLifetime, draft: draftKey, operation, lifetime: {} })
  if (draftResetScope.current.target !== targetLifetime || draftResetScope.current.draft !== draftKey || draftResetScope.current.operation !== operation) {
    draftResetScope.current = { target: targetLifetime, draft: draftKey, operation, lifetime: {} }
  }
  const draftResetLifetime = draftResetScope.current.lifetime
  const currentDeletePrompt = useRef(deletePrompt)
  currentDeletePrompt.current = deletePrompt?.lifetime === targetLifetime ? deletePrompt : null
  const currentDeleteFeedback = useRef(deleteFeedback)
  currentDeleteFeedback.current = deleteFeedback
  const deleteCanStart = (lifetime: object) => deleteMounted.current && mounted.current && accountCanStart()
    && deleteTarget.current.lifetime === lifetime && deleteTarget.current.mode === 'library' && !deleteTarget.current.loading
  const interruptedDeleteMessage = (acknowledged: boolean) => acknowledged
    ? 'Delete was acknowledged, but its library check was interrupted. Refresh the library to verify its current contents.'
    : 'The delete request may have reached the service before it was interrupted. Refresh the library to check before starting another deletion.'
  const changeLibraryMode = (next: LibraryMode) => {
    if (deleteTarget.current.mode !== next) deleteTarget.current = { ...deleteTarget.current, mode: next, lifetime: {} }
    setMode(next)
  }

  useLayoutEffect(() => {
    deleteMounted.current = true
    if (interruptedDelete.current !== null) {
      setDeleteFeedback({ acknowledged: interruptedDelete.current, message: interruptedDeleteMessage(interruptedDelete.current), owner: deleteContext.current.owner, id: null })
      interruptedDelete.current = null
    }
    return () => {
      deleteMounted.current = false
      if (deleteActivity.current) interruptedDelete.current = deleteActivity.current.acknowledged
      deleteActivity.current = null
    }
  }, [])
  useLayoutEffect(() => {
    if (deletePrompt && deletePrompt.lifetime !== targetLifetime) setDeletePrompt(null)
    const activity = deleteActivity.current
    if (!activity || (activity.context === contextLifetime && (activity.phase === 'verify' || activity.target === targetLifetime))) return
    deleteActivity.current = null
    listRequest.current += 1
    busy.current = false; setOperation(null); setLoading(false)
    setDeleteFeedback({ acknowledged: activity.acknowledged, message: interruptedDeleteMessage(activity.acknowledged), owner: deleteContext.current.owner, id: null })
  }, [contextLifetime, targetLifetime, deletePrompt])
  useLayoutEffect(() => {
    if (!deletePrompt || !deleteCanStart(deletePrompt.lifetime)) return
    keepButton.current?.focus()
    keepStudioScrollFocusVisible(keepButton.current, '.sl-preview-panel')
  }, [deletePrompt])

  const refresh = useCallback(async () => {
    if (!mounted.current || !accountCanStart() || deleteActivity.current) return
    const requestAccount = accountScope.current
    const request = ++listRequest.current
    libraryRequested.current = true
    if (!deleteTarget.current.loading) deleteTarget.current = { ...deleteTarget.current, loading: true, lifetime: {} }
    setLoading(true)
    let response
    try { response = await listThemes() } catch { response = null }
    if (!mounted.current || request !== listRequest.current || !accountIsCurrent(requestAccount)) return
    setLoading(false)
    if (!response) { setListError('Your themes could not be loaded. Try refreshing the library.'); return }
    setListError('')
    setThemes(response.themes)
    setSelectedId(current => response.themes.some(theme => theme.id === current) ? current : response.themes[0]?.id ?? null)
  }, [listThemes])

  useEffect(() => {
    mounted.current = true
    if (retiredOperation.current) {
      retiredOperation.current = false
      setOperation(null)
      setActionError('The previous theme operation was interrupted locally. Refresh the library to check its result before retrying.')
    }
    void refresh()
    return () => {
      mounted.current = false
      listRequest.current += 1
      libraryRequested.current = false
      operationRequest.current += 1
      retiredOperation.current = busy.current
      busy.current = false
    }
  }, [refresh])
  useEffect(() => {
    // Initial same-owner verification does not tear down the leaf or repeat loaded reads.
    if (accountReady && !libraryRequested.current) void refresh()
  }, [accountReady, refresh])
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  const selected = themes?.find(theme => theme.id === selectedId)
  const standard = themes?.find(theme => theme.is_standard)
  const activeSelection = mode === 'create' ? draft : selected?.theme_payload
  const palette = themePreviewPalette(draft)
  const filtered = themes?.filter(theme => `${theme.name} ${theme.description || ''}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || theme.is_standard)) ?? []
  const hasFilters = Boolean(query || filter !== 'all')
  const unknownBase = Boolean(activeSelection?.preset_id && !isCanonicalThemePresetId(normalizeThemePresetId(activeSelection.preset_id)))
  const invalidColors = Object.values(draft.color_overrides || {}).some(value => !isValidThemeHex(value)) || (draft.mode === 'custom' && (!isValidThemeHex(draft.primary_hex) || CUSTOM_FIELDS.slice(1).some(([key]) => draft[key] !== undefined && !isValidThemeHex(draft[key]))))
  const duplicateName = themes?.some(theme => theme.name.toLowerCase() === name.trim().toLowerCase())
  const canSave = Boolean(name.trim() && draft.mode !== 'auto' && !invalidColors && !duplicateName && !operation)
  const patchDraft = (next: BuildThemeSelection) => { if (!mounted.current || !accountIsCurrent()) return; setDraft(next); setDirty(true); setActionError(''); setNotice(''); setCompareBase(false) }

  const loadDraft = (source: SavedThemeProfile | 'blank') => {
    // A previously opened confirmation can outlive the click that starts save.
    if (!mounted.current || !accountCanStart() || busy.current) return
    if (source === 'blank') { setName(''); setDescription(''); setDraft({ ...INITIAL_THEME }); setDirty(false) }
    else { setName(`${source.name} copy`); setDescription(source.description ?? ''); setDraft({ ...source.theme_payload, color_overrides: source.theme_payload.color_overrides ? { ...source.theme_payload.color_overrides } : undefined }); setDirty(true) }
    changeLibraryMode('create'); setCompareBase(false); setReplacePrompt(null); setActionError(''); setNotice('')
  }
  const requestDraft = (source: SavedThemeProfile | 'blank') => { if (!mounted.current || !accountCanStart() || busy.current) return; if (dirty) setReplacePrompt(source); else loadDraft(source) }

  const save = async () => {
    if (!mounted.current || !accountCanStart() || !canSave || busy.current || draftKey !== currentDraft.current) return
    const requestAccount = accountScope.current
    const request = ++operationRequest.current
    listRequest.current += 1; setLoading(false)
    busy.current = true; setOperation('save'); setActionError(''); setNotice('')
    try {
      const result = await saveTheme({ name: name.trim(), description: description.trim(), theme: draft, setStandard: false })
      if (!mounted.current || request !== operationRequest.current || !accountIsCurrent(requestAccount)) return
      if (!result?.id || !result.theme_payload) { setActionError('The save was not confirmed. Your draft is still here. Refresh the library before retrying to check whether it was saved.'); return }
      setThemes(current => [...(current ?? []).filter(theme => theme.id !== result.id), result]); setSelectedId(result.id); setDirty(false); setMode('library')
      setNotice(`“${result.name}” was saved to your library. Choose it in Studio when you are ready to use it.`)
    } catch {
      if (mounted.current && request === operationRequest.current && accountIsCurrent(requestAccount)) setActionError('The save was not confirmed. Your draft is still here. Refresh the library before retrying to check whether it was saved.')
    } finally {
      if (mounted.current && request === operationRequest.current && accountIsCurrent(requestAccount)) {
        busy.current = false
        if (mounted.current) setOperation(null)
      }
    }
  }

  const changeStandard = async () => {
    if (!mounted.current || !accountCanStart() || !selected || selected.id !== currentSelection.current || busy.current) return
    const requestAccount = accountScope.current
    const request = ++operationRequest.current
    listRequest.current += 1; setLoading(false)
    busy.current = true; setOperation('standard'); setActionError(''); setNotice('')
    const wasStandard = Boolean(selected.is_standard)
    try {
      const result = wasStandard ? await clearStandardTheme() : await setStandardTheme(selected.id)
      if (!mounted.current || request !== operationRequest.current || !accountIsCurrent(requestAccount)) return
      if (wasStandard) {
        if (result !== true) { setActionError('The standard change was not confirmed. Refresh the library to check the current standard before retrying.'); return }
        setThemes(current => current?.map(theme => ({ ...theme, is_standard: false })) ?? null)
        setNotice('Standard cleared. New presentations will use the session default.')
      } else {
        if (!result || typeof result === 'boolean' || result.id !== selected.id || result.is_standard !== true || !result.theme_payload) { setActionError('The standard change was not confirmed. Refresh the library to check the current standard before retrying.'); return }
        setThemes(current => current?.map(theme => theme.id === result.id ? result : { ...theme, is_standard: false }) ?? null)
        setNotice(`“${result.name}” is now the standard for new presentations. Existing decks are unchanged.`)
      }
    } catch {
      if (mounted.current && request === operationRequest.current && accountIsCurrent(requestAccount)) setActionError('The standard change was not confirmed. Refresh the library to check the current standard before retrying.')
    } finally {
      if (mounted.current && request === operationRequest.current && accountIsCurrent(requestAccount)) {
        busy.current = false
        if (mounted.current) setOperation(null)
      }
    }
  }

  const verifyDeletion = async (theme: SavedThemeProfile, acknowledged: boolean) => {
    if (!deleteMounted.current || !mounted.current || !accountCanStart() || busy.current) return
    const activity: ThemeDeleteActivity = { phase: 'verify', context: deleteContext.current.lifetime, target: deleteTarget.current.lifetime, theme, acknowledged }
    const requestAccount = accountScope.current
    const request = ++listRequest.current
    deleteActivity.current = activity
    libraryRequested.current = true
    busy.current = true; setOperation('verify-delete'); setLoading(true)
    let response
    try { response = await listThemes() } catch { response = null }
    if (!deleteMounted.current || !mounted.current || deleteActivity.current !== activity || activity.context !== deleteContext.current.lifetime || !accountIsCurrent(requestAccount) || !accountCanStart() || request !== listRequest.current) return
    deleteActivity.current = null
    busy.current = false; setOperation(null); setLoading(false)
    if (!response || !Array.isArray(response.themes)) {
      setListError('Your themes could not be loaded. Try refreshing the library.')
      setDeleteFeedback({ acknowledged, owner: deleteContext.current.owner, id: theme.id || null, name: theme.name,
        message: acknowledged ? 'Delete was acknowledged. The library could not be refreshed; refresh to verify its current contents.' : 'Delete was not confirmed. The library could not be refreshed; check its current contents before trying another deletion.' })
      return
    }
    setListError(''); setThemes(response.themes)
    setSelectedId(current => response.themes.some(item => item.id === current) ? current : response.themes[0]?.id ?? null)
    const stillPresent = response.themes.some(item => item.id === theme.id)
    setDeleteFeedback({ acknowledged, owner: deleteContext.current.owner, id: theme.id || null, name: theme.name,
      message: !theme.id ? 'Library refreshed. Check the current list before starting a new deletion; the interrupted request has no confirmed target result.' : acknowledged ? stillPresent ? 'Delete was acknowledged, but this theme still appears in the refreshed library. Refresh to recheck before starting another deletion.' : `“${theme.name}” was deleted. The refreshed library no longer contains it.`
        : stillPresent ? 'Delete was not confirmed. This theme is still in the refreshed library; start a new confirmation if you want to try again.' : 'Delete was not confirmed, but this theme is absent from the refreshed library.' })
  }
  const requestDelete = () => {
    if (!deleteCanStart(targetLifetime) || !selected || selected.id !== currentSelection.current || busy.current) return
    setDeletePrompt({ theme: selected, lifetime: targetLifetime })
  }
  const keepTheme = () => {
    if (!deleteCanStart(targetLifetime) || currentDeletePrompt.current !== deletePrompt || busy.current) return
    currentDeletePrompt.current = null; setDeletePrompt(null)
    deleteButton.current?.focus()
    keepStudioScrollFocusVisible(deleteButton.current, '.sl-preview-panel')
  }
  const confirmDelete = async () => {
    if (!deletePrompt || currentDeletePrompt.current !== deletePrompt || !deleteCanStart(deletePrompt.lifetime) || deletePrompt.lifetime !== targetLifetime || deletePrompt.theme.id !== currentSelection.current || busy.current) return
    const theme = deletePrompt.theme
    const requestAccount = accountScope.current
    const activity: ThemeDeleteActivity = { phase: 'delete', context: contextLifetime, target: targetLifetime, theme, acknowledged: false }
    currentDeletePrompt.current = null; setDeletePrompt(null)
    listRequest.current += 1
    deleteActivity.current = activity
    busy.current = true; setOperation('delete'); setDeleteFeedback(null)
    let acknowledged = false
    try { acknowledged = await deleteTheme(theme.id) } catch { /* The unchanged hook normally returns false on refusal. */ }
    if (!deleteMounted.current || !mounted.current || deleteActivity.current !== activity || !deleteCanStart(activity.target) || !accountIsCurrent(requestAccount) || activity.context !== deleteContext.current.lifetime) return
    deleteActivity.current = null
    busy.current = false; setOperation(null)
    if (acknowledged !== true) {
      setDeleteFeedback({ acknowledged: false, owner: deleteContext.current.owner, id: theme.id, name: theme.name, message: 'Delete was not confirmed. Your selected theme and draft are still here. Refresh the library to check before starting another deletion.' })
      return
    }
    setThemes(current => current?.filter(item => item.id !== theme.id) ?? null)
    setSelectedId(current => current === theme.id ? null : current)
    setDeleteFeedback({ acknowledged: true, owner: deleteContext.current.owner, id: theme.id, name: theme.name, message: `Delete was acknowledged for “${theme.name}”. Checking the library…` })
    await verifyDeletion(theme, true)
  }
  const retryDeleteRead = () => {
    if (!deleteMounted.current || !mounted.current || !accountCanStart() || deleteTarget.current.lifetime !== targetLifetime || deleteTarget.current.loading || !deleteFeedback || currentDeleteFeedback.current !== deleteFeedback || deleteFeedback.owner !== deleteContext.current.owner || busy.current) return
    // Recovery is always a read, including an uncertain or acknowledged write.
    const theme = themes?.find(item => item.id === deleteFeedback.id)
      ?? { id: deleteFeedback.id ?? '', name: deleteFeedback.name ?? '', theme_payload: { ...INITIAL_THEME } }
    void verifyDeletion(theme, deleteFeedback.acknowledged)
  }

  const changePreset = (id: string) => {
    if (id === 'auto') { const retained = selectCanonicalThemePreset(draft, draft.preset_id || 'corporate_light'); patchDraft({ mode: 'auto', harmony_preference: draft.harmony_preference, palette_mode: draft.palette_mode, color_overrides: retained.color_overrides }); return }
    patchDraft(selectCanonicalThemePreset(draft, id))
  }
  const setOverride = (key: string, value?: string) => {
    const overrides = { ...draft.color_overrides }
    if (value === undefined || value === '') delete overrides[key]; else overrides[key] = value
    patchDraft({ ...draft, color_overrides: Object.keys(overrides).length ? overrides : undefined })
  }
  const paletteResetAvailable = draft.mode !== 'auto' && (draft.mode === 'custom' || CUSTOM_FIELDS.some(([key]) => draft[key] !== undefined))
  const tokenResetAvailable = Object.keys(draft.color_overrides || {}).length > 0
  const canResetDraft = () => mounted.current && accountCanStart() && !busy.current && operation === null
    && deleteContext.current.lifetime === contextLifetime && deleteTarget.current.lifetime === targetLifetime
    && deleteTarget.current.mode === 'create' && draftResetScope.current.lifetime === draftResetLifetime
    && currentDraft.current === draftKey
  const resetPalette = () => {
    if (!canResetDraft() || !paletteResetAvailable) return
    // A base switch would promote these literals into tokens; reset only the brand layer.
    const next = { ...draft }
    delete next.primary_hex; delete next.secondary_hex; delete next.tertiary_hex; delete next.neutral_hex
    patchDraft({ ...next, mode: 'preset', preset_id: draft.preset_id || 'corporate_light' })
  }
  const resetTokenOverrides = () => {
    if (!canResetDraft() || !tokenResetAvailable) return
    const next = { ...draft }
    delete next.color_overrides
    patchDraft(next)
  }

  const canContinueInStudio = () => mounted.current && accountCanStart()

  return <LibraryWorkspace introScreen={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && account !== null ? "brand" : undefined} introAutoStart={true} introEnabled={accountReady} workspaceId="themes" title={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'Themes & brand' : 'Themes'} description={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && account !== null ? 'A reusable visual identity. Your story structure stays separate.' : 'A visual identity you can return to. Explore, customize, and make it yours.'} mode={mode} onModeChange={changeLibraryMode}>
    <div className="sl-context" data-studio-themes-fidelity={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && account !== null ? 'true' : undefined}><Palette size={15} /><span>{standard ? <>Standard for new presentations: <strong>{standard.name}</strong></> : 'No saved standard · new presentations use the session default'}</span><span>Preview selection only</span></div>
    {!accountReady && <LibraryNotice>Verifying your account. Your draft and last loaded themes stay here; saving, refresh, standard changes, and Studio handoffs are paused.</LibraryNotice>}
    {notice && <LibraryNotice>{notice}</LibraryNotice>}{actionError && <LibraryNotice error>{actionError}</LibraryNotice>}
    {replacePrompt && <div className="sl-confirm" role="alert"><span>Replace your unsaved theme draft?</span><button type="button" disabled={!accountReady || Boolean(operation)} onClick={() => loadDraft(replacePrompt)}>Discard & continue</button><button type="button" onClick={() => setReplacePrompt(null)}>Keep draft</button></div>}
    <div className="sl-split">
      <aside className="sl-side">
        {mode === 'create' ? <>
          <div className="sl-side-heading"><p className="sl-eyebrow">MAKE IT YOURS</p><h2>Shape your visual identity.</h2><p>Start with a base, then adjust the colors that matter to your brand.</p></div>
          <div className="sl-form-scroll"><fieldset disabled={Boolean(operation)} className="sl-fields">
            <label className="sl-field">Theme name<input value={name} placeholder="e.g. Evergreen studio" onChange={event => { if (!mounted.current || !accountIsCurrent()) return; setName(event.target.value); setDirty(true); setNotice('') }} maxLength={150} /></label>
            {duplicateName && <p className="sl-field-error">A saved theme has this name. Choose a new name for this copy.</p>}
            <label className="sl-field">Description<textarea rows={2} value={description} placeholder="The identity behind your next story" onChange={event => { if (!mounted.current || !accountIsCurrent()) return; setDescription(event.target.value); setDirty(true) }} /></label>
            <label className="sl-field">Base theme<select value={draft.mode === 'auto' ? 'auto' : draft.preset_id || 'corporate_light'} onChange={event => changePreset(event.target.value)}><option value="auto">Auto / session default</option>{FALLBACK_THEME_PRESETS.map(theme => <option key={theme.preset_id} value={theme.preset_id}>{theme.name}</option>)}{draft.preset_id && !FALLBACK_THEME_PRESETS.some(theme => theme.preset_id === draft.preset_id) && <option value={draft.preset_id}>{draft.preset_id} (saved base)</option>}</select></label>
            <div className="sl-segment" aria-label="Color approach"><button type="button" aria-pressed={draft.mode !== 'custom'} onClick={() => changePreset(draft.preset_id || 'corporate_light')}>Theme-linked</button><button type="button" aria-pressed={draft.mode === 'custom'} onClick={() => patchDraft({ ...draft, mode: 'custom', primary_hex: draft.primary_hex || palette.primary, harmony_preference: draft.harmony_preference || 'auto', palette_mode: draft.palette_mode || 'both' })}>Custom palette</button></div>
            <div className="sl-section-line"><span className="sl-helper">Brand colors</span><button type="button" className="sl-text-button inline-flex items-center gap-1" disabled={!accountReady || Boolean(operation) || !paletteResetAvailable} onClick={resetPalette}><RotateCcw size={11} />Reset palette</button></div>
            {draft.mode === 'auto' && <p className="sl-helper">Auto is resolved by Director in Studio. Choose a preset or custom palette to save a reusable theme.</p>}
            {draft.mode === 'custom' && <><div className="sl-colors">{CUSTOM_FIELDS.map(([key, label]) => <ColorField key={key} label={label} value={draft[key]} fallback={palette[key.replace('_hex', '')]} onChange={value => patchDraft({ ...draft, [key]: value || undefined })} onReset={() => patchDraft({ ...draft, [key]: undefined })} />)}</div>
              <div className="sl-two-fields"><label className="sl-field">Color harmony<select value={draft.harmony_preference || 'auto'} onChange={event => patchDraft({ ...draft, harmony_preference: event.target.value as BuildThemeSelection['harmony_preference'] })}>{['auto', 'monochrome', 'analogous', 'complementary', 'triadic'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label><label className="sl-field">Palette mode<select value={draft.palette_mode || 'both'} onChange={event => patchDraft({ ...draft, palette_mode: event.target.value as BuildThemeSelection['palette_mode'] })}><option value="light">Light</option><option value="dark">Dark</option><option value="both">Both</option></select></label></div></>}
            <details className="sl-disclosure"><summary>Individual colors <span>{Object.keys(draft.color_overrides || {}).length} overrides</span></summary><p className="sl-helper">Explicit colors stay yours when changing the base. Reset a color to follow the theme again.</p><button type="button" className="sl-text-button inline-flex items-center gap-1" disabled={!accountReady || Boolean(operation) || !tokenResetAvailable} onClick={resetTokenOverrides}><RotateCcw size={11} />Reset all token overrides</button><div className="sl-colors">{THEME_TOKENS.map(([token, label]) => <ColorField key={token} label={label} value={draft.color_overrides?.[token]} fallback={palette[token]} onChange={value => setOverride(token, value)} onReset={() => setOverride(token)} />)}{Object.keys(draft.color_overrides || {}).filter(key => !THEME_TOKENS.some(([token]) => token === key)).map(key => <ColorField key={key} label={key} value={draft.color_overrides?.[key]} fallback="#64748b" onChange={value => setOverride(key, value)} onReset={() => setOverride(key)} />)}</div></details>
            <p className="sl-helper">Website extraction, font editing, and AI theme chat are not connected in this workspace. Colors above are editable now.</p>
          </fieldset></div>
          <div className="sl-side-footer"><button type="button" className="sl-primary" onClick={() => void save()} disabled={!canSave || !accountReady}><Save size={15} />{operation === 'save' ? 'Saving…' : 'Save reusable theme'}</button><span>{dirty ? 'Unsaved draft · kept while switching tabs' : 'Choose colors to begin'}</span></div>
        </> : <>
          <div className="sl-side-heading"><div className="sl-section-line"><h2>Your themes</h2><button type="button" className="sl-icon-button" aria-label="Refresh themes" disabled={!accountReady || loading || Boolean(operation)} onClick={() => void refresh()}><RefreshCw size={15} /></button></div><LibrarySearch label="Search saved themes" value={query} onChange={setQuery} /><div className="sl-segment sl-library-filters" aria-label="Theme library filter"><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All themes</button><button type="button" aria-pressed={filter === 'standard'} onClick={() => setFilter('standard')}><Star size={12} />Standard</button></div><p className="sl-result-count" role="status">{loading ? themes === null ? 'Loading library…' : 'Refreshing library…' : themes === null ? 'Library not loaded' : `${filtered.length} ${filtered.length === 1 ? 'theme' : 'themes'}${hasFilters ? ' match' : ' in your library'}`}</p></div>
          {listError && <LibraryNotice error>{listError}{themes && <p>Showing the last loaded library. Refresh to check for updates.</p>}</LibraryNotice>}
          <div className="sl-library-list">{loading && themes === null ? <LibraryLoading /> : filtered.length ? filtered.map(theme => <button type="button" className="sl-record" key={theme.id} aria-pressed={selectedId === theme.id} onClick={() => { if (deleteTarget.current.selectedId !== theme.id) deleteTarget.current = { ...deleteTarget.current, selectedId: theme.id, lifetime: {} }; currentSelection.current = theme.id; setSelectedId(theme.id); setActionError(''); setCompareBase(false) }}><ThemeSwatches selection={theme.theme_payload} /><span><strong>{theme.name}</strong><small>{theme.description || `${theme.theme_payload.mode === 'custom' ? 'Custom' : 'Saved'} palette`}</small></span>{theme.is_standard && <Star size={14} aria-label="Standard theme" />}</button>) : <div className="sl-empty"><Palette size={24} /><h3>{listError && themes === null ? 'Library unavailable' : hasFilters ? filter === 'standard' && !query ? 'No standard in this view' : 'No matching themes' : listError ? 'Library unavailable' : 'Your identity starts here.'}</h3><p>{listError && themes === null ? 'Refresh to load your saved themes.' : hasFilters ? filter === 'standard' && !query ? 'Preview a saved theme and choose Set as standard for future presentations.' : 'Try another name or description, or clear the filters.' : listError ? 'Refresh to try again. Your draft is still available in Create.' : 'Create a palette and save it here for your next presentation.'}</p>{listError && themes === null ? <button type="button" className="sl-button" disabled={!accountReady || loading} onClick={() => void refresh()}>Retry library</button> : hasFilters ? <button type="button" className="sl-button" onClick={() => { setQuery(''); setFilter('all') }}>Show all themes</button> : listError ? <button type="button" className="sl-button" disabled={!accountReady || loading} onClick={() => void refresh()}>Retry library</button> : <button type="button" className="sl-button" onClick={() => changeLibraryMode('create')}>Create a theme</button>}</div>}</div>
          <div className="sl-side-footer"><p className="sl-helper">Selecting a theme here opens its preview. It does not restyle a deck or change your standard.</p></div>
        </>}
      </aside>
      <section className="sl-preview-panel" aria-label="Theme preview">
        <div className="sl-preview-heading"><div><p className="sl-eyebrow">{mode === 'create' ? 'YOUR DESIGN PREVIEW' : 'SAVED THEME'}</p><h2>{mode === 'create' ? name || 'Your visual identity' : selected?.name || 'Choose your visual identity'}</h2></div><span className="sl-badge">{mode === 'create' ? 'Unsaved preview' : selected?.is_standard ? 'Your standard' : 'Preview'}</span></div>
        <div className="sl-preview-tabs" aria-label="Preview specimen">{(['title', 'data', 'content'] as const).map(value => <button type="button" key={value} aria-pressed={specimen === value} onClick={() => setSpecimen(value)}>{value === 'title' ? 'Title slide' : value === 'data' ? 'Data story' : 'Content'}</button>)}</div>
        <FittedLibraryStage>{activeSelection ? <ThemePreview selection={compareBase ? { mode: 'preset', preset_id: activeSelection.preset_id } : activeSelection} specimen={specimen} name={mode === 'create' ? name : selected?.name || ''} /> : <div className="sl-preview-empty"><Palette size={34} /><h3>Your theme, in context.</h3><p>Select a saved theme or create one to preview title, data, and content slides.</p></div>}</FittedLibraryStage>
        {activeSelection && <div className="sl-preview-caption"><span>{unknownBase ? 'Reference base' : activeSelection.mode === 'auto' ? 'Auto reference palette' : 'Palette guide'} · sample content</span><button type="button" onClick={() => setCompareBase(value => !value)} aria-pressed={compareBase}>{compareBase ? <Check size={13} /> : <RotateCcw size={13} />}{compareBase ? 'Showing base colors' : 'Compare base colors'}</button></div>}
        <div className="sl-preview-bottom">
          {mode === 'library' && selected && <div className="sl-actions"><StudioWorkflowAction action="theme" itemId={selected.id} canStart={canContinueInStudio} className="sl-primary" disabled={!accountReady || Boolean(operation)}>Choose theme in Studio</StudioWorkflowAction><button type="button" className="sl-button" disabled={!accountReady || Boolean(operation)} onClick={() => requestDraft(selected)}><Copy size={14} />Customize a copy</button><button type="button" className="sl-button" disabled={!accountReady || Boolean(operation)} onClick={() => void changeStandard()}><Star size={14} />{operation === 'standard' ? 'Updating…' : selected.is_standard ? 'Clear standard' : 'Set as standard'}</button><button type="button" ref={deleteButton} className="sl-button" disabled={!accountReady || loading || Boolean(operation)} onClick={requestDelete} onFocus={event => keepStudioScrollFocusVisible(event.target, '.sl-preview-panel')}><Trash2 size={14} />{operation === 'delete' ? 'Deleting…' : 'Delete theme'}</button></div>}
          {deletePrompt?.lifetime === targetLifetime && <div className="sl-confirm" role="alert" aria-label={`Delete saved theme ${deletePrompt.theme.name}`} onFocusCapture={event => keepStudioScrollFocusVisible(event.target, '.sl-preview-panel')} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); keepTheme() } }}><span>Delete “{deletePrompt.theme.name}” from your saved themes?</span><button type="button" disabled={!accountReady || loading || Boolean(operation)} onClick={() => void confirmDelete()}>Delete</button><button type="button" ref={keepButton} disabled={!accountReady || loading || Boolean(operation)} onClick={keepTheme}>Keep</button></div>}
          {deleteFeedback && deleteFeedback.owner === (account?.owner ?? null) && <LibraryNotice error={!deleteFeedback.acknowledged}>{deleteFeedback.message}<div className="sl-actions"><button type="button" className="sl-button" disabled={!accountReady || loading || Boolean(operation)} onClick={retryDeleteRead}>Refresh library</button></div></LibraryNotice>}
          {mode === 'create' && <div className="sl-actions"><button type="button" className="sl-text-button" disabled={!accountReady || Boolean(operation)} onClick={() => requestDraft('blank')}>Start another draft</button><span className="sl-helper">Saving a theme leaves existing presentations unchanged.</span></div>}
          <details className="sl-disclosure sl-theme-support">
            <summary>Theme details & use <span>{mode === 'library' && selected ? 'Saved settings · preview guide' : 'Preview guide · Studio workflow'}</span></summary>
            <div className="sl-theme-support-content" data-studio-theme-support-region={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'true' : undefined} tabIndex={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 0 : undefined} role={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'region' : undefined} aria-label={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'Theme details and use' : undefined}>
              {activeSelection && <p className="sl-helper">{activeSelection.mode === 'auto' ? 'Auto is resolved from the Studio session; this specimen shows reference colors only. ' : ''}Harmony, typography, and component treatments are resolved by Theme Builder when used in Studio.</p>}
              {unknownBase && <LibraryNotice>This saved base has no local palette specimen. The preview uses reference base colors with your explicit color settings; Studio resolves the actual theme.</LibraryNotice>}
              {mode === 'library' && selected && <><p className="sl-helper">Studio opens the theme picker for you to choose. Build settings stay locked after generation starts.</p><dl className="sl-read-grid"><ReadValue label="Description" value={selected.description} /><ReadValue label="Palette type" value={selected.theme_payload.mode} /><ReadValue label="Base theme" value={selected.theme_payload.preset_id || 'Service-resolved'} /><ReadValue label="Color harmony" value={selected.theme_payload.harmony_preference || 'Service default'} /><ReadValue label="Palette mode" value={selected.theme_payload.palette_mode || 'Service default'} /><ReadValue label="Explicit token overrides" value={String(Object.keys(selected.theme_payload.color_overrides || {}).length)} /><ReadValue label="Created (UTC)" value={libraryDate(selected.created_at)} /><ReadValue label="Updated (UTC)" value={libraryDate(selected.updated_at)} /><ReadValue label="Recorded uses" value={typeof selected.usage_count === 'number' ? String(selected.usage_count) : undefined} /></dl><MetadataDisclosure label="Complete saved theme settings" value={selected.theme_payload} /></>}
              <div className="sl-workflow-link"><div><strong>Continue in Studio</strong><p>Use the theme picker in Studio to select a saved theme for an eligible presentation.</p></div><StudioWorkflowAction action="theme" canStart={canContinueInStudio} disabled={!accountReady}>Back to {process.env.NEXT_PUBLIC_STUDIO_V4_LABELS === 'true' ? 'Studio' : 'builder'}</StudioWorkflowAction><ArrowRight size={14} aria-hidden="true" /></div>
            </div>
          </details>
        </div>
      </section>
    </div>
  </LibraryWorkspace>
}
