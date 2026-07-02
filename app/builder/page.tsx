"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useDecksterWebSocketV2, type DirectorMessage, type ActionRequest, type SlideUpdate, type SlideComposeReady, type SlideComposeFailed } from "@/hooks/use-deckster-websocket-v2"
import { useChatSessions } from "@/hooks/use-chat-sessions"
import { useSessionPersistence } from "@/hooks/use-session-persistence"
import { WebSocketErrorBoundary } from "@/components/error-boundary"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatHistorySidebar } from "@/components/chat-history-sidebar"
import { OnboardingModal } from "@/components/onboarding-modal"
import { useFileUpload } from '@/hooks/use-file-upload'
import { features } from '@/lib/config'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { SlideGenerationPanel, type SlideComposeAcceptedJob, type SlideComposeBuiltResult } from '@/components/slide-generation-panel'
import { TextBoxFormatPanel } from '@/components/textbox-format-panel'
import { TextBoxFormatting, type SlideComposeViewerApi } from '@/components/presentation-viewer'
import { ElementFormatPanel } from '@/components/element-format-panel'
import { ElementType, ElementProperties, SlideLayoutType } from '@/types/elements'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { GenerationPanel } from '@/components/generation-panel'
import { useGenerationPanel } from '@/hooks/use-generation-panel'
import { iframeTypeToTextLabs, isTextLabsMappable } from '@/lib/element-type-mapping'
import { useBlankElements } from '@/hooks/use-blank-elements'
import { useTextLabsSession } from '@/hooks/use-textlabs-session'
// Extracted components
import { MessageList } from '@/components/builder/message-list'
import { ChatInput } from '@/components/builder/chat-input'
import { BuilderHeader } from '@/components/builder/builder-header'
import { PresentationArea } from '@/components/builder/presentation-area'
import { TemplateParamsPanel, TEMPLATE_PANEL_COLLAPSED_WIDTH } from '@/components/builder/template-params-panel'
import { TokenUsageStrip } from '@/components/builder/token-usage-strip'
import { TopUpModal } from '@/components/builder/topup-modal'
import type { SlideComposeThumbnailJob } from '@/components/slide-thumbnail-strip'
import {
  canPollCompleteSlideComposeJob,
  canLiveReconcileSlideCompose,
  getComposeVisualIndexForTarget,
  resolveSlideComposeVisualIndex,
  resolveSlideComposeCountAfterReady,
  shouldNavigateToResolvedComposeSlide,
  shouldUseIncomingComposePresentationUrl,
  shiftSlideComposeTargetsAfterInsert,
  SLIDE_COMPOSE_WATCHDOG_MS,
} from '@/lib/slide-compose-async'

// Extracted hooks
import { useBuilderSession } from '@/hooks/use-builder-session'
import { useTextLabsGeneration } from '@/hooks/use-textlabs-generation'
import { useKnowledgeGraph } from '@/hooks/use-knowledge-graph'
import { useQuota } from '@/hooks/use-quota'
import { useThemeProfiles } from '@/hooks/use-theme-profiles'
import { useTemplates, type TemplateBlueprint, type TemplateSnapshot } from '@/hooks/use-templates'
import type { BuildThemeSelection } from '@/lib/theme-builder'
import { LAYOUT_SERVICE_URL } from '@/lib/layout-service-client'
import type { TemplateModeOverride, TemplateOverrides } from '@/lib/template-mode'

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

const DEFAULT_DRAWER_WIDTH = 420
const MIN_DRAWER_WIDTH = 320
const MAX_DRAWER_WIDTH_RATIO = 0.5
const BUILDER_SESSION_OPTIONS_VERSION = 1

function scTrace(event: string, payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (!features.slideComposerTraceEnabled && window.localStorage?.getItem('deckster.slideComposerTrace') !== 'true') return
  console.info('[SC_TRACE]', event, payload)
}

type BuilderTemplateSelection = { id: string; name: string }
type ActiveBuildThemeProfile = { id: string; name: string }

type SlideComposeJobStatus = 'building' | 'error'

interface SlideComposeJobState {
  job_id: string
  target_visual_index: number
  target_layout_index: number
  status: SlideComposeJobStatus
  title: string
  request: Record<string, unknown>
  real_slide_id?: string | null
  expected_slide_count?: number | null
  errors?: string[]
}

interface BuilderSessionOptions {
  version: typeof BUILDER_SESSION_OPTIONS_VERSION
  activeTemplate: BuilderTemplateSelection | null
  buildThemeSelection: BuildThemeSelection
  activeBuildThemeProfile: ActiveBuildThemeProfile | null
}

function getBuilderSessionOptionsKey(sessionId: string): string {
  return `deckster_builder_options_${sessionId}`
}

function normalizeStoredBuildThemeSelection(value: unknown): BuildThemeSelection {
  if (!value || typeof value !== 'object') return { mode: 'auto' }

  const raw = value as Partial<BuildThemeSelection>
  if (raw.mode === 'preset') {
    return typeof raw.preset_id === 'string'
      ? { mode: 'preset', preset_id: raw.preset_id }
      : { mode: 'auto' }
  }

  if (raw.mode === 'custom') {
    const next: BuildThemeSelection = { mode: 'custom' }
    if (typeof raw.primary_hex === 'string') next.primary_hex = raw.primary_hex
    if (raw.color_overrides && typeof raw.color_overrides === 'object') {
      next.color_overrides = raw.color_overrides
    }
    return next.primary_hex || next.color_overrides ? next : { mode: 'auto' }
  }

  return { mode: 'auto' }
}

function normalizeStoredTemplate(value: unknown): BuilderTemplateSelection | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Partial<BuilderTemplateSelection>
  return typeof raw.id === 'string' && typeof raw.name === 'string'
    ? { id: raw.id, name: raw.name }
    : null
}

function normalizeStoredBuildThemeProfile(value: unknown): ActiveBuildThemeProfile | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Partial<ActiveBuildThemeProfile>
  return typeof raw.id === 'string' && typeof raw.name === 'string'
    ? { id: raw.id, name: raw.name }
    : null
}

function stableStringifyRecord(value: Record<string, string> | undefined): string {
  if (!value) return ''
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        acc[key] = value[key]
        return acc
      }, {}),
  )
}

function buildThemeSelectionsEqual(a: BuildThemeSelection, b: BuildThemeSelection): boolean {
  if (a.mode !== b.mode) return false
  if (a.mode === 'auto') return true
  if (a.mode === 'preset') return a.preset_id === b.preset_id

  return (
    (a.primary_hex || '').toLowerCase() === (b.primary_hex || '').toLowerCase() &&
    stableStringifyRecord(a.color_overrides) === stableStringifyRecord(b.color_overrides)
  )
}

function readBuilderSessionOptions(sessionId: string): BuilderSessionOptions {
  if (typeof window === 'undefined') {
    return {
      version: BUILDER_SESSION_OPTIONS_VERSION,
      activeTemplate: null,
      buildThemeSelection: { mode: 'auto' },
      activeBuildThemeProfile: null,
    }
  }

  try {
    const raw = window.sessionStorage.getItem(getBuilderSessionOptionsKey(sessionId))
    if (!raw) {
      return {
        version: BUILDER_SESSION_OPTIONS_VERSION,
        activeTemplate: null,
        buildThemeSelection: { mode: 'auto' },
        activeBuildThemeProfile: null,
      }
    }

    const parsed = JSON.parse(raw) as Partial<BuilderSessionOptions>
    if (parsed.version !== BUILDER_SESSION_OPTIONS_VERSION) {
      return {
        version: BUILDER_SESSION_OPTIONS_VERSION,
        activeTemplate: null,
        buildThemeSelection: { mode: 'auto' },
        activeBuildThemeProfile: null,
      }
    }

    return {
      version: BUILDER_SESSION_OPTIONS_VERSION,
      activeTemplate: normalizeStoredTemplate(parsed.activeTemplate),
      buildThemeSelection: normalizeStoredBuildThemeSelection(parsed.buildThemeSelection),
      activeBuildThemeProfile: normalizeStoredBuildThemeProfile(parsed.activeBuildThemeProfile),
    }
  } catch {
    return {
      version: BUILDER_SESSION_OPTIONS_VERSION,
      activeTemplate: null,
      buildThemeSelection: { mode: 'auto' },
      activeBuildThemeProfile: null,
    }
  }
}

function writeBuilderSessionOptions(
  sessionId: string,
  activeTemplate: BuilderTemplateSelection | null,
  buildThemeSelection: BuildThemeSelection,
  activeBuildThemeProfile: ActiveBuildThemeProfile | null,
): void {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(
      getBuilderSessionOptionsKey(sessionId),
      JSON.stringify({
        version: BUILDER_SESSION_OPTIONS_VERSION,
        activeTemplate,
        buildThemeSelection,
        activeBuildThemeProfile,
      } satisfies BuilderSessionOptions),
    )
  } catch {
    // Browser storage can fail in private mode/quota scenarios; the session still works.
  }
}

function hasTemplateOverrideEntries(overrides: TemplateOverrides): boolean {
  return Object.values(overrides).some((slideOverrides) => Object.keys(slideOverrides).length > 0)
}

