"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
// MDC P6 (K1): @slide mention support — inert unless NEXT_PUBLIC_CHAT_MENTIONS.
import { SlideMentionPopover } from "@/components/builder/chat/mention-popover"
import { filterMentionSlides, mentionToken, type MentionSlide } from "@/lib/mdc-mentions"
import { CHAT_MENTIONS } from "@/lib/mdc-flags"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileChip, UploadedFile } from '@/components/file-chip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import {
  Globe,
  SlidersHorizontal,
  Paperclip,
  ArrowUp,
  Square,
  Loader2,
  Search,
  Brain,
  LayoutTemplate,
  Palette,
  Save,
  Star,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { config, features } from '@/lib/config'
import {
  FALLBACK_THEME_PRESETS,
  isValidThemeHex,
  normalizeThemePresetId,
  type BuildThemeSelection,
  type ThemePresetSummary,
} from '@/lib/theme-builder'
import type { ActionRequest } from "@/hooks/use-deckster-websocket-v2"
import { useThemeProfiles, type SavedThemeProfile } from '@/hooks/use-theme-profiles'
import {
  isTemplateGenerationReady,
  templateGenerationUnavailableReason,
  type TemplateSelection,
} from '@/hooks/use-templates'
import { TemplatePicker } from './template-picker'
import { StudioThemeMenu, type StudioThemeView, type StudioThemeMutationKind, type StudioThemeMutationNotice } from './studio-theme-menu'

const TEXTAREA_MIN_HEIGHT = 96
const TEXTAREA_MAX_HEIGHT = 220

type ActiveBuildThemeProfile = {
  id: string
  name: string
  theme_payload: BuildThemeSelection
}

export interface ChatInputProps {
  /** Studio draft actions return focus to the native composer without submitting. */
  composerTextareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>
  inputMessage: string
  onInputChange: (value: string) => void
  /** MDC P6: deck slides for the @mention picker (absent => no mentions). */
  mentionSlides?: MentionSlide[]
  /** Turn gate: a user turn is awaiting the Director's reply. */
  awaitingReply?: boolean
  /** Deliberate unlock (Esc) while awaiting a reply. */
  onStopAwaiting?: () => void
  onSubmit: (e?: React.FormEvent) => void
  uploadedFiles: UploadedFile[]
  onFilesSelected: (files: File[]) => void
  onRemoveFile: (fileId: string) => void
  onClearAllFiles: () => void
  pendingActionInput: {
    action: ActionRequest['payload']['actions'][0]
    messageId: string
    timestamp: number
  } | null
  onCancelAction: () => void
  researchEnabled: boolean
  onResearchEnabledChange: (enabled: boolean) => void
  webSearchEnabled: boolean
  onWebSearchEnabledChange: (enabled: boolean) => void
  knowledgeGraphEnabled: boolean
  onKnowledgeGraphEnabledChange: (enabled: boolean) => void
  showKnowledgeGraphToggle: boolean
  knowledgeGraphAccess: 'locked' | 'setup' | 'ready' | 'unavailable' | 'loading'
  onKnowledgeGraphAccessClick: () => void
  /** Research settings are spent at strawman generation; after that they are
   *  frozen for the deck and the Director refuses late changes server-side. */
  researchSettingsLocked?: boolean
  isReady: boolean
  isLoadingSession: boolean
  connected: boolean
  /** A persistent Studio header may own the duplicate connection label. */
  showConnectionStatus?: boolean
  connecting: boolean
  user: any
  currentSessionId: string | null
  onRequestSession: () => Promise<void>
  // Template Builder (reuse): in-chat picker beside the attach button
  templateBuilderEnabled?: boolean
  activeTemplate?: TemplateSelection | null
  onSelectTemplate?: (template: TemplateSelection) => void
  onOpenComposerLibrary?: () => void
  onClearTemplate?: () => void
  templateSelectionLocked?: boolean
  isTemplateReuseRunning?: boolean
  onCancelTemplateReuse?: () => void
  buildTheme: BuildThemeSelection
  onBuildThemeChange: (theme: BuildThemeSelection) => void
  activeBuildThemeProfile?: ActiveBuildThemeProfile | null
  onActiveBuildThemeProfileChange?: (profile: ActiveBuildThemeProfile | null) => void
  themeSyncStatus?: 'idle' | 'syncing' | 'applied' | 'failed'
  themeSyncError?: string | null
  /** Saved Theme library handoff: inspect in the native picker, then explicitly select. */
  studioSavedThemeRequest?: { id: string; key: string }
}