function mergeTemplateOverride(
  existing: TemplateModeOverride,
  patch: TemplateModeOverride,
): TemplateModeOverride {
  const next: TemplateModeOverride = { ...existing }

  for (const [key, value] of Object.entries(patch)) {
    const existingValue = next[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existingValue &&
      typeof existingValue === 'object' &&
      !Array.isArray(existingValue)
    ) {
      next[key] = {
        ...(existingValue as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      }
    } else {
      next[key] = value
    }
  }

  return next
}

function asTemplateModeOverride(value: unknown): TemplateModeOverride {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as TemplateModeOverride
    : {}
}

function withSlideComposerRefreshToken(url: string | null, token: number): string | null {
  if (!url || !token) return url
  const [base, hash] = url.split('#', 2)
  const separator = base.includes('?') ? '&' : '?'
  const refreshed = `${base}${separator}sc_refresh=${encodeURIComponent(String(token))}`
  return hash ? `${refreshed}#${hash}` : refreshed
}

function BuilderContent() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const themeSearchOverride = searchParams.get('theme')

  // Session management
  const { loadSession, createSession } = useChatSessions()

  // UI state
  const [inputMessage, setInputMessage] = useState("")
  const templateBuilderEnabled = process.env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED === 'true'
  const blueprintEditorV2Enabled = templateBuilderEnabled && process.env.NEXT_PUBLIC_BLUEPRINT_EDITOR_V2 === 'true'
  // Template Builder (reuse): the locked-in template, carried on every send.
  const [activeTemplate, setActiveTemplate] = useState<BuilderTemplateSelection | null>(null)
  const [templateModeOn, setTemplateModeOn] = useState(false)
  const [templateSnapshot, setTemplateSnapshot] = useState<TemplateSnapshot | null>(null)
  const [templateSnapshotLoading, setTemplateSnapshotLoading] = useState(false)
  const [templateBlueprintDirty, setTemplateBlueprintDirty] = useState(false)
  const [templateBlueprintSaving, setTemplateBlueprintSaving] = useState(false)
  const [templateParamsCollapsed, setTemplateParamsCollapsed] = useState(false)
  const [templateOverrides, setTemplateOverrides] = useState<TemplateOverrides>({})
  const [selectedTemplateElementId, setSelectedTemplateElementId] = useState<string | null>(null)
  const [buildThemeSelection, setBuildThemeSelection] = useState<BuildThemeSelection>({ mode: 'auto' })
  const [activeBuildThemeProfile, setActiveBuildThemeProfile] = useState<ActiveBuildThemeProfile | null>(null)
  const standardThemeLoadedRef = useRef(false)
  const buildThemeSelectionRef = useRef(buildThemeSelection)
  const { getStandardTheme } = useThemeProfiles()
  const { getTemplate, updateTemplateBlueprint } = useTemplates()
  const hasTemplateOverrides = useMemo(
    () => hasTemplateOverrideEntries(templateOverrides),
    [templateOverrides],
  )
  const templateSendOptions = useMemo(() => {
    if (!activeTemplate) return {}

    return {
      templateMode: true as const,
      templateId: activeTemplate.id,
      ...(hasTemplateOverrides ? { elementOverrides: templateOverrides } : {}),
    }
  }, [activeTemplate, hasTemplateOverrides, templateOverrides])
  const buildSendOptions = useMemo(
    () => ({ ...templateSendOptions, theme: buildThemeSelection }),
    [templateSendOptions, buildThemeSelection],
  )
  const templateModeSourcePresentationId = templateModeOn
    ? templateSnapshot?.source_presentation_id ?? null
    : null
  const templateModeSourcePresentationUrl = useMemo(
    () => templateModeSourcePresentationId
      ? `${LAYOUT_SERVICE_URL}/p/${encodeURIComponent(templateModeSourcePresentationId)}`
      : null,
    [templateModeSourcePresentationId],
  )
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [researchEnabled, setResearchEnabled] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)
  const { isSubscribed: kgSubscribed, isPremium: kgIsPremium } = useKnowledgeGraph()
  const [knowledgeGraphEnabled, setKnowledgeGraphEnabled] = useState(false)
  const showKnowledgeGraphToggle = kgIsPremium && kgSubscribed

  useEffect(() => {
    if (kgSubscribed) setKnowledgeGraphEnabled(true)
  }, [kgSubscribed])

  useEffect(() => {
    buildThemeSelectionRef.current = buildThemeSelection
  }, [buildThemeSelection])

  useEffect(() => {
    if (
      !user ||
      isAuthLoading ||
      standardThemeLoadedRef.current ||
      themeSearchOverride ||
      buildThemeSelection.mode !== 'auto'
    ) {
      return
    }

    standardThemeLoadedRef.current = true
    void (async () => {
      try {
        const profile = await getStandardTheme()
        if (
          profile?.theme_payload &&
          profile.theme_payload.mode !== 'auto' &&
          buildThemeSelectionRef.current.mode === 'auto'
        ) {
          setBuildThemeSelection(profile.theme_payload)
          setActiveBuildThemeProfile({ id: profile.id, name: profile.name })
        }
      } catch {
        // Standard-theme hydration is display-only; Director still resolves it.
      }
    })()
  }, [user, isAuthLoading, themeSearchOverride, buildThemeSelection.mode, getStandardTheme])

  const [sessionStoreName, setSessionStoreName] = useState<string | null>(null)
  const [pendingActionInput, setPendingActionInput] = useState<{
    action: ActionRequest['payload']['actions'][0];
    messageId: string;
    timestamp: number;
  } | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showFormatPanel, setShowFormatPanel] = useState(false)
  const [showChat, setShowChat] = useState(true)
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH)
  const [isResizingDrawer, setIsResizingDrawer] = useState(false)
  // Theme is owned by next-themes' ThemeProvider (app/layout.tsx). The
  // sun/moon toggle in BuilderHeader and the "Dark Mode" entry in the
  // user-profile menu both call setTheme(), so they stay in sync. No
  // local builder-only theme state.
  // Text box selection state
  const [showTextBoxPanel, setShowTextBoxPanel] = useState(false)
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
  const [selectedTextBoxFormatting, setSelectedTextBoxFormatting] = useState<TextBoxFormatting | null>(null)
  // Element selection state
  const [showElementPanel, setShowElementPanel] = useState(false)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedElementType, setSelectedElementType] = useState<ElementType | null>(null)
  const [selectedElementProperties, setSelectedElementProperties] = useState<ElementProperties | null>(null)
  // Layout Service API handlers
  const [layoutServiceApis, setLayoutServiceApis] = useState<{
    getSelectionInfo: () => Promise<{ hasSelection: boolean; selectedText?: string; sectionId?: string; slideIndex?: number } | null>
    updateSectionContent: (slideIndex: number, sectionId: string, content: string) => Promise<boolean>
    sendTextBoxCommand: (action: string, params: Record<string, any>) => Promise<any>
    sendElementCommand: (action: string, params: Record<string, any>) => Promise<any>
  } | null>(null)
  const composeViewerApiRef = useRef<SlideComposeViewerApi | null>(null)


  // Toast notifications
  const { toast } = useToast()

  // Current slide tracking
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const currentSlideIndexRef = useRef(0)
  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex
  }, [currentSlideIndex])
  const [selectedLayoutSlideIndex, setSelectedLayoutSlideIndex] = useState(0)
  const [templateSourceSlideIndex, setTemplateSourceSlideIndex] = useState(0)
  const activeTemplateSlideIndex = templateModeOn ? templateSourceSlideIndex : currentSlideIndex
  const [slideComposerOverride, setSlideComposerOverride] = useState<{
    presentationUrl: string | null
    presentationId: string | null
    slideCount: number | null
    refreshToken: number
  } | null>(null)
  const [slideComposeJobs, setSlideComposeJobs] = useState<Record<string, SlideComposeJobState>>({})
  const slideComposerPresentationRef = useRef<{
    presentationUrl: string | null
    presentationId: string | null
    slideCount: number | null
    activeVersion: 'blank' | 'strawman' | 'final'
    refreshToken: number
  }>({
    presentationUrl: null,
    presentationId: null,
    slideCount: null,
    activeVersion: 'final',
    refreshToken: 0,
  })
  const slideComposeJobsRef = useRef<Record<string, SlideComposeJobState>>({})
  useEffect(() => {
    slideComposeJobsRef.current = slideComposeJobs
  }, [slideComposeJobs])
  const pendingComposePlaceholdersRef = useRef<Map<string, {
    jobId: string
    visualIndex: number
    replaceJobId?: string
  }>>(new Map())
  const slideComposeWatchdogsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const slideComposePollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const slideComposeReconcileQueuesRef = useRef<Record<string, Promise<void>>>({})
  const slideComposeFallbackReloadInFlightRef = useRef(false)

  const clearSlideComposeWatchdog = useCallback((jobId: string) => {
    const timer = slideComposeWatchdogsRef.current[jobId]
    if (timer) {
      clearTimeout(timer)
      delete slideComposeWatchdogsRef.current[jobId]
    }
  }, [])

  const clearSlideComposePoller = useCallback((jobId: string) => {
    const timer = slideComposePollersRef.current[jobId]
    if (timer) {
      clearInterval(timer)
      delete slideComposePollersRef.current[jobId]
    }
  }, [])

  const triggerCoalescedSlideComposeReload = useCallback((reason: string) => {
    if (slideComposeFallbackReloadInFlightRef.current) return
    slideComposeFallbackReloadInFlightRef.current = true
    const snapshot = slideComposerPresentationRef.current
    scTrace('builder.reload_fallback.trigger', {
      reason,
      presentation_id: snapshot.presentationId,
      slide_count: snapshot.slideCount,
      refresh_token_before: snapshot.refreshToken,
      jobs: Object.values(slideComposeJobsRef.current).map(job => ({
        job_id: job.job_id,
        status: job.status,
        target_visual_index: job.target_visual_index,
        target_layout_index: job.target_layout_index,
        real_slide_id: job.real_slide_id ?? null,
      })),
    })
    const nextOverride = {
      presentationUrl: snapshot.presentationUrl,
      presentationId: snapshot.presentationId,
      slideCount: snapshot.slideCount,
      refreshToken: Date.now(),
    }
    slideComposerPresentationRef.current = {
      ...snapshot,
      ...nextOverride,
    }
    setSlideComposerOverride(nextOverride)
    window.setTimeout(() => {
      slideComposeFallbackReloadInFlightRef.current = false
    }, 8000)
    console.warn('[Slide Composer] Falling back to iframe reload:', reason)
  }, [])

  const enqueueSlideComposeReconcile = useCallback((
    presentationKey: string,
    task: () => Promise<void>,
  ) => {
    const key = presentationKey || '__unknown_presentation__'
    const previous = slideComposeReconcileQueuesRef.current[key] ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(task)
    const queued = next.finally(() => {
      if (slideComposeReconcileQueuesRef.current[key] === queued) {
        delete slideComposeReconcileQueuesRef.current[key]
      }
    })
    slideComposeReconcileQueuesRef.current[key] = queued
    return queued
  }, [])

  const removeSlideComposeJob = useCallback((jobId: string, insertedLayoutIndex?: number | null) => {
    clearSlideComposeWatchdog(jobId)
    clearSlideComposePoller(jobId)
    pendingComposePlaceholdersRef.current.delete(jobId)
    setSlideComposeJobs(prev => shiftSlideComposeTargetsAfterInsert(prev, jobId, insertedLayoutIndex))
  }, [clearSlideComposePoller, clearSlideComposeWatchdog])

  const fetchSlideComposePresentationSnapshot = useCallback(async (presentationId: string | null | undefined) => {
    if (!presentationId) return null
    try {
      const response = await fetch(`${LAYOUT_SERVICE_URL}/api/presentations/${encodeURIComponent(presentationId)}`, {
        cache: 'no-store',
      })
      if (!response.ok) return null
      const data = await response.json().catch(() => null) as { slides?: Array<{ slide_id?: string; id?: string }> } | null
      const slides = Array.isArray(data?.slides) ? data.slides : []
      return {
        slideCount: slides.length,
        slideIds: new Set(slides.map(slide => String(slide.slide_id || slide.id || '')).filter(Boolean)),
      }
    } catch (error) {
      console.warn('[Slide Composer] Completion poll failed.', error)
      return null
    }
  }, [])

  const confirmSlideComposeJobAfterRefresh = useCallback(async (jobId: string) => {
    const job = slideComposeJobsRef.current[jobId]
    if (!job) return false
    const snapshot = slideComposerPresentationRef.current
    const presentation = await fetchSlideComposePresentationSnapshot(snapshot.presentationId)
    if (!presentation) return false

    const hasExpectedSlide = job.real_slide_id
      ? presentation.slideIds.has(job.real_slide_id)
      : presentation.slideCount >= Math.max(job.expected_slide_count ?? 0, job.target_layout_index + 1)

    scTrace('builder.refresh_confirm', {
      job_id: jobId,
      real_slide_id: job.real_slide_id ?? null,
      target_layout_index: job.target_layout_index,
      expected_slide_count: job.expected_slide_count ?? null,
      fetched_slide_count: presentation.slideCount,
      has_expected_slide: hasExpectedSlide,
    })

    if (!hasExpectedSlide) return false

    removeSlideComposeJob(jobId)
    const nextOverride = {
      presentationUrl: snapshot.presentationUrl,
      presentationId: snapshot.presentationId,
      slideCount: Math.max(snapshot.slideCount ?? 0, presentation.slideCount),
      refreshToken: snapshot.refreshToken,
    }
    slideComposerPresentationRef.current = {
      ...snapshot,
      ...nextOverride,
    }
    setSlideComposerOverride(nextOverride)
    return true
  }, [fetchSlideComposePresentationSnapshot, removeSlideComposeJob])

  const startSlideComposePoller = useCallback((jobId: string) => {
    clearSlideComposePoller(jobId)
    const poll = async () => {
      const job = slideComposeJobsRef.current[jobId]
      if (!job || job.status !== 'building') {
        clearSlideComposePoller(jobId)
        return
      }
      const snapshot = slideComposerPresentationRef.current
      const presentation = await fetchSlideComposePresentationSnapshot(snapshot.presentationId)
      if (!presentation) return

      const foundById = canPollCompleteSlideComposeJob(job.real_slide_id)
        ? presentation.slideIds.has(job.real_slide_id)
        : false
      scTrace('builder.poll.complete_check', {
        job_id: jobId,
        real_slide_id: job.real_slide_id ?? null,
        target_layout_index: job.target_layout_index,
        expected_slide_count: job.expected_slide_count ?? null,
        fetched_slide_count: presentation.slideCount,
        found_by_id: foundById,
        found_by_count: false,
        count_only_poll_disabled: !canPollCompleteSlideComposeJob(job.real_slide_id),
      })
      if (!foundById) return

      triggerCoalescedSlideComposeReload(`compose job ${jobId} found by completion poll`)
      void confirmSlideComposeJobAfterRefresh(jobId)
    }

    slideComposePollersRef.current[jobId] = setTimeout(() => {
      void poll()
      slideComposePollersRef.current[jobId] = setInterval(() => {
        void poll()
      }, 10_000)
    }, 15_000) as unknown as ReturnType<typeof setInterval>
  }, [
    clearSlideComposePoller,
    confirmSlideComposeJobAfterRefresh,
    fetchSlideComposePresentationSnapshot,
    triggerCoalescedSlideComposeReload,
  ])

  // Portal target for toolbar in header
  const [toolbarPortalTarget, setToolbarPortalTarget] = useState<HTMLDivElement | null>(null)

  // Text Labs Generation Panel
  const generationPanel = useGenerationPanel()
  const blankElements = useBlankElements()

  // Z-index tracking for drawer stacking order
  const zCounterRef = useRef(0)
  const [panelZIndices, setPanelZIndices] = useState({ element: 0, slide: 0, deck: 0 })

  const bringToFront = useCallback((panel: 'element' | 'slide' | 'deck') => {
    zCounterRef.current += 1
    const z = zCounterRef.current
    setPanelZIndices(prev => ({ ...prev, [panel]: z }))
  }, [])

  const clampDrawerWidth = useCallback((width: number) => {
    if (typeof window === 'undefined') {
      return Math.min(Math.max(width, MIN_DRAWER_WIDTH), DEFAULT_DRAWER_WIDTH)
    }

    const maxWidth = Math.max(MIN_DRAWER_WIDTH, Math.floor(window.innerWidth * MAX_DRAWER_WIDTH_RATIO))
    return Math.min(Math.max(width, MIN_DRAWER_WIDTH), maxWidth)
  }, [])

  const handleDrawerResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()

    const startX = event.clientX
    const startWidth = drawerWidth
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect

    setIsResizingDrawer(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = clampDrawerWidth(startWidth + moveEvent.clientX - startX)
      setDrawerWidth(nextWidth)
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      const finalWidth = clampDrawerWidth(startWidth + upEvent.clientX - startX)
      setDrawerWidth(finalWidth)
      window.localStorage.setItem('deckster_builder_drawer_width', String(finalWidth))
      setIsResizingDrawer(false)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [clampDrawerWidth, drawerWidth])

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem('deckster_builder_drawer_width'))
    if (Number.isFinite(savedWidth) && savedWidth > 0) {
      setDrawerWidth(clampDrawerWidth(savedWidth))
    }
  }, [clampDrawerWidth])

  useEffect(() => {
    const handleResize = () => {
      setDrawerWidth(prev => {
        const next = clampDrawerWidth(prev)
        window.localStorage.setItem('deckster_builder_drawer_width', String(next))
        return next
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampDrawerWidth])

  // Drawer open conditions
  const isElementDrawerOpen = generationPanel.isOpen || showTextBoxPanel || showElementPanel
  const isSlideDrawerOpen = features.slideComposerEnabled && showFormatPanel
  const isDeckDrawerOpen = showChat
  const isTemplateParamsDrawerOpen = templateBuilderEnabled
    && templateModeOn
    && (blueprintEditorV2Enabled || Boolean(selectedTemplateElementId))
  const anyNonTemplateDrawerOpen = isElementDrawerOpen || isSlideDrawerOpen || isDeckDrawerOpen
  const drawerOffset = anyNonTemplateDrawerOpen
    ? drawerWidth
    : isTemplateParamsDrawerOpen && templateParamsCollapsed
      ? TEMPLATE_PANEL_COLLAPSED_WIDTH
      : isTemplateParamsDrawerOpen
        ? drawerWidth
        : 0
  const showDrawerResizeHandle = anyNonTemplateDrawerOpen || (isTemplateParamsDrawerOpen && !templateParamsCollapsed)

  // FIXED: Track when generating final/strawman presentations
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false)
  const [isGeneratingStrawman, setIsGeneratingStrawman] = useState(false)
  // Persist isUnsavedSession in sessionStorage so it survives page refresh.
  // Without this, refreshing after immediateConnection generates a UUID loses
  // the "unsaved" flag, causing persistence and uploads to hit 404.
  const [isUnsavedSession, setIsUnsavedSession] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlSessionId = params.get('session_id')
      if (urlSessionId && urlSessionId !== 'new') {
        return sessionStorage.getItem(`deckster_unsaved_${urlSessionId}`) === 'true'
      }
    }
    return false
  })

  // Guard to prevent concurrent executions of handleSendMessage
  const isExecutingSendRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // CRITICAL: currentSessionId must be declared here in page.tsx (not inside useBuilderSession)
  // so useSessionPersistence gets the correct sessionId synchronously — no multi-render delay.
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlSessionId = params.get('session_id')
      // The URL is the single source of truth for which session to show:
      //   ?session_id=<uuid> → resume that deck
      //   ?session_id=new  or  no param → fresh session (Director greets + blank canvas)
      // A bare /builder must NEVER resurrect a prior deck. Reload persistence is handled
      // by the URL, not hidden storage: once a session is active the app rewrites the URL
      // to ?session_id=<uuid> (use-builder-session.ts), so a browser refresh keeps the
      // param and the deck. PR #77 regressed this by restoring
      // sessionStorage['deckster_active_session_id'] on every no-param load, so opening a
      // "new" session silently reopened the last deck with no greeting (empty chat + a
      // templated deck appearing unrequested). Restoring URL-only intent fixes it.
      if (urlSessionId && urlSessionId !== 'new') return urlSessionId
    }
    return null
  })

  const persistence = useSessionPersistence({
    sessionId: currentSessionId || '',
    enabled: !!currentSessionId && !isUnsavedSession,
    debounceMs: 500,
    onError: (error) => {
      console.error('Persistence error:', error)
    }
  })

  // CRITICAL FIX: Use refs to avoid stale closures in onSessionStateChange callback
  const persistenceRef = useRef(persistence)
  useEffect(() => {
    persistenceRef.current = persistence
  }, [persistence])

  const currentSessionIdRef = useRef(currentSessionId)
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])
  const builderOptionsRestoredSessionRef = useRef<string | null>(null)
  const skipBuilderOptionsPersistRef = useRef<string | null>(null)

  // Remember the active session so "Back to builder" (in the account-area header)
  // can return the user to this exact deck. Covers create, resume, and
  // dashboard-initiated navigation since they all funnel through currentSessionId.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (currentSessionId && currentSessionId !== "new") {
      try {
        window.localStorage.setItem("deckster:last_session_id", currentSessionId)
      } catch {
        // ignore storage errors (Safari private mode, quota)
      }
    }
  }, [currentSessionId])

  useEffect(() => {
    standardThemeLoadedRef.current = false
    setSlideComposerOverride(null)
    setSlideComposeJobs({})
    Object.values(slideComposeWatchdogsRef.current).forEach(clearTimeout)
    slideComposeWatchdogsRef.current = {}
    Object.values(slideComposePollersRef.current).forEach(clearInterval)
    slideComposePollersRef.current = {}
    pendingComposePlaceholdersRef.current.clear()
    slideComposeReconcileQueuesRef.current = {}
    slideComposeFallbackReloadInFlightRef.current = false
    setSelectedLayoutSlideIndex(0)
    setShowFormatPanel(false)
    setTemplateModeOn(false)
    setTemplateSnapshot(null)
    setTemplateSnapshotLoading(false)
    setTemplateBlueprintDirty(false)
    setTemplateBlueprintSaving(false)
    setTemplateOverrides({})
    setSelectedTemplateElementId(null)
    setTemplateSourceSlideIndex(0)
  }, [currentSessionId])

  useEffect(() => {
    setSelectedTemplateElementId(null)
  }, [activeTemplateSlideIndex, templateModeOn])

  useEffect(() => {
    if (!currentSessionId || currentSessionId === "new") {
      builderOptionsRestoredSessionRef.current = null
      return
    }

    let cancelled = false
    const stored = readBuilderSessionOptions(currentSessionId)
    skipBuilderOptionsPersistRef.current = currentSessionId
    setActiveTemplate(stored.activeTemplate)
    setBuildThemeSelection(stored.buildThemeSelection)
    setActiveBuildThemeProfile(stored.activeBuildThemeProfile)
    builderOptionsRestoredSessionRef.current = currentSessionId

    if (
      !stored.activeBuildThemeProfile &&
      stored.buildThemeSelection.mode !== 'auto' &&
      !themeSearchOverride
    ) {
      void (async () => {
        const profile = await getStandardTheme()
        if (
          !cancelled &&
          profile?.theme_payload &&
          profile.theme_payload.mode !== 'auto' &&
          buildThemeSelectionsEqual(profile.theme_payload, stored.buildThemeSelection)
        ) {
          setActiveBuildThemeProfile({ id: profile.id, name: profile.name })
        }
      })()
    }

    return () => {
      cancelled = true
    }
  }, [currentSessionId, getStandardTheme, themeSearchOverride])

  useEffect(() => {
    if (!currentSessionId || currentSessionId === "new") return
    if (builderOptionsRestoredSessionRef.current !== currentSessionId) return

    if (skipBuilderOptionsPersistRef.current === currentSessionId) {
      skipBuilderOptionsPersistRef.current = null
      return
    }

    writeBuilderSessionOptions(currentSessionId, activeTemplate, buildThemeSelection, activeBuildThemeProfile)
  }, [currentSessionId, activeTemplate, buildThemeSelection, activeBuildThemeProfile])

  const loadTemplateSnapshot = useCallback(async (template: BuilderTemplateSelection): Promise<TemplateSnapshot | null> => {
    setTemplateSnapshotLoading(true)
    try {
      const snapshot = await getTemplate(template.id)
      if (snapshot) {
        setTemplateSnapshot(snapshot)
        setTemplateBlueprintDirty(false)
        setTemplateBlueprintSaving(false)
        return snapshot
      }
      toast({
        title: 'Template unavailable',
        description: 'The saved template could not be loaded for Template Mode.',
        variant: 'destructive',
      })
      return null
    } finally {
      setTemplateSnapshotLoading(false)
    }
  }, [getTemplate, toast])

  const handleSelectTemplate = useCallback(async (template: BuilderTemplateSelection) => {
    setActiveTemplate(template)
    setTemplateOverrides({})
    setTemplateBlueprintDirty(false)
    setTemplateBlueprintSaving(false)
    setSelectedTemplateElementId(null)
    setTemplateSourceSlideIndex(currentSlideIndex)
    if (!templateBuilderEnabled) return

    setTemplateParamsCollapsed(false)
    setTemplateModeOn(true)
    const snapshot = await loadTemplateSnapshot(template)
    if (!snapshot) {
      setTemplateModeOn(false)
    }
  }, [currentSlideIndex, loadTemplateSnapshot, templateBuilderEnabled])

  const handleClearTemplate = useCallback(() => {
    setActiveTemplate(null)
    setTemplateModeOn(false)
    setTemplateSnapshot(null)
    setTemplateSnapshotLoading(false)
    setTemplateBlueprintDirty(false)
    setTemplateBlueprintSaving(false)
    setTemplateParamsCollapsed(false)
    setTemplateOverrides({})
    setSelectedTemplateElementId(null)
    setTemplateSourceSlideIndex(0)
  }, [])

  const handleTemplateOverrideChange = useCallback((
    slideIndex: number,
    overrideKey: string,
    patch: TemplateModeOverride,
  ) => {
    setTemplateOverrides((previous) => {
      const slideKey = String(slideIndex)
      const currentSlide = previous[slideKey] ?? {}
      const currentElementOverride = asTemplateModeOverride(currentSlide[overrideKey])

      return {
        ...previous,
        [slideKey]: {
          ...currentSlide,
          [overrideKey]: mergeTemplateOverride(currentElementOverride, patch),
        },
      }
    })
  }, [])

  const handleTemplateBlueprintChange = useCallback((blueprint: TemplateBlueprint) => {
    setTemplateSnapshot((previous) => previous
      ? { ...previous, template_blueprint: blueprint }
      : previous
    )
    setTemplateBlueprintDirty(true)
  }, [])

  const handleTemplateBlueprintSave = useCallback(async () => {
    if (!activeTemplate || !templateSnapshot?.template_blueprint) return

    setTemplateBlueprintSaving(true)
    try {
      const snapshot = await updateTemplateBlueprint(activeTemplate.id, templateSnapshot.template_blueprint)
      if (!snapshot) {
        toast({
          title: 'Template changes not saved',
          description: 'Director could not persist the template blueprint.',
          variant: 'destructive',
        })
        return
      }

      setTemplateSnapshot(snapshot)
      setTemplateBlueprintDirty(false)
      toast({
        title: 'Template changes saved',
        description: 'Reusable slide and element details are now persisted.',
      })
    } finally {
      setTemplateBlueprintSaving(false)
    }
  }, [activeTemplate, templateSnapshot?.template_blueprint, toast, updateTemplateBlueprint])

  const handleTemplateElementSelect = useCallback((overrideKey: string | null) => {
    setSelectedTemplateElementId(overrideKey)
    if (!overrideKey) return

    setTemplateParamsCollapsed(false)
    setShowChat(false)
    setShowTextBoxPanel(false)
    setShowElementPanel(false)
    setShowFormatPanel(false)
    generationPanel.closePanel()
  }, [generationPanel])

  const handleTemplateModeChange = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      if (templateBlueprintDirty && templateSnapshot?.template_blueprint && activeTemplate) {
        await handleTemplateBlueprintSave()
      }
      setTemplateModeOn(false)
      setSelectedTemplateElementId(null)
      return
    }

    if (!activeTemplate) {
      toast({
        title: 'Select a template first',
        description: 'Template Mode opens from an available saved template.',
      })
      return
    }

    setTemplateModeOn(true)
    setTemplateParamsCollapsed(false)
    setTemplateSourceSlideIndex(currentSlideIndex)
    if (!templateSnapshot || templateSnapshot.id !== activeTemplate.id) {
      const snapshot = await loadTemplateSnapshot(activeTemplate)
      if (!snapshot) setTemplateModeOn(false)
    }
  }, [
    activeTemplate,
    currentSlideIndex,
    handleTemplateBlueprintSave,
    loadTemplateSnapshot,
    templateBlueprintDirty,
    templateSnapshot,
    toast,
  ])

  // WebSocket v2 integration
  const {
    connected,
    connecting,
    connectionState,
    error: wsError,
    messages,
    presentationUrl,
    presentationId,
    slideCount,
    currentStatus,
    slideStructure,
    strawmanPreviewUrl,
    finalPresentationUrl,
    strawmanPresentationId,
    finalPresentationId,
    deckOwnerSessionId,
    blankPresentationUrl,
    blankPresentationId,
    isBlankPresentation,
    activeVersion,
    slideContextByIndex,
    ephemeralMessageIds,
    ephemeralFadeToken,
    tokenUsage,
    tokenUsageMessageId,
    sendMessage,
    clearMessages,
    clearEphemeralIds,
    restoreMessages,
    switchVersion,
    connect,
    disconnect,
    isReady,
    sessionId: wsSessionId,
    updateCacheUserMessages
  } = useDecksterWebSocketV2({
    // Don't auto-connect when restoring an existing session from URL.
    // The useBuilderSession hook will connect AFTER DB load + restoreMessages,
    // preventing Director's blank state from flashing before restored content.
    autoConnect: features.immediateConnection && !currentSessionId,
    existingSessionId: currentSessionId || undefined,
    reconnectOnError: false,
    maxReconnectAttempts: 0,
    reconnectDelay: 5000,
    onSessionStateChange: (state) => {
      console.log('CALLBACK INVOKED!', {
        currentSessionId: currentSessionIdRef.current,
        hasPersistence: !!persistenceRef.current,
        currentStage: state.currentStage,
        hasUrl: !!state.presentationUrl,
        hasPresentationId: !!state.presentationId
      });

      if (currentSessionIdRef.current && persistenceRef.current) {
        const isStrawman = state.currentStage === 4
        const isFinal = state.currentStage === 6

        const updates: any = {
          currentStage: state.currentStage,
          slideCount: state.slideCount,
          lastMessageAt: new Date(),
          stateCache: {
            activeVersion: state.activeVersion,
            slideStructure: state.slideStructure
          }
        }

        if (isStrawman) {
          updates.strawmanPreviewUrl = state.presentationUrl
          updates.strawmanPresentationId = state.presentationId
          console.log('Saving strawman URLs:', { url: state.presentationUrl, id: state.presentationId, activeVersion: state.activeVersion })
        } else if (isFinal) {
          updates.finalPresentationUrl = state.presentationUrl
          updates.finalPresentationId = state.presentationId
          console.log('Saving final URLs:', { url: state.presentationUrl, id: state.presentationId, activeVersion: state.activeVersion })
        }

        persistenceRef.current.updateMetadata(updates)
      } else {
        console.error('PERSISTENCE BLOCKED:', {
          reason: !currentSessionIdRef.current ? 'No currentSessionId' : 'No persistenceRef.current',
          currentSessionId: currentSessionIdRef.current,
          hasPersistenceRef: !!persistenceRef.current
        });
      }
    },
    onSlideComposeReady: (message: SlideComposeReady) => {
      const payload = message.payload
      const presentationKey = payload.presentation_id
        ?? slideComposerPresentationRef.current.presentationId
        ?? '__unknown__'
      scTrace('builder.ws.slide_ready.received', {
        payload,
        presentation_key: presentationKey,
        current_visual_index: currentSlideIndexRef.current,
        selected_layout_index: selectedLayoutSlideIndex,
        jobs: Object.values(slideComposeJobsRef.current).map(job => ({
          job_id: job.job_id,
          status: job.status,
          target_visual_index: job.target_visual_index,
          target_layout_index: job.target_layout_index,
          real_slide_id: job.real_slide_id ?? null,
        })),
      })

      void enqueueSlideComposeReconcile(presentationKey, async () => {
        clearSlideComposePoller(payload.job_id)
        const latest = slideComposerPresentationRef.current
        const targetPresentationUrl = payload.presentation_url ?? latest.presentationUrl
        const targetPresentationId = payload.presentation_id ?? latest.presentationId
        const payloadSlideIndex = Math.max(0, payload.slide_index)
        const existingDeck = !!latest.presentationId && targetPresentationId === latest.presentationId
        const composeApi = composeViewerApiRef.current
        let refreshToken = latest.refreshToken
        let resolvedVisualIndex = payloadSlideIndex
        let resolvedLayoutIndex = payloadSlideIndex
        let viewerSlideCount: number | null = null
        let liveSwapSucceeded = false

        if (!canLiveReconcileSlideCompose(payload.real_slide_id)) {
          console.warn('[Slide Composer] slide_ready missing real_slide_id; falling back to iframe refresh.', {
            job_id: payload.job_id,
            slide_index: payload.slide_index,
          })
          triggerCoalescedSlideComposeReload('compose slide_ready missing real_slide_id')
        } else if (!composeApi) {
          triggerCoalescedSlideComposeReload('compose API unavailable on slide_ready')
        } else {
          try {
            const reconcileResult = await composeApi.composeSlideReconcile(
              payload.job_id,
              payloadSlideIndex,
              payload.real_slide_id,
              targetPresentationId,
            )
            scTrace('builder.reconcile.result', {
              job_id: payload.job_id,
              input_slide_index: payloadSlideIndex,
              input_real_slide_id: payload.real_slide_id,
              result: reconcileResult,
            })
            if (Number.isFinite(Number(reconcileResult?.visual_index))) {
              resolvedVisualIndex = Math.max(0, Number(reconcileResult.visual_index))
            }
            if (Number.isFinite(Number(reconcileResult?.real_slide_index))) {
              resolvedLayoutIndex = Math.max(0, Number(reconcileResult.real_slide_index))
            }
            if (Number.isFinite(Number(reconcileResult?.real_slide_count))) {
              viewerSlideCount = Number(reconcileResult.real_slide_count)
            } else if (Number.isFinite(Number(reconcileResult?.total_slides))) {
              viewerSlideCount = Number(reconcileResult.total_slides)
            }
            liveSwapSucceeded = true
          } catch (error) {
            scTrace('builder.reconcile.error', {
              job_id: payload.job_id,
              real_slide_id: payload.real_slide_id,
              message: error instanceof Error ? error.message : String(error),
            })
            console.warn('[Slide Composer] Live slide swap failed; falling back to iframe refresh.', error)
            triggerCoalescedSlideComposeReload('compose live swap failed')
          }
        }

        if (!liveSwapSucceeded) {
          setSlideComposeJobs(prev => {
            const existing = prev[payload.job_id]
            if (!existing) return prev
            return {
              ...prev,
              [payload.job_id]: {
                ...existing,
                real_slide_id: payload.real_slide_id ?? existing.real_slide_id ?? null,
                expected_slide_count: Math.max(
                  existing.expected_slide_count ?? 0,
                  (latest.slideCount ?? 0) + 1,
                ),
              },
            }
          })
          window.setTimeout(() => {
            void (async () => {
              const confirmed = await confirmSlideComposeJobAfterRefresh(payload.job_id)
              if (!confirmed && slideComposeJobsRef.current[payload.job_id]?.status === 'building') {
                startSlideComposePoller(payload.job_id)
              }
            })()
          }, 1500)
          toast({
            title: 'Slide ready',
            description: 'Refreshing the deck to show the completed slide.',
          })
          return
        }

        const nextSlideCount = resolveSlideComposeCountAfterReady({
          currentSlideCount: latest.slideCount,
          existingDeck,
          resolvedVisualIndex,
          viewerSlideCount,
        })
        const job = slideComposeJobsRef.current[payload.job_id]
        const navigate = !!job && shouldNavigateToResolvedComposeSlide({
          currentSlideIndex: currentSlideIndexRef.current,
          jobTargetVisualIndex: job.target_visual_index,
          resolvedVisualIndex,
        })
        const nextPresentationUrl = shouldUseIncomingComposePresentationUrl(
          latest.presentationUrl,
          targetPresentationUrl,
        )
          ? targetPresentationUrl
          : latest.presentationUrl

        removeSlideComposeJob(payload.job_id, resolvedLayoutIndex)
        scTrace('builder.ws.slide_ready.applied', {
          job_id: payload.job_id,
          real_slide_id: payload.real_slide_id,
          resolved_visual_index: resolvedVisualIndex,
          resolved_layout_index: resolvedLayoutIndex,
          viewer_slide_count: viewerSlideCount,
          next_slide_count: nextSlideCount,
          navigate,
          live_swap_succeeded: liveSwapSucceeded,
        })
        const nextOverride = {
          presentationUrl: nextPresentationUrl ?? targetPresentationUrl ?? null,
          presentationId: targetPresentationId ?? null,
          slideCount: nextSlideCount,
          refreshToken,
        }
        slideComposerPresentationRef.current = {
          ...latest,
          ...nextOverride,
        }
        setSlideComposerOverride(nextOverride)
        if (navigate) {
          setCurrentSlideIndex(resolvedVisualIndex)
          setSelectedLayoutSlideIndex(resolvedLayoutIndex)
        }

        if (currentSessionIdRef.current && persistenceRef.current) {
          const updates: any = {
            slideCount: nextSlideCount,
            lastMessageAt: new Date(),
          }
          if (latest.activeVersion === 'strawman') {
            updates.strawmanPreviewUrl = nextPresentationUrl
            updates.strawmanPresentationId = targetPresentationId
          } else {
            updates.finalPresentationUrl = nextPresentationUrl
            updates.finalPresentationId = targetPresentationId
          }
          persistenceRef.current.updateMetadata(updates)
        }

        toast({
          title: 'Slide built',
          description: `Inserted slide ${resolvedVisualIndex + 1}.`,
        })
      })
    },
    onSlideComposeFailed: (message: SlideComposeFailed) => {
      const payload = message.payload
      const errors = payload.errors?.filter(Boolean) ?? []
      clearSlideComposeWatchdog(payload.job_id)
      clearSlideComposePoller(payload.job_id)
      void composeViewerApiRef.current?.composePlaceholderFail(payload.job_id).catch(error => {
        console.warn('[Slide Composer] Failed to mark in-deck placeholder as error.', error)
      })
      setSlideComposeJobs(prev => {
        const existing = prev[payload.job_id]
        if (!existing) return prev
        return {
          ...prev,
          [payload.job_id]: {
            ...existing,
            status: 'error',
            errors: errors.length > 0 ? errors : [`Slide Composer failed${payload.stage ? ` during ${payload.stage}` : ''}.`],
          },
        }
      })
      toast({
        title: 'Slide failed',
        description: errors[0] ?? (payload.stage ? `Failed during ${payload.stage}.` : 'Slide Composer failed.'),
        variant: 'destructive',
      })
    },
  })

  const quota = useQuota(tokenUsage, tokenUsageMessageId ?? undefined)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpReason, setTopUpReason] = useState<string | undefined>(undefined)

  const effectivePresentationId = templateModeSourcePresentationId
    ?? slideComposerOverride?.presentationId
    ?? presentationId
  const effectiveSlideCount = slideComposerOverride?.slideCount ?? slideCount
  const effectivePresentationUrl = useMemo(
    () => withSlideComposerRefreshToken(
      templateModeSourcePresentationUrl ?? slideComposerOverride?.presentationUrl ?? presentationUrl,
      slideComposerOverride?.refreshToken ?? 0,
    ),
    [presentationUrl, slideComposerOverride, templateModeSourcePresentationUrl],
  )

  useEffect(() => {
    slideComposerPresentationRef.current = {
      presentationUrl: slideComposerOverride?.presentationUrl ?? presentationUrl,
      presentationId: effectivePresentationId,
      slideCount: effectiveSlideCount,
      activeVersion,
      refreshToken: slideComposerOverride?.refreshToken ?? 0,
    }
  }, [
    activeVersion,
    effectivePresentationId,
    effectiveSlideCount,
    presentationUrl,
    slideComposerOverride?.refreshToken,
    slideComposerOverride?.presentationUrl,
  ])

  const currentSlideLayout = useMemo<SlideLayoutType | undefined>(() => {
    const ctx = slideContextByIndex?.[selectedLayoutSlideIndex]
    if (!ctx) return undefined

    const canvas = ctx.canvas_type
    const contentType = ctx.content_type
    const diagramSubtype = ctx.subtypes?.diagram_subtype

    if (canvas === 'H1') return 'H1-generated'
    if (canvas === 'H2') return 'H2-section'
    if (canvas === 'H3') return 'H3-closing'
    if (canvas === 'I1') return 'I1-image-left'
    if (canvas === 'I2') return 'I2-image-right'
    if (canvas === 'I3') return 'I3-image-left-narrow'
    if (canvas === 'I4') return 'I4-image-right-narrow'
    if (contentType === 'chart') return 'C3-chart'
    if (contentType === 'infographic') return 'C4-infographic'
    if (contentType?.startsWith('diagram') || diagramSubtype) return 'C5-diagram'
    return 'C1-text'
  }, [selectedLayoutSlideIndex, slideContextByIndex])

  const handleSlideComposerBuilt = useCallback((result: SlideComposeBuiltResult) => {
    const nextSlideIndex = Math.max(0, result.slide_index)
    const targetPresentationId = result.presentation_id
    const targetPresentationUrl = result.presentation_url ?? slideComposerOverride?.presentationUrl ?? presentationUrl
    const existingDeck = !!effectivePresentationId && targetPresentationId === effectivePresentationId
    const baseSlideCount = effectiveSlideCount ?? 0
    const nextSlideCount = Math.max(
      existingDeck ? baseSlideCount + 1 : (result.slides_built ?? 1),
      nextSlideIndex + 1,
    )

    setSlideComposerOverride({
      presentationUrl: targetPresentationUrl ?? null,
      presentationId: targetPresentationId,
      slideCount: nextSlideCount,
      refreshToken: Date.now(),
    })
    setCurrentSlideIndex(nextSlideIndex)
    setSelectedLayoutSlideIndex(nextSlideIndex)

    if (persistence) {
      const updates: any = {
        slideCount: nextSlideCount,
        lastMessageAt: new Date(),
      }

      if (activeVersion === 'strawman') {
        updates.strawmanPreviewUrl = targetPresentationUrl
        updates.strawmanPresentationId = targetPresentationId
      } else {
        updates.finalPresentationUrl = targetPresentationUrl
        updates.finalPresentationId = targetPresentationId
      }

      persistence.updateMetadata(updates)
    }

    toast({
      title: 'Slide built',
      description: `Inserted slide ${nextSlideIndex + 1}.`,
    })
  }, [
    activeVersion,
    effectivePresentationId,
    effectiveSlideCount,
    persistence,
    presentationUrl,
    slideComposerOverride?.presentationUrl,
    toast,
  ])

  const handleComposeApiReady = useCallback((apis: SlideComposeViewerApi | null) => {
    composeViewerApiRef.current = apis
    scTrace('builder.compose_api.ready', {
      ready: !!apis,
      queued_placeholders: pendingComposePlaceholdersRef.current.size,
    })
    if (!apis) return

    const queued = Array.from(pendingComposePlaceholdersRef.current.values())
    pendingComposePlaceholdersRef.current.clear()
    queued.forEach(item => {
      void apis.composePlaceholderAdd(item.jobId, item.visualIndex, item.replaceJobId).catch(error => {
        console.warn('[Slide Composer] Failed to flush queued in-deck placeholder.', error)
        pendingComposePlaceholdersRef.current.set(item.jobId, item)
      })
    })
  }, [])

  const handleSlideComposerAccepted = useCallback((job: SlideComposeAcceptedJob) => {
    const targetVisualIndex = getComposeVisualIndexForTarget(job.target_index, slideComposeJobsRef.current)
    const expectedSlideCount = (slideComposerPresentationRef.current.slideCount ?? 0) +
      Object.values(slideComposeJobsRef.current).filter(item => item.status === 'building').length +
      1
    scTrace('builder.accepted', {
      job_id: job.job_id,
      director_target_index: job.target_index,
      computed_target_visual_index: targetVisualIndex,
      current_visual_index: currentSlideIndexRef.current,
      selected_layout_index: selectedLayoutSlideIndex,
      presentation_id: slideComposerPresentationRef.current.presentationId,
      slide_count: slideComposerPresentationRef.current.slideCount,
      existing_jobs: Object.values(slideComposeJobsRef.current).map(item => ({
        job_id: item.job_id,
        status: item.status,
        target_visual_index: item.target_visual_index,
        target_layout_index: item.target_layout_index,
      })),
    })
    clearSlideComposeWatchdog(job.job_id)
    setSlideComposeJobs(prev => ({
      ...prev,
      [job.job_id]: {
        job_id: job.job_id,
        target_visual_index: targetVisualIndex,
        target_layout_index: Math.max(0, job.target_index),
        status: 'building',
        title: job.title,
        request: job.request,
        expected_slide_count: expectedSlideCount,
      },
    }))
    const placeholderAdd = { jobId: job.job_id, visualIndex: targetVisualIndex }
    const composeApi = composeViewerApiRef.current
    if (composeApi) {
      void composeApi.composePlaceholderAdd(job.job_id, targetVisualIndex).catch(error => {
        scTrace('builder.placeholder_add.error', {
          job_id: job.job_id,
          target_visual_index: targetVisualIndex,
          message: error instanceof Error ? error.message : String(error),
        })
        console.warn('[Slide Composer] Failed to add in-deck placeholder.', error)
        pendingComposePlaceholdersRef.current.set(job.job_id, placeholderAdd)
      })
    } else {
      pendingComposePlaceholdersRef.current.set(job.job_id, placeholderAdd)
    }
    // TODO: replace this timer with a backend heartbeat; for now it must exceed
    // Director's 300s same-target FIFO wait plus a long Slide Builder pass.
    slideComposeWatchdogsRef.current[job.job_id] = setTimeout(() => {
      if (slideComposeJobsRef.current[job.job_id]?.status === 'building') {
        triggerCoalescedSlideComposeReload(`compose job ${job.job_id} exceeded watchdog`)
        void confirmSlideComposeJobAfterRefresh(job.job_id)
      }
    }, SLIDE_COMPOSE_WATCHDOG_MS)
    startSlideComposePoller(job.job_id)
    toast({
      title: 'Slide queued',
      description: `Building slide ${targetVisualIndex + 1} in the background.`,
    })
  }, [
    clearSlideComposeWatchdog,
    confirmSlideComposeJobAfterRefresh,
    startSlideComposePoller,
    toast,
    triggerCoalescedSlideComposeReload,
  ])

  const handleRetrySlideCompose = useCallback(async (jobId: string) => {
    const existing = slideComposeJobs[jobId]
    if (!existing) return

    const nextJobId = crypto.randomUUID()
    const retryRequest = {
      ...existing.request,
      job_id: nextJobId,
      async: true,
      assume_on_missing: true,
    }

    setSlideComposeJobs(prev => {
      const { [jobId]: _failed, ...rest } = prev
      return {
        ...rest,
        [nextJobId]: {
          ...existing,
          job_id: nextJobId,
          status: 'building',
          errors: undefined,
          request: retryRequest,
        },
      }
    })
    // TODO: replace this timer with a backend heartbeat; for now it must exceed
    // Director's 300s same-target FIFO wait plus a long Slide Builder pass.
    slideComposeWatchdogsRef.current[nextJobId] = setTimeout(() => {
      if (slideComposeJobsRef.current[nextJobId]?.status === 'building') {
        triggerCoalescedSlideComposeReload(`compose retry ${nextJobId} exceeded watchdog`)
        void confirmSlideComposeJobAfterRefresh(nextJobId)
      }
    }, SLIDE_COMPOSE_WATCHDOG_MS)
    startSlideComposePoller(nextJobId)

    try {
      const response = await fetch('/api/slides/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryRequest),
      })
      const data = await response.json().catch(() => null) as {
        status?: string
        job_id?: string
        target_index?: number
        error?: string
        errors?: string[]
      } | null

      if (!response.ok || data?.status !== 'accepted' || typeof data.target_index !== 'number') {
        const message = Array.isArray(data?.errors) && data.errors.length > 0
          ? data.errors.join('; ')
          : data?.error ?? 'Slide Composer retry failed.'
        throw new Error(message)
      }

      setSlideComposeJobs(prev => {
        const current = prev[nextJobId]
        if (!current) return prev
        return {
          ...prev,
          [nextJobId]: {
            ...current,
            target_layout_index: Math.max(0, data.target_index ?? current.target_layout_index),
            target_visual_index: existing.target_visual_index,
            expected_slide_count: (slideComposerPresentationRef.current.slideCount ?? 0) +
              Object.values(slideComposeJobsRef.current).filter(item => item.status === 'building').length,
          },
        }
      })
      const placeholderAdd = {
        jobId: nextJobId,
        visualIndex: existing.target_visual_index,
        replaceJobId: jobId,
      }
      const composeApi = composeViewerApiRef.current
      if (composeApi) {
        void composeApi
          .composePlaceholderAdd(nextJobId, existing.target_visual_index, jobId)
          .catch(error => {
            console.warn('[Slide Composer] Failed to reset in-deck placeholder for retry.', error)
            pendingComposePlaceholdersRef.current.set(nextJobId, placeholderAdd)
          })
      } else {
        pendingComposePlaceholdersRef.current.set(nextJobId, placeholderAdd)
      }
    } catch (err) {
      clearSlideComposeWatchdog(nextJobId)
      clearSlideComposePoller(nextJobId)
      const message = err instanceof Error ? err.message : 'Slide Composer retry failed.'
      setSlideComposeJobs(prev => {
        const current = prev[nextJobId]
        if (!current) return prev
        return {
          ...prev,
          [nextJobId]: {
            ...current,
            status: 'error',
            errors: [message],
          },
        }
      })
      toast({
        title: 'Retry failed',
        description: message,
        variant: 'destructive',
      })
    }
  }, [
    clearSlideComposeWatchdog,
    confirmSlideComposeJobAfterRefresh,
    slideComposeJobs,
    startSlideComposePoller,
    toast,
    triggerCoalescedSlideComposeReload,
  ])

  const handleSelectPendingSlideCompose = useCallback((jobId: string) => {
    void composeViewerApiRef.current?.composeGoToPlaceholder(jobId).catch(error => {
      console.warn('[Slide Composer] Failed to navigate to pending placeholder.', error)
    })
  }, [])

  const slideComposeThumbnailJobs = useMemo<SlideComposeThumbnailJob[]>(
    () => Object.values(slideComposeJobs)
      .filter(job => job.status === 'building' || job.status === 'error')
      .map(job => ({
        jobId: job.job_id,
        targetIndex: job.target_layout_index,
        targetLayoutIndex: job.target_layout_index,
        status: job.status,
        title: job.title,
        errors: job.errors,
        onRetry: handleRetrySlideCompose,
        onSelect: handleSelectPendingSlideCompose,
      })),
    [handleRetrySlideCompose, handleSelectPendingSlideCompose, slideComposeJobs],
  )

  // Builder session hook (session init, loading, switching, persistence effects)
  const session = useBuilderSession({
    user,
    isAuthLoading,
    searchParams,
    loadSession,
    createSession,
    persistence,
    connected,
    connecting,
    connect,
    disconnect,
    clearMessages,
    restoreMessages,
    updateCacheUserMessages,
    messages,
    toast,
    isUnsavedSession,
    setIsUnsavedSession,
    currentSessionId,
    setCurrentSessionId,
    setSessionStoreName,
  })

  // Text Labs session (depends on the currently displayed presentation)
  const textLabsSession = useTextLabsSession(effectivePresentationId)

  // Track active blank element for real-time canvas<->modal position sync
  const trackElementRef = useRef(blankElements.trackElement)
  trackElementRef.current = blankElements.trackElement
  useEffect(() => {
    trackElementRef.current(generationPanel.blankElementId)
  }, [generationPanel.blankElementId])

  // Text Labs generation hook
  const { handleGenerate: handleTextLabsGenerate, handleOpenPanel: handleOpenGenerationPanel } = useTextLabsGeneration({
    generationPanel,
    blankElements,
    textLabsSession,
    layoutServiceApis,
    currentSlideIndex,
    toast,
  })

  // File upload state
  const {
    files: uploadedFiles,
    handleFilesSelected,
    removeFile,
    clearAllFiles
  } = useFileUpload({
    sessionId: currentSessionId || '',
    userId: user?.email || '',
    onUploadComplete: (files) => {
      console.log('Files uploaded:', files)
      const storeName = files.find(f => f.geminiStoreName)?.geminiStoreName
      if (storeName) {
        setSessionStoreName(storeName)
      }
    }
  })

  // FIXED: Clear loading state when final presentation URL arrives
  const lastFinalPresentationUrlRef = useRef<string | null>(null)
  useEffect(() => {
    if (finalPresentationUrl && isGeneratingFinal) {
      setIsGeneratingFinal(false)
      console.log('Final presentation ready - hiding loader')
    }

    if (finalPresentationUrl && finalPresentationUrl !== lastFinalPresentationUrlRef.current) {
      setTemplateModeOn(false)
      setSelectedTemplateElementId(null)
    }
    lastFinalPresentationUrlRef.current = finalPresentationUrl
  }, [finalPresentationUrl, isGeneratingFinal])

  useEffect(() => {
    if (!templateModeOn) return
    if (!isGeneratingFinal && !isGeneratingStrawman) return

    setTemplateModeOn(false)
    setSelectedTemplateElementId(null)
  }, [isGeneratingFinal, isGeneratingStrawman, templateModeOn])

  // Infer current stage from available data
  const currentStage = useMemo(() => {
    if (effectivePresentationUrl) return 6;
    if (effectiveSlideCount && effectiveSlideCount > 0) return 5;
    if (slideStructure && (slideStructure as any).length > 0) return 4;
    return 3;
  }, [effectivePresentationUrl, effectiveSlideCount, slideStructure])

  // Set strawman generation flag
  useEffect(() => {
    if (currentStage === 4 && !strawmanPreviewUrl && !isGeneratingStrawman) {
      setIsGeneratingStrawman(true)
      console.log('Strawman generation started - showing loader')
    }
  }, [currentStage, strawmanPreviewUrl, isGeneratingStrawman])

  // Clear strawman generation flag when URL arrives
  useEffect(() => {
    if (strawmanPreviewUrl && isGeneratingStrawman) {
      setIsGeneratingStrawman(false)
      console.log('Strawman presentation ready - hiding loader')
    }
  }, [strawmanPreviewUrl, isGeneratingStrawman])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, session.userMessages])

  // Check if user is new and should see onboarding
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const isNewUser = urlParams.get('new') === 'true'

    if (isNewUser && user) {
      setShowOnboarding(true)
      window.history.replaceState({}, '', '/builder')
    }
  }, [user])

  // Handle sending messages
  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputMessage.trim()) return

    if (!user) {
      console.warn('Cannot send message: user not authenticated')
      return
    }

    // Pre-flight quota gate: block a new turn only when a plan cap is fully
    // exhausted AND there is no prepaid reserve to cover the overflow.
    const q = quota.status
    if (q && (q.flags.dailyAt || q.flags.weeklyAt) && q.walletBalanceCents <= 0) {
      const isDaily = q.flags.dailyAt
      const which = isDaily ? 'daily' : 'weekly'
      const resetIso = isDaily ? q.resetAt.daily : q.resetAt.weekly
      const resetLabel = new Date(resetIso).toLocaleString(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
      setTopUpReason(`You've reached your ${which} limit.`)
      setTopUpOpen(true)
      toast({
        title: `${isDaily ? 'Daily' : 'Weekly'} limit reached`,
        description: `Your ${which} budget resets ${resetLabel}. Top up reserve credits to keep generating now.`,
        variant: 'destructive',
      })
      return
    }

    if (isExecutingSendRef.current) {
      console.log('Already executing send, skipping duplicate call')
      return
    }

    isExecutingSendRef.current = true

    try {
      const messageText = inputMessage.trim()

      // Template reuse skips the strawman→accept step that normally turns on the
      // build animation, so the right pane would sit static. Flip it on here so a
      // reuse turn runs the SAME live slide-build animation as a normal build (the
      // viewer's isGenerating overlay when a deck is shown, or the full loader
      // otherwise). It auto-hides when the final URL arrives (finalPresentationUrl effect).
      if (activeTemplate) {
        setIsGeneratingFinal(true)
      }

      // Handle pending action input
      if (pendingActionInput) {
        const { action, messageId, timestamp } = pendingActionInput

        session.userMessageIdsRef.current.add(messageId)

        session.setUserMessages(prev => [...prev, {
          id: messageId,
          text: action.label,
          timestamp: timestamp
        }])

        if (currentSessionId && persistence) {
          persistence.queueMessage({
            message_id: messageId,
            session_id: currentSessionId,
            timestamp: new Date(timestamp).toISOString(),
            type: 'chat_message',
            payload: { text: action.label, action_value: action.value }
          } as unknown as DirectorMessage, action.label)
        }

        const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
        const fileCount = successfulFiles.length

        const success = sendMessage(messageText, undefined, fileCount, {
          deepResearch: researchEnabled,
          webSearch: webSearchEnabled,
          extendedGeneration: extendedGenerationEnabled,
          useKnowledgeGraph: showKnowledgeGraphToggle && knowledgeGraphEnabled,
          fileUpload: !!sessionStoreName,
          storeName: sessionStoreName,
          ...buildSendOptions,
        })
        if (success) {
          setInputMessage("")
          setPendingActionInput(null)
          if (successfulFiles.length > 0) {
            clearAllFiles()
          }
        }

        setTimeout(() => {
          isExecutingSendRef.current = false
        }, 500)
        return
      }

      // For unsaved sessions, create database session first
      if (isUnsavedSession) {
        console.log('Creating database session for first message')
        const newSessionId = currentSessionId || wsSessionId

        try {
          const dbSession = await createSession(newSessionId)

          if (dbSession) {
            session.justCreatedSessionRef.current = dbSession.id
            setIsUnsavedSession(false)
            try { sessionStorage.removeItem(`deckster_unsaved_${dbSession.id}`) } catch {}
            if (!currentSessionId) {
              setCurrentSessionId(dbSession.id)
              router.push(`/builder?session_id=${dbSession.id}`)
            }
            console.log('Database session created:', dbSession.id)

            const messageId = crypto.randomUUID()
            const timestamp = Date.now()

            session.userMessageIdsRef.current.add(messageId)

            session.setUserMessages(prev => [...prev, {
              id: messageId,
              text: messageText,
              timestamp: timestamp
            }])

            // FIX 11: Save first message directly via API
            try {
              const firstMessagePayload = {
                id: messageId,
                messageType: 'chat_message',
                timestamp: new Date(timestamp).toISOString(),
                payload: { text: messageText },
                userText: messageText,
              }

              console.log('[FIX 11] Saving first message directly via API:', {
                sessionId: dbSession.id,
                messageId,
                userText: messageText.substring(0, 30)
              })

              const response = await fetch(`/api/sessions/${dbSession.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [firstMessagePayload] }),
              })

              if (response.ok) {
                const result = await response.json()
                console.log('[FIX 11] First message saved:', result)
              } else {
                console.error('[FIX 11] Failed to save first message:', response.status)
              }

              if (persistence) {
                const generatedTitle = persistence.generateTitle(messageText)
                console.log('Setting initial title from first message:', generatedTitle)

                await fetch(`/api/sessions/${dbSession.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: generatedTitle }),
                })
                session.hasTitleFromUserMessageRef.current = true
              }
            } catch (error) {
              console.error('[FIX 11] Error saving first message:', error)
            }

            setInputMessage("")

            const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
            const fileCount = successfulFiles.length

            sendMessage(messageText, undefined, fileCount, {
              deepResearch: researchEnabled,
              webSearch: webSearchEnabled,
              extendedGeneration: extendedGenerationEnabled,
              useKnowledgeGraph: showKnowledgeGraphToggle && knowledgeGraphEnabled,
              fileUpload: !!sessionStoreName,
              storeName: sessionStoreName,
              ...buildSendOptions,
            })
            if (successfulFiles.length > 0) {
              clearAllFiles()
            }
            return
          } else {
            console.error('createSession returned null')
            alert('Failed to create session. Please check your connection and try again.')
            return
          }
        } catch (error) {
          console.error('Error creating session:', error)
          alert(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}. Please try refreshing the page.`)
          return
        }
      }

      // For resumed sessions, connect on first message
      if (session.isResumedSession && !connected && !connecting) {
        console.log('Connecting WebSocket for first message in resumed session')
        connect()
        session.setIsResumedSession(false)

        const messageId = crypto.randomUUID()
        const timestamp = Date.now()

        session.userMessageIdsRef.current.add(messageId)

        session.setUserMessages(prev => [...prev, {
          id: messageId,
          text: messageText,
          timestamp: timestamp
        }])

        if (currentSessionId && persistence) {
          console.log('Persisting user message for resumed session:', messageId)
          persistence.queueMessage({
            message_id: messageId,
            session_id: currentSessionId,
            timestamp: new Date(timestamp).toISOString(),
            type: 'chat_message',
            payload: { text: messageText }
          } as DirectorMessage, messageText)
        }

        setInputMessage("")

        const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
        const fileCount = successfulFiles.length

        setTimeout(() => {
          sendMessage(messageText, undefined, fileCount, {
            deepResearch: researchEnabled,
            webSearch: webSearchEnabled,
            extendedGeneration: extendedGenerationEnabled,
            useKnowledgeGraph: showKnowledgeGraphToggle && knowledgeGraphEnabled,
            fileUpload: !!sessionStoreName,
            storeName: sessionStoreName,
            ...buildSendOptions,
          })
          if (successfulFiles.length > 0) {
            clearAllFiles()
          }
        }, 200)
        return
      }

      // Normal check for connection
      if (!isReady) return

      const messageId = crypto.randomUUID()
      const timestamp = Date.now()

      session.userMessageIdsRef.current.add(messageId)

      session.setUserMessages(prev => [...prev, {
        id: messageId,
        text: messageText,
        timestamp: timestamp
      }])

      if (currentSessionId && persistence) {
        persistence.queueMessage({
          message_id: messageId,
          session_id: currentSessionId,
          timestamp: new Date(timestamp).toISOString(),
          type: 'chat_message',
          payload: { text: messageText }
        } as DirectorMessage, messageText)

        if (!session.hasTitleFromUserMessageRef.current && !session.hasTitleFromPresentationRef.current) {
          const generatedTitle = persistence.generateTitle(messageText)
          console.log('Setting initial title from first message:', generatedTitle)
          persistence.updateMetadata({
            title: generatedTitle
          })
          session.hasTitleFromUserMessageRef.current = true
        }
      }

      const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
      const fileCount = successfulFiles.length

      const success = sendMessage(messageText, undefined, fileCount, {
        deepResearch: researchEnabled,
        webSearch: webSearchEnabled,
        extendedGeneration: extendedGenerationEnabled,
        useKnowledgeGraph: showKnowledgeGraphToggle && knowledgeGraphEnabled,
        fileUpload: !!sessionStoreName,
        storeName: sessionStoreName,
        ...buildSendOptions,
      })
      if (success) {
        setInputMessage("")
        if (successfulFiles.length > 0) {
          clearAllFiles()
        }
      }
    } finally {
      setTimeout(() => {
        isExecutingSendRef.current = false
      }, 500)
    }
  }, [inputMessage, isReady, sendMessage, currentSessionId, persistence, session.isResumedSession, connected, connecting, connect, isUnsavedSession, createSession, router, uploadedFiles, clearAllFiles, researchEnabled, webSearchEnabled, extendedGenerationEnabled, knowledgeGraphEnabled, showKnowledgeGraphToggle, sessionStoreName, quota.status, toast, buildSendOptions, activeTemplate])

  // Handle action button clicks
  const handleActionClick = useCallback((action: ActionRequest['payload']['actions'][0], actionRequestMessageId: string) => {
    const messageId = crypto.randomUUID()
    const timestamp = Date.now()

    session.answeredActionsRef.current.add(actionRequestMessageId)
    console.log(`Marked action request ${actionRequestMessageId} as answered`)

    if (action.requires_input) {
      setPendingActionInput({ action, messageId, timestamp })
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    } else {
      session.userMessageIdsRef.current.add(messageId)

      session.setUserMessages(prev => [...prev, {
        id: messageId,
        text: action.label,
        timestamp: timestamp
      }])

      if (currentSessionId && persistence) {
        persistence.queueMessage({
          message_id: messageId,
          session_id: currentSessionId,
          timestamp: new Date(timestamp).toISOString(),
          type: 'chat_message',
          payload: { text: action.label, action_value: action.value }
        } as unknown as DirectorMessage, action.label)
      }

      if (action.value === 'accept_strawman') {
        setIsGeneratingFinal(true)
        console.log('Starting final deck generation - showing loader')
      }

      sendMessage(action.value, undefined, undefined, {
        deepResearch: researchEnabled,
        webSearch: webSearchEnabled,
        extendedGeneration: extendedGenerationEnabled,
        useKnowledgeGraph: showKnowledgeGraphToggle && knowledgeGraphEnabled,
        fileUpload: !!sessionStoreName,
        storeName: sessionStoreName,
        ...buildSendOptions,
      })
    }
  }, [sendMessage, currentSessionId, persistence, researchEnabled, webSearchEnabled, extendedGenerationEnabled, knowledgeGraphEnabled, showKnowledgeGraphToggle, sessionStoreName, buildSendOptions])

  // Wrapped session select handler (clears local UI state too)
  const handleSessionSelectWrapped = useCallback((sessionId: string) => {
    setIsGeneratingFinal(false)
    setIsGeneratingStrawman(false)
    setShowChatHistory(false)
    setSessionStoreName(null)
    session.handleSessionSelect(sessionId)
  }, [session.handleSessionSelect])

  const handleNewChatWrapped = useCallback(() => {
    if (currentSessionId) skipBuilderOptionsPersistRef.current = currentSessionId
    setInputMessage("")
    setPendingActionInput(null)
    setActiveTemplate(null)
    setTemplateModeOn(false)
    setTemplateSnapshot(null)
    setTemplateSnapshotLoading(false)
    setTemplateBlueprintDirty(false)
    setTemplateBlueprintSaving(false)
    setTemplateOverrides({})
    setSelectedTemplateElementId(null)
    setTemplateSourceSlideIndex(0)
    standardThemeLoadedRef.current = false
    setBuildThemeSelection({ mode: 'auto' })
    setActiveBuildThemeProfile(null)
    setResearchEnabled(false)
    setWebSearchEnabled(false)
    setExtendedGenerationEnabled(true)
    setKnowledgeGraphEnabled(kgSubscribed)
    setIsGeneratingFinal(false)
    setIsGeneratingStrawman(false)
    setShowChatHistory(false)
    setSessionStoreName(null)
    clearAllFiles()
    session.handleNewChat()
  }, [clearAllFiles, currentSessionId, kgSubscribed, session.handleNewChat])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <BuilderHeader
          wsError={wsError}
          onOpenChatHistory={() => setShowChatHistory((prev) => !prev)}
          isChatHistoryOpen={showChatHistory}
          toolbarSlotRef={setToolbarPortalTarget}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex relative overflow-hidden">
          {templateBuilderEnabled && (
            <TemplateParamsPanel
              isOpen={isTemplateParamsDrawerOpen}
              width={drawerWidth}
              collapsed={templateParamsCollapsed}
              snapshot={templateSnapshot}
              currentSlideIndex={activeTemplateSlideIndex}
              overrides={templateOverrides}
              loading={templateSnapshotLoading}
              blueprintEditorV2Enabled={blueprintEditorV2Enabled}
              blueprintDirty={templateBlueprintDirty}
              blueprintSaving={templateBlueprintSaving}
              selectedElementId={selectedTemplateElementId}
              onClose={() => {
                if (blueprintEditorV2Enabled) {
                  void handleTemplateModeChange(false)
                }
                setSelectedTemplateElementId(null)
              }}
              onCollapsedChange={setTemplateParamsCollapsed}
              onResizeStart={handleDrawerResizeStart}
              onOverrideChange={handleTemplateOverrideChange}
              onBlueprintChange={handleTemplateBlueprintChange}
              onSaveBlueprint={handleTemplateBlueprintSave}
            />
          )}

          {/* === Element Drawer === */}
          <div
            className={cn(
              "absolute inset-y-0 left-0 ease-out",
              isResizingDrawer ? "" : "transition-transform duration-300"
            )}
            style={{
              width: drawerWidth,
              transform: isElementDrawerOpen ? 'translateX(0px)' : `translateX(-${drawerWidth}px)`,
              zIndex: isElementDrawerOpen ? 10 + panelZIndices.element : 60,
              pointerEvents: isElementDrawerOpen ? 'auto' : 'none',
            }}
          >
            {/* Panel area */}
            <div
              className={`absolute inset-y-0 left-0 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-900 dark:text-slate-100 overflow-hidden ${isElementDrawerOpen ? 'shadow-xl' : ''}`}
              style={{ width: drawerWidth }}
            >
              {features.useTextLabsGeneration && (
                <GenerationPanel
                  isOpen={generationPanel.isOpen}
                  elementType={generationPanel.elementType}
                  onClose={() => {
                    generationPanel.closePanel()
                  }}
                  onReopen={generationPanel.reopenPanel}
                  onGenerate={handleTextLabsGenerate}
                  onElementTypeChange={generationPanel.changeElementType}
                  isGenerating={generationPanel.isGenerating}
                  error={generationPanel.error}
                  slideIndex={currentSlideIndex}
                  elementContext={blankElements.activePosition}
                  mode={generationPanel.mode}
                  regenerateEnabled={generationPanel.regenerateEnabled}
                  onRegenerateToggle={generationPanel.setRegenerateEnabled}
                />
              )}

              <TextBoxFormatPanel
                isOpen={showTextBoxPanel}
                onClose={() => {
                  setShowTextBoxPanel(false)
                  setSelectedTextBoxId(null)
                  setSelectedTextBoxFormatting(null)
                }}
                elementId={selectedTextBoxId}
                formatting={selectedTextBoxFormatting}
                onSendCommand={async (action, params) => {
                  if (!layoutServiceApis?.sendTextBoxCommand) {
                    throw new Error('Layout Service not ready')
                  }
                  return layoutServiceApis.sendTextBoxCommand(action, {
                    elementId: selectedTextBoxId,
                    ...params
                  })
                }}
                onDelete={async () => {
                  if (!layoutServiceApis?.sendTextBoxCommand || !selectedTextBoxId) return
                  try {
                    await layoutServiceApis.sendTextBoxCommand('deleteTextBox', {
                      elementId: selectedTextBoxId
                    })
                    setShowTextBoxPanel(false)
                    setSelectedTextBoxId(null)
                    setSelectedTextBoxFormatting(null)
                  } catch (error) {
                    console.error('Failed to delete text box:', error)
                  }
                }}
                presentationId={effectivePresentationId}
                slideIndex={currentSlideIndex}
                sessionId={currentSessionId}
              />

              {effectivePresentationId && (
                <ElementFormatPanel
                  isOpen={showElementPanel}
                  onClose={() => {
                    setShowElementPanel(false)
                    setSelectedElementId(null)
                    setSelectedElementType(null)
                    setSelectedElementProperties(null)
                  }}
                  elementId={selectedElementId}
                  elementType={selectedElementType}
                  properties={selectedElementProperties}
                  onSendCommand={async (action, params) => {
                    if (!layoutServiceApis?.sendElementCommand) {
                      throw new Error('Layout Service not ready')
                    }
                    return layoutServiceApis.sendElementCommand(action, {
                      elementId: selectedElementId,
                      ...params
                    })
                  }}
                  onDelete={async () => {
                    if (!layoutServiceApis?.sendElementCommand || !selectedElementId) return
                    try {
                      await layoutServiceApis.sendElementCommand('deleteElement', {
                        elementId: selectedElementId
                      })
                      setShowElementPanel(false)
                      setSelectedElementId(null)
                      setSelectedElementType(null)
                      setSelectedElementProperties(null)
                    } catch (error) {
                      console.error('Failed to delete element:', error)
                    }
                  }}
                  presentationId={effectivePresentationId}
                  slideIndex={currentSlideIndex}
                />
              )}
            </div>

            {/* Handle */}
            {features.useTextLabsGeneration && (
              <button
                type="button"
                onClick={() => {
                  if (generationPanel.isOpen) {
                    generationPanel.closePanel()
                  } else {
                    generationPanel.reopenPanel()
                    bringToFront('element')
                  }
                }}
                className={cn(
                  "absolute top-[33%] -translate-y-1/2",
                  "w-4 py-3 rounded-r-md shadow-sm border border-l-0",
                  "flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                  "transition-colors pointer-events-auto",
                  generationPanel.isOpen
                    ? "bg-purple-200 hover:bg-purple-300 border-purple-400 text-purple-700 dark:bg-purple-900/50 dark:hover:bg-purple-800/60 dark:border-purple-700 dark:text-purple-200"
                    : "bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-purple-300"
                )}
                style={{ left: drawerWidth }}
                title={generationPanel.isOpen ? 'Close element panel' : 'Open element panel'}
              >
                {isElementDrawerOpen ? (
                  <ChevronLeft className="h-2.5 w-2.5" />
                ) : (
                  <ChevronRight className="h-2.5 w-2.5" />
                )}
                <span className="[writing-mode:vertical-rl] text-[9px] font-semibold uppercase tracking-wider select-none leading-none">
                  Element
                </span>
              </button>
            )}
          </div>

          {/* === Slide Drawer === */}
          {features.slideComposerEnabled && (
            <div
              className={cn(
                "absolute inset-y-0 left-0 ease-out",
                isResizingDrawer ? "" : "transition-transform duration-300"
              )}
              style={{
                width: drawerWidth,
                transform: isSlideDrawerOpen ? 'translateX(0px)' : `translateX(-${drawerWidth}px)`,
                zIndex: isSlideDrawerOpen ? 10 + panelZIndices.slide : 60,
                pointerEvents: isSlideDrawerOpen ? 'auto' : 'none',
              }}
            >
              {/* Panel area */}
              <div
                className={`absolute inset-y-0 left-0 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-900 dark:text-slate-100 overflow-hidden ${isSlideDrawerOpen ? 'shadow-xl' : ''}`}
                style={{ width: drawerWidth }}
              >
                <SlideGenerationPanel
                  isOpen={showFormatPanel}
                  onClose={() => setShowFormatPanel(false)}
                  currentSlide={selectedLayoutSlideIndex + 1}
                  currentLayout={currentSlideLayout}
                  sessionId={wsSessionId || currentSessionId || ''}
                  presentationId={effectivePresentationId}
                  research={{
                    useUploadedDocuments: uploadedFiles.some(file => file.status === 'success') || Boolean(sessionStoreName),
                    useWebSearch: webSearchEnabled,
                    useDeepResearch: researchEnabled && webSearchEnabled,
                    useKnowledgeGraph: showKnowledgeGraphToggle && knowledgeGraphEnabled,
                  }}
                  enabled={features.slideComposerEnabled}
                  onBuilt={handleSlideComposerBuilt}
                  onAccepted={handleSlideComposerAccepted}
                />
              </div>

              {/* Handle */}
              <button
                type="button"
                onClick={() => {
                  const next = !showFormatPanel
                  setShowFormatPanel(next)
                  if (next) bringToFront('slide')
                }}
                className={cn(
                  "absolute top-[45%] -translate-y-1/2",
                  "w-4 py-3 rounded-r-md shadow-sm border border-l-0",
                  "flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                  "transition-colors pointer-events-auto",
                  showFormatPanel
                    ? "bg-blue-200 hover:bg-blue-300 border-blue-400 text-blue-700 dark:bg-blue-900/50 dark:hover:bg-blue-800/60 dark:border-blue-700 dark:text-blue-200"
                    : "bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-blue-300"
                )}
                style={{ left: drawerWidth }}
                title={showFormatPanel ? 'Close slide panel' : 'Open slide panel'}
              >
                {isSlideDrawerOpen ? (
                  <ChevronLeft className="h-2.5 w-2.5" />
                ) : (
                  <ChevronRight className="h-2.5 w-2.5" />
                )}
                <span className="[writing-mode:vertical-rl] text-[9px] font-semibold uppercase tracking-wider select-none leading-none">
                  Slide
                </span>
              </button>
            </div>
          )}

          {/* === Deck Drawer === */}
          <div
            className={cn(
              "absolute inset-y-0 left-0 ease-out",
              isResizingDrawer ? "" : "transition-transform duration-300"
            )}
            style={{
              width: drawerWidth,
              transform: isDeckDrawerOpen ? 'translateX(0px)' : `translateX(-${drawerWidth}px)`,
              zIndex: isDeckDrawerOpen ? 10 + panelZIndices.deck : 60,
              pointerEvents: isDeckDrawerOpen ? 'auto' : 'none',
            }}
          >
            {/* Panel area */}
            <div
              className={`absolute inset-y-0 left-0 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col ${isDeckDrawerOpen ? 'shadow-xl' : ''}`}
              style={{ width: drawerWidth }}
            >
              {showChat && (
                <>
                  <TokenUsageStrip
                    tokenUsage={tokenUsage}
                    quota={quota}
                    onTopUp={() => {
                      setTopUpReason(undefined)
                      setTopUpOpen(true)
                    }}
                  />

                  <ScrollArea className="flex-1">
                    <div className="px-3 py-4 space-y-4">
                      <MessageList
                        sessionId={currentSessionId}
                        userMessages={session.userMessages}
                        messages={messages}
                        userMessageIdsRef={session.userMessageIdsRef}
                        userMessageContentMapRef={session.userMessageContentMapRef}
                        hasSeenWelcomeRef={session.hasSeenWelcomeRef}
                        answeredActionsRef={session.answeredActionsRef}
                        onActionClick={handleActionClick}
                        messagesEndRef={messagesEndRef}
                        slideContextByIndex={slideContextByIndex}
                        ephemeralFadeToken={ephemeralFadeToken}
                        ephemeralMessageIds={ephemeralMessageIds}
                        onEphemeralFadeComplete={clearEphemeralIds}
                      />
                    </div>
                  </ScrollArea>

                  <ChatInput
                    inputMessage={inputMessage}
                    onInputChange={setInputMessage}
                    onSubmit={handleSendMessage}
                    uploadedFiles={uploadedFiles}
                    onFilesSelected={handleFilesSelected}
                    onRemoveFile={removeFile}
                    onClearAllFiles={clearAllFiles}
                    pendingActionInput={pendingActionInput}
                    onCancelAction={() => {
                      setPendingActionInput(null)
                      setInputMessage("")
                    }}
                    researchEnabled={researchEnabled}
                    onResearchEnabledChange={setResearchEnabled}
                    webSearchEnabled={webSearchEnabled}
                    onWebSearchEnabledChange={setWebSearchEnabled}
                    knowledgeGraphEnabled={knowledgeGraphEnabled}
                    onKnowledgeGraphEnabledChange={setKnowledgeGraphEnabled}
                    showKnowledgeGraphToggle={showKnowledgeGraphToggle}
                    isReady={isReady}
                    isLoadingSession={session.isLoadingSession}
                    connected={connected}
                    connecting={connecting}
                    user={user}
                    currentSessionId={currentSessionId}
                    onRequestSession={session.handleRequestSession}
                    templateBuilderEnabled={templateBuilderEnabled}
                    activeTemplate={activeTemplate}
                    onSelectTemplate={handleSelectTemplate}
                    onClearTemplate={handleClearTemplate}
                    buildTheme={buildThemeSelection}
                    onBuildThemeChange={setBuildThemeSelection}
                    activeBuildThemeProfile={activeBuildThemeProfile}
                    onActiveBuildThemeProfileChange={setActiveBuildThemeProfile}
                  />
                </>
              )}
            </div>

            {/* Handle */}
            <button
              type="button"
              onClick={() => {
                const next = !showChat
                setShowChat(next)
                if (next) bringToFront('deck')
              }}
              className={cn(
                "absolute top-[57%] -translate-y-1/2",
                "w-4 py-3 rounded-r-md shadow-sm border border-l-0",
                "flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                "transition-colors pointer-events-auto",
                showChat
                  ? "bg-purple-200 hover:bg-purple-300 border-purple-400 text-purple-700 dark:bg-purple-900/50 dark:hover:bg-purple-800/60 dark:border-purple-700 dark:text-purple-200"
                  : "bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-purple-300"
              )}
              style={{ left: drawerWidth }}
              title={showChat ? 'Close chat panel' : 'Open chat panel'}
            >
              {isDeckDrawerOpen ? (
                <ChevronLeft className="h-2.5 w-2.5" />
              ) : (
                <ChevronRight className="h-2.5 w-2.5" />
              )}
              <span className="[writing-mode:vertical-rl] text-[9px] font-semibold uppercase tracking-wider select-none leading-none">
                Deck
              </span>
            </button>
          </div>

          {showDrawerResizeHandle && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize builder panel"
              title="Drag to resize panel"
              onMouseDown={handleDrawerResizeStart}
              onDoubleClick={() => {
                const next = clampDrawerWidth(DEFAULT_DRAWER_WIDTH)
                setDrawerWidth(next)
                window.localStorage.setItem('deckster_builder_drawer_width', String(next))
              }}
              className={cn(
                "absolute inset-y-0 w-2 cursor-col-resize transition-colors",
                "hover:bg-purple-200/70",
                isResizingDrawer ? "bg-purple-300/80" : "bg-transparent"
              )}
              style={{
                left: drawerWidth - 3,
                zIndex: 140,
              }}
            />
          )}

          {/* Presentation fills the area, shifts right when any drawer is open */}
          <div
            className={cn(
              "flex-1 min-w-0 min-h-0 flex flex-col",
              isResizingDrawer ? "" : "transition-[margin] duration-300 ease-out"
            )}
            style={{ marginLeft: drawerOffset }}
          >
          {session.isLoadingSession ? (
            <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-slate-800 h-full">
              <div className="text-center">
                <div className="h-8 w-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">Loading session...</p>
              </div>
            </div>
          ) : (
          <PresentationArea
            presentationUrl={effectivePresentationUrl}
            presentationId={effectivePresentationId}
            slideCount={effectiveSlideCount}
            slideStructure={slideStructure}
            strawmanPreviewUrl={strawmanPreviewUrl}
            finalPresentationUrl={finalPresentationUrl}
            activeVersion={activeVersion}
            isBlankPresentation={isBlankPresentation}
            onVersionSwitch={switchVersion}
            currentStage={currentStage}
            currentSlideIndex={currentSlideIndex}
            onSlideChange={(slideNum) => {
              const nextVisualIndex = Math.max(0, slideNum - 1)
              setCurrentSlideIndex(nextVisualIndex)
              const resolved = resolveSlideComposeVisualIndex(nextVisualIndex, {
                slideCount: effectiveSlideCount ?? 0,
                jobs: slideComposeJobsRef.current,
              })
              if (resolved?.kind === 'slide') {
                setSelectedLayoutSlideIndex(resolved.layoutIndex)
              }
            }}
            currentStatus={currentStatus}
            isGeneratingFinal={isGeneratingFinal}
            isGeneratingStrawman={isGeneratingStrawman}
            onApiReady={setLayoutServiceApis}
            onComposeApiReady={handleComposeApiReady}
            onTextBoxSelected={(elementId, formatting) => {
              if (features.useTextLabsGeneration) {
                generationPanel.openPanelForEdit('TEXT_BOX', elementId)
                bringToFront('element')
                setShowTextBoxPanel(false)
                setShowElementPanel(false)
                setShowFormatPanel(false)
              } else {
                setSelectedTextBoxId(elementId)
                setSelectedTextBoxFormatting(formatting)
                setShowTextBoxPanel(true)
                bringToFront('element')
                setShowElementPanel(false)
                setShowFormatPanel(false)
              }
            }}
            onTextBoxDeselected={() => {
              setSelectedTextBoxId(null)
              setSelectedTextBoxFormatting(null)
              if (generationPanel.mode === 'edit') {
                generationPanel.closePanel()
              }
            }}
            onElementSelected={(elementId, elementType, properties) => {
              if (features.useTextLabsGeneration && isTextLabsMappable(elementType)) {
                const mappedType = iframeTypeToTextLabs(elementType)!
                generationPanel.openPanelForEdit(mappedType, elementId)
                bringToFront('element')
                setShowElementPanel(false)
                setShowTextBoxPanel(false)
                setShowFormatPanel(false)
              } else {
                setSelectedElementId(elementId)
                setSelectedElementType(elementType)
                setSelectedElementProperties(properties)
                setShowElementPanel(true)
                bringToFront('element')
                setShowTextBoxPanel(false)
                setShowFormatPanel(false)
              }
            }}
            onElementDeselected={() => {
              setSelectedElementId(null)
              setSelectedElementType(null)
              setSelectedElementProperties(null)
              if (generationPanel.mode === 'edit') {
                generationPanel.closePanel()
              }
            }}
            blankElements={blankElements}
            generationPanel={generationPanel}
            onOpenGenerationPanel={features.useTextLabsGeneration ? handleOpenGenerationPanel : undefined}
            connected={connected}
            connecting={connecting}
            toolbarPortalTarget={toolbarPortalTarget}
            toolbarOffset={drawerOffset > TEMPLATE_PANEL_COLLAPSED_WIDTH ? Math.max(drawerOffset - 112, 0) : 0}
            sessionId={wsSessionId}
            deckOwnerSessionId={deckOwnerSessionId}
            templateSavePresentationId={templateModeOn ? null : finalPresentationId}
            templateBuilderEnabled={templateBuilderEnabled}
            onSelectTemplate={handleSelectTemplate}
            templateModeOn={templateModeOn}
            onTemplateModeChange={handleTemplateModeChange}
            templateModeAvailable={Boolean(activeTemplate)}
            templateSnapshot={templateSnapshot}
            templateSnapshotLoading={templateSnapshotLoading}
            composeJobs={slideComposeThumbnailJobs}
            templateCurrentSlideIndex={templateSourceSlideIndex}
            selectedTemplateElementId={selectedTemplateElementId}
            blueprintEditorV2Enabled={blueprintEditorV2Enabled}
            onTemplateSlideChange={setTemplateSourceSlideIndex}
            onTemplateElementSelect={handleTemplateElementSelect}
            onTemplateBlueprintChange={handleTemplateBlueprintChange}
          />
          )}
          </div>
        </div>
      </div>

      {/* Chat History Sidebar */}
      <ChatHistorySidebar
        isOpen={showChatHistory}
        onClose={() => setShowChatHistory(false)}
        currentSessionId={currentSessionId || undefined}
        onSessionSelect={handleSessionSelectWrapped}
        onNewChat={handleNewChatWrapped}
      />

      {/* Onboarding Modal */}
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* Reserve credit top-up */}
      <TopUpModal open={topUpOpen} onOpenChange={setTopUpOpen} reason={topUpReason} />

    </div>
  )
}

export default function BuilderPage() {
  return (
    <WebSocketErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
          <div className="text-center">
            <div className="h-10 w-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600">Loading builder...</p>
          </div>
        </div>
      }>
        <BuilderContent />
      </Suspense>
    </WebSocketErrorBoundary>
  )
}