export function ChatInput({
  inputMessage,
  onInputChange,
  mentionSlides,
  awaitingReply = false,
  onStopAwaiting,
  onSubmit,
  uploadedFiles,
  onFilesSelected,
  onRemoveFile,
  onClearAllFiles,
  pendingActionInput,
  onCancelAction,
  researchEnabled,
  onResearchEnabledChange,
  webSearchEnabled,
  onWebSearchEnabledChange,
  knowledgeGraphEnabled,
  onKnowledgeGraphEnabledChange,
  showKnowledgeGraphToggle,
  knowledgeGraphAccess,
  onKnowledgeGraphAccessClick,
  researchSettingsLocked = false,
  isReady,
  isLoadingSession,
  connected,
  showConnectionStatus = true,
  connecting,
  user,
  currentSessionId,
  onRequestSession,
  templateBuilderEnabled,
  activeTemplate,
  onSelectTemplate,
  onOpenComposerLibrary,
  onClearTemplate,
  templateSelectionLocked = false,
  isTemplateReuseRunning = false,
  onCancelTemplateReuse,
  buildTheme,
  onBuildThemeChange,
  activeBuildThemeProfile,
  onActiveBuildThemeProfileChange,
  themeSyncStatus = 'idle',
  themeSyncError,
  studioSavedThemeRequest,
  composerTextareaRef,
}: ChatInputProps) {
  const studio = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  // Only raw transfer/session-linking blocks Send. Once a file is stored,
  // background source enrichment is calm and non-blocking (`processing`);
  // a degraded enrichment result remains a valid attachment too.
  // The Director learns about uploads ONLY from the flags this composer puts
  // on the outgoing message, so sending early tells it "no documents" and it
  // builds the deck without them — silently, and unrecoverably for that turn.
  const pendingUpload = uploadedFiles.find((file) => file.status === 'uploading')
  const failedUpload = uploadedFiles.find((file) => file.status === 'error')
  const uploadBlockReason = pendingUpload
    ? `Waiting for ${pendingUpload.name} to finish uploading…`
    : failedUpload
      ? `${failedUpload.name} couldn't be uploaded — remove it or try again`
      : null
  const isSendBlocked = Boolean(uploadBlockReason) || awaitingReply
  const isSubmitDisabled = (studio ? !user || isLoadingSession : !isReady) || !inputMessage.trim() || isSendBlocked
  const mentionMatch = studio && CHAT_MENTIONS && mentionSlides?.length ? /@([\w ]{0,30})$/.exec(inputMessage) : null
  const mentionSelecting = Boolean(mentionMatch && mentionSlides && filterMentionSlides(mentionSlides, mentionMatch[1] || '').length)
  const composerHint = !user
    ? 'Authenticating…'
    : isLoadingSession
      ? 'Loading your conversation…'
      : isTemplateReuseRunning
        ? 'Director is working from your template'
        : mentionSelecting
          ? 'Enter or Tab selects a slide · Shift+Enter for a new line'
          : awaitingReply
            ? 'Director is replying · Esc to continue'
            : uploadBlockReason
              ? 'Send waits for attachments · Shift+Enter for a new line'
              : 'Enter sends · Shift+Enter for a new line'
  const composerConnection = isLoadingSession ? 'Loading session…' : connected ? 'Connected' : connecting ? 'Connecting…' : 'Disconnected'

  const guardedSubmit = (e?: React.FormEvent) => {
    if (isSendBlocked) {
      e?.preventDefault()
      return
    }
    onSubmit(e)
  }

  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [themePresets, setThemePresets] = useState<ThemePresetSummary[]>(FALLBACK_THEME_PRESETS)
  const [themePresetsLoading, setThemePresetsLoading] = useState(false)
  const [themePresetsError, setThemePresetsError] = useState<string | null>(null)
  const [brandHexDraft, setBrandHexDraft] = useState(buildTheme.primary_hex || '#1e40af')
  const [savedThemes, setSavedThemes] = useState<SavedThemeProfile[]>([])
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [requestedSavedThemeId, setRequestedSavedThemeId] = useState<string | null>(null)
  const [dismissedSavedThemeRequestKey, setDismissedSavedThemeRequestKey] = useState<string | null>(null)
  const [unavailableSavedThemeRequest, setUnavailableSavedThemeRequest] = useState<{ key: string; failed: boolean } | null>(null)
  const openedSavedThemeRequestRef = useRef<string | null>(null)
  const [selectedSavedThemeId, setSelectedSavedThemeId] = useState<string | null>(null)
  const [saveThemeName, setSaveThemeName] = useState('')
  const [saveAsStandard, setSaveAsStandard] = useState(false)
  const {
    loading: themeProfilesLoading,
    error: themeProfilesError,
    listThemes,
    saveTheme,
    setStandardTheme,
    clearStandardTheme,
    deleteTheme,
  } = useThemeProfiles()
  // Studio theme read ownership START — classic refresh and write contracts stay below.
  const studioThemeAccount = user?.id ?? user ?? null
  const studioThemeOwnerRef = useRef({ account: studioThemeAccount, session: currentSessionId })
  if (studioThemeOwnerRef.current.account !== studioThemeAccount
    || studioThemeOwnerRef.current.session !== currentSessionId) {
    studioThemeOwnerRef.current = { account: studioThemeAccount, session: currentSessionId }
    if (studio) openedSavedThemeRequestRef.current = null
  }
  const studioThemeOwner = studioThemeOwnerRef.current
  const studioThemeReadSequence = useRef(0)
  const studioThemeMount = useRef({ active: true, epoch: 0 })
  const studioThemeCacheAccount = useRef<unknown>(undefined)
  const studioThemeCacheThemes = useRef<SavedThemeProfile[]>([])
  const studioThemeSelectionKey = JSON.stringify([activeBuildThemeProfile?.id, buildTheme])
  const studioThemeSelection = useRef({ key: studioThemeSelectionKey, epoch: 0 })
  if (studioThemeSelection.current.key !== studioThemeSelectionKey) {
    studioThemeSelection.current = { key: studioThemeSelectionKey, epoch: studioThemeSelection.current.epoch + 1 }
  }
  const recordStudioThemeSelection = (profileId: string | null, theme = buildTheme, newIntent = true) => {
    if (studio) studioThemeSelection.current = {
      key: JSON.stringify([profileId, theme]), epoch: studioThemeSelection.current.epoch + (newIntent ? 1 : 0),
    }
  }
  const [studioThemeRead, setStudioThemeRead] = useState<{
    owner: typeof studioThemeOwner; phase: 'loading' | 'failed' | 'loaded'; failed: boolean
  } | null>(null)
  const [studioThemeView, setStudioThemeView] = useState<StudioThemeView>('choices')
  const [studioThemeMutation, setStudioThemeMutation] = useState<(StudioThemeMutationNotice & { owner: typeof studioThemeOwner }) | null>(null)
  const studioThemeMutationSequence = useRef(0)
  const studioThemeMutationRequest = useRef<{ owner: typeof studioThemeOwner; mountEpoch: number; sequence: number } | null>(null)
  const studioThemeReadActivity = useRef<{ owner: typeof studioThemeOwner; mountEpoch: number; sequence: number } | null>(null)
  const studioThemeReady = useRef({ owner: studioThemeOwner, allowed: !!user && !isLoadingSession && !templateSelectionLocked })
  studioThemeReady.current = { owner: studioThemeOwner, allowed: !!user && !isLoadingSession && !templateSelectionLocked }
  const studioThemeDraft = useRef({ name: saveThemeName, asStandard: saveAsStandard, epoch: 0 })
  if (studioThemeDraft.current.name !== saveThemeName || studioThemeDraft.current.asStandard !== saveAsStandard) {
    studioThemeDraft.current = { name: saveThemeName, asStandard: saveAsStandard, epoch: studioThemeDraft.current.epoch + 1 }
  }
  const studioThemeRequestOwner = useRef<typeof studioThemeOwner | null>(null)
  useEffect(() => {
    if (!studio) return
    studioThemeMount.current.active = true
    return () => {
      studioThemeMount.current.active = false
      studioThemeMount.current.epoch += 1
    }
  }, [studio])
  const visibleSavedThemes = studio && studioThemeCacheAccount.current !== studioThemeAccount ? [] : savedThemes
  const studioThemeReadOwned = studioThemeRead?.owner === studioThemeOwner
  const studioThemeReadBusy = studioThemeReadOwned && studioThemeRead?.phase === 'loading'
  const studioThemeReadFailed = studioThemeReadOwned && studioThemeRead?.failed
  const ownedStudioThemeMutation = studioThemeMutation?.owner === studioThemeOwner ? studioThemeMutation : null
  // Studio theme read ownership END.
  const activeTemplateReady = isTemplateGenerationReady(activeTemplate)
  const templateChipLabel = templateSelectionLocked
    ? 'Template locked'
    : activeTemplateReady
      ? 'Template selected'
      : 'Template review only'
  const themeChipLabel = templateSelectionLocked ? 'Theme locked' : 'Theme selected'
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const attachStudioTextarea = useCallback((element: HTMLTextAreaElement | null) => {
    textareaRef.current = element
    if (composerTextareaRef) composerTextareaRef.current = element
  }, [composerTextareaRef])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(Math.max(textarea.scrollHeight, TEXTAREA_MIN_HEIGHT), TEXTAREA_MAX_HEIGHT)
      textarea.style.height = `${newHeight}px`
    }
  }, [inputMessage])

  useEffect(() => {
    let cancelled = false
    async function loadPresets() {
      setThemePresetsLoading(true)
      setThemePresetsError(null)
      try {
        const baseUrl = config.api.themeBuilderUrl.replace(/\/$/, '')
        const response = await fetch(`${baseUrl}/api/v1/themes/presets`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const presets = await response.json()
        if (!cancelled && Array.isArray(presets) && presets.length > 0) {
          setThemePresets(presets)
        }
      } catch (error) {
        if (!cancelled) {
          setThemePresets(FALLBACK_THEME_PRESETS)
          setThemePresetsError(error instanceof Error ? error.message : 'Unable to load presets')
        }
      } finally {
        if (!cancelled) {
          setThemePresetsLoading(false)
        }
      }
    }
    loadPresets()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (buildTheme.primary_hex) {
      setBrandHexDraft(buildTheme.primary_hex)
    }
  }, [buildTheme.primary_hex])

  useEffect(() => {
    setSelectedSavedThemeId(activeBuildThemeProfile?.id ?? null)
  }, [activeBuildThemeProfile?.id])

  const refreshSavedThemes = useCallback(async (preserveSelection = false) => {
    // Studio theme refresh START — only this owner and latest read may adopt a result.
    if (studio) {
      if (!studioThemeMount.current.active || studioThemeOwnerRef.current !== studioThemeOwner) return null
      const sequence = ++studioThemeReadSequence.current
      const mountEpoch = studioThemeMount.current.epoch
      const selectionEpoch = studioThemeSelection.current.epoch
      studioThemeReadActivity.current = { owner: studioThemeOwner, mountEpoch, sequence }
      setStudioThemeRead((previous) => ({ owner: studioThemeOwner, phase: 'loading', failed: previous?.owner === studioThemeOwner && previous.failed }))
      const res = await listThemes()
      if (!studioThemeMount.current.active || studioThemeMount.current.epoch !== mountEpoch
        || studioThemeOwnerRef.current !== studioThemeOwner || studioThemeReadSequence.current !== sequence) return res
      studioThemeReadActivity.current = null
      if (res === null) {
        setStudioThemeRead({ owner: studioThemeOwner, phase: 'failed', failed: true })
        return res
      }
      const selectionChanged = studioThemeSelection.current.epoch !== selectionEpoch
      const currentSelectionId = JSON.parse(studioThemeSelection.current.key)[0] as string | null
      const cachedSelectionKnown = studioThemeCacheAccount.current === studioThemeOwner.account
        && studioThemeCacheThemes.current.some((theme) => theme.id === currentSelectionId)
      // Retain a newer saved choice's known option if this older snapshot omits it.
      // Brand/preset choices and an initial cache never discard a successful library.
      if (selectionChanged && cachedSelectionKnown && !res.themes.some((theme) => theme.id === currentSelectionId)) {
        setStudioThemeRead((previous) => ({
          owner: studioThemeOwner,
          phase: previous?.owner === studioThemeOwner && previous.failed ? 'failed' : 'loaded',
          failed: previous?.owner === studioThemeOwner && previous.failed,
        }))
        return res
      }
      studioThemeCacheAccount.current = studioThemeOwner.account
      studioThemeCacheThemes.current = res.themes
      setSavedThemes(res.themes)
      setStudioThemeRead({ owner: studioThemeOwner, phase: 'loaded', failed: false })
      if (!preserveSelection && !selectionChanged) {
        setSelectedSavedThemeId((current) => current && res.themes.some((theme) => theme.id === current) ? current : null)
      }
      return res
    }
    // Studio theme refresh END.
    const res = await listThemes()
    const nextThemes = res?.themes ?? []
    setSavedThemes(nextThemes)
    if (!preserveSelection) {
      setSelectedSavedThemeId((current) => (
        current && nextThemes.some((theme) => theme.id === current) ? current : null
      ))
    }
    return res
  }, [listThemes, studio, studioThemeOwner])

  useEffect(() => {
    const request = studioSavedThemeRequest
    if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'true' || !request
      || !user || isLoadingSession || templateSelectionLocked
      || dismissedSavedThemeRequestKey === request.key
      || openedSavedThemeRequestRef.current === request.key) return
    const { id, key } = request
    let cancelled = false
    setRequestedSavedThemeId(null)
    setUnavailableSavedThemeRequest(null)
    async function showRequestedTheme() {
      const pendingRead = refreshSavedThemes(true)
      const readSequence = studioThemeReadSequence.current
      const result = await pendingRead
      if (cancelled || studioThemeOwnerRef.current !== studioThemeOwner
        || studioThemeReadSequence.current !== readSequence || !studioThemeMount.current.active) return
      studioThemeRequestOwner.current = studioThemeOwner
      openedSavedThemeRequestRef.current = key
      const available = result?.themes.some((theme) => theme.id === id) ?? false
      setRequestedSavedThemeId(available ? id : null)
      setUnavailableSavedThemeRequest(available ? null : { key, failed: result === null })
      setThemeMenuOpen(true)
    }
    void showRequestedTheme()
    return () => { cancelled = true }
  }, [studioSavedThemeRequest?.id, studioSavedThemeRequest?.key, user, isLoadingSession, templateSelectionLocked, dismissedSavedThemeRequestKey, refreshSavedThemes])

  const activeSavedThemeRequest = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
    && studioSavedThemeRequest && dismissedSavedThemeRequestKey !== studioSavedThemeRequest.key
    ? studioSavedThemeRequest : null
  const savedThemeRequestNotice = activeSavedThemeRequest && templateSelectionLocked
    ? "Build theme selection is locked for this deck. Your saved theme has not been applied."
    : activeSavedThemeRequest && studioThemeRequestOwner.current === studioThemeOwner
      && unavailableSavedThemeRequest?.key === activeSavedThemeRequest.key
      ? unavailableSavedThemeRequest.failed
        ? "The selected saved theme is unavailable because saved themes could not be loaded. Your saved theme has not been applied."
        : "The selected saved theme is unavailable in My themes. Your saved theme has not been applied."
      : null

  const requestedSavedTheme = requestedSavedThemeId
    && (!studio || (activeSavedThemeRequest && studioThemeRequestOwner.current === studioThemeOwner))
    ? visibleSavedThemes.find((theme) => theme.id === requestedSavedThemeId)
    : undefined

  const activeSavedTheme = selectedSavedThemeId
    ? visibleSavedThemes.find((theme) => theme.id === selectedSavedThemeId)
    : undefined
  const standardTheme = visibleSavedThemes.find((theme) => theme.is_standard)
  const activePreset = buildTheme.mode === 'preset'
    ? themePresets.find((preset) => preset.preset_id === buildTheme.preset_id)
    : undefined
  const activeThemeLabel = activeSavedTheme
    ? activeSavedTheme.name
    : activeBuildThemeProfile
    ? activeBuildThemeProfile.name
    : buildTheme.mode === 'preset'
    ? activePreset?.name || buildTheme.preset_id || 'Preset'
    : buildTheme.mode === 'custom'
      ? `Brand ${buildTheme.primary_hex || ''}`
      : 'Auto theme'

  const handlePresetChange = (presetId: string) => {
    if (studio) studioThemeSelection.current.epoch += 1
    setSelectedSavedThemeId(null)
    onActiveBuildThemeProfileChange?.(null)
    if (presetId === 'auto') {
      recordStudioThemeSelection(null, { mode: 'auto' }, false)
      onBuildThemeChange({ mode: 'auto' })
      return
    }
    const normalized = normalizeThemePresetId(presetId)
    if (normalized) {
      recordStudioThemeSelection(null, { mode: 'preset', preset_id: normalized }, false)
      onBuildThemeChange({ mode: 'preset', preset_id: normalized })
    }
  }

  const handleBrandHexChange = (value: string) => {
    if (studio) studioThemeSelection.current.epoch += 1
    setSelectedSavedThemeId(null)
    onActiveBuildThemeProfileChange?.(null)
    const normalized = value.startsWith('#') ? value : `#${value}`
    setBrandHexDraft(normalized)
    recordStudioThemeSelection(null, isValidThemeHex(normalized) ? { mode: 'custom', primary_hex: normalized.toLowerCase() } : buildTheme, false)
    if (isValidThemeHex(normalized)) {
      onBuildThemeChange({ mode: 'custom', primary_hex: normalized.toLowerCase() })
    }
  }

  const handleSavedThemeChange = (themeId: string) => {
    if (studio) studioThemeSelection.current.epoch += 1
    if (!themeId) {
      recordStudioThemeSelection(null, buildTheme, false)
      setSelectedSavedThemeId(null)
      onActiveBuildThemeProfileChange?.(null)
      return
    }
    const profile = visibleSavedThemes.find((theme) => theme.id === themeId)
    if (!profile?.theme_payload) return
    recordStudioThemeSelection(profile.id, profile.theme_payload, false)
    setRequestedSavedThemeId(null)
    if (studioSavedThemeRequest?.id === profile.id) setDismissedSavedThemeRequestKey(studioSavedThemeRequest.key)
    setSelectedSavedThemeId(profile.id)
    onActiveBuildThemeProfileChange?.({
      id: profile.id,
      name: profile.name,
      theme_payload: profile.theme_payload,
    })
    onBuildThemeChange(profile.theme_payload)
  }

  const handleSaveCurrentTheme = async () => {
    if (studio) { await runStudioThemeMutation('save'); return }
    const name = saveThemeName.trim()
    if (!name || buildTheme.mode === 'auto') return
    const saved = await saveTheme({
      name,
      theme: buildTheme,
      setStandard: saveAsStandard,
    })
    if (saved) {
      setSaveThemeName('')
      setSaveAsStandard(false)
      onBuildThemeChange(saved.theme_payload)
      onActiveBuildThemeProfileChange?.({
        id: saved.id,
        name: saved.name,
        theme_payload: saved.theme_payload,
      })
      await refreshSavedThemes()
      setSelectedSavedThemeId(saved.id)
    }
  }

  const handleSetStandardTheme = async () => {
    if (studio) { await runStudioThemeMutation('set-standard'); return }
    if (!activeSavedTheme) return
    await setStandardTheme(activeSavedTheme.id)
    await refreshSavedThemes()
  }

  const handleClearStandardTheme = async () => {
    if (studio) { await runStudioThemeMutation('clear-standard'); return }
    await clearStandardTheme()
    await refreshSavedThemes()
  }

  const handleDeleteSavedTheme = async () => {
    if (studio) { await runStudioThemeMutation('delete'); return }
    if (!activeSavedTheme) return
    const deleted = await deleteTheme(activeSavedTheme.id)
    if (deleted) {
      setSelectedSavedThemeId(null)
      onActiveBuildThemeProfileChange?.(null)
      await refreshSavedThemes()
    }
  }

  // Studio theme read recovery START — recovery reads never apply or save a theme.
  const handleStudioThemeRefresh = async () => {
    if (!studio || !user || isLoadingSession || templateSelectionLocked || studioThemeReadBusy) return
    const mountEpoch = studioThemeMount.current.epoch
    const pendingRead = refreshSavedThemes()
    const readSequence = studioThemeReadSequence.current
    const result = await pendingRead
    if (!studioThemeMount.current.active || studioThemeMount.current.epoch !== mountEpoch
      || studioThemeOwnerRef.current !== studioThemeOwner
      || studioThemeReadSequence.current !== readSequence || !activeSavedThemeRequest) return
    studioThemeRequestOwner.current = studioThemeOwner
    const available = result?.themes.some((theme) => theme.id === activeSavedThemeRequest.id) ?? false
    setRequestedSavedThemeId(available ? activeSavedThemeRequest.id : null)
    setUnavailableSavedThemeRequest(available ? null : { key: activeSavedThemeRequest.key, failed: result === null })
  }
  // Studio theme read recovery END.
  // Studio theme mutations START — only returned native outcomes acknowledge writes.
  const runStudioThemeMutation = async (kind: StudioThemeMutationKind) => {
    const owner = studioThemeOwner
    const mountEpoch = studioThemeMount.current.epoch
    const ready = studioThemeReady.current
    const prior = studioThemeMutationRequest.current
    if (!studio || !studioThemeMount.current.active || studioThemeOwnerRef.current !== owner
      || ready.owner !== owner || !ready.allowed
      || (prior?.owner === owner && prior.mountEpoch === mountEpoch)) return
    const [profileId, selection] = JSON.parse(studioThemeSelection.current.key) as [string | null, BuildThemeSelection]
    const profile = studioThemeCacheAccount.current === owner.account
      ? studioThemeCacheThemes.current.find((theme) => theme.id === profileId) : undefined
    const standard = studioThemeCacheAccount.current === owner.account
      ? studioThemeCacheThemes.current.find((theme) => theme.is_standard) : undefined
    const draft = { ...studioThemeDraft.current }
    const name = draft.name.trim()
    const activeRead = studioThemeReadActivity.current
    if (kind === 'save' && (!name || selection.mode === 'auto'
      || (activeRead?.owner === owner && activeRead.mountEpoch === mountEpoch))) return
    if ((kind === 'set-standard' || kind === 'delete') && !profile) return
    if (kind === 'clear-standard' && !standard) return
    const sequence = ++studioThemeMutationSequence.current
    const selectionEpoch = studioThemeSelection.current.epoch
    studioThemeMutationRequest.current = { owner, mountEpoch, sequence }
    const progress = { save: 'Saving theme…', 'set-standard': 'Setting standard theme…', 'clear-standard': 'Clearing standard theme…', delete: 'Deleting saved theme…' }
    setStudioThemeMutation({ owner, kind, phase: 'loading', message: progress[kind] })
    const result = kind === 'save'
      ? await saveTheme({ name, theme: selection, setStandard: draft.asStandard })
      : kind === 'set-standard' ? await setStandardTheme(profile!.id)
      : kind === 'clear-standard' ? await clearStandardTheme()
      : await deleteTheme(profile!.id)
    if (!studioThemeMount.current.active || studioThemeMount.current.epoch !== mountEpoch
      || studioThemeOwnerRef.current !== owner
      || studioThemeMutationRequest.current?.sequence !== sequence) return
    studioThemeMutationRequest.current = null
    const validProfile = (value: unknown): value is SavedThemeProfile => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const candidate = value as SavedThemeProfile & { error?: unknown }
      const payload = candidate.theme_payload
      const validLiteral = (literal: unknown) => typeof literal === 'string' && isValidThemeHex(literal)
      const overrides = payload?.color_overrides
      const validOverrides = overrides === undefined || (!!overrides && typeof overrides === 'object'
        && !Array.isArray(overrides) && Object.values(overrides).every(validLiteral))
      return !candidate.error && typeof candidate.id === 'string' && !!candidate.id.trim()
        && typeof candidate.name === 'string' && !!candidate.name.trim()
        && !!payload && typeof payload === 'object' && !Array.isArray(payload)
        && (payload.mode === 'preset'
          ? typeof payload.preset_id === 'string' && !!payload.preset_id.trim()
          : payload.mode === 'custom' && (validLiteral(payload.primary_hex)
            || (!!overrides && Object.values(overrides).some(validLiteral))))
        && [payload.primary_hex, payload.secondary_hex, payload.tertiary_hex, payload.neutral_hex]
          .every((literal) => literal === undefined || validLiteral(literal))
        && validOverrides
        && (candidate.is_standard === undefined || typeof candidate.is_standard === 'boolean')
    }
    const acknowledged = kind === 'save' ? validProfile(result)
      : kind === 'set-standard' ? validProfile(result) && result.id === profile!.id
      : result === true
    if (!acknowledged) {
      const refusal = { save: 'Could not confirm theme save. Your changes are kept.', 'set-standard': 'Could not confirm standard theme. Your current theme is kept.', 'clear-standard': 'Could not clear standard theme. Your current theme is kept.', delete: 'Could not delete saved theme. Your changes are kept.' }
      setStudioThemeMutation({ owner, kind, phase: 'failed', message: refusal[kind] })
      return
    }
    const choiceUnchanged = studioThemeSelection.current.epoch === selectionEpoch
    const stillReady = studioThemeReady.current.owner === owner && studioThemeReady.current.allowed
    // Only this account's cache may contribute rows to a write acknowledgment.
    // A new account can save before its first successful library read.
    const ownedThemes = studioThemeCacheAccount.current === owner.account
      ? studioThemeCacheThemes.current : []
    const publish = (themes: SavedThemeProfile[]) => {
      // Includes user reads begun after request admission but before this ACK.
      ++studioThemeReadSequence.current
      studioThemeReadActivity.current = null
      setStudioThemeRead((previous) => previous?.owner === owner && previous.phase === 'loading'
        ? { ...previous, phase: previous.failed ? 'failed' : 'loaded' } : previous)
      studioThemeCacheAccount.current = owner.account
      studioThemeCacheThemes.current = themes
      setSavedThemes(themes)
    }
    let message = ''
    let phase: 'success' | 'uncertain' = 'success'
    if (kind === 'save' && validProfile(result)) {
      const saved = result
      publish([...ownedThemes.filter((theme) => theme.id !== saved.id)
        .map((theme) => saved.is_standard === true ? { ...theme, is_standard: false } : theme), saved])
      if (choiceUnchanged && stillReady) {
        recordStudioThemeSelection(saved.id, saved.theme_payload)
        setSelectedSavedThemeId(saved.id)
        onBuildThemeChange(saved.theme_payload)
        onActiveBuildThemeProfileChange?.({ id: saved.id, name: saved.name, theme_payload: saved.theme_payload })
        if (studioThemeDraft.current.epoch === draft.epoch) {
          setSaveThemeName('')
          if (!draft.asStandard || saved.is_standard === true) setSaveAsStandard(false)
        }
      }
      message = choiceUnchanged && stillReady ? 'Theme saved.' : 'Theme saved. Your current theme choice and unsent changes are kept.'
      if (draft.asStandard && saved.is_standard !== true) {
        phase = 'uncertain'
        message = 'Theme saved. Standard status was not confirmed.'
      }
    } else if (kind === 'set-standard' && validProfile(result)) {
      if (result.is_standard !== true) {
        setStudioThemeMutation({ owner, kind, phase: 'uncertain', message: 'Standard status was not confirmed. Your current theme is kept.' })
        return
      }
      publish(ownedThemes.map((theme) => theme.id === result.id ? result : { ...theme, is_standard: false }))
      message = 'Standard theme set.'
    } else if (kind === 'clear-standard') {
      publish(ownedThemes.map((theme) => ({ ...theme, is_standard: false })))
      message = 'Standard theme cleared.'
    } else if (kind === 'delete') {
      publish(ownedThemes.filter((theme) => theme.id !== profile!.id))
      if (choiceUnchanged && stillReady) {
        recordStudioThemeSelection(null)
        setSelectedSavedThemeId(null)
        onActiveBuildThemeProfileChange?.(null)
      }
      message = choiceUnchanged ? 'Saved theme deleted.' : 'Saved theme deleted. Your newer theme choice is kept.'
    }
    setStudioThemeMutation({ owner, kind, phase, message })
    // Reconciliation is a separate read; its success/failure is never a write ACK.
    if (stillReady) void refreshSavedThemes(true)
  }
  // Studio theme mutations END.
  return (
    <div
      data-studio-v4-chrome={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === 'true' ? 'true' : undefined}
      data-studio-v4-composer="true"
      data-studio-v4-type={process.env.NEXT_PUBLIC_STUDIO_V4_TYPE === 'true' ? 'true' : undefined}
      data-studio-v4-dragging={isDraggingFiles ? 'true' : undefined}
      className={`p-3 border-t border-gray-100 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900 ${
        isDraggingFiles ? 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-700' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        if (features.enableFileUploads) setIsDraggingFiles(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setIsDraggingFiles(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDraggingFiles(false)
        if (features.enableFileUploads) {
          const files = Array.from(e.dataTransfer.files)
          if (files.length > 0) {
            onRequestSession().then(() => {
              onFilesSelected(files)
            }).catch((error) => {
              console.error('[ChatInput] Session creation failed for drag-and-drop:', error)
            })
          }
        }
      }}
    >
      {/* Drop zone indicator */}
      {isDraggingFiles && (
        <div className="mb-3 p-4 border-2 border-dashed border-purple-300 rounded-lg bg-purple-50 text-center">
          <p data-studio-v4-type-role="drop-label" className="text-xs text-purple-600 font-medium">Drop files here to attach</p>
        </div>
      )}

      {savedThemeRequestNotice && activeSavedThemeRequest && (
        <div data-studio-v4-saved-theme-notice={templateSelectionLocked ? "locked" : "unavailable"} role="status">
          <p>{savedThemeRequestNotice}</p>
          <button
            type="button"
            aria-label="Dismiss saved theme notice"
            onClick={() => {
              setDismissedSavedThemeRequestKey(activeSavedThemeRequest.key)
              openedSavedThemeRequestRef.current = activeSavedThemeRequest.key
              setRequestedSavedThemeId(null)
              setUnavailableSavedThemeRequest(null)
            }}
          >Dismiss</button>
        </div>
      )}

      {/* Hidden file input for upload button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.csv,.pptx,.ppt,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg,.gif,.webp,.py,.js,.ts,.java,.go,.rs"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          console.log(`[ChatInput] File input onChange fired, ${files.length} file(s)`, files.map(f => f.name))
          if (files.length > 0) {
            onFilesSelected(files)
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }}
        className="hidden"
      />

      {/* Action Input Banner */}
      {pendingActionInput && (
        <div data-studio-composer-pending-action={studio ? "true" : undefined} className="mb-2 p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
          <div data-studio-v4-type-role="action-content" tabIndex={studio ? 0 : undefined} role={studio ? "region" : undefined} aria-label={studio ? "Pending Director action" : undefined} className="flex items-center gap-2">
            <span data-studio-v4-type-role="action-label" className="text-gray-700 dark:text-slate-200 font-medium text-xs">
              {pendingActionInput.action.label}
            </span>
            <span data-studio-v4-type-role="action-helper" className="text-gray-500 dark:text-slate-400 text-[11px]">
              Type your input and press Enter
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            data-studio-v4-type-role="action-cancel"
            onClick={onCancelAction}
            className="h-5 text-[11px] text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-700 px-1.5"
          >
            Cancel
          </Button>
        </div>
      )}
      {/* Template Builder: locked-in template indicator */}
      {activeTemplate && (
        <div data-studio-composer-selection={studio ? 'template' : undefined} data-studio-composer-template-ready={studio ? String(activeTemplateReady) : undefined} className={`mb-2 px-2 py-1.5 border rounded-lg flex items-center justify-between ${
          activeTemplateReady
            ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
        }`}>
          <div data-studio-v4-type-role="selection-content" className={`flex items-center gap-1.5 text-xs font-medium min-w-0 ${
            activeTemplateReady
              ? 'text-purple-700 dark:text-purple-300'
              : 'text-amber-800 dark:text-amber-300'
          }`}>
            <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
            <span data-studio-v4-type-role="selection-label" title={studio ? activeTemplate.name : undefined} className="truncate">
              {templateChipLabel}: {activeTemplate.name}
            </span>
            {!activeTemplateReady && (
              <span data-studio-v4-type-role="selection-helper" className="hidden sm:inline text-[11px] font-normal opacity-80">
                {templateGenerationUnavailableReason(activeTemplate)}
              </span>
            )}
          </div>
          {!templateSelectionLocked && (
            <button
              type="button"
              onClick={() => onClearTemplate?.()}
              className="ml-2 shrink-0 text-purple-500 hover:text-purple-700 dark:hover:text-purple-200"
              title="Clear template"
              aria-label="Clear template"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {buildTheme.mode !== 'auto' && (
        <div data-studio-composer-selection={studio ? 'theme' : undefined} data-studio-composer-theme-sync={studio ? themeSyncStatus : undefined} data-studio-v4-theme-chip="true" className="mb-2 px-2 py-1.5 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg flex items-center justify-between">
          <div data-studio-v4-type-role="selection-content" className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300 text-xs font-medium min-w-0">
            <Palette className="h-3.5 w-3.5 shrink-0" />
            <span data-studio-v4-type-role="selection-label" title={studio ? activeThemeLabel : undefined} className="truncate">{themeChipLabel}: {activeThemeLabel}</span>
            {themeSyncStatus === 'syncing' && (
              <span data-studio-v4-type-role="theme-sync-status" className="ml-1 inline-flex items-center gap-1 text-[10px] font-normal" title="Applying theme to the current deck">
                <Loader2 className="h-3 w-3 animate-spin" /> Syncing
              </span>
            )}
            {themeSyncStatus === 'applied' && (
              <span data-studio-v4-type-role="theme-sync-status" className="ml-1 inline-flex items-center gap-1 text-[10px] font-normal" title="Theme applied to the current deck">
                <CheckCircle2 className="h-3 w-3" /> Applied
              </span>
            )}
            {themeSyncStatus === 'failed' && (
              <span
                data-studio-v4-type-role="theme-sync-status"
                className="ml-1 inline-flex items-center gap-1 text-[10px] font-normal text-rose-600 dark:text-rose-300"
                title={themeSyncError || 'Theme application failed'}
              >
                <AlertCircle className="h-3 w-3" /> Failed
              </span>
            )}
            {studio && themeSyncStatus === 'failed' && themeSyncError && (
              <span data-studio-composer-options-part="sync-error">{themeSyncError}</span>
            )}
          </div>
          {!templateSelectionLocked && (
            <button
              type="button"
              onClick={() => {
                onActiveBuildThemeProfileChange?.(null)
                onBuildThemeChange({ mode: 'auto' })
              }}
              className="ml-2 shrink-0 text-sky-500 hover:text-sky-700 dark:hover:text-sky-200"
              title="Clear theme"
              aria-label="Clear theme"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {isTemplateReuseRunning && (
        <div data-studio-v4-type-role="working-status" className="mb-2 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-600" />
          </span>
          Director is working from your template
        </div>
      )}

      {uploadBlockReason && (
        <div
          data-studio-v4-type-role="upload-status"
          role="status"
          aria-live="polite"
          className={`mb-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            pendingUpload
              ? 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300'
              : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300'
          }`}
        >
          {pendingUpload
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <AlertCircle className="h-3 w-3" />}
          {uploadBlockReason}
        </div>
      )}

      {/* Main input container - Claude style */}
      <form onSubmit={guardedSubmit}>
        <div data-studio-v4-prompt="true"
          className="relative bg-gray-50 rounded-xl border border-gray-200 focus-within:border-gray-300 focus-within:shadow-sm transition-all dark:bg-slate-800 dark:border-slate-700 dark:focus-within:border-slate-600">
          {/* File chips live inside the composer so the input grows with them */}
          {features.enableFileUploads && uploadedFiles.length > 0 && !isDraggingFiles && (
            <div data-studio-composer-attachments={studio ? "true" : undefined} className="max-h-24 overflow-y-auto border-b border-gray-200/70 px-3 py-2">
              {studio && (
                <div data-studio-composer-part="attachment-heading">
                  <span>{uploadedFiles.length} attached {uploadedFiles.length === 1 ? 'file' : 'files'}</span>
                  {uploadedFiles.length > 1 && <button type="button" onClick={onClearAllFiles}>Clear all</button>}
                </div>
              )}
              <div className="flex flex-wrap items-start gap-2">
                {uploadedFiles.map((file) => {
                  const chip = <FileChip
                    key={file.id}
                    file={file}
                    onRemove={() => onRemoveFile(file.id)}
                    variant={studio ? "compact" : "icon"}
                  />
                  return studio ? <div key={file.id} data-studio-composer-file={file.status}>{chip}</div> : chip
                })}
                {!studio && uploadedFiles.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    data-studio-v4-type-role="attachments-clear"
                    onClick={onClearAllFiles}
                    className="h-5 w-fit px-1.5 text-[10px] text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-200"
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* MDC P6: @slide mention picker (flag-gated, absolute above input) */}
          {(() => {
            if (!CHAT_MENTIONS || !mentionSlides || mentionSlides.length === 0) return null
            const match = /@([\w ]{0,30})$/.exec(inputMessage)
            if (!match) return null
            return (
              <SlideMentionPopover
                slides={mentionSlides}
                query={match[1] || ''}
                onKeyboardSelect={studio ? () => textareaRef.current?.focus({ preventScroll: true }) : undefined}
                onSelect={(slide) => {
                  const before = inputMessage.slice(0, match.index)
                  onInputChange(`${before}${mentionToken(slide)} `)
                }}
              />
            )
          })()}

          {/* Textarea */}
          <Textarea
            aria-label={studio ? "Message Director" : undefined}
            data-studio-v4-type-role="prompt"
            ref={studio && composerTextareaRef ? attachStudioTextarea : textareaRef}
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              // MDC P6 (UAT 2026-08-30): while the @mention picker is open,
              // Enter/Tab select the top match — they must never send the
              // message (Enter used to fire the bare tag as its own turn,
              // so the actual ask arrived reference-less and G3 re-asked).
              if (CHAT_MENTIONS && mentionSlides && mentionSlides.length > 0
                  && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
                const m = /@([\w ]{0,30})$/.exec(inputMessage)
                if (m) {
                  const candidates = filterMentionSlides(mentionSlides, m[1] || '')
                  if (candidates.length > 0) {
                    e.preventDefault()
                    const before = inputMessage.slice(0, m.index)
                    onInputChange(`${before}${mentionToken(candidates[0])} `)
                    return
                  }
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                guardedSubmit()
              }
              if (e.key === 'Escape' && awaitingReply) {
                e.preventDefault()
                onStopAwaiting?.()
                return
              }
              if (e.key === 'Escape' && pendingActionInput) {
                e.preventDefault()
                onCancelAction()
              }
            }}
            placeholder={
              !user
                ? "Authenticating..."
                : isLoadingSession
                ? "Loading..."
                : !connected && !connecting
                  ? "Disconnected - send to reconnect"
                  : connecting
                    ? "Connecting..."
                    : isTemplateReuseRunning
                      ? "Director is working..."
                    : awaitingReply
                      ? "Director is replying… (Esc to type anyway)"
                    : pendingActionInput
                      ? "Type your changes... (ESC to cancel)"
                      : "Message Director..."
            }
            disabled={!user || isLoadingSession || isTemplateReuseRunning}
            className="w-full resize-none border-0 bg-transparent focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 pt-3 pb-14 min-h-[96px] max-h-[220px] text-xs placeholder:text-gray-400 dark:text-slate-500 overflow-y-auto dark:text-slate-100 dark:placeholder:text-slate-500"
            rows={1}
          />

          {/* Bottom toolbar inside input */}
          <div data-studio-v4-composer-toolbar="true"
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gray-50 rounded-b-xl dark:bg-slate-800">
            {/* Left: Action buttons */}
            <div className="flex items-center gap-1">
              {/* Direct file upload */}
              {features.enableFileUploads && (
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-1.5 text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-200 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uploadedFiles.length >= 5}
                  onClick={async () => {
                    try {
                      await onRequestSession()
                    } catch {
                      return
                    }
                    fileInputRef.current?.click()
                  }}
                  title="Upload a file"
                  aria-label="Upload a file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              )}

              {/* Template Builder: reuse a saved template (sibling of attach) */}
              {((templateBuilderEnabled && onSelectTemplate) || onOpenComposerLibrary) && (
                <TemplatePicker onSelect={onSelectTemplate || (() => {})} disabled={!user || isLoadingSession}
                  selectionLocked={templateSelectionLocked} onOpenLibrary={onOpenComposerLibrary}
                  showSavedTemplates={!!(templateBuilderEnabled && onSelectTemplate)} />
              )}

              {/* Build-time Theme Builder selection */}
              <DropdownMenu open={themeMenuOpen} onOpenChange={(open) => { setThemeMenuOpen(open); if (open) void refreshSavedThemes() }}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`flex items-center justify-center rounded-lg p-1.5 transition-colors ${
                      buildTheme.mode === 'auto'
                        ? 'text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                        : 'bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900'
                    }`}
                    title={activeThemeLabel}
                    aria-label="Build theme"
                    disabled={!user || isLoadingSession || templateSelectionLocked}
                  >
                    <Palette className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onKeyDownCapture={studio ? (event) => {
                  // Native form Tab traversal must run before Radix menu key handling.
                  if (event.key === 'Tab') event.stopPropagation()
                } : undefined} data-studio-composer-menu={studio ? 'theme' : undefined} data-studio-v4-chrome={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === 'true' ? 'true' : undefined} data-studio-v4-type={process.env.NEXT_PUBLIC_STUDIO_V4_TYPE === 'true' ? 'true' : undefined} data-studio-v4-menu="theme" align="start" className={studio ? 'studio-theme-popover' : 'w-72 p-2'}>
                  {/* Studio theme presentation START */}
                  {studio ? <StudioThemeMenu
                    view={studioThemeView} onView={setStudioThemeView} onClose={() => setThemeMenuOpen(false)}
                    selection={buildTheme} presets={themePresets} presetsLoading={themePresetsLoading} presetsError={!!themePresetsError}
                    themes={visibleSavedThemes} selectedId={selectedSavedThemeId} currentProfile={activeBuildThemeProfile}
                    activeTheme={activeSavedTheme} standardTheme={standardTheme}
                    onPreset={handlePresetChange} onSaved={handleSavedThemeChange} hex={brandHexDraft} onHex={handleBrandHexChange}
                    locked={!user || isLoadingSession || templateSelectionLocked}
                    lockReason={!user ? 'Sign in to choose a build theme.' : isLoadingSession ? 'Loading your conversation…' : templateSelectionLocked ? 'Build theme selection is locked for this deck.' : null}
                    readBusy={studioThemeReadBusy} readFailed={!!studioThemeReadFailed}
                    readEmpty={!!studioThemeReadOwned && studioThemeRead?.phase === 'loaded' && visibleSavedThemes.length === 0}
                    onRefresh={() => void handleStudioThemeRefresh()} requestedTheme={requestedSavedTheme}
                    name={saveThemeName} onName={(name) => { studioThemeDraft.current = { ...studioThemeDraft.current, name, epoch: studioThemeDraft.current.epoch + 1 }; setSaveThemeName(name) }}
                    asStandard={saveAsStandard} onAsStandard={(asStandard) => { studioThemeDraft.current = { ...studioThemeDraft.current, asStandard, epoch: studioThemeDraft.current.epoch + 1 }; setSaveAsStandard(asStandard) }}
                    mutation={ownedStudioThemeMutation}
                    onSave={() => void handleSaveCurrentTheme()} onSetStandard={() => void handleSetStandardTheme()}
                    onClearStandard={() => void handleClearStandardTheme()} onDelete={() => void handleDeleteSavedTheme()}
                  /> : <>
                  {/* Studio theme classic body START */}
                  {studio && (
                    <div data-studio-composer-options-part="heading">
                      <strong>Theme for this presentation</strong>
                      <p>Choose a preset, use a saved theme, or set your brand color.</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div>
                      <div data-studio-v4-type-role="theme-caption" className="mb-1 text-[11px] font-medium text-gray-600 dark:text-slate-300">
                        Build theme
                      </div>
                      <select
                        aria-label={studio ? 'Build theme preset' : undefined}
                        value={buildTheme.mode === 'preset' ? buildTheme.preset_id || 'auto' : 'auto'}
                        onChange={(event) => handlePresetChange(event.target.value)}
                        data-studio-v4-type-role="theme-field"
                        className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        disabled={themePresetsLoading || templateSelectionLocked}
                      >
                        <option value="auto">Auto / default</option>
                        {themePresets.map((preset) => (
                          <option key={preset.preset_id} value={preset.preset_id}>
                            {preset.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div data-studio-v4-type-role="theme-caption" className="mb-1 text-[11px] font-medium text-gray-600 dark:text-slate-300">
                        Brand color
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={isValidThemeHex(brandHexDraft) ? brandHexDraft : '#1e40af'}
                          onChange={(event) => handleBrandHexChange(event.target.value)}
                          className="h-8 w-9 rounded border border-gray-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
                          aria-label="Brand color"
                          disabled={templateSelectionLocked}
                        />
                        <input
                          value={brandHexDraft}
                          onChange={(event) => handleBrandHexChange(event.target.value)}
                          data-studio-v4-type-role="theme-field"
                          className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 font-mono text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="#1e40af"
                          aria-label="Brand hex color"
                          disabled={templateSelectionLocked}
                        />
                      </div>
                    </div>
                    {themePresetsError && (
                      <div data-studio-v4-type-role="theme-warning" className="text-[10px] text-amber-600 dark:text-amber-300">
                        Using local preset list
                      </div>
                    )}
                    <div className="border-t border-gray-100 pt-2 dark:border-slate-800">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span data-studio-v4-type-role="theme-caption" className="text-[11px] font-medium text-gray-600 dark:text-slate-300">
                          My themes
                        </span>
                        {themeProfilesLoading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                      </div>
                      <select
                        aria-label="Saved theme"
                        value={selectedSavedThemeId || ''}
                        onChange={(event) => handleSavedThemeChange(event.target.value)}
                        data-studio-v4-type-role="theme-field"
                        className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        disabled={templateSelectionLocked}
                      >
                        <option value="">Select saved theme</option>
                        {savedThemes.map((theme) => (
                          <option key={theme.id} value={theme.id}>
                            {theme.is_standard ? '★ ' : ''}{theme.name}
                          </option>
                        ))}
                      </select>
                      {requestedSavedTheme && (
                        <p data-studio-v4-saved-theme-request="true" className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-2 py-1.5 text-[11px] leading-relaxed text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
                          From Themes: <strong>{requestedSavedTheme.name}</strong>. Choose it in My themes to apply it.
                        </p>
                      )}
                      {activeSavedTheme && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            data-studio-v4-type-role="theme-standard-action"
                            onClick={handleSetStandardTheme}
                            className="flex h-7 items-center gap-1 rounded-md border border-gray-200 px-2 text-[11px] text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            title="Set as standard"
                            aria-label="Set as standard"
                            disabled={templateSelectionLocked}
                          >
                            <Star className="h-3.5 w-3.5" />
                            {activeSavedTheme.is_standard ? 'Standard' : 'Set standard'}
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteSavedTheme}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            title="Delete saved theme"
                            aria-label="Delete saved theme"
                            disabled={templateSelectionLocked}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      {standardTheme && (
                        <div data-studio-v4-type-role="theme-standard-line" className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-gray-500 dark:text-slate-400">
                          <span data-studio-v4-type-role="theme-standard-line" className="truncate">Standard: {standardTheme.name}</span>
                          <button
                            type="button"
                            data-studio-v4-type-role="theme-standard-action"
                            onClick={handleClearStandardTheme}
                            className="shrink-0 text-sky-600 hover:text-sky-700 dark:text-sky-300"
                            disabled={templateSelectionLocked}
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-100 pt-2 dark:border-slate-800">
                      <div data-studio-v4-type-role="theme-caption" className="mb-1 text-[11px] font-medium text-gray-600 dark:text-slate-300">
                        Save current
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          value={saveThemeName}
                          onChange={(event) => setSaveThemeName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void handleSaveCurrentTheme()
                            }
                          }}
                          data-studio-v4-type-role="theme-field"
                          className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Theme name"
                          aria-label="Theme name"
                          disabled={templateSelectionLocked}
                        />
                        <button
                          type="button"
                          onClick={handleSaveCurrentTheme}
                          disabled={templateSelectionLocked || buildTheme.mode === 'auto' || !saveThemeName.trim() || themeProfilesLoading}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-slate-700"
                          title="Save current theme"
                          aria-label="Save current theme"
                        >
                          <Save className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <label data-studio-v4-type-role="theme-standard-label" className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={saveAsStandard}
                          onChange={(event) => setSaveAsStandard(event.target.checked)}
                          className="h-3 w-3"
                          disabled={templateSelectionLocked}
                        />
                        Set as standard
                      </label>
                    </div>
                    {themeProfilesError && (
                      <div data-studio-v4-type-role="theme-warning" className="text-[10px] text-amber-600 dark:text-amber-300">
                        Saved themes unavailable
                      </div>
                    )}
                  </div>
                  {/* Studio theme classic body END */}
                  </>}
                  {/* Studio theme presentation END */}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Settings/Options Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={studio ? "Research options" : undefined}
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent data-studio-composer-menu={studio ? 'research' : undefined} data-studio-v4-chrome={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === 'true' ? 'true' : undefined} data-studio-v4-type={process.env.NEXT_PUBLIC_STUDIO_V4_TYPE === 'true' ? 'true' : undefined} data-studio-v4-menu="research" align="start" className="w-52">
                  {studio && (
                    <div data-studio-composer-options-part="heading">
                      <strong>Research options</strong>
                      <p>Choose sources for this deck.</p>
                    </div>
                  )}
                  {researchSettingsLocked && (
                    <div data-studio-v4-type-role="research-notice" className="mx-2 mb-1 mt-2 rounded-md bg-gray-100 px-2 py-1.5 text-[10px] leading-snug text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                      Locked for this deck — research already ran. Start a new
                      session to change these.
                    </div>
                  )}
                  <div data-studio-v4-type-role="research-row" className="flex items-center justify-between px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                      <span data-studio-v4-type-role="research-choice" className="text-xs">Deep research (includes web){studio && <small>Also turns on web search.</small>}</span>
                    </div>
                    <Switch
                      aria-label={studio ? 'Deep research (includes web)' : undefined}
                      checked={researchEnabled}
                      onCheckedChange={onResearchEnabledChange}
                      disabled={researchSettingsLocked}
                      className="scale-75"
                    />
                  </div>
                  <div data-studio-v4-type-role="research-row" className="flex items-center justify-between px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                      <span data-studio-v4-type-role="research-choice" className="text-xs">Web search{studio && <small>Search the web for supporting sources.</small>}</span>
                    </div>
                    <Switch
                      aria-label={studio ? 'Web search' : undefined}
                      checked={webSearchEnabled}
                      onCheckedChange={onWebSearchEnabledChange}
                      disabled={researchSettingsLocked}
                      className="scale-75"
                    />
                  </div>
                  {showKnowledgeGraphToggle && (
                    <div data-studio-v4-type-role="research-row" className="flex items-center justify-between px-2 py-2">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                        <span data-studio-v4-type-role="research-choice" className="text-xs">Knowledge graph{studio && <small>Use your connected knowledge graph.</small>}</span>
                      </div>
                      {knowledgeGraphAccess === 'ready' ? (
                        <Switch
                          checked={knowledgeGraphEnabled}
                          onCheckedChange={onKnowledgeGraphEnabledChange}
                          disabled={researchSettingsLocked}
                          className="scale-75"
                          aria-label="Use my knowledge graph for this deck"
                        />
                      ) : (
                        <button
                          type="button"
                          data-studio-v4-type-role="research-remedy"
                          onClick={onKnowledgeGraphAccessClick}
                          disabled={knowledgeGraphAccess === 'unavailable' || knowledgeGraphAccess === 'loading'}
                          className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
                        >
                          {knowledgeGraphAccess === 'locked'
                            ? 'Pro'
                            : knowledgeGraphAccess === 'unavailable'
                              ? 'Offline'
                              : knowledgeGraphAccess === 'loading'
                                ? '…'
                                : 'Enable'}
                        </button>
                      )}
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right: Send button - rounded square with up arrow */}
            {isTemplateReuseRunning ? (
              <button
                type="button"
                onClick={onCancelTemplateReuse}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white transition-all hover:bg-rose-700"
                title="Stop template reuse"
                aria-label="Stop template reuse"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                data-studio-v4-send="true"
                aria-label={studio ? "Send message" : undefined}
                type="submit"
                disabled={isSubmitDisabled}
                title={uploadBlockReason ?? undefined}
                aria-disabled={isSubmitDisabled}
                className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                  inputMessage.trim()
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-purple-100 text-purple-300 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Only show loading overlay when actually loading session */}
          {isLoadingSession && (
            <div className="absolute inset-0 bg-white dark:bg-slate-900/50 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-gray-600 dark:text-slate-300" />
            </div>
          )}
        </div>
      </form>
      {studio && (
        <div data-studio-composer-part="footer">
          <span>{composerHint}</span>
          {showConnectionStatus && <span data-studio-composer-part="connection" role="status">{composerConnection}</span>}
        </div>
      )}
    </div>
  )
}
