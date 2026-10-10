"use client"

import './studio-v4.css'
import './studio-v4-type.css'
import '@/components/layout/studio-shell.css'
import '@/components/builder/studio-workspace.css'
import '@/components/builder/studio-canvas.css'
import { allocateStudioWorkspace, resizeStudioPane, type StudioWorkspacePane, type StudioInspector } from '@/lib/studio-workspace-layout'
import { StudioIntroductionProvider, StudioIntroductionButton } from '@/components/builder/studio-introduction'
import { historicalActionStatuses } from '@/lib/director-history-presentation'
import { askGatesLocked, lockApprovalGateStatuses } from '@/lib/director-ask-identity'
import { StudioRail } from '@/components/layout/studio-rail'

import { composerThemeSyncBlocked } from '@/lib/composer-theme-policy'

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react"
import { ThemePanel } from "@/components/theme-panel"
import { TemplatePickerContent } from "@/components/builder/template-picker"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { draftKey, parseStudioWorkflowAction, parseStudioWorkflowDraft } from "@/lib/studio-workflow"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useDecksterWebSocketV2, INGEST_JOB_KEY_PREFIX, type DirectorMessage, type ActionRequest, type SlideUpdate, type SlideComposeProgress, type SlideBuilt, type SlideComposeReady, type SlideComposeFailed, type TemplateIngestReady, type TemplateIngestFailed, type IngestUploadRef } from "@/hooks/use-deckster-websocket-v2"
import { useChatSessions } from "@/hooks/use-chat-sessions"
import { useSessionPersistence } from "@/hooks/use-session-persistence"
import { WebSocketErrorBoundary } from "@/components/error-boundary"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatHistorySidebar } from "@/components/chat-history-sidebar"
import { OnboardingModal } from "@/components/onboarding-modal"
import { useFileUpload } from '@/hooks/use-file-upload'
import type { UploadedFile } from '@/components/file-chip'
import { features } from '@/lib/config'
import { useBuildNarration } from '@/hooks/use-build-narration'
import { useStudioOutlinePreview } from '@/hooks/use-studio-outline-preview'
import { useStageFThumbnailCache } from '@/hooks/use-stage-f-thumbnail-cache'
import { centerStageFor, effectiveNarrationEnabled } from '@/lib/build-narration-heuristics'
import {
  captureStudioPartialBuildReceipt, captureStudioPartialStageVersionIntent,
  hasStudioPartialStageVersionIntent, prepareStudioPartialStageTransition,
  prepareStudioInitialPartialStageTransition,
  settleStudioPartialStageTransition, isStudioSettledPartialStageCurrent,
  type StudioPartialStageAuthority, type StudioPartialStageAssignment,
  type StudioPartialBuildReceipt, type StudioPartialStageVersionIntent,
  type StudioSettledPartialStageReceipt, type StudioPartialStageTransitionInput,
} from '@/lib/studio-partial-stage-admission'
import type { DirectorTransportOwner } from '@/hooks/use-deckster-websocket-v2'
import { DirectorPresence } from '@/components/build-narration/director-presence'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { SlideGenerationPanel, type SlideComposeAcceptedJob, type SlideComposeBuiltResult, type SlideComposePanelEvent, type StudioSlideBuiltSelection } from '@/components/slide-generation-panel'
import { createAddSlideV2Hooks } from '@/lib/studio-add-slide-v2-submit'
import { createAddSlideV2RegenerateHooks } from '@/lib/studio-add-slide-v2-submit'
import { createAddSlideV2GeneratedStore, rememberAddSlideV2Failed, rememberAddSlideV2Generated } from '@/lib/studio-add-slide-v2'
import { StudioFormatInspector, type StudioFormatTarget, type StudioFormatCommand } from '@/components/builder/studio-format-inspector'
import type { StudioFormatSelectionHandle } from '@/lib/studio-format-native'
import { TextBoxFormatPanel } from '@/components/textbox-format-panel'
import {
  STUDIO_DECK_MUTATION_REFRESH_ENABLED,
  createDeckMutationSeen,
  planDeckMutationRefresh,
  requestSlideRailRefresh,
} from '@/lib/studio-deck-mutation-refresh'
import { TextBoxFormatting, type RefineElementRequest, type SlideComposeViewerApi, type StudioIntroductionSafety, type StudioComposeSelectionContext, type StudioElementGenerationLease, type StudioPartialNativeReadback } from '@/components/presentation-viewer'
import { parseStudioNativeSlideOrder, type StudioNativeSlideOrder } from '@/lib/studio-native-slide-order'
import { STUDIO_PANEL_KEEP_CANVAS_ENABLED, presentationWrapperTransition } from '@/lib/studio-panel-keep-canvas'
import {
  STUDIO_GOTO_NEW_SLIDE_ENABLED,
  goToNewSlideIntent,
  resolveGoToNewSlideTarget,
  shouldArmGoToNewSlide,
  type GoToNewSlideIntent,
} from '@/lib/studio-goto-new-slide'
import {
  createStudioComposeRestoreTarget, resolveStudioComposeRestore, verifyStudioComposeRestoreSelection,
  type StudioComposeRestoreOwner, type StudioComposeRestoreTarget, type StudioComposeRestoreState,
} from '@/lib/studio-compose-selection-restore'
import { ElementFormatPanel } from '@/components/element-format-panel'
import { ElementType, ElementProperties, SlideLayoutType } from '@/types/elements'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { GenerationPanel } from '@/components/generation-panel'
import type { ElementGenerationSubmitIntent } from '@/lib/element-generation-retry'
import { useGenerationPanel } from '@/hooks/use-generation-panel'
import { useElementRefinement } from '@/hooks/use-element-refinement'
import { shouldOpenAsBlankPlaceholder } from '@/lib/element-blank-policy'
import { isTextLabsMappable } from '@/lib/element-type-mapping'
import { useBlankElements } from '@/hooks/use-blank-elements'
import { useTextLabsSession } from '@/hooks/use-textlabs-session'
import type {
  ElementResearchCapabilities,
  TextLabsComponentType,
  TextLabsFormData,
} from '@/types/textlabs'
// Extracted components
import { MessageList } from '@/components/builder/message-list'
import { ChatInput } from '@/components/builder/chat-input'
import { StudioDirectorNotice } from '@/components/builder/studio-director-notice'
import { StudioBlockedSendNotice } from '@/components/builder/studio-blocked-send-notice'
import { ComposerLibraryDialog } from '@/components/builder/composer-library-dialog'
import { COMPOSER_READY_KEY_PREFIX, type ComposerReady } from '@/lib/composer-library'
import { BuilderHeader } from '@/components/builder/builder-header'
import { PresentationArea } from '@/components/builder/presentation-area'
import { TemplateParamsPanel, TEMPLATE_PANEL_COLLAPSED_WIDTH } from '@/components/builder/template-params-panel'
import { TokenUsageStrip } from '@/components/builder/token-usage-strip'
import { StudioDirectorHeader } from '@/components/builder/chat/studio-director-header'
import { DirectorCallEntry, DirectorCallPanel } from '@/components/builder/voice-interactive/director-call'
import { useStudioDirectorCall } from '@/hooks/use-studio-director-call'
import { STUDIO_VOICE_INTERACTIVE_ENABLED } from '@/lib/studio-voice-interactive'
import {
  STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED,
  nextBlockedSendNotice,
  quotaBlockedSendNotice,
  templateBlockedSendNotice,
  uploadBlockedSendNotice,
  type BlockedSendNotice,
  type BlockedSendSource,
} from '@/lib/studio-blocked-send'
import { classifyDirectorMessage } from '@/lib/studio-director-message-policy'
import { createStudioVoiceOwner } from '@/lib/studio-voice-owner'
import { classifyStudioCanvasLifecycle } from '@/lib/studio-canvas-lifecycle'
import { StudioWaitingState } from '@/components/builder/studio-waiting-state'
import { TemplateIngestReviewCards } from '@/components/template-ingest-review-cards'
import { INGEST_INTENT_KEY_PREFIX, type IngestIntentPayload } from '@/components/template-ingest-dialog'
import { TopUpModal } from '@/components/builder/topup-modal'
import { ManualDeckConflictDialog } from '@/components/builder/manual-deck-conflict-dialog'
import { useDeckIdentity } from '@/hooks/use-deck-identity'
import type { DeckIdentity } from '@/lib/deck-identity'
import type { SlideComposeThumbnailJob } from '@/components/slide-thumbnail-strip'
import {
  canPollCompleteSlideComposeJob,
  canLiveReconcileSlideCompose,
  getComposeVisualIndexForTarget,
  resolveSlideComposeVisualIndex,
  resolveSlideComposeCountAfterReady,
  resolveSlideComposeSelectionAfterReady,
  shouldNavigateToResolvedComposeSlide,
  shouldUseIncomingComposePresentationUrl,
  shiftSlideComposeTargetsAfterInsert,
  SLIDE_COMPOSE_WATCHDOG_MS,
} from '@/lib/slide-compose-async'
import {
  buildSlideComposeJobStatusPath,
  normalizeSlideComposeJobRecoveryResult,
  resolveSlideComposeSessionId,
} from '@/lib/slide-compose-job-recovery'
import {
  mergeStageFReadyThumbnailUrl,
  mergeStageFPresentationThumbnailUrl,
} from '@/lib/stage-f-thumbnails'

// Extracted hooks
import { useBuilderSession } from '@/hooks/use-builder-session'
import { useTextLabsGeneration, type TextLabsGenerationResult } from '@/hooks/use-textlabs-generation'
import { useKnowledgeGraph } from '@/hooks/use-knowledge-graph'
import { useQuota } from '@/hooks/use-quota'
import { useThemeProfiles } from '@/hooks/use-theme-profiles'
import {
  isTemplateGenerationReady,
  templateGenerationUnavailableReason,
  useTemplates,
  type TemplateBlueprint,
  type TemplateSelection,
  type TemplateSnapshot,
} from '@/hooks/use-templates'
import {
  themeSelectionFingerprint,
  type BuildThemeSelection,
} from '@/lib/theme-builder'
import { themeFontFields, themeFontsEqual } from '@/lib/theme-fonts'
import { getLayoutServiceUrl, LAYOUT_URL_CONFIG_ERROR, LAYOUT_VIEWER_URL_POLICY, getPresentationViewerUrl } from '@/lib/layout-service-client'
import { ServiceUrlConfigError } from '@/lib/service-url'
import { evaluateLayoutViewerUrl } from '@/lib/layout-viewer-url-policy'
import { shouldDeferStudioInitialNative, type StudioInitialStageTarget } from '@/lib/studio-initial-stage-admission'
import {
  initialStudioInitialStageOwnerState,
  reconcileStudioInitialStageOwner,
  createStudioInitialRouteAdoptionIntent,
  type StudioInitialRouteAdoptionIntent,
  type StudioInitialStageOwnerObservation,
} from '@/lib/studio-initial-stage-owner'
import type { TemplateModeOverride, TemplateOverrides } from '@/lib/template-mode'
import type { SlideRefineTarget } from '@/lib/slide-refinement'
import {
  attachmentsFromPayload,
  snapshotAttachedUploads,
} from '@/lib/user-message-attachments'
import {
  deriveBuilderStage,
  isPresentationCallbackCurrent,
  resolveEffectivePresentation,
} from '@/lib/builder-presentation-ownership'
import { normalizeSemanticComponentType } from '@/lib/element-semantic-type'
import {
  IDLE_THEME_SYNC,
  applyThemeSyncResponse,
  isThemeAppliedToPresentation,
  isThemeSyncTerminal,
  persistedThemeSync,
  probePersistedPresentationTheme,
  syncingTheme,
  waitForAuthoritativeTheme,
  type ThemeSyncRequestResult,
  type ThemeSyncState,
  type ElementThemePreflightRetry,
} from '@/lib/theme-sync'
import {
  buildSessionHandoffRequest,
  clearPendingHandoff,
  createManualDeckContext,
  inspectManualDeck,
  readPendingHandoff,
  savePendingHandoff,
  shouldInspectManualDeckBeforeBuild,
  type ManualDeckContext,
  type ManualDeckSummary,
  type PendingHandoffSubmission,
} from '@/lib/manual-deck-workflow'
import { lastBuilderSessionKey, unsavedBuilderSessionKey } from '@/lib/last-builder-session'
import {
  absorbStudioHandoffStatus,
  canAutomaticallySubmitStudioHandoff,
  getExpectedStudioHandoffRequest,
  markStudioHandoffSubmitted,
} from '@/lib/studio-handoff-status'
import type { DirectorHandoffRequestOwner, DirectorHandoffRequestStatus } from '@/hooks/use-deckster-websocket-v2'

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

const DEFAULT_DRAWER_WIDTH = 420
const MIN_DRAWER_WIDTH = 320
const MAX_DRAWER_WIDTH_RATIO = 0.5
const BUILDER_SESSION_OPTIONS_VERSION = 2
const THEME_SYNC_TIMEOUT_MS = 20_000
const isAttachedUpload = (file: UploadedFile) => (
  file.status === 'success'
  || file.status === 'stored'
  || file.status === 'processing'
  || file.status === 'degraded'
)
function normalizeTextLabsElementType(value: unknown): TextLabsComponentType | null {
  return normalizeSemanticComponentType(value)
}

function scTrace(event: string, payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (!features.slideComposerTraceEnabled && window.localStorage?.getItem('deckster.slideComposerTrace') !== 'true') return
  console.info('[SC_TRACE]', event, payload)
}

type BuilderTemplateSelection = TemplateSelection
type ActiveBuildThemeProfile = {
  id: string
  name: string
  theme_payload: BuildThemeSelection
}

type SlideComposeJobStatus = 'building' | 'error'
type SlideComposeJobKind = 'compose' | 'refine'

interface SlideComposeJobState {
  job_id: string
  kind?: SlideComposeJobKind
  target_visual_index: number
  target_layout_index: number
  target_slide_id?: string | null
  status: SlideComposeJobStatus
  title: string
  request: Record<string, unknown>
  target_presentation_id?: string | null
  real_slide_id?: string | null
  expected_slide_count?: number | null
  lastProgressText?: string
  errors?: string[]
}

interface BuilderSessionOptions {
  version: typeof BUILDER_SESSION_OPTIONS_VERSION
  ownerUserId: string
  activeTemplate: BuilderTemplateSelection | null
  buildThemeSelection: BuildThemeSelection
  activeBuildThemeProfile: ActiveBuildThemeProfile | null
}

interface PendingManualDeckBuild {
  messageText: string
  presentationId: string
  presentationUrl: string | null
  summary: ManualDeckSummary
  operationId: string
}

interface DirectorHandoffResponse {
  new_session_id: string
  source_session_id: string
  status: 'ready'
  continued_from_session_id: string
}

function getBuilderSessionOptionsKey(userId: string, sessionId: string): string {
  return `deckster_builder_options_v2_${encodeURIComponent(userId)}_${sessionId}`
}

function normalizeStoredBuildThemeSelection(value: unknown): BuildThemeSelection {
  if (!value || typeof value !== 'object') return { mode: 'auto' }

  const raw = value as Partial<BuildThemeSelection>
  if (raw.mode === 'preset') {
    return typeof raw.preset_id === 'string'
      ? { mode: 'preset', preset_id: raw.preset_id, ...themeFontFields(raw) }
      : { mode: 'auto' }
  }

  if (raw.mode === 'custom') {
    const next: BuildThemeSelection = { mode: 'custom' }
    if (typeof raw.primary_hex === 'string') next.primary_hex = raw.primary_hex
    if (typeof raw.secondary_hex === 'string') next.secondary_hex = raw.secondary_hex
    if (typeof raw.tertiary_hex === 'string') next.tertiary_hex = raw.tertiary_hex
    if (typeof raw.neutral_hex === 'string') next.neutral_hex = raw.neutral_hex
    if (
      raw.harmony_preference === 'auto' ||
      raw.harmony_preference === 'monochrome' ||
      raw.harmony_preference === 'analogous' ||
      raw.harmony_preference === 'complementary' ||
      raw.harmony_preference === 'triadic'
    ) {
      next.harmony_preference = raw.harmony_preference
    }
    if (raw.palette_mode === 'light' || raw.palette_mode === 'dark' || raw.palette_mode === 'both') {
      next.palette_mode = raw.palette_mode
    }
    if (raw.color_overrides && typeof raw.color_overrides === 'object') {
      next.color_overrides = raw.color_overrides
    }
    Object.assign(next, themeFontFields(raw))
    return next.primary_hex || next.secondary_hex || next.tertiary_hex || next.color_overrides ? next : { mode: 'auto' }
  }

  return { mode: 'auto' }
}

function normalizeStoredTemplate(value: unknown): BuilderTemplateSelection | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Partial<BuilderTemplateSelection>
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  return {
    id: raw.id,
    name: raw.name,
    blueprint_generation_method: raw.blueprint_generation_method,
    blueprint_enrichment_status: raw.blueprint_enrichment_status,
    blueprint_enrichment_error: raw.blueprint_enrichment_error,
    template_purity_status: raw.template_purity_status,
    template_purity_error: raw.template_purity_error,
  }
}

function normalizeStoredBuildThemeProfile(value: unknown): ActiveBuildThemeProfile | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Partial<ActiveBuildThemeProfile>
  const themePayload = normalizeStoredBuildThemeSelection(raw.theme_payload)
  return typeof raw.id === 'string' &&
    typeof raw.name === 'string' &&
    themePayload.mode !== 'auto'
    ? { id: raw.id, name: raw.name, theme_payload: themePayload }
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
  if (a.mode === 'preset') return a.preset_id === b.preset_id && themeFontsEqual(a, b)

  return (
    (a.primary_hex || '').toLowerCase() === (b.primary_hex || '').toLowerCase() &&
    (a.secondary_hex || '').toLowerCase() === (b.secondary_hex || '').toLowerCase() &&
    (a.tertiary_hex || '').toLowerCase() === (b.tertiary_hex || '').toLowerCase() &&
    (a.neutral_hex || '').toLowerCase() === (b.neutral_hex || '').toLowerCase() &&
    (a.harmony_preference || 'auto') === (b.harmony_preference || 'auto') &&
    (a.palette_mode || 'light') === (b.palette_mode || 'light') &&
    stableStringifyRecord(a.color_overrides) === stableStringifyRecord(b.color_overrides) &&
    themeFontsEqual(a, b)
  )
}

function buildThemeProfileMatchesSelection(
  profile: ActiveBuildThemeProfile | null,
  selection: BuildThemeSelection,
): boolean {
  return !!profile && buildThemeSelectionsEqual(profile.theme_payload, selection)
}

function readBuilderSessionOptions(userId: string, sessionId: string): BuilderSessionOptions {
  if (typeof window === 'undefined') {
    return {
      version: BUILDER_SESSION_OPTIONS_VERSION,
      ownerUserId: userId,
      activeTemplate: null,
      buildThemeSelection: { mode: 'auto' },
      activeBuildThemeProfile: null,
    }
  }

  try {
    const raw = window.sessionStorage.getItem(getBuilderSessionOptionsKey(userId, sessionId))
    if (!raw) {
      return {
        version: BUILDER_SESSION_OPTIONS_VERSION,
        ownerUserId: userId,
        activeTemplate: null,
        buildThemeSelection: { mode: 'auto' },
        activeBuildThemeProfile: null,
      }
    }

    const parsed = JSON.parse(raw) as Partial<BuilderSessionOptions>
    if (
      parsed.version !== BUILDER_SESSION_OPTIONS_VERSION
      || parsed.ownerUserId !== userId
    ) {
      return {
        version: BUILDER_SESSION_OPTIONS_VERSION,
        ownerUserId: userId,
        activeTemplate: null,
        buildThemeSelection: { mode: 'auto' },
        activeBuildThemeProfile: null,
      }
    }

    const buildThemeSelection = normalizeStoredBuildThemeSelection(parsed.buildThemeSelection)
    const activeBuildThemeProfile = normalizeStoredBuildThemeProfile(parsed.activeBuildThemeProfile)
    return {
      version: BUILDER_SESSION_OPTIONS_VERSION,
      ownerUserId: userId,
      activeTemplate: normalizeStoredTemplate(parsed.activeTemplate),
      buildThemeSelection,
      activeBuildThemeProfile: buildThemeProfileMatchesSelection(activeBuildThemeProfile, buildThemeSelection)
        ? activeBuildThemeProfile
        : null,
    }
  } catch {
    return {
      version: BUILDER_SESSION_OPTIONS_VERSION,
      ownerUserId: userId,
      activeTemplate: null,
      buildThemeSelection: { mode: 'auto' },
      activeBuildThemeProfile: null,
    }
  }
}

function writeBuilderSessionOptions(
  userId: string,
  sessionId: string,
  activeTemplate: BuilderTemplateSelection | null,
  buildThemeSelection: BuildThemeSelection,
  activeBuildThemeProfile: ActiveBuildThemeProfile | null,
): void {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(
      getBuilderSessionOptionsKey(userId, sessionId),
      JSON.stringify({
        version: BUILDER_SESSION_OPTIONS_VERSION,
        ownerUserId: userId,
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

function extractPresentationIdFromViewerUrl(url: string | null): string | null {
  if (!url) return null
  const decodeId = (value: string) => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  try {
    const parsed = new URL(url, 'https://deckster.local')
    const match = parsed.pathname.match(/\/p\/([^/]+)/)
    return match ? decodeId(match[1]) : null
  } catch {
    const match = url.match(/\/p\/([^/?#]+)/)
    return match ? decodeId(match[1]) : null
  }
}

interface StudioSyncSelectionRecord {
  sequence: number
  lane: 'compose' | 'refine'
  owner: StudioComposeRestoreOwner
  isOwnerCurrent: () => boolean
  context: StudioComposeSelectionContext | null
  priorOrder: StudioNativeSlideOrder | null
  consumed: boolean
  persistCount: (count: number) => void
  /** Flag NEXT_PUBLIC_STUDIO_GOTO_NEW_SLIDE_ENABLED only: the slide on stage when the request started (the go-to's user-move baseline). */
  startVisualIndex?: number
}
interface StudioSyncPendingSelection {
  request: StudioSyncSelectionRecord
  target: StudioComposeRestoreTarget | null
  restoreSelection: boolean
  /** Flag NEXT_PUBLIC_STUDIO_GOTO_NEW_SLIDE_ENABLED only: go to the inserted slide after the reload. */
  goToNewSlide?: GoToNewSlideIntent | null
  refreshRevision: number
  refreshToken: number
  expectedUrl: string
  observedRefresh: boolean
}

function AuthenticatedBuilderContent({ authScopeUserId }: { authScopeUserId: string }) {
  const { user, isLoading: isAuthLoading } = useAuth()
  // This component is keyed by authScopeUserId at the boundary below. Account
  // changes therefore discard all Builder-local state and socket hooks in the
  // same render instead of waiting for cleanup effects.
  const builderCacheOwner = authScopeUserId
  const router = useRouter()
  const searchParams = useSearchParams()
  const themeSearchOverride = searchParams.get('theme')

  // Session management
  const { loadSession, createSession } = useChatSessions()

  // UI state
  const [inputMessage, setInputMessage] = useState("")
  const [pendingManualDeckBuild, setPendingManualDeckBuild] = useState<PendingManualDeckBuild | null>(null)
  const [manualDeckHandoffBusy, setManualDeckHandoffBusy] = useState(false)
  const [manualDeckHandoffError, setManualDeckHandoffError] = useState<string | null>(null)
  const templateBuilderEnabled = process.env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED === 'true'
  const composerLibraryEnabled = process.env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED === 'true'
  const [showComposerLibrary, setShowComposerLibrary] = useState(false)
  const blueprintEditorV2Enabled = templateBuilderEnabled && process.env.NEXT_PUBLIC_BLUEPRINT_EDITOR_V2 === 'true'
  // Template Builder (reuse): the locked-in template, carried on every send.
  const [activeTemplate, setActiveTemplate] = useState<BuilderTemplateSelection | null>(null)
  // MDC P4: late-bound handle so the WS hook options (declared earlier) can
  // trigger the New Chat flow defined further down.
  const handleNewChatWrappedRef = useRef<(() => void) | null>(null)
  // MDC P8: late-bound element-directive runner (defined after the Text Labs
  // hook below; the WS options are declared earlier).
  const elementDirectiveRunnerRef = useRef<((payload: import('@/types/mdc').ElementDirectivePayload) => void) | null>(null)
  const templateSelectionLockedRef = useRef(false)
  const [templateModeOn, setTemplateModeOn] = useState(false)
  const studioFormatTemplateModeRef = useRef(templateModeOn)
  const studioFormatTemplateModeObservedRef = useRef(templateModeOn)
  if (studioFormatTemplateModeObservedRef.current !== templateModeOn) {
    studioFormatTemplateModeObservedRef.current = templateModeOn
    studioFormatTemplateModeRef.current = templateModeOn
  }
  const [templateSnapshot, setTemplateSnapshot] = useState<TemplateSnapshot | null>(null)
  const [templateSnapshotLoading, setTemplateSnapshotLoading] = useState(false)
  const [templateBlueprintDirty, setTemplateBlueprintDirty] = useState(false)
  const [templateBlueprintSaving, setTemplateBlueprintSaving] = useState(false)
  const [templateParamsCollapsed, setTemplateParamsCollapsed] = useState(false)
  const [templateOverrides, setTemplateOverrides] = useState<TemplateOverrides>({})
  const [selectedTemplateElementId, setSelectedTemplateElementId] = useState<string | null>(null)
  const [buildThemeSelection, setBuildThemeSelection] = useState<BuildThemeSelection>({ mode: 'auto' })
  const [activeBuildThemeProfile, setActiveBuildThemeProfile] = useState<ActiveBuildThemeProfile | null>(null)
  const [themeSync, setThemeSync] = useState<ThemeSyncState>(IDLE_THEME_SYNC)
  const themeSyncRef = useRef(themeSync)
  themeSyncRef.current = themeSync
  const getThemeSyncSnapshot = useCallback(() => themeSyncRef.current, [])
  const latestThemeSyncRequestRef = useRef<string | null>(null)
  const latestThemeSyncKeyRef = useRef<string | null>(null)
  const themeSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const themeSelectionChangedLocallyRef = useRef(false)
  const commitThemeSync = useCallback((next: ThemeSyncState) => {
    themeSyncRef.current = next
    setThemeSync(next)
  }, [])
  const clearThemeSyncTimeout = useCallback(() => {
    if (!themeSyncTimeoutRef.current) return
    clearTimeout(themeSyncTimeoutRef.current)
    themeSyncTimeoutRef.current = null
  }, [])
  const standardThemeLoadedRef = useRef(false)
  const buildThemeSelectionRef = useRef(buildThemeSelection)
  const { getStandardTheme } = useThemeProfiles()
  const { getTemplate, updateTemplateBlueprint } = useTemplates()
  const hasTemplateOverrides = useMemo(
    () => hasTemplateOverrideEntries(templateOverrides),
    [templateOverrides],
  )
  const activeBuildThemeProfileForSelection = useMemo(
    () => buildThemeProfileMatchesSelection(activeBuildThemeProfile, buildThemeSelection)
      ? activeBuildThemeProfile
      : null,
    [activeBuildThemeProfile, buildThemeSelection],
  )
  const templateSendOptions = useMemo(() => {
    if (!activeTemplate) return {}

    return {
      templateMode: true as const,
      templateId: activeTemplate.id,
      ...(hasTemplateOverrides ? { elementOverrides: templateOverrides } : {}),
    }
  }, [activeTemplate, hasTemplateOverrides, templateOverrides])
  // Contract G3: who is presenting. Null when NEXT_PUBLIC_DECK_IDENTITY_ENABLED
  // is off or nothing is known, so spreading it emits no `deck_identity` key.
  const deckIdentity = useDeckIdentity()
  // Handlers passed into the WS hook are captured once, so the directive-driven
  // auto-send reads identity through a ref rather than a stale closure.
  const deckIdentityRef = useRef<DeckIdentity | null>(deckIdentity)
  useEffect(() => {
    deckIdentityRef.current = deckIdentity
  }, [deckIdentity])
  const buildSendOptions = useMemo(
    () => ({
      ...templateSendOptions,
      theme: buildThemeSelection,
      ...(deckIdentity ? { deckIdentity } : {}),
    }),
    [templateSendOptions, buildThemeSelection, deckIdentity],
  )
  const templateModeSourcePresentationId = templateModeOn
    ? templateSnapshot?.source_presentation_id ?? null
    : null
  const templateModeSourcePresentationUrl = useMemo(
    () => templateModeSourcePresentationId && !LAYOUT_URL_CONFIG_ERROR
      ? `${getLayoutServiceUrl()}/p/${encodeURIComponent(templateModeSourcePresentationId)}`
      : null,
    [templateModeSourcePresentationId],
  )
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [researchEnabled, setResearchEnabled] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const handleResearchEnabledChange = useCallback((enabled: boolean) => {
    setResearchEnabled(enabled)
    if (enabled) setWebSearchEnabled(true)
  }, [])
  const handleWebSearchEnabledChange = useCallback((enabled: boolean) => {
    setWebSearchEnabled(enabled)
    if (!enabled) setResearchEnabled(false)
  }, [])
  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)
  const {
    isSubscribed: kgSubscribed,
    isPremium: kgIsPremium,
    isLoading: kgIsLoading,
    capability: kgCapability,
    serviceAvailable: kgServiceAvailable,
    subscribe: subscribeToKnowledgeGraph,
  } = useKnowledgeGraph()
  // The KG workspace code refers to the loading flag as kgAccessLoading.
  const kgAccessLoading = kgIsLoading
  const [knowledgeGraphEnabled, setKnowledgeGraphEnabled] = useState(false)
  const canUseKnowledgeGraph = kgIsPremium && kgSubscribed && kgServiceAvailable
  // Keep the feature discoverable for every user. The chat row renders an
  // upgrade/setup affordance until both paid entitlement and explicit consent
  // are present; only the ready state can send KG=true.
  const showKnowledgeGraphToggle = true
  const knowledgeGraphAccess: 'locked' | 'setup' | 'ready' | 'unavailable' | 'loading' = kgAccessLoading
    ? 'loading'
    : !kgIsPremium
      ? 'locked'
      : !kgServiceAvailable
        ? 'unavailable'
        : canUseKnowledgeGraph
          ? 'ready'
          : 'setup'

  useEffect(() => {
    // Per-deck privacy choice: access becoming available must never silently
    // opt a resumed deck in. Like web/deep research, each deck starts off and
    // the user explicitly enables it from the chat menu.
    if (!canUseKnowledgeGraph) setKnowledgeGraphEnabled(false)
  }, [canUseKnowledgeGraph])

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
          buildThemeSelectionRef.current.mode === 'auto' &&
          // Auto already resolves the account's standard theme in Director.
          // Never replace its semantic selection after theme sync has started:
          // doing so invalidates an in-flight element for a display-only label.
          themeSyncRef.current.status === 'idle'
        ) {
          setBuildThemeSelection(profile.theme_payload)
          setActiveBuildThemeProfile({
            id: profile.id,
            name: profile.name,
            theme_payload: profile.theme_payload,
          })
        }
      } catch {
        // Standard-theme hydration is display-only; Director still resolves it.
      }
    })()
  }, [user, isAuthLoading, themeSearchOverride, buildThemeSelection.mode, getStandardTheme])

  const [sessionStoreName, setSessionStoreName] = useState<string | null>(null)
  const elementResearchCapabilities = useMemo<ElementResearchCapabilities>(() => {
    let knowledgeGraph: ElementResearchCapabilities['knowledge_graph'] = {
      available: false,
      code: 'KG_NOT_SUBSCRIBED',
      reason: 'Enable Knowledge Graph in Settings before using it for element research.',
    }
    if (!kgIsPremium) {
      knowledgeGraph = {
        available: false,
        code: 'KG_PLAN_REQUIRED',
        reason: 'Knowledge Graph requires the Max plan.',
      }
    } else if (kgIsLoading) {
      knowledgeGraph = {
        available: false,
        code: 'KG_CAPABILITY_CHECKING',
        reason: 'Checking Knowledge Graph availability.',
      }
    } else if (!kgCapability.available) {
      knowledgeGraph = {
        available: false,
        code: kgCapability.code || 'KG_NOT_CONFIGURED',
        reason: kgCapability.reason || 'Knowledge Graph is not configured in this environment.',
      }
    } else if (kgSubscribed) {
      knowledgeGraph = { available: true, code: null, reason: null }
    }

    return {
      web: { available: true, code: null, reason: null },
      uploaded_documents: sessionStoreName
        ? { available: true, code: null, reason: null }
        : {
            available: false,
            code: 'NO_UPLOADED_DOCUMENTS',
            reason: 'No uploaded documents are ready in this session.',
          },
      knowledge_graph: knowledgeGraph,
    }
  }, [kgCapability, kgIsLoading, kgIsPremium, kgSubscribed, sessionStoreName])
  const [pendingActionInput, setPendingActionInputState] = useState<{
    action: ActionRequest['payload']['actions'][0];
    messageId: string;
    timestamp: number;
  } | null>(null)
  const pendingActionIntentRef = useRef({ action: pendingActionInput, revision: 0 })
  const setPendingActionInput = useCallback((next: typeof pendingActionInput) => {
    // Cancel/replacement intent retires reconnect waits in the same event,
    // before React commits the updated composer.
    if (pendingActionIntentRef.current.action !== next) {
      pendingActionIntentRef.current = { action: next, revision: pendingActionIntentRef.current.revision + 1 }
    }
    setPendingActionInputState(next)
  }, [])
  const [showSidebar, setShowSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [studioViewerEditing, setStudioViewerEditing] = useState(false)
  const [showFormatPanel, setShowFormatPanel] = useState(false)
  const [slideGenerationMode, setSlideGenerationMode] = useState<'compose' | 'refine'>('compose')
  const [slideRefineTarget, setSlideRefineTarget] = useState<SlideRefineTarget | null>(null)
  const [showChat, setShowChat] = useState(true)
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH)
  const [isResizingDrawer, setIsResizingDrawer] = useState(false)
  // Theme is owned by next-themes' ThemeProvider (app/layout.tsx). The
  // sun/moon toggle in BuilderHeader and the "Dark Mode" entry in the
  // user-profile menu both call setTheme(), so they stay in sync. No
  // local builder-only theme state.
  // Text box selection state
  const [studioFormatOpen, setStudioFormatOpen] = useState(false)
  const [studioFormatTarget, setStudioFormatTarget] = useState<StudioFormatTarget | null>(null)
  const [studioFormatLoading, setStudioFormatLoading] = useState(false)
  const [studioFormatError, setStudioFormatError] = useState<string | null>(null)
  const studioFormatRequestRef = useRef<{ selection: StudioFormatSelectionHandle; scope: object & { busy: boolean; presentationId: string | null; slideIndex: number } } | null>(null)
  const studioFormatCommandIntentRef = useRef<object | null>(null)
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
    goToSlide: (slideIndex: number) => Promise<void>
    getStudioIntroductionSafety?: () => StudioIntroductionSafety
    captureStudioElementGeneration?: () => StudioElementGenerationLease | null
  } | null>(null)
  const [studioViewerSafety, setStudioViewerSafety] = useState<StudioIntroductionSafety | null>(null)
  const studioInitialBlankProofRef = useRef(initialStudioInitialStageOwnerState())
  const studioInitialOwnerObservationRef = useRef<StudioInitialStageOwnerObservation | null>(null)
  const studioInitialRouteAdoptionRef = useRef<StudioInitialRouteAdoptionIntent | null>(null)
  const studioNativeAdmittedOwnerRef = useRef<object | null>(null)
  const studioExplicitBlankOwnerRef = useRef<object | null>(null)
  const handleStudioViewerSafety = useCallback((next: StudioIntroductionSafety | null) => {
    setStudioViewerSafety(previous => previous && next && Object.keys(next).every(key =>
      previous[key as keyof StudioIntroductionSafety] === next[key as keyof StudioIntroductionSafety]) ? previous : next)
  }, [])
  const composeViewerApiRef = useRef<SlideComposeViewerApi | null>(null)
  const studioPartialScopeRef = useRef<{ key: string; authority: StudioPartialStageAuthority } | null>(null)
  const studioPartialMountedRef = useRef(false)
  const studioPartialAssignmentRef = useRef<StudioPartialStageAssignment | null>(null)
  const studioPartialAssignmentObservationRef = useRef<{ scope: object; key: string } | null>(null)
  const studioPartialCandidateRef = useRef<StudioPartialBuildReceipt | null>(null)
  const studioPartialCandidatesRef = useRef<{ scope: object; receipts: Map<string, StudioPartialBuildReceipt> } | null>(null)
  const studioPartialVersionIntentRef = useRef<StudioPartialStageVersionIntent | null>(null)
  const studioPartialVersionHandlerRef = useRef<((version: 'blank' | 'strawman' | 'final') => void) | null>(null)
  const studioPartialVersionInputsRef = useRef<{
    authority: StudioPartialStageAuthority; owner: object; buildId: string | null; observation: object
  } | null>(null)
  const studioPartialNativeReadbackHandlerRef = useRef<((readback: StudioPartialNativeReadback) => void) | null>(null)
  const studioPartialIngressRef = useRef<((message: SlideBuilt, owner?: DirectorTransportOwner) => void) | null>(null)
  const [studioPartialRevision, setStudioPartialRevision] = useState(0)
  const [studioPartialDisplayed, setStudioPartialDisplayed] = useState<StudioSettledPartialStageReceipt | null>(null)
  const studioPartialNativeRegistrationRef = useRef<{
    scope: object; owner: object; presentationId: string | null; presentationUrl: string | null
    layout: typeof layoutServiceApis; compose: SlideComposeViewerApi | null
  } | null>(null)
  const studioPartialReadCurrentRef = useRef<((context: StudioComposeSelectionContext | null) => StudioPartialStageTransitionInput) | null>(null)
  const studioPartialNativeSeenScopeRef = useRef<object | null>(null)
  const studioPartialNativeAbsenceRef = useRef<(() => boolean) | null>(null)
  const [studioPartialNativeIndex, setStudioPartialNativeIndex] = useState<{
    owner: object; presentationId: string; presentationUrl: string; count: number; index: number
    isFrameCurrent: () => boolean; isCurrent: () => boolean
  } | null>(null)
  const studioPartialLocalWorkRef = useRef(new Set<object>())
  const studioPartialRenderedWorkRef = useRef(false)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'true') return
    studioPartialMountedRef.current = true
    setStudioPartialRevision(revision => revision + 1)
    return () => {
      studioPartialMountedRef.current = false
      studioPartialScopeRef.current = null
      studioPartialIngressRef.current = null
      studioPartialNativeRegistrationRef.current = null
    }
  }, [])


  // Toast notifications
  const { toast } = useToast()

  // Current slide tracking
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const currentSlideIndexRef = useRef(0)
  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex
  }, [currentSlideIndex])
  const getCurrentSlideIndex = useCallback(() => currentSlideIndexRef.current, [])
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
  const [slideComposePanelEvent, setSlideComposePanelEvent] = useState<SlideComposePanelEvent | null>(null)
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
  const deckMutationSeenRef = useRef(createDeckMutationSeen())
  const studioSlideComposeOwnerRef = useRef({
    key: '',
    sessionId: null as string | null,
    presentationId: null as string | null,
    activeVersion: null as string | null,
  })
  const studioSlideComposeCountsRef = useRef<Record<string, number>>({})
  useEffect(() => {
    slideComposeJobsRef.current = slideComposeJobs
  }, [slideComposeJobs])
  const pendingComposePlaceholdersRef = useRef<Map<string, {
    jobId: string
    kind?: SlideComposeJobKind
    visualIndex?: number
    slideId?: string | null
    replaceJobId?: string
    presentationId?: string | null
    sessionId?: string
  }>>(new Map())
  const slideComposeWatchdogsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const slideComposePollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const studioSlideComposePollerOwnersRef = useRef<Record<string, object>>({})
  const studioSlideComposeWatchdogsRef = useRef<Record<string, {
    owner: object
    deadline: number
    reason: string
    fired: boolean
  }>>({})
  const slideComposeReconcileQueuesRef = useRef<Record<string, Promise<void>>>({})
  const slideComposeFallbackReloadInFlightRef = useRef(false)
  const pendingComposeSelectionRestoreRef = useRef<{
    visualIndex: number
    isCurrentOwner: () => boolean
  } | null>(null)
  const composeSelectionAttemptRef = useRef<object | null>(null)
  const studioSyncSequenceRef = useRef(0)
  const studioSyncRefreshRevisionRef = useRef(0)
  const studioSyncRefreshTokenRef = useRef(0)
  const studioSyncRequestRef = useRef<StudioSyncSelectionRecord | null>(null)
  const studioSyncProofsRef = useRef(new WeakMap<object, StudioSyncSelectionRecord>())
  const studioSyncPendingRef = useRef<StudioSyncPendingSelection | null>(null)
  function queueComposeSelectionRestore(visualIndex: number | null) {
    pendingComposeSelectionRestoreRef.current = visualIndex === null ? null
      : { visualIndex, isCurrentOwner: captureStudioSlideComposeOwner() }
  }
  const slideComposerLayoutCountReconcileRef = useRef<string | null>(null)

  const clearSlideComposerWork = useCallback(() => {
    setSlideComposeJobs({})
    setSlideComposePanelEvent(null)
    Object.values(slideComposeWatchdogsRef.current).forEach(clearTimeout)
    slideComposeWatchdogsRef.current = {}
    Object.values(slideComposePollersRef.current).forEach(clearInterval)
    slideComposePollersRef.current = {}
    studioSlideComposePollerOwnersRef.current = {}
    studioSlideComposeWatchdogsRef.current = {}
    pendingComposePlaceholdersRef.current.clear()
    slideComposeReconcileQueuesRef.current = {}
    slideComposeFallbackReloadInFlightRef.current = false
    pendingComposeSelectionRestoreRef.current = null
    composeSelectionAttemptRef.current = null
    studioSyncSequenceRef.current += 1
    studioSyncRefreshRevisionRef.current += 1
    studioSyncRequestRef.current = null
    studioSyncPendingRef.current = null
    slideComposerLayoutCountReconcileRef.current = null
  }, [])

  // J2V2-REGENERATE (flag NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED): which slides this session generated, and how the
  // regenerate jobs ended. A finished job leaves slideComposeJobs, so this is the only record of it. Inert with the flag off.
  const [addSlideV2Generated] = useState(createAddSlideV2GeneratedStore)

  const clearSlideComposeWatchdog = useCallback((jobId: string) => {
    const timer = slideComposeWatchdogsRef.current[jobId]
    if (timer) {
      clearTimeout(timer)
      delete slideComposeWatchdogsRef.current[jobId]
    }
    delete studioSlideComposeWatchdogsRef.current[jobId]
  }, [])

  const clearSlideComposePoller = useCallback((jobId: string) => {
    const timer = slideComposePollersRef.current[jobId]
    if (timer) {
      clearInterval(timer)
      delete slideComposePollersRef.current[jobId]
    }
    delete studioSlideComposePollerOwnersRef.current[jobId]
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
      const response = await fetch(`${getLayoutServiceUrl()}/api/presentations/${encodeURIComponent(presentationId)}`, {
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
    const isCurrentOwner = captureStudioSlideComposeOwner()
    if (!isCurrentOwner()) return false
    const job = slideComposeJobsRef.current[jobId]
    if (!job) return false
    const snapshot = slideComposerPresentationRef.current
    const presentation = await fetchSlideComposePresentationSnapshot(snapshot.presentationId)
    if (!isCurrentOwner()) return false
    if (!presentation) return false

    const hasExpectedSlide = job.kind === 'refine' && !job.real_slide_id
      ? false
      : job.real_slide_id
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

    if (process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true' && job.real_slide_id) {
      rememberAddSlideV2Generated(addSlideV2Generated, {
        jobId,
        realSlideId: job.real_slide_id,
        replacedSlideId: job.kind === 'refine' ? (job.target_slide_id ?? null) : null,
        request: job.request,
      })
    }
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
  }, [addSlideV2Generated, fetchSlideComposePresentationSnapshot, removeSlideComposeJob])

  const startSlideComposePoller = useCallback((jobId: string) => {
    const isCurrentOwner = captureStudioSlideComposeOwner()
    if (!isCurrentOwner()) return
    clearSlideComposePoller(jobId)
    if (studioShell) studioSlideComposePollerOwnersRef.current[jobId] = studioSlideComposeOwnerRef.current
    const poll = async () => {
      if (!isCurrentOwner()) return
      const job = slideComposeJobsRef.current[jobId]
      if (!job || job.status !== 'building') {
        clearSlideComposePoller(jobId)
        return
      }
      const snapshot = slideComposerPresentationRef.current
      const requestSessionId = typeof job.request.session_id === 'string'
        ? job.request.session_id
        : ''
      let recoveredRealSlideId = job.real_slide_id ?? null

      if (requestSessionId) {
        try {
          const response = await fetch(buildSlideComposeJobStatusPath({
            jobId,
            sessionId: requestSessionId,
            presentationId: snapshot.presentationId,
          }), { cache: 'no-store' })
          if (!isCurrentOwner()) return
          if (response.ok) {
            const recovered = normalizeSlideComposeJobRecoveryResult(
              await response.json().catch(() => null),
            )
            if (!isCurrentOwner()) return
            if (recovered?.job_id === jobId) {
              if (recovered.status === 'building') return

              if (recovered.status === 'error' || recovered.status === 'cancelled') {
                clearSlideComposePoller(jobId)
                clearSlideComposeWatchdog(jobId)
                const errors = recovered.errors.length > 0
                  ? recovered.errors
                  : [`Slide Composer ${recovered.status}.`]
                const recoveredKind: SlideComposeJobKind = recovered.kind
                if (recoveredKind === 'refine') {
                  if (process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true') rememberAddSlideV2Failed(addSlideV2Generated, jobId, errors[0])
                  void composeViewerApiRef.current?.refineOverlayClear(jobId).catch(error => {
                    console.warn('[Slide Composer] Failed to clear recovered refine overlay.', error)
                  })
                  setSlideComposeJobs(prev => {
                    const { [jobId]: _failed, ...rest } = prev
                    return rest
                  })
                  toast({
                    title: 'Refine failed',
                    description: errors[0],
                    variant: 'destructive',
                  })
                  return
                }
                void composeViewerApiRef.current?.composePlaceholderFail(jobId).catch(error => {
                  console.warn('[Slide Composer] Failed to mark recovered job as failed.', error)
                })
                setSlideComposeJobs(prev => {
                  const existing = prev[jobId]
                  if (!existing) return prev
                  return {
                    ...prev,
                    [jobId]: { ...existing, status: 'error', errors },
                  }
                })
                toast({
                  title: 'Slide failed',
                  description: errors[0],
                  variant: 'destructive',
                })
                return
              }

              if (recovered.status === 'built') {
                if (!recovered.real_slide_id) {
                  console.warn('[Slide Composer] Durable built job is missing real_slide_id.', {
                    job_id: jobId,
                  })
                  return
                }
                recoveredRealSlideId = recovered.real_slide_id
                const recoveredLayoutIndex = recovered.slide_index ?? job.target_layout_index
                const recoveredJob = {
                  ...job,
                  target_layout_index: recoveredLayoutIndex,
                  real_slide_id: recovered.real_slide_id,
                  expected_slide_count: Math.max(
                    job.expected_slide_count ?? 0,
                    recoveredLayoutIndex + 1,
                  ),
                }
                slideComposeJobsRef.current = {
                  ...slideComposeJobsRef.current,
                  [jobId]: recoveredJob,
                }
                setSlideComposeJobs(prev => ({ ...prev, [jobId]: recoveredJob }))
                queueComposeSelectionRestore(resolveSlideComposeSelectionAfterReady({
                  currentSlideIndex: currentSlideIndexRef.current,
                  jobTargetVisualIndex: job.target_visual_index,
                  resolvedVisualIndex: recoveredLayoutIndex,
                }))
                scTrace('builder.poll.job_status_built', {
                  job_id: jobId,
                  session_id: recovered.session_id,
                  presentation_id: recovered.presentation_id,
                  slide_index: recovered.slide_index,
                  real_slide_id: recovered.real_slide_id,
                })
              }
            }
          }
        } catch (error) {
          if (!isCurrentOwner()) return
          console.warn('[Slide Composer] Durable job status poll failed.', error)
        }
      }

      const presentation = await fetchSlideComposePresentationSnapshot(snapshot.presentationId)
      if (!isCurrentOwner()) return
      if (!presentation) return

      const foundById = canPollCompleteSlideComposeJob(recoveredRealSlideId)
        ? presentation.slideIds.has(recoveredRealSlideId)
        : false
      scTrace('builder.poll.complete_check', {
        job_id: jobId,
        real_slide_id: recoveredRealSlideId,
        target_layout_index: job.target_layout_index,
        expected_slide_count: job.expected_slide_count ?? null,
        fetched_slide_count: presentation.slideCount,
        found_by_id: foundById,
        found_by_count: false,
        count_only_poll_disabled: !canPollCompleteSlideComposeJob(recoveredRealSlideId),
      })
      if (!foundById) return

      triggerCoalescedSlideComposeReload(`compose job ${jobId} found by completion poll`)
      void confirmSlideComposeJobAfterRefresh(jobId)
    }

    slideComposePollersRef.current[jobId] = setTimeout(() => {
      if (!isCurrentOwner()) return
      void poll()
      slideComposePollersRef.current[jobId] = setInterval(() => {
        void poll()
      }, 3_000)
    }, 2_000) as unknown as ReturnType<typeof setInterval>
  }, [
    addSlideV2Generated,
    clearSlideComposeWatchdog,
    clearSlideComposePoller,
    confirmSlideComposeJobAfterRefresh,
    fetchSlideComposePresentationSnapshot,
    toast,
    triggerCoalescedSlideComposeReload,
  ])

  const startStudioSlideComposeWatchdog = useCallback((jobId: string, reason: string, deadline = Date.now() + SLIDE_COMPOSE_WATCHDOG_MS, targetPresentationId?: string | null) => {
    const isCurrentOwner = captureStudioSlideComposeOwner()
    if (!isCurrentOwner()) return
    clearSlideComposeWatchdog(jobId)
    const state = { owner: studioSlideComposeOwnerRef.current, deadline, reason, fired: false }
    studioSlideComposeWatchdogsRef.current[jobId] = state
    if (studioSlideComposeOwnerRef.current.presentationId && targetPresentationId !== undefined && targetPresentationId !== studioSlideComposeOwnerRef.current.presentationId) return
    slideComposeWatchdogsRef.current[jobId] = setTimeout(() => {
      if (!isCurrentOwner() || studioSlideComposeWatchdogsRef.current[jobId] !== state) return
      state.fired = true
      if (slideComposeJobsRef.current[jobId]?.status === 'building') {
        triggerCoalescedSlideComposeReload(reason)
        void confirmSlideComposeJobAfterRefresh(jobId)
      }
    }, Math.max(0, deadline - Date.now()))
  }, [clearSlideComposeWatchdog, confirmSlideComposeJobAfterRefresh, triggerCoalescedSlideComposeReload])

  // Portal target for toolbar in header
  const [toolbarPortalTarget, setToolbarPortalTarget] = useState<HTMLDivElement | null>(null)

  // Text Labs Generation Panel
  const generationPanel = useGenerationPanel()
  const blankElements = useBlankElements()

  const studioVoiceOwnerRef = useRef<ReturnType<typeof createStudioVoiceOwner> | null>(null)
  if (!studioVoiceOwnerRef.current) studioVoiceOwnerRef.current = createStudioVoiceOwner()
  const retireStudioVoiceOwner = useCallback(() => studioVoiceOwnerRef.current?.retire(), [])
  React.useLayoutEffect(() => {
    if (!STUDIO_VOICE_INTERACTIVE_ENABLED) return
    studioVoiceOwnerRef.current?.mount()
    return () => studioVoiceOwnerRef.current?.unmount()
  }, [])

  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [workspaceWidth, setWorkspaceWidth] = useState(1100)
  const [workspaceInnerWidth, setWorkspaceInnerWidth] = useState(1100)
  const [workspacePane, setWorkspacePane] = useState<StudioWorkspacePane>('chat')
  const [studioStageSelected, setStudioStageSelected] = useState(false)
  const [studioViewerFullscreen, setStudioViewerFullscreen] = useState(false)
  const studioVoiceLayoutIntentRef = useRef({ studioShell, workspaceWidth })
  studioVoiceLayoutIntentRef.current = { studioShell, workspaceWidth }
  useEffect(() => {
    if (!studioShell) return
    const syncFullscreen = () => setStudioViewerFullscreen(Boolean(document.fullscreenElement && workspaceRef.current?.contains(document.fullscreenElement)))
    syncFullscreen()
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [studioShell])
  const studioOverlayWorkspace = studioShell && workspaceWidth <= 880
  const selectWorkspacePane = useCallback((pane: StudioWorkspacePane) => {
    const current = studioVoiceLayoutIntentRef.current
    if (pane !== 'chat' && current.studioShell && current.workspaceWidth <= 880) retireStudioVoiceOwner()
    setStudioStageSelected(false)
    setWorkspacePane(pane)
  }, [retireStudioVoiceOwner])
  const revealStudioStage = useCallback(() => {
    if (studioShell && workspaceWidth <= 880) { retireStudioVoiceOwner(); setStudioStageSelected(true) }
  }, [studioShell, workspaceWidth, retireStudioVoiceOwner])
  const [preferredInspector, setPreferredInspector] = useState<StudioInspector | null>(null)
  const [chatWidth, setChatWidth] = useState<number | null>(null)
  const studioResizeCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => studioResizeCleanupRef.current?.(), [])

  useEffect(() => {
    if (!studioShell) return
    const savedWidth = Number(window.localStorage.getItem('deckster_builder_chat_width'))
    if (Number.isFinite(savedWidth) && savedWidth > 0) setChatWidth(savedWidth)
  }, [studioShell])

  useEffect(() => {
    if (!studioShell || !workspaceRef.current) return
    const workspace = workspaceRef.current
    const measure = () => {
      setWorkspaceWidth(workspace.getBoundingClientRect().width)
      setWorkspaceInnerWidth(workspace.clientWidth)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(workspace)
    return () => observer.disconnect()
  }, [studioShell])

  // Z-index tracking for drawer stacking order
  const zCounterRef = useRef(0)
  const [panelZIndices, setPanelZIndices] = useState({ element: 0, slide: 0, deck: 0 })
  // J2 v2 (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED): the Add Slide side panel lives in the Element drawer.
  // `addSlideV2Open` stays false, and the host is never rendered, while the flag is off.
  const [addSlideV2Open, setAddSlideV2Open] = useState(false)
  const [addSlideV2Host, setAddSlideV2Host] = useState<HTMLElement | null>(null)
  const addSlideV2FollowRef = useRef<Map<string, number>>(new Map())

  const bringToFront = useCallback((panel: 'element' | 'slide' | 'deck') => {
    zCounterRef.current += 1
    const z = zCounterRef.current
    setPanelZIndices(prev => ({ ...prev, [panel]: z }))
    if (studioShell) {
      selectWorkspacePane(panel === 'deck' ? 'chat' : 'inspector')
      if (panel !== 'deck') setPreferredInspector(panel)
    }
  }, [studioShell, selectWorkspacePane])
  const clampDrawerWidth = useCallback((width: number) => {
    if (typeof window === 'undefined') {
      return Math.min(Math.max(width, MIN_DRAWER_WIDTH), DEFAULT_DRAWER_WIDTH)
    }

    const maxWidth = Math.max(MIN_DRAWER_WIDTH, Math.floor((window.innerWidth - (studioShell ? 68 : 0)) * MAX_DRAWER_WIDTH_RATIO))
    return Math.min(Math.max(width, MIN_DRAWER_WIDTH), maxWidth)
  }, [studioShell])

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
      setDrawerWidth(studioShell ? savedWidth : clampDrawerWidth(savedWidth))
    }
  }, [clampDrawerWidth, studioShell])

  useEffect(() => {
    if (studioShell) return
    const handleResize = () => {
      setDrawerWidth(prev => {
        const next = clampDrawerWidth(prev)
        window.localStorage.setItem('deckster_builder_drawer_width', String(next))
        return next
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampDrawerWidth, studioShell])

  // Drawer open conditions
  const isElementDrawerOpen = generationPanel.isOpen || showTextBoxPanel || showElementPanel || (studioShell && studioFormatOpen) || addSlideV2Open
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

  const availableInspectors: StudioInspector[] = [
    ...(isElementDrawerOpen ? ['element' as const] : []),
    ...(isSlideDrawerOpen ? ['slide' as const] : []),
    ...(isTemplateParamsDrawerOpen ? ['template' as const] : []),
  ]
  const activeInspector = preferredInspector && availableInspectors.includes(preferredInspector)
    ? preferredInspector
    : isElementDrawerOpen && (!isSlideDrawerOpen || panelZIndices.element >= panelZIndices.slide)
      ? 'element' : isSlideDrawerOpen ? 'slide' : isTemplateParamsDrawerOpen ? 'template' : null

  // Opening a real inspector selects it on a compact workspace; changing width never closes it.
  const previousInspectorOpenRef = useRef({ element: false, slide: false, template: false })
  useEffect(() => {
    const current = { element: isElementDrawerOpen, slide: isSlideDrawerOpen, template: isTemplateParamsDrawerOpen }
    if (studioShell) {
      const newlyOpened = (['element', 'slide', 'template'] as const).find(panel => current[panel] && !previousInspectorOpenRef.current[panel])
      if (newlyOpened) {
        setPreferredInspector(newlyOpened)
        selectWorkspacePane('inspector')
      }
    }
    previousInspectorOpenRef.current = current
  }, [studioShell, isElementDrawerOpen, isSlideDrawerOpen, isTemplateParamsDrawerOpen, selectWorkspacePane])

  const persistStudioPaneWidth = (side: StudioWorkspacePane, width: number) => {
    const next = allocateStudioWorkspace({
      width: workspaceWidth,
      chatPreference: side === 'chat' ? width : chatWidth ?? studioChatWidth,
      inspectorPreference: side === 'inspector' ? width : drawerWidth,
      chatOpen: isDeckDrawerOpen,
      inspectorOpen: Boolean(activeInspector),
      inspectorCollapsed: activeInspector === 'template' && templateParamsCollapsed,
      activePane: workspacePane,
    })
    if (side === 'chat') {
      setChatWidth(next.chatWidth)
      window.localStorage.setItem('deckster_builder_chat_width', String(next.chatWidth))
    } else {
      setDrawerWidth(next.inspectorWidth)
      window.localStorage.setItem('deckster_builder_drawer_width', String(next.inspectorWidth))
    }
  }
  const handleStudioResizeStart = (event: React.MouseEvent<HTMLDivElement>, side: StudioWorkspacePane) => {
    event.preventDefault()
    studioResizeCleanupRef.current?.()
    const startX = event.clientX
    const startWidth = side === 'chat' ? studioChatWidth : studioInspectorWidth
    const cursor = document.body.style.cursor
    const userSelect = document.body.style.userSelect
    setIsResizingDrawer(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const move = (moveEvent: MouseEvent) => persistStudioPaneWidth(side, resizeStudioPane(startWidth, startX, moveEvent.clientX, side))
    const cleanup = () => {
      document.body.style.cursor = cursor
      document.body.style.userSelect = userSelect
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
      studioResizeCleanupRef.current = null
    }
    const stop = (upEvent: MouseEvent) => {
      move(upEvent)
      setIsResizingDrawer(false)
      cleanup()
    }
    studioResizeCleanupRef.current = cleanup
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }
  const handleStudioResizeKey = (event: React.KeyboardEvent<HTMLDivElement>, side: StudioWorkspacePane) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home') return
    event.preventDefault()
    event.stopPropagation()
    const width = side === 'chat' ? studioChatWidth : studioInspectorWidth
    const direction = (event.key === 'ArrowRight' ? 1 : -1) * (side === 'chat' ? 1 : -1)
    persistStudioPaneWidth(side, event.key === 'Home' ? side === 'chat' ? 304 : DEFAULT_DRAWER_WIDTH : width + direction * (event.shiftKey ? 32 : 8))
  }

  // FIXED: Track when generating final/strawman presentations
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false)
  const [templateReuseAwaitingInput, setTemplateReuseAwaitingInput] = useState(false)
  const [isGeneratingStrawman, setIsGeneratingStrawman] = useState(false)
  const isGeneratingFinalRef = useRef(false)
  // Build Narration: the WS hook's options are constructed before the
  // narration hook exists, so typed-frame callbacks route through this ref
  // (populated in an effect after useBuildNarration below).
  const buildNarrationHandlersRef = useRef<{
    onBuildPhase?: (payload: any, ownerSessionId?: string) => void
    onBuildEvent?: (payload: any) => void
    onSlideBuilt?: (payload: any) => void
    onBuildStateSync?: (buildState: unknown) => void
  }>({})
  // Persist isUnsavedSession in sessionStorage so it survives page refresh.
  // Without this, refreshing after immediateConnection generates a UUID loses
  // the "unsaved" flag, causing persistence and uploads to hit 404.
  const [isUnsavedSession, setIsUnsavedSession] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlSessionId = params.get('session_id')
      if (builderCacheOwner && urlSessionId && urlSessionId !== 'new') {
        return sessionStorage.getItem(
          unsavedBuilderSessionKey(builderCacheOwner, urlSessionId),
        ) === 'true'
      }
    }
    return false
  })

  // Guard to prevent concurrent executions of handleSendMessage
  const isExecutingSendRef = useRef(false)
  const questionSubmissionPendingRef = useRef(false)
  const createdDirectorSessionRef = useRef<{ id: string; ownerId: string; sourceSessionId: string } | null>(null)
  const manualDeckInspectionInFlightRef = useRef(false)
  const handoffSubmissionInFlightRef = useRef<Set<string>>(new Set())
  const pendingHandoffMemoryRef = useRef<PendingHandoffSubmission | null>(null)
  const [pendingHandoffRevision, setPendingHandoffRevision] = useState(0)
  const [handoffStorageWarning, setHandoffStorageWarning] = useState<{ sessionId: string; text: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const studioVoiceChatRootRef = useRef<HTMLDivElement>(null)
  const studioVoiceTranscriptRootRef = useRef<HTMLDivElement>(null)

  // CRITICAL: currentSessionId must be declared here in page.tsx (not inside useBuilderSession)
  // so useSessionPersistence gets the correct sessionId synchronously — no multi-render delay.
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
      // Next's route params already represent the destination during client navigation;
      // window.location can still represent the library being left on this render.
      const urlSessionId = studioShell ? searchParams.get('session_id')
        : typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session_id') : null
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
    return null
  })

  // A socket receipt can arrive before the submission effect. Keep the owned
  // in-memory receipt ahead of an older staged copy in browser storage.
  const readCurrentStudioHandoff = useCallback((sessionId: string | null) => {
    if (!sessionId || typeof window === 'undefined') return null
    let stored: PendingHandoffSubmission | null = null
    try { stored = readPendingHandoff(window.sessionStorage, sessionId) } catch { /* Memory remains available. */ }
    const memory = pendingHandoffMemoryRef.current
    if (memory?.new_session_id === sessionId
      && (memory.owner_user_id === undefined || memory.owner_user_id === authScopeUserId)
      && (!stored || stored.idempotency_key === memory.idempotency_key)) {
      const accountSession = { userId: authScopeUserId, sessionId }
      // Neither storage nor memory may downgrade a known submitted/observed
      // request to staged. Both directions must suppress uncertain replay.
      if (stored && canAutomaticallySubmitStudioHandoff(memory, accountSession)
        && !canAutomaticallySubmitStudioHandoff(stored, accountSession)) return stored
      return memory
    }
    return stored
  }, [authScopeUserId])
  const expectedStudioHandoffRequest = useMemo(() => studioShell
    ? getExpectedStudioHandoffRequest(readCurrentStudioHandoff(currentSessionId), {
        userId: authScopeUserId, sessionId: currentSessionId,
      })
    : null, [studioShell, currentSessionId, authScopeUserId, readCurrentStudioHandoff, pendingHandoffRevision])
  const expectedStudioHandoffRequestRef = useRef(expectedStudioHandoffRequest)
  expectedStudioHandoffRequestRef.current = expectedStudioHandoffRequest
  const handleStudioHandoffRequestStatus = useCallback((status: DirectorHandoffRequestStatus, owner: DirectorHandoffRequestOwner) => {
    if (!studioShell || typeof window === 'undefined') return
    const result = absorbStudioHandoffStatus(readCurrentStudioHandoff(currentSessionId), {
      userId: authScopeUserId, sessionId: currentSessionId,
    }, status, owner)
    if (!result.accepted || !result.pending) return
    pendingHandoffMemoryRef.current = result.pending
    setPendingHandoffRevision(value => value + 1)
    try {
      savePendingHandoff(window.sessionStorage, result.pending)
      setHandoffStorageWarning(null)
    } catch {
      setHandoffStorageWarning({ sessionId: result.pending.new_session_id,
        text: 'Director reported this request, but its recovery record could not be saved in this browser. Keep this tab open to retain its recovery record. Reload recovery is uncertain.' })
    }
  }, [studioShell, currentSessionId, authScopeUserId, readCurrentStudioHandoff])

  const {
    thumbnailUrls: slideThumbnailUrlsByPresentation,
    setThumbnailUrls: setSlideThumbnailUrlsByPresentation,
    setReceivedThumbnailUrls: setReceivedSlideThumbnailUrlsByPresentation,
    invalidateThumbnailUrls,
    captureThumbnailMutation,
  } = useStageFThumbnailCache({
    enabled: studioShell,
    ownerUserId: authScopeUserId,
    sessionId: currentSessionId,
  })

  const persistence = useSessionPersistence({
    sessionId: currentSessionId || '',
    userId: authScopeUserId,
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
  const previousKnowledgeGraphSessionRef = useRef(currentSessionId)
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
    if (
      previousKnowledgeGraphSessionRef.current !== null &&
      previousKnowledgeGraphSessionRef.current !== currentSessionId
    ) {
      // Covers sidebar navigation, browser history and query-param-driven
      // deck changes. A KG choice belongs only to the deck where it was made.
      setKnowledgeGraphEnabled(false)
    }
    previousKnowledgeGraphSessionRef.current = currentSessionId
  }, [currentSessionId])
  const builderOptionsRestoredSessionRef = useRef<string | null>(null)
  const skipBuilderOptionsPersistRef = useRef<string | null>(null)
  const builderOptionsScope = builderCacheOwner && currentSessionId && currentSessionId !== 'new'
    ? getBuilderSessionOptionsKey(builderCacheOwner, currentSessionId)
    : null

  // Remember the active session so "Back to builder" (in the account-area header)
  // can return the user to this exact deck. Covers create, resume, and
  // dashboard-initiated navigation since they all funnel through currentSessionId.
  useEffect(() => {
    if (typeof window === "undefined") return
    const userId = user?.id ?? user?.email
    if (userId && currentSessionId && currentSessionId !== "new") {
      try {
        window.localStorage.setItem(lastBuilderSessionKey(userId), currentSessionId)
      } catch {
        // ignore storage errors (Safari private mode, quota)
      }
    }
  }, [currentSessionId, user?.email, user?.id])

  useEffect(() => {
    standardThemeLoadedRef.current = false
    setPendingManualDeckBuild(null)
    setManualDeckHandoffError(null)
    setManualDeckHandoffBusy(false)
    setSlideComposerOverride(null)
    clearSlideComposerWork()
    if (!studioShell) setSlideThumbnailUrlsByPresentation({})
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
  }, [clearSlideComposerWork, currentSessionId])

  useEffect(() => {
    setSelectedTemplateElementId(null)
  }, [activeTemplateSlideIndex, templateModeOn])

  useEffect(() => {
    if (isAuthLoading || !builderOptionsScope || !currentSessionId) {
      builderOptionsRestoredSessionRef.current = null
      setActiveTemplate(null)
      setBuildThemeSelection({ mode: 'auto' })
      setActiveBuildThemeProfile(null)
      return
    }

    let cancelled = false
    const stored = readBuilderSessionOptions(builderCacheOwner, currentSessionId)
    skipBuilderOptionsPersistRef.current = builderOptionsScope
    setActiveTemplate(stored.activeTemplate)
    setBuildThemeSelection(stored.buildThemeSelection)
    setActiveBuildThemeProfile(stored.activeBuildThemeProfile)
    builderOptionsRestoredSessionRef.current = builderOptionsScope

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
          setActiveBuildThemeProfile({
            id: profile.id,
            name: profile.name,
            theme_payload: profile.theme_payload,
          })
        }
      })()
    }

    return () => {
      cancelled = true
    }
  }, [
    builderCacheOwner,
    builderOptionsScope,
    currentSessionId,
    getStandardTheme,
    isAuthLoading,
    themeSearchOverride,
  ])

  useEffect(() => {
    if (!builderCacheOwner || !builderOptionsScope || !currentSessionId) return
    if (builderOptionsRestoredSessionRef.current !== builderOptionsScope) return

    if (skipBuilderOptionsPersistRef.current === builderOptionsScope) {
      skipBuilderOptionsPersistRef.current = null
      return
    }

    writeBuilderSessionOptions(
      builderCacheOwner,
      currentSessionId,
      activeTemplate,
      buildThemeSelection,
      activeBuildThemeProfile,
    )
  }, [
    activeBuildThemeProfile,
    activeTemplate,
    buildThemeSelection,
    builderCacheOwner,
    builderOptionsScope,
    currentSessionId,
  ])

  const loadTemplateSnapshot = useCallback(async (template: BuilderTemplateSelection): Promise<TemplateSnapshot | null> => {
    setTemplateSnapshotLoading(true)
    try {
      const snapshot = await getTemplate(template.id)
      if (snapshot) {
        setTemplateSnapshot(snapshot)
        setActiveTemplate((previous) => previous?.id === snapshot.id
          ? {
              ...previous,
              blueprint_generation_method: snapshot.blueprint_generation_method ?? snapshot.template_blueprint?.generation_method,
              blueprint_enrichment_status: snapshot.blueprint_enrichment_status,
              blueprint_enrichment_error: snapshot.blueprint_enrichment_error,
              template_purity_status: snapshot.template_purity_status,
              template_purity_error: snapshot.template_purity_error,
            }
          : previous
        )
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

  const handleSelectTemplate = useCallback((template: BuilderTemplateSelection) => {
    if (templateSelectionLockedRef.current) {
      toast({
        title: 'Build selections locked',
        description: 'Template and theme choices are locked once generation starts. Start a new chat to choose different build settings.',
      })
      return
    }

    retireStudioVoiceOwner()
    setActiveTemplate(template)
    setTemplateOverrides({})
    setTemplateBlueprintDirty(false)
    setTemplateBlueprintSaving(false)
    setSelectedTemplateElementId(null)
    setTemplateSourceSlideIndex(currentSlideIndex)
    setTemplateParamsCollapsed(false)
    setTemplateModeOn(false)
    setTemplateSnapshot(null)
    setTemplateSnapshotLoading(false)
    if (!isTemplateGenerationReady(template)) {
      toast({
        title: 'Template selected for review',
        description: templateGenerationUnavailableReason(template),
      })
    }
  }, [currentSlideIndex, toast, retireStudioVoiceOwner])

  const handleBuildThemeChange = useCallback((next: BuildThemeSelection) => {
    if (templateSelectionLockedRef.current) {
      toast({
        title: 'Build selections locked',
        description: 'Template and theme choices are locked once generation starts. Start a new chat to choose different build settings.',
      })
      return
    }
    setActiveBuildThemeProfile(current => (
      buildThemeProfileMatchesSelection(current, next) ? current : null
    ))
    themeSelectionChangedLocallyRef.current = true
    setBuildThemeSelection(next)
  }, [toast])

  const handleActiveBuildThemeProfileChange = useCallback((profile: ActiveBuildThemeProfile | null) => {
    if (templateSelectionLockedRef.current) {
      toast({
        title: 'Build selections locked',
        description: 'Template and theme choices are locked once generation starts. Start a new chat to choose different build settings.',
      })
      return
    }
    setActiveBuildThemeProfile(profile)
  }, [toast])

  const handleClearTemplate = useCallback(() => {
    if (templateSelectionLockedRef.current) {
      toast({
        title: 'Build selections locked',
        description: 'Template and theme choices are locked once generation starts. Start a new chat to choose different build settings.',
      })
      return
    }
    retireStudioVoiceOwner()
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
  }, [toast, retireStudioVoiceOwner])

  const handleTemplateOptimizationFailed = useCallback((templateId: string) => {
    retireStudioVoiceOwner()
    setActiveTemplate((previous) => previous?.id === templateId ? null : previous)
    setTemplateModeOn(false)
    setTemplateSnapshot((previous) => previous?.id === templateId ? null : previous)
    setTemplateSnapshotLoading(false)
    setTemplateBlueprintDirty(false)
    setTemplateBlueprintSaving(false)
    setTemplateParamsCollapsed(false)
    setTemplateOverrides({})
    setSelectedTemplateElementId(null)
  }, [retireStudioVoiceOwner])

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
      setActiveTemplate((previous) => previous?.id === snapshot.id
        ? {
            ...previous,
            blueprint_generation_method: snapshot.blueprint_generation_method ?? snapshot.template_blueprint?.generation_method,
            blueprint_enrichment_status: snapshot.blueprint_enrichment_status,
            blueprint_enrichment_error: snapshot.blueprint_enrichment_error,
            template_purity_status: snapshot.template_purity_status,
            template_purity_error: snapshot.template_purity_error,
          }
        : previous
      )
      setTemplateBlueprintDirty(false)
      toast({
        title: 'Template changes saved',
        description: isTemplateGenerationReady(snapshot)
          ? 'Reusable slide and element details are now persisted.'
          : templateGenerationUnavailableReason(snapshot),
        variant: isTemplateGenerationReady(snapshot) ? undefined : 'destructive',
      })
    } finally {
      setTemplateBlueprintSaving(false)
    }
  }, [activeTemplate, templateSnapshot?.template_blueprint, toast, updateTemplateBlueprint])

  const handleTemplateElementSelect = useCallback((overrideKey: string | null) => {
    setSelectedTemplateElementId(overrideKey)
    if (!overrideKey) return

    retireStudioVoiceOwner()

    setTemplateParamsCollapsed(false)
    setShowChat(false)
    setShowTextBoxPanel(false)
    setSelectedTextBoxId(null)
    setSelectedTextBoxFormatting(null)
    setShowElementPanel(false)
    setSelectedElementId(null)
    setSelectedElementType(null)
    setSelectedElementProperties(null)
    setShowFormatPanel(false)
    generationPanel.closePanel()
  }, [generationPanel, retireStudioVoiceOwner])

  const handleTemplateModeChange = useCallback(async (enabled: boolean) => {
    if (enabled !== templateModeOn) retireStudioVoiceOwner()
    if (!enabled) {
      if (studioShell) {
        studioFormatRequestRef.current?.selection.retire()
        studioFormatRequestRef.current = null
        setStudioFormatOpen(false); setStudioFormatTarget(null); setStudioFormatLoading(false); setStudioFormatError(null)
      }
      if (templateBlueprintDirty && templateSnapshot?.template_blueprint && activeTemplate) {
        await handleTemplateBlueprintSave()
      }
      studioFormatTemplateModeRef.current = false
      setTemplateModeOn(false)
      setTemplateParamsCollapsed(false)
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

    if (studioShell) {
      // Close and retire synchronously before the mode setter or any await.
      // An old command callback cannot borrow the next render's selection.
      studioFormatTemplateModeRef.current = true
      studioFormatRequestRef.current?.selection.retire()
      studioFormatRequestRef.current = null
      setStudioFormatOpen(false); setStudioFormatTarget(null); setStudioFormatLoading(false); setStudioFormatError(null)
    }
    setTemplateModeOn(true)
    setTemplateParamsCollapsed(false)
    setShowChat(false)
    setShowTextBoxPanel(false)
    setSelectedTextBoxId(null)
    setSelectedTextBoxFormatting(null)
    setShowElementPanel(false)
    setSelectedElementId(null)
    setSelectedElementType(null)
    setSelectedElementProperties(null)
    setShowFormatPanel(false)
    generationPanel.closePanel()
    setTemplateSourceSlideIndex(currentSlideIndex)
    if (!templateSnapshot || templateSnapshot.id !== activeTemplate.id) {
      const snapshot = await loadTemplateSnapshot(activeTemplate)
      if (!snapshot) {
        studioFormatTemplateModeRef.current = false
        setTemplateModeOn(false)
      }
    }
  }, [
    studioShell,
    templateModeOn,
    retireStudioVoiceOwner,
    activeTemplate,
    currentSlideIndex,
    handleTemplateBlueprintSave,
    generationPanel,
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
    reconnectStatus,
    transportNotice,
    handoffRequestStatus,
    error: wsError,
    messages,
    studioVoiceTranscriptReceipt,
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
    studioAutomaticBlankSelection,
    activeVersion,
    directorWorkflowState,
    slideContextByIndex,
    deckContext,
    ephemeralMessageIds,
    ephemeralFadeToken,
    tokenUsage,
    tokenUsageMessageId,
    hasStrawman,
    composerAdoption,
    composerThemeResolved,
    templateIngestResult,
    templateIngestJobId,
    sendMessage,
    sendMessageWhenConnected,
    sendElementDirectiveResult,
    sendControlMessage,
    sendThemeSelection,
    sendBuildControl,
    applyTemplateIngestReady,
    clearMessages,
    clearEphemeralIds,
    restoreMessages,
    trackHandoffRequest,
    switchVersion,
    connect,
    ensureConnected,
    disconnect,
    isReady,
    socketSessionId,
    connectionGeneration,
    sessionId: wsSessionId,
    updateCacheUserMessages,
    awaitingDirectorReply,
    stopAwaitingReply,
  } = useDecksterWebSocketV2({
    getStudioVoiceAssistantAdmission: STUDIO_VOICE_INTERACTIVE_ENABLED ? message => !classifyDirectorMessage(message, {
      userMessageIds: session.userMessageIdsRef.current,
      userMessageContentMap: session.userMessageContentMapRef.current,
    }).isUserMessage : undefined,
    expectedHandoffRequest: expectedStudioHandoffRequest,
    onHandoffRequestStatus: handleStudioHandoffRequestStatus,
    // S-03: Director's deck_mutation (chat-driven add/delete/replace/reorder) reloads the displayed deck and
    // re-reads the rail inventory. Flag off: no handler, so the hook drops the frame exactly as before.
    ...(STUDIO_DECK_MUTATION_REFRESH_ENABLED && {
      onDeckMutation: (message: import('@/types/mdc').DeckMutationMessage, owner: { isCurrent: () => boolean; presentationId: string }) => {
        const displayed = slideComposerPresentationRef.current
        const plan = planDeckMutationRefresh({
          message, ownerIsCurrent: owner.isCurrent(), ownerPresentationId: owner.presentationId,
          displayed, now: Date.now(), seen: deckMutationSeenRef.current,
        })
        if (!plan) return
        slideComposerPresentationRef.current = { ...displayed, ...plan.override }
        setSlideComposerOverride(plan.override)
        requestSlideRailRefresh(plan.override.presentationId)
      },
    }),
    // Don't auto-connect when restoring an existing session from URL.
    // The useBuilderSession hook will connect AFTER DB load + restoreMessages,
    // preventing Director's blank state from flashing before restored content.
    autoConnect: features.immediateConnection && !currentSessionId,
    existingSessionId: currentSessionId || undefined,
    reconnectOnError: true,
    maxReconnectAttempts: 4,
    reconnectDelay: 1500,
    onSessionStateChange: (state) => {
      console.log('CALLBACK INVOKED!', {
        currentSessionId: currentSessionIdRef.current,
        hasPersistence: !!persistenceRef.current,
        currentStage: state.currentStage,
        hasUrl: !!state.presentationUrl,
        hasPresentationId: !!state.presentationId
      });

      if (currentSessionIdRef.current && persistenceRef.current) {
        const verifiedLayoutCount = (() => {
          const current = slideComposerPresentationRef.current
          const samePresentation =
            !!state.presentationId &&
            (current.presentationId === state.presentationId || current.presentationUrl === state.presentationUrl)
          return samePresentation ? current.slideCount : null
        })()
        const nextSlideCount = Math.max(state.slideCount ?? 0, verifiedLayoutCount ?? 0) || state.slideCount
        const isBlank = state.currentStage === 0
        const isStrawman = state.currentStage === 4
        const isFinal = state.currentStage === 6

        const updates: any = {
          currentStage: state.currentStage,
          slideCount: nextSlideCount,
          lastMessageAt: new Date(),
          stateCache: {
            activeVersion: state.activeVersion,
            slideStructure: state.slideStructure
          }
        }

        if (isBlank) {
          updates.blankPresentationUrl = state.presentationUrl
          updates.blankPresentationId = state.presentationId
          console.log('Saving blank presentation URLs:', { url: state.presentationUrl, id: state.presentationId })
        } else if (isStrawman) {
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
    onMessage: (message) => {
      if (message.type === 'theme_sync') {
        if (message.payload.request_id !== latestThemeSyncRequestRef.current) return
        const terminal = isThemeSyncTerminal(message.payload.status)
        if (terminal) clearThemeSyncTimeout()
        const current = themeSyncRef.current
        const next = applyThemeSyncResponse(current, message.payload)
        if (next.status === 'applied') {
          themeSelectionChangedLocallyRef.current = false
        }
        if (next !== current) commitThemeSync(next)
        return
      }

      const isTemplateActionRequest = message.type === 'action_request'
        && message.payload.actions.some((action) => action.value.startsWith('template_'))
      if (isTemplateActionRequest) {
        setIsGeneratingFinal(false)
        setTemplateReuseAwaitingInput(true)
        return
      }

      // Terminal build frames apply to ordinary and template builds alike.
      // Restricting this guard to activeTemplate left the optimistic progress
      // pulse stuck forever when a regular Slide Builder run ended in error.
      if (!isGeneratingFinalRef.current) return

      if (message.type === 'presentation_url') {
        setIsGeneratingFinal(false)
        setTemplateReuseAwaitingInput(false)
        return
      }

      if (message.type === 'status_update') {
        const status = message.payload.status
        if (status === 'idle' || status === 'complete' || status === 'error') {
          setIsGeneratingFinal(false)
          setTemplateReuseAwaitingInput(false)
        }
      }
    },
    onSlideComposeProgress: (message: SlideComposeProgress) => {
      const payload = message.payload
      const progressJob = slideComposeJobsRef.current[payload.job_id]
      if (progressJob && !isPresentationCallbackCurrent({
        callbackPresentationId: progressJob.target_presentation_id,
        livePresentationId: presentationId,
      })) {
        scTrace('builder.ws.slide_progress.ignored_stale', {
          job_id: payload.job_id,
          callback_presentation_id: progressJob.target_presentation_id ?? null,
          live_presentation_id: presentationId,
        })
        return
      }
      setSlideComposeJobs(prev => {
        const existing = prev[payload.job_id]
        if (!existing || existing.status === 'error') return prev
        return {
          ...prev,
          [payload.job_id]: {
            ...existing,
            lastProgressText: payload.text,
          },
        }
      })
      void composeViewerApiRef.current
        ?.composePlaceholderUpdate(
          payload.job_id,
          payload.text,
          payload.stage,
          payload.detail,
        )
        .catch(error => {
          console.warn('[Slide Composer] Failed to update in-deck placeholder progress.', error)
        })
    },
    onSlideBuilt: (message: SlideBuilt, owner?: DirectorTransportOwner) => {
      const { presentation_id, slide_index, thumbnail_url } = message.payload
      const ownsThumbnail = !studioShell || message.session_id === currentSessionIdRef.current
      if (ownsThumbnail) setReceivedSlideThumbnailUrlsByPresentation(presentation_id, prev =>
        mergeStageFPresentationThumbnailUrl(
          prev,
          presentation_id,
          slide_index,
          thumbnail_url,
        ),
      )
      // Build Narration (D1): the same shared frame feeds the canvas reducer.
      buildNarrationHandlersRef.current.onSlideBuilt?.(message.payload)
      if (studioShell) studioPartialIngressRef.current?.(message, owner)
    },
    // MDC P4 (K3): Director-confirmed new-deck handoff. Start a fresh session
    // and auto-send the captured brief (section 12-Q2 LOCKED). The send goes
    // through sendMessageWhenConnected, which waits for the fresh socket.
    onElementDirective: (payload) => {
      elementDirectiveRunnerRef.current?.(payload)
    },
    onSessionDirective: (payload) => {
      if (payload.directive !== 'new_session') return
      const prefill = (payload.prefill_prompt || '').trim()
      handleNewChatWrappedRef.current?.()
      if (prefill && payload.auto_send) {
        const ts = Date.now()
        session.setUserMessages(prev => [...prev, { id: `user-nd-${ts}`, text: prefill, timestamp: ts }])
        // Dedupe (I-D/F1): upstream's sendMessageWhenConnected owns the
        // closed-socket case — it reconnects, waits for OPEN, then sends.
        void sendMessageWhenConnected(prefill, undefined, undefined, {
          ...(deckIdentityRef.current ? { deckIdentity: deckIdentityRef.current } : {}),
        })
      } else if (prefill) {
        setInputMessage(prefill)
      }
    },
    // Build Narration: typed-frame ref-forwarders (WS options precede the
    // useBuildNarration hook, so the handlers land via a ref).
    onBuildPhase: (payload, ownerSessionId) => buildNarrationHandlersRef.current.onBuildPhase?.(payload, ownerSessionId),
    onBuildEvent: (payload) => buildNarrationHandlersRef.current.onBuildEvent?.(payload),
    onBuildStateSync: (buildState) => buildNarrationHandlersRef.current.onBuildStateSync?.(buildState),
    onSlideComposeReady: (message: SlideComposeReady) => {
      const payload = message.payload
      const readyJob = slideComposeJobsRef.current[payload.job_id]
      const callbackPresentationId = payload.presentation_id ?? readyJob?.target_presentation_id
      const isCurrentReadyOrigin = captureStudioSlideComposeOwner()
      if (studioShell && (!isCurrentReadyOrigin() || !isPresentationCallbackCurrent({
        callbackPresentationId,
        livePresentationId: studioSlideComposeOwnerRef.current.presentationId,
      }))) return
      if (!isPresentationCallbackCurrent({
        callbackPresentationId,
        livePresentationId: presentationId,
      })) {
        scTrace('builder.ws.slide_ready.ignored_stale', {
          job_id: payload.job_id,
          callback_presentation_id: callbackPresentationId ?? null,
          live_presentation_id: presentationId,
        })
        clearSlideComposeWatchdog(payload.job_id)
        clearSlideComposePoller(payload.job_id)
        setSlideComposeJobs(prev => {
          const { [payload.job_id]: _stale, ...rest } = prev
          return rest
        })
        return
      }
      setReceivedSlideThumbnailUrlsByPresentation(payload.presentation_id, prev =>
        mergeStageFReadyThumbnailUrl(
          prev,
          payload.presentation_id,
          payload.slide_index,
          payload.thumbnail_url,
          payload.kind,
        ),
      )
      const presentationKey = payload.presentation_id
        ?? slideComposerPresentationRef.current.presentationId
        ?? '__unknown__'
      setSlideComposePanelEvent({
        jobId: payload.job_id,
        status: 'built',
        message: `Slide ${Math.max(0, payload.slide_index) + 1} built.`,
      })
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
        if (!isCurrentReadyOrigin()) return
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
        const job = slideComposeJobsRef.current[payload.job_id]
        const readyKind: SlideComposeJobKind = payload.kind ?? job?.kind ?? 'compose'
        // J2V2-REGENERATE: remember the slide this job produced (its kind and original instruction) and that the job finished.
        if (process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true' && payload.real_slide_id) {
          rememberAddSlideV2Generated(addSlideV2Generated, {
            jobId: payload.job_id,
            realSlideId: payload.real_slide_id,
            replacedSlideId: readyKind === 'refine' ? (payload.replaced_slide_id ?? job?.target_slide_id ?? null) : null,
            request: job?.request ?? null,
          })
        }

        if (readyKind === 'refine') {
          const requestedSlideId = typeof job?.request.slide_id === 'string' ? job.request.slide_id : null
          const replacedSlideId = payload.replaced_slide_id ?? job?.target_slide_id ?? requestedSlideId

          if (!canLiveReconcileSlideCompose(payload.real_slide_id)) {
            console.warn('[Slide Composer] refine slide_ready missing real_slide_id; falling back to iframe refresh.', {
              job_id: payload.job_id,
              slide_index: payload.slide_index,
            })
            triggerCoalescedSlideComposeReload('refine slide_ready missing real_slide_id')
          } else if (!replacedSlideId) {
            console.warn('[Slide Composer] refine slide_ready missing replaced slide id; falling back to iframe refresh.', {
              job_id: payload.job_id,
              slide_index: payload.slide_index,
            })
            triggerCoalescedSlideComposeReload('refine slide_ready missing replaced_slide_id')
          } else if (!composeApi) {
            triggerCoalescedSlideComposeReload('compose API unavailable on refine slide_ready')
          } else {
            try {
              const reconcileResult = await composeApi.refineSlideReconcile(
                payload.job_id,
                replacedSlideId,
                payload.real_slide_id,
                targetPresentationId,
              )
              if (!isCurrentReadyOrigin()) return
              scTrace('builder.refine_reconcile.result', {
                job_id: payload.job_id,
                old_slide_id: replacedSlideId,
                input_real_slide_id: payload.real_slide_id,
                result: reconcileResult,
              })
              if (Number.isFinite(Number(reconcileResult?.visual_index))) {
                resolvedVisualIndex = Math.max(0, Number(reconcileResult.visual_index))
              } else if (job) {
                resolvedVisualIndex = job.target_visual_index
              }
              if (Number.isFinite(Number(reconcileResult?.real_slide_index))) {
                resolvedLayoutIndex = Math.max(0, Number(reconcileResult.real_slide_index))
              } else if (job) {
                resolvedLayoutIndex = job.target_layout_index
              }
              if (Number.isFinite(Number(reconcileResult?.real_slide_count))) {
                viewerSlideCount = Number(reconcileResult.real_slide_count)
              } else if (Number.isFinite(Number(reconcileResult?.total_slides))) {
                viewerSlideCount = Number(reconcileResult.total_slides)
              }
              liveSwapSucceeded = true
            } catch (error) {
              if (!isCurrentReadyOrigin()) return
              scTrace('builder.refine_reconcile.error', {
                job_id: payload.job_id,
                real_slide_id: payload.real_slide_id,
                replaced_slide_id: replacedSlideId,
                message: error instanceof Error ? error.message : String(error),
              })
              console.warn('[Slide Composer] Live refine swap failed; falling back to iframe refresh.', error)
              triggerCoalescedSlideComposeReload('refine live swap failed')
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
                  expected_slide_count: latest.slideCount ?? existing.expected_slide_count ?? null,
                },
              }
            })
            window.setTimeout(() => {
              if (!isCurrentReadyOrigin()) return
              void (async () => {
                const confirmed = await confirmSlideComposeJobAfterRefresh(payload.job_id)
                if (!isCurrentReadyOrigin()) return
                if (!confirmed && slideComposeJobsRef.current[payload.job_id]?.status === 'building') {
                  startSlideComposePoller(payload.job_id)
                }
              })()
            }, 1500)
            toast({
              title: 'Slide refined',
              description: 'Refreshing the deck to show the refined slide.',
            })
            return
          }

          const nextSlideCount = Number.isFinite(Number(viewerSlideCount))
            ? Number(viewerSlideCount)
            : latest.slideCount ?? payloadSlideIndex + 1
          const navigate = !!job && currentSlideIndexRef.current === job.target_visual_index
          const nextPresentationUrl = shouldUseIncomingComposePresentationUrl(
            latest.presentationUrl,
            targetPresentationUrl,
          )
            ? targetPresentationUrl
            : latest.presentationUrl

          removeSlideComposeJob(payload.job_id)
          scTrace('builder.ws.refine_ready.applied', {
            job_id: payload.job_id,
            real_slide_id: payload.real_slide_id,
            replaced_slide_id: replacedSlideId,
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
            title: 'Slide refined',
            description: `Updated slide ${resolvedVisualIndex + 1}.`,
          })
          return
        }

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
            if (!isCurrentReadyOrigin()) return
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
            if (!isCurrentReadyOrigin()) return
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
            if (!isCurrentReadyOrigin()) return
            void (async () => {
              const confirmed = await confirmSlideComposeJobAfterRefresh(payload.job_id)
              if (!isCurrentReadyOrigin()) return
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
        const composeJob = slideComposeJobsRef.current[payload.job_id]
        // J2 v2 (DEC-P9): the slide an Add Slide panel job was started from; null for every other job.
        const addSlideV2Follow = addSlideV2FollowRef.current.get(payload.job_id) ?? null
        addSlideV2FollowRef.current.delete(payload.job_id)
        const selectionRestoreVisualIndex = composeJob
          ? resolveSlideComposeSelectionAfterReady({
              currentSlideIndex: currentSlideIndexRef.current,
              jobTargetVisualIndex: composeJob.target_visual_index,
              resolvedVisualIndex,
              followVisualIndex: addSlideV2Follow,
            })
          : currentSlideIndexRef.current
        const navigate = !!composeJob && shouldNavigateToResolvedComposeSlide({
          currentSlideIndex: currentSlideIndexRef.current,
          jobTargetVisualIndex: composeJob.target_visual_index,
          resolvedVisualIndex,
          followVisualIndex: addSlideV2Follow,
        })
        const nextPresentationUrl = shouldUseIncomingComposePresentationUrl(
          latest.presentationUrl,
          targetPresentationUrl,
        )
          ? targetPresentationUrl
          : latest.presentationUrl
        refreshToken = Date.now()

        removeSlideComposeJob(payload.job_id, resolvedLayoutIndex)
        scTrace('builder.ws.slide_ready.applied', {
          job_id: payload.job_id,
          real_slide_id: payload.real_slide_id,
          resolved_visual_index: resolvedVisualIndex,
          resolved_layout_index: resolvedLayoutIndex,
          viewer_slide_count: viewerSlideCount,
          next_slide_count: nextSlideCount,
          navigate,
          selection_restore_visual_index: selectionRestoreVisualIndex,
          live_swap_succeeded: liveSwapSucceeded,
        })
        queueComposeSelectionRestore(selectionRestoreVisualIndex)
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
      const failedJob = slideComposeJobsRef.current[payload.job_id]
      if (studioShell && failedJob && (!captureStudioSlideComposeOwner()() ||
          failedJob.request.session_id !== studioSlideComposeOwnerRef.current.sessionId ||
          (studioSlideComposeOwnerRef.current.presentationId && failedJob.target_presentation_id !== studioSlideComposeOwnerRef.current.presentationId))) return
      if (failedJob && !isPresentationCallbackCurrent({
        callbackPresentationId: failedJob.target_presentation_id,
        livePresentationId: presentationId,
      })) {
        clearSlideComposeWatchdog(payload.job_id)
        clearSlideComposePoller(payload.job_id)
        setSlideComposeJobs(prev => {
          const { [payload.job_id]: _stale, ...rest } = prev
          return rest
        })
        return
      }
      const failedKind: SlideComposeJobKind = payload.kind ?? failedJob?.kind ?? 'compose'
      setSlideComposePanelEvent({
        jobId: payload.job_id,
        status: 'error',
        message: errors[0]
          ?? (payload.stage ? `Failed during ${payload.stage}.` : 'Slide generation failed.'),
      })
      clearSlideComposeWatchdog(payload.job_id)
      clearSlideComposePoller(payload.job_id)
      if (failedKind === 'refine') {
        if (process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true') rememberAddSlideV2Failed(addSlideV2Generated, payload.job_id, errors[0] ?? (payload.stage ? `Failed during ${payload.stage}.` : undefined))
        void composeViewerApiRef.current?.refineOverlayClear(payload.job_id).catch(error => {
          console.warn('[Slide Composer] Failed to clear refine overlay after error.', error)
        })
        setSlideComposeJobs(prev => {
          const { [payload.job_id]: _failed, ...rest } = prev
          return rest
        })
        toast({
          title: 'Refine failed',
          description: errors[0] ?? (payload.stage ? `Failed during ${payload.stage}.` : 'Slide refinement failed.'),
          variant: 'destructive',
        })
        return
      }
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
    // Template Ingest (C-7): deck rebuilt from an uploaded presentation. The
    // hook already promoted viewer_url to the session presentation; surface
    // the save/optimize handoff here (existing template polling UI takes over).
    onTemplateIngestReady: () => {
      toast({
        title: 'Template saved — optimizing…',
        description: 'Your uploaded presentation was converted into a template.',
      })
    },
    onTemplateIngestFailed: (message: TemplateIngestFailed) => {
      const description = message.payload.error
        || message.payload.errors?.[0]
        || (message.payload.stage ? `Failed during ${message.payload.stage}.` : 'Template ingest failed.')
      toast({
        title: 'Template ingest failed',
        description,
        variant: 'destructive',
      })
    },
  })

  const quota = useQuota(tokenUsage, tokenUsageMessageId ?? undefined)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpReason, setTopUpReason] = useState<string | undefined>(undefined)
  // Blocked-send feedback (flag NEXT_PUBLIC_STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED,
  // default off): a send refused before it leaves also posts ONE client-only
  // notice at the end of the chat. Never sent to the Director, never persisted;
  // the draft is untouched (a refusal never cleared it).
  const [blockedSendNotice, setBlockedSendNotice] = useState<BlockedSendNotice | null>(null)
  const blockedSendNoticeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED) setBlockedSendNotice(null)
  }, [currentSessionId, wsSessionId])
  useEffect(() => {
    if (STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED && blockedSendNotice) {
      blockedSendNoticeRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    }
  }, [blockedSendNotice?.id])
  const effectiveBuildNarrationEnabled = effectiveNarrationEnabled(
    features.buildNarrationEnabled,
    Boolean(activeTemplate),
  )

  // Canvas v2 R1: per-session dismissal of the blank-landing placeholder.
  const [blankPlaceholderDismissed, setBlankPlaceholderDismissed] = useState(false)
  useEffect(() => {
    setBlankPlaceholderDismissed(false)
  }, [currentSessionId])

  // Canvas v2 R3: stable viewer navigation for the deck walkthrough (0-based;
  // postMessage goToSlide never remounts the iframe).
  const narrationNavigate = useCallback(
    (slideIndex: number) => {
      void layoutServiceApis?.goToSlide?.(slideIndex)
    },
    [layoutServiceApis],
  )

  // Build Narration Canvas (NEXT_PUBLIC_BUILD_NARRATION) — inert when the flag
  // is off (the hook returns the initial inactive state and skips all effects).
  const {
    narration: buildNarration,
    pinSlide: pinNarrationSlide,
    onBuildPhase: narrationOnBuildPhase,
    onBuildEvent: narrationOnBuildEvent,
    onSlideBuilt: narrationOnSlideBuilt,
    syncBuildState: narrationSyncBuildState,
    markControl: markNarrationControl,
  } = useBuildNarration({
    // Template-reuse builds keep their own progress UI for now (untested
    // overlay interaction with the template panels) — narration excludes them.
    enabled: effectiveBuildNarrationEnabled,
    sessionId: currentSessionId,
    messages,
    currentStatus,
    slideStructure,
    isGeneratingFinal,
    isGeneratingStrawman,
    finalPresentationUrl,
    finalPresentationId,
    // Durable final identity fences outline/history replay without suppressing
    // a distinct newer typed build or its recovery controls.
  })

  const { showOutlinePreview, onNativeBuildPhase, cancelOutlinePreview } = useStudioOutlinePreview({
    enabled: studioShell && effectiveBuildNarrationEnabled,
    sessionId: currentSessionId,
    buildId: buildNarration.buildId,
    phase: buildNarration.phase,
    slidesDone: buildNarration.slidesDone,
    activeVersion,
    templateModeOn,
  })

  // Route typed narration frames from the WS hook into the reducer. With the
  // flag off the ref stays empty — frames from a new Director are dropped at
  // the callback boundary (nothing accumulates).
  useEffect(() => {
    buildNarrationHandlersRef.current = effectiveBuildNarrationEnabled
      ? {
          onBuildPhase: (payload, ownerSessionId) => {
            narrationOnBuildPhase(payload)
            onNativeBuildPhase(payload, ownerSessionId ?? null)
          },
          onBuildEvent: narrationOnBuildEvent,
          onSlideBuilt: narrationOnSlideBuilt,
          onBuildStateSync: narrationSyncBuildState,
      }
      : {}
  }, [effectiveBuildNarrationEnabled, narrationOnBuildPhase, onNativeBuildPhase, narrationOnBuildEvent, narrationOnSlideBuilt, narrationSyncBuildState])

  const directorOwnedPresentation = useMemo(
    () => resolveEffectivePresentation({
      livePresentationUrl: presentationUrl,
      livePresentationId: presentationId,
      liveSlideCount: slideCount,
      override: slideComposerOverride,
    }),
    [presentationId, presentationUrl, slideComposerOverride, slideCount],
  )
  // Display ownership excludes the presentation ID: admitting B must not
  // retire its own logical session merely because A was previously selected.
  const studioPartialScopeKey = JSON.stringify([authScopeUserId, user?.id, currentSessionId,
    wsSessionId, searchParams.get('session_id'), templateModeOn, templateModeSourcePresentationId])
  if (studioPartialScopeRef.current?.key !== studioPartialScopeKey) {
    const scope = {}
    const authority: StudioPartialStageAuthority = {
      scope, userId: authScopeUserId, sessionId: currentSessionId || wsSessionId || '',
      isCurrent: () => studioPartialMountedRef.current
        && studioPartialScopeRef.current?.authority === authority,
    }
    studioPartialScopeRef.current = { key: studioPartialScopeKey, authority }
  }
  const studioPartialAuthority = studioPartialScopeRef.current.authority
  if (studioPartialCandidatesRef.current?.scope !== studioPartialAuthority.scope) {
    studioPartialCandidatesRef.current = { scope: studioPartialAuthority.scope, receipts: new Map() }
  }
  for (const retired of buildNarration.retiredBuildIds) studioPartialCandidatesRef.current.receipts.delete(retired)
  studioPartialCandidateRef.current = buildNarration.buildId
    ? studioPartialCandidatesRef.current.receipts.get(buildNarration.buildId) ?? null : null
  const studioPartialDisplayInput = {
    authority: studioPartialAuthority, assignment: studioPartialAssignmentRef.current,
    buildId: buildNarration.buildId, buildPresentationId: buildNarration.buildPresentationId,
    phase: buildNarration.phase, narrationEnabled: studioShell && effectiveBuildNarrationEnabled,
    templateOverride: Boolean(templateModeOn || templateModeSourcePresentationUrl),
    viewerUrlAllowed: !LAYOUT_URL_CONFIG_ERROR && Boolean(buildNarration.buildPresentationId
      && evaluateLayoutViewerUrl(getPresentationViewerUrl(buildNarration.buildPresentationId), LAYOUT_VIEWER_URL_POLICY).status === 'allowed'),
    versionIntent: studioPartialVersionIntentRef.current,
  }
  const studioPartialHeld = Boolean(studioShell && studioPartialDisplayed
    && studioPartialDisplayInput.assignment
    && isStudioSettledPartialStageCurrent(studioPartialDisplayed, {
      ...studioPartialDisplayInput, assignment: studioPartialDisplayInput.assignment,
      viewerUrlAllowed: !LAYOUT_URL_CONFIG_ERROR
        && evaluateLayoutViewerUrl(getPresentationViewerUrl(studioPartialDisplayed.presentationId), LAYOUT_VIEWER_URL_POLICY).status === 'allowed',
    }))
  // Canvas v2 R3 (amends D11): the stage always shows the real artifact. The
  // strawman shows AS a deck (with narration chrome around it), and from the
  // first slide_built the center swaps to the FILLING final deck, addressed by
  // the id the typed frames carry — long before the official presentation_url.
  const legacyNarrationCenterStage = centerStageFor({
    narrationEnabled: effectiveBuildNarrationEnabled,
    templateOverride: Boolean(templateModeSourcePresentationUrl),
    phase: buildNarration.phase,
    buildPresentationId: buildNarration.buildPresentationId,
    finalPresentationUrl,
  })
  // Studio uses a private admitted target. Classic retains its exact existing
  // center-stage policy; raw narration/history is never display authority here.
  const narrationCenterStage = studioShell
    ? (studioPartialHeld && !(studioPartialDisplayed!.presentationId === directorOwnedPresentation.presentationId
      && finalPresentationId === studioPartialDisplayed!.presentationId && activeVersion === 'final'
      && finalPresentationUrl && finalPresentationUrl === directorOwnedPresentation.presentationUrl)
      ? 'final_fill' : 'default')
    : legacyNarrationCenterStage
  const studioPartialTargetId = studioPartialHeld ? studioPartialDisplayed!.presentationId : null
  const effectivePresentationId = narrationCenterStage === 'final_fill'
    ? (studioShell ? studioPartialTargetId : buildNarration.buildPresentationId)
    : (templateModeSourcePresentationId ?? directorOwnedPresentation.presentationId)
  const effectiveSlideCount = templateModeSourcePresentationId
    ? slideCount
    : studioShell && narrationCenterStage === 'final_fill'
      ? (studioPartialNativeIndex?.presentationId === effectivePresentationId
        && studioPartialNativeIndex.owner === studioSlideComposeOwnerRef.current
        && studioPartialNativeIndex.isFrameCurrent() ? studioPartialNativeIndex.count : null)
      : directorOwnedPresentation.slideCount
  const effectivePresentationUrl = useMemo(
    () => {
      const fillingId = studioShell ? studioPartialTargetId : buildNarration.buildPresentationId
      if (narrationCenterStage === 'final_fill' && fillingId) {
        // Keep Director's canonical /p/{id}; the viewer separately admits a
        // completed snapshot refresh when this mounted build frame is stale.
        return LAYOUT_URL_CONFIG_ERROR ? null : getPresentationViewerUrl(fillingId)
      }
      return withSlideComposerRefreshToken(
        templateModeSourcePresentationUrl ?? directorOwnedPresentation.presentationUrl,
        templateModeSourcePresentationId ? 0 : directorOwnedPresentation.refreshToken,
      )
    },
    [directorOwnedPresentation, templateModeSourcePresentationId, templateModeSourcePresentationUrl, narrationCenterStage, buildNarration.buildPresentationId, studioShell, studioPartialTargetId],
  )
  const studioPartialMetadata = studioShell && narrationCenterStage === 'final_fill'
  const effectiveSlideStructure = studioPartialMetadata ? null : slideStructure
  const effectiveActiveVersion = studioPartialMetadata ? 'final' : activeVersion
  const effectiveIsBlankPresentation = studioPartialMetadata ? false : isBlankPresentation

  // Retire continuations on navigation/version intent, even if the same deck
  // is selected again. Counts and composer refreshes keep the current owner.
  const studioSlideComposeOwnerKey = JSON.stringify([
    currentSessionId || wsSessionId,
    authScopeUserId,
    searchParams.get('session_id'),
    effectivePresentationId,
    effectiveActiveVersion,
    templateModeOn,
  ])
  if (studioSlideComposeOwnerRef.current.key !== studioSlideComposeOwnerKey) {
    studioSlideComposeOwnerRef.current = {
      key: studioSlideComposeOwnerKey,
      sessionId: currentSessionId || wsSessionId,
      presentationId: effectivePresentationId,
      activeVersion: effectiveActiveVersion,
    }
  }
  if (studioShell && effectivePresentationId && effectiveSlideCount !== null) {
    studioSlideComposeCountsRef.current[effectivePresentationId] = effectiveSlideCount
  }
  // Canonical selection excludes composer refresh tokens; private initial-stage
  // proof below permits only an explicitly verified fresh route adoption.
  const studioInitialSelectedTarget: StudioInitialStageTarget = {
    owner: studioSlideComposeOwnerRef.current,
    presentationId: effectivePresentationId,
    presentationUrl: narrationCenterStage === 'final_fill' ? effectivePresentationUrl
      : templateModeSourcePresentationUrl ?? directorOwnedPresentation.presentationUrl,
    activeVersion: effectiveActiveVersion,
  }


  const studioCanvasLifecycle = classifyStudioCanvasLifecycle({
    displayedSessionId: currentSessionId || wsSessionId,
    deckOwnerSessionId,
    selected: {
      presentationId: effectivePresentationId,
      presentationUrl: narrationCenterStage === 'final_fill'
        ? effectivePresentationUrl
        : templateModeSourcePresentationUrl ?? directorOwnedPresentation.presentationUrl,
      activeVersion: effectiveActiveVersion,
      slideCount: effectiveSlideCount,
    },
    finalPresentationId,
    finalPresentationUrl,
    hasAuthoredStructure: (effectiveSlideStructure?.slides ?? []).length > 0,
    // Session loading has its own exclusive canvas branch below.
    loading: false,
    generating: isGeneratingFinal || isGeneratingStrawman,
    phase: buildNarration.active ? buildNarration.phase : 'idle',
    dismissed: blankPlaceholderDismissed,
    connected,
    connecting,
  })
  const studioWelcome = studioShell && !studioPartialMetadata && studioCanvasLifecycle.showLanding
  const workspaceLayout = allocateStudioWorkspace({
    width: studioOverlayWorkspace ? workspaceInnerWidth : workspaceWidth,
    chatPreference: chatWidth ?? (studioWelcome ? Math.min(640, workspaceWidth * .44) : 304),
    inspectorPreference: drawerWidth,
    chatOpen: isDeckDrawerOpen,
    inspectorOpen: Boolean(activeInspector),
    inspectorCollapsed: activeInspector === 'template' && templateParamsCollapsed,
    collapsedWidth: TEMPLATE_PANEL_COLLAPSED_WIDTH,
    activePane: workspacePane,
    overlay: studioOverlayWorkspace,
    // Fullscreen owns the foreground; newly opened native panes resume on exit.
    stageSelected: studioStageSelected || studioViewerFullscreen,
  })
  const studioCanvasCovered = studioOverlayWorkspace && !studioViewerFullscreen && (workspaceLayout.chatVisible || (workspaceLayout.inspectorVisible && !(activeInspector === 'template' && templateParamsCollapsed)))
  const inspectorIsVisible = (inspector: StudioInspector) => workspaceLayout.inspectorVisible && activeInspector === inspector
  const studioElementVisible = inspectorIsVisible('element')
  const studioSlideVisible = inspectorIsVisible('slide')
  const studioTemplateVisible = inspectorIsVisible('template')
  const studioInspectorWidth = workspaceLayout.inspectorWidth
  const studioChatWidth = workspaceLayout.chatWidth
  const showStudioInspectorTabs = availableInspectors.length > 1 && !(activeInspector === 'template' && templateParamsCollapsed)


  const composerThemeBlocked = composerThemeSyncBlocked(composerLibraryEnabled,
    { composerAdoption, composerThemeResolved }, effectivePresentationId)
  const composerThemeFrozen = composerLibraryEnabled && composerAdoption?.presentation_id === effectivePresentationId

  const themeSyncTargetRef = useRef({
    isReady,
    presentationId: effectivePresentationId,
    templateModeOn,
    composerThemeBlocked,
    composerThemeFrozen,
    selection: buildThemeSelection,
  })
  themeSyncTargetRef.current = {
    isReady,
    presentationId: effectivePresentationId,
    templateModeOn,
    composerThemeBlocked,
    composerThemeFrozen,
    selection: buildThemeSelection,
  }

  const requestThemeSyncForPresentation = useCallback((
    targetPresentationId: string,
  ): ThemeSyncRequestResult => {
    const target = themeSyncTargetRef.current
    if (target.composerThemeBlocked) {
      return { ok: false, code: 'failed', error: target.composerThemeFrozen
        ? 'This template keeps its stored source theme.'
        : 'Waiting for the presentation theme policy from Director.' }
    }
    if (target.templateModeOn) {
      return {
        ok: false,
        code: 'failed',
        error: 'Deck-theme element generation is unavailable while Template Mode owns the presentation.',
      }
    }
    if (!target.presentationId || target.presentationId !== targetPresentationId) {
      return {
        ok: false,
        code: 'presentation_changed',
        error: 'The active presentation changed before its deck theme could be prepared. Generate again in the current presentation.',
      }
    }

    const themeFingerprint = themeSelectionFingerprint(target.selection)
    const requestKey = `${targetPresentationId}:${themeFingerprint}`
    const current = themeSyncRef.current
    if (
      current.requestId &&
      isThemeAppliedToPresentation(current, targetPresentationId, themeFingerprint)
    ) {
      latestThemeSyncRequestRef.current = current.requestId
      latestThemeSyncKeyRef.current = requestKey
      return {
        ok: true,
        requestId: current.requestId,
        themeFingerprint,
      }
    }
    if (!target.isReady) {
      return {
        ok: false,
        code: 'disconnected',
        error: 'Director is disconnected. Reconnect, then generate this element again.',
      }
    }
    if (
      latestThemeSyncKeyRef.current === requestKey &&
      current.requestId &&
      current.presentationId === targetPresentationId &&
      current.themeFingerprint === themeFingerprint &&
      (current.status === 'syncing' || current.status === 'applied')
    ) {
      return { ok: true, requestId: current.requestId, themeFingerprint }
    }

    clearThemeSyncTimeout()
    const requestId = crypto.randomUUID()
    latestThemeSyncRequestRef.current = requestId
    latestThemeSyncKeyRef.current = requestKey
    commitThemeSync(syncingTheme(requestId, targetPresentationId, themeFingerprint))

    if (!sendThemeSelection(target.selection, requestId, targetPresentationId)) {
      const error = 'Director disconnected before it could apply the deck theme. Reconnect, then generate this element again.'
      commitThemeSync({
        status: 'failed',
        requestId,
        presentationId: targetPresentationId,
        themeFingerprint,
        error,
      })
      return { ok: false, code: 'disconnected', error }
    }

    themeSyncTimeoutRef.current = setTimeout(() => {
      if (latestThemeSyncRequestRef.current !== requestId) return
      commitThemeSync({
        status: 'failed',
        requestId,
        presentationId: targetPresentationId,
        themeFingerprint,
        error: 'Theme application timed out. Reapply the deck theme or reconnect, then generate again.',
      })
      themeSyncTimeoutRef.current = null
    }, THEME_SYNC_TIMEOUT_MS)

    return { ok: true, requestId, themeFingerprint }
  }, [clearThemeSyncTimeout, commitThemeSync, sendThemeSelection])

  const ensureThemeReady = useCallback(async (targetPresentationId: string, retry?: ElementThemePreflightRetry) => {
    if (themeSyncTargetRef.current.composerThemeBlocked) {
      return { ready: false, code: 'failed', error: themeSyncTargetRef.current.composerThemeFrozen
        ? 'This template keeps its stored source theme.'
        : 'Waiting for the presentation theme policy from Director.' } as const
    }
    const current = getThemeSyncSnapshot()
    const desiredFingerprint = themeSelectionFingerprint(
      themeSyncTargetRef.current.selection,
    )
    if (
      isThemeAppliedToPresentation(
        current,
        targetPresentationId,
        desiredFingerprint,
      )
      && current.requestId
    ) {
      return { ready: true, sync: current, source: 'director' } as const
    }

    // A theme selected locally while Director is disconnected or has refused
    // the change has not reached Layout yet. Do not render against the previously
    // persisted palette (or neutral fallback) and silently misrepresent the user's new selection.
    if (
      current.status === 'failed'
      && (current.requestId === null || (studioShell && themeSelectionChangedLocallyRef.current))
      && current.presentationId === targetPresentationId
      && current.themeFingerprint === desiredFingerprint
    ) {
      return {
        ready: false,
        code: 'failed',
        error: current.error
          || 'This theme selection is pending. Reconnect so Director can apply it before generating themed elements.',
      } as const
    }

    // Only an explicit Retry of this failed handshake may request fresh
    // authority. Existing local-theme/composer/template guards still apply.
    if (
      process.env.NEXT_PUBLIC_ELEMENT_THEME_PREFLIGHT_RECOVERY_ENABLED === 'true'
      && retry
      && retry.presentationId === targetPresentationId
      && retry.themeFingerprint === desiredFingerprint
      && current.presentationId === retry.presentationId
      && current.themeFingerprint === retry.themeFingerprint
      && current.requestId === retry.requestId
      && current.status === 'failed'
    ) {
      const requested = requestThemeSyncForPresentation(targetPresentationId)
      if (!requested.ok) return { ready: false, code: requested.code, error: requested.error } as const
      return waitForAuthoritativeTheme({
        presentationId: targetPresentationId,
        themeFingerprint: desiredFingerprint,
        getSyncState: getThemeSyncSnapshot,
        isConnected: () => themeSyncTargetRef.current.isReady,
        requestSync: requestThemeSyncForPresentation,
        timeoutMs: THEME_SYNC_TIMEOUT_MS,
        captureFailureSync: true,
      })
    }

    // A theme mutation already accepted by Director must finish (or fail)
    // before generation. When Director is connected, idle or stale applied
    // state is also advanced to the exact selected theme. A disconnected or
    // failed Director is not authoritative: Layout's persisted theme remains
    // usable and the renderer can fall back to a neutral palette.
    const shouldWaitForDirector = (
      (
        current.status === 'syncing'
        && current.presentationId === targetPresentationId
        && current.requestId
      )
      || (
        themeSyncTargetRef.current.isReady
        && (
          current.status === 'idle'
          || (
            current.status === 'applied'
            && (
              current.presentationId !== targetPresentationId
              || current.themeFingerprint !== desiredFingerprint
            )
          )
        )
      )
    )
    if (shouldWaitForDirector) {
      return waitForAuthoritativeTheme({
        presentationId: targetPresentationId,
        themeFingerprint: desiredFingerprint,
        getSyncState: getThemeSyncSnapshot,
        isConnected: () => themeSyncTargetRef.current.isReady,
        requestSync: requestThemeSyncForPresentation,
        timeoutMs: THEME_SYNC_TIMEOUT_MS,
        captureFailureSync: process.env.NEXT_PUBLIC_ELEMENT_THEME_PREFLIGHT_RECOVERY_ENABLED === 'true',
      })
    }

    const persisted = await probePersistedPresentationTheme({
      presentationId: targetPresentationId,
      layoutServiceUrl: getLayoutServiceUrl(),
    })
    return {
      ready: true,
      source: persisted.source,
      // Preserve the selected semantic identity even though readiness came
      // from Layout. If Director reconnects during element generation, the
      // hook can distinguish an equivalent re-application from a real theme
      // change without trusting a transport request ID.
      sync: persistedThemeSync(targetPresentationId, persisted.source, desiredFingerprint),
      ...(persisted.notice ? { notice: persisted.notice } : {}),
    } as const
  }, [studioShell, getThemeSyncSnapshot, requestThemeSyncForPresentation])

  useEffect(() => {
    if (composerThemeBlocked) {
      latestThemeSyncRequestRef.current = null
      latestThemeSyncKeyRef.current = null
      clearThemeSyncTimeout()
      commitThemeSync(IDLE_THEME_SYNC)
      return
    }
    if (!isReady || !effectivePresentationId || templateModeOn) {
      const current = themeSyncRef.current
      const currentFingerprint = themeSelectionFingerprint(buildThemeSelection)
      if (
        !templateModeOn &&
        !isReady &&
        effectivePresentationId &&
        themeSelectionChangedLocallyRef.current
      ) {
        latestThemeSyncRequestRef.current = null
        latestThemeSyncKeyRef.current = null
        clearThemeSyncTimeout()
        commitThemeSync({
          status: 'failed',
          requestId: null,
          presentationId: effectivePresentationId,
          themeFingerprint: currentFingerprint,
          error: 'This theme selection is pending. Reconnect so Director can apply it before generating themed elements.',
        })
        return
      }
      if (
        !templateModeOn &&
        effectivePresentationId &&
        isThemeAppliedToPresentation(current, effectivePresentationId, currentFingerprint)
      ) {
        clearThemeSyncTimeout()
        latestThemeSyncRequestRef.current = current.requestId
        latestThemeSyncKeyRef.current = `${effectivePresentationId}:${currentFingerprint}`
        return
      }
      if (
        !templateModeOn &&
        effectivePresentationId &&
        current.status === 'failed' &&
        current.requestId === null &&
        current.presentationId === effectivePresentationId &&
        current.themeFingerprint === currentFingerprint
      ) {
        clearThemeSyncTimeout()
        latestThemeSyncRequestRef.current = null
        latestThemeSyncKeyRef.current = null
        return
      }
      latestThemeSyncRequestRef.current = null
      latestThemeSyncKeyRef.current = null
      clearThemeSyncTimeout()
      commitThemeSync(IDLE_THEME_SYNC)
      return
    }

    requestThemeSyncForPresentation(effectivePresentationId)
  }, [
    buildThemeSelection,
    clearThemeSyncTimeout,
    commitThemeSync,
    effectivePresentationId,
    isReady,
    requestThemeSyncForPresentation,
    templateModeOn,
    composerThemeBlocked,
  ])

  useEffect(() => clearThemeSyncTimeout, [clearThemeSyncTimeout])

  useEffect(() => {
    if (!slideComposerOverride || directorOwnedPresentation.usesOverride) return

    scTrace('builder.override.cleared_for_director_deck', {
      override_presentation_id: slideComposerOverride.presentationId,
      director_presentation_id: presentationId,
      active_version: activeVersion,
    })
    setSlideComposerOverride(null)
    clearSlideComposerWork()
  }, [
    activeVersion,
    clearSlideComposerWork,
    directorOwnedPresentation.usesOverride,
    presentationId,
    slideComposerOverride,
  ])
  const templateSavePresentationId = useMemo(() => {
    if (studioPartialMetadata || templateModeOn || activeVersion !== 'final') return null
    return finalPresentationId
      ?? effectivePresentationId
      ?? extractPresentationIdFromViewerUrl(finalPresentationUrl)
      ?? extractPresentationIdFromViewerUrl(effectivePresentationUrl)
  }, [
    activeVersion,
    effectivePresentationId,
    effectivePresentationUrl,
    finalPresentationId,
    finalPresentationUrl,
    templateModeOn,
    studioPartialMetadata,
  ])

  useEffect(() => {
    slideComposerPresentationRef.current = {
      presentationUrl: studioPartialMetadata ? effectivePresentationUrl : directorOwnedPresentation.presentationUrl,
      presentationId: effectivePresentationId,
      slideCount: effectiveSlideCount,
      activeVersion: effectiveActiveVersion,
      refreshToken: studioPartialMetadata ? 0 : directorOwnedPresentation.refreshToken,
    }
  }, [
    activeVersion,
    directorOwnedPresentation.presentationUrl,
    directorOwnedPresentation.refreshToken,
    effectivePresentationId,
    effectiveSlideCount,
    effectivePresentationUrl,
    effectiveActiveVersion,
    studioPartialMetadata,
  ])

  useEffect(() => {
    if (studioPartialMetadata || templateModeOn || !effectivePresentationId || !presentationUrl) return

    const localSlideCount = Math.max(0, effectiveSlideCount ?? 0)
    const reconcileKey = `${effectivePresentationId}:${localSlideCount}`
    if (slideComposerLayoutCountReconcileRef.current === reconcileKey) return
    slideComposerLayoutCountReconcileRef.current = reconcileKey

    let cancelled = false

    void (async () => {
      const presentation = await fetchSlideComposePresentationSnapshot(effectivePresentationId)
      if (cancelled || !presentation || presentation.slideCount <= localSlideCount) return

      const latest = slideComposerPresentationRef.current
      const nextPresentationUrl = latest.presentationUrl ?? presentationUrl
      const nextOverride = {
        presentationUrl: nextPresentationUrl,
        presentationId: effectivePresentationId,
        slideCount: presentation.slideCount,
        refreshToken: Date.now(),
      }

      scTrace('builder.layout_count_reconcile', {
        presentation_id: effectivePresentationId,
        local_slide_count: localSlideCount,
        layout_slide_count: presentation.slideCount,
      })

      slideComposerPresentationRef.current = {
        ...latest,
        ...nextOverride,
      }
      setSlideComposerOverride(nextOverride)

      if (currentSessionIdRef.current && persistenceRef.current) {
        const updates: any = {
          slideCount: presentation.slideCount,
          lastMessageAt: new Date(),
        }
        if (activeVersion === 'strawman') {
          updates.strawmanPreviewUrl = nextPresentationUrl
          updates.strawmanPresentationId = effectivePresentationId
        } else {
          updates.finalPresentationUrl = nextPresentationUrl
          updates.finalPresentationId = effectivePresentationId
        }
        persistenceRef.current.updateMetadata(updates)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    activeVersion,
    effectivePresentationId,
    effectiveSlideCount,
    fetchSlideComposePresentationSnapshot,
    presentationUrl,
    templateModeOn,
    studioPartialMetadata,
  ])

  const currentSlideLayout = useMemo<SlideLayoutType | undefined>(() => {
    if (studioPartialMetadata) return undefined
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
  }, [selectedLayoutSlideIndex, slideContextByIndex, studioPartialMetadata])


  const handleComposeApiReady = useCallback((apis: SlideComposeViewerApi | null) => {
    const isCurrentOwner = captureStudioSlideComposeOwner()
    composeViewerApiRef.current = apis
    const attempt = {}
    composeSelectionAttemptRef.current = attempt
    scTrace('builder.compose_api.ready', {
      ready: !!apis,
      queued_placeholders: pendingComposePlaceholdersRef.current.size,
    })
    if (!apis) return
    const syncTarget = studioSyncPendingRef.current
    if (studioShell && syncTarget) void restoreStudioSyncSelection(apis, syncTarget, attempt)

    const selectionRestoreTarget = pendingComposeSelectionRestoreRef.current
    if (selectionRestoreTarget !== null) {
      const selectionRestoreVisualIndex = selectionRestoreTarget.visualIndex
      const isCurrent = () => composeSelectionAttemptRef.current === attempt
        && composeViewerApiRef.current === apis && pendingComposeSelectionRestoreRef.current === selectionRestoreTarget
        && isCurrentOwner() && selectionRestoreTarget.isCurrentOwner()
      scTrace('builder.selection_restore.requested', {
        visual_index: selectionRestoreVisualIndex,
      })
      void apis.composeGoToVisualIndex(selectionRestoreVisualIndex, { isCurrent })
        .then(result => {
          if (!isCurrent()) return
          pendingComposeSelectionRestoreRef.current = null
          scTrace('builder.selection_restore.applied', {
            visual_index: selectionRestoreVisualIndex,
            result,
          })
        })
        .catch(error => {
          if (!isCurrent()) return
          console.warn('[Slide Composer] Failed to restore the selected slide after refresh.', error)
        })
    }

    const queued = Array.from(pendingComposePlaceholdersRef.current.values())
    pendingComposePlaceholdersRef.current.clear()
    queued.forEach(item => {
      const queuedJob = slideComposeJobsRef.current[item.jobId]
      if (studioShell && (!isCurrentOwner() ||
          (item.sessionId ?? queuedJob?.request.session_id) !== questionSubmissionScopeRef.current.sessionId ||
          (studioSlideComposeOwnerRef.current.presentationId &&
            (item.presentationId ?? queuedJob?.target_presentation_id) !== studioSlideComposeOwnerRef.current.presentationId))) {
        pendingComposePlaceholdersRef.current.set(item.jobId, item)
        return
      }
      if (item.kind === 'refine') {
        if (!item.slideId) {
          console.warn('[Slide Composer] Cannot flush refine overlay without a slide id.', item)
          return
        }
        void apis.refineOverlayMark(item.jobId, item.slideId).catch(error => {
          if (studioShell && !isCurrentOwner()) return
          console.warn('[Slide Composer] Failed to flush queued refine overlay.', error)
          pendingComposePlaceholdersRef.current.set(item.jobId, item)
        })
        return
      }

      if (typeof item.visualIndex !== 'number') return
      void apis.composePlaceholderAdd(item.jobId, item.visualIndex, item.replaceJobId).catch(error => {
        if (studioShell && !isCurrentOwner()) return
        console.warn('[Slide Composer] Failed to flush queued in-deck placeholder.', error)
        pendingComposePlaceholdersRef.current.set(item.jobId, item)
      })
    })
  }, [studioShell])

  // J2-F7 (flag NEXT_PUBLIC_STUDIO_GOTO_NEW_SLIDE_ENABLED): the reloaded viewer starts on slide 1 and the
  // identity restore had no context to run from (the viewer was in edit mode or unsaved when Generate
  // was clicked). Read the viewer's own slide order and go to the inserted slide through the verified
  // go-to path. A user move, a newer request, or a changed deck retires it (sameRequest).
  async function goToNewSlideAfterSync(apis: SlideComposeViewerApi, pending: StudioSyncPendingSelection, attempt: object) {
    const request = pending.request
    const intent = pending.goToNewSlide
    // The slide the request started on (armed only if the user was still on it). Any other current slide
    // is a user move, except this go-to's own target, which the viewer reports as current once it lands.
    let landing: number | null = null
    const userMoved = () => currentSlideIndexRef.current !== request.startVisualIndex && currentSlideIndexRef.current !== landing
    const sameRequest = () => studioSyncPendingRef.current === pending && pending.observedRefresh
      && studioSyncRequestRef.current === request && studioSyncSequenceRef.current === request.sequence
      && studioSyncRefreshRevisionRef.current === pending.refreshRevision && request.isOwnerCurrent()
      && composeSelectionAttemptRef.current === attempt && composeViewerApiRef.current === apis && !userMoved()
    // A user move retires the go-to for good, so a later reload cannot run it again.
    const retired = () => {
      if (sameRequest()) return false
      if (userMoved() && studioSyncPendingRef.current === pending) studioSyncPendingRef.current = null
      return true
    }
    if (!intent || retired()) return
    try {
      // A freshly loaded viewer can take a moment to answer; a few short retries, never a guess.
      let order: StudioNativeSlideOrder | null = null
      for (let tries = 0; tries < 6 && !order; tries += 1) {
        if (tries > 0) await new Promise(resolve => setTimeout(resolve, 500))
        if (retired()) return
        try { order = parseStudioNativeSlideOrder(await apis.composeGetState()) } catch { order = null }
      }
      if (retired()) return
      if (!order) {
        console.warn('[Slide Composer] The viewer did not report its slide order; choose the new slide in the rail.', intent)
        if (studioSyncPendingRef.current === pending) studioSyncPendingRef.current = null
        return
      }
      // The viewer's own count is authoritative whether or not the navigation below succeeds.
      setSlideComposerOverride(previous => sameRequest() && previous?.refreshToken === pending.refreshToken
        ? { ...previous, slideCount: order.nativeCount } : previous)
      request.persistCount(order.nativeCount)
      const target = resolveGoToNewSlideTarget(order, intent)
      if (!target) {
        console.warn('[Slide Composer] Could not find the new slide in the viewer; choose it in the rail.', intent)
        if (studioSyncPendingRef.current === pending) studioSyncPendingRef.current = null
        return
      }
      landing = target.visualIndex
      await apis.composeGoToVisualIndex(target.visualIndex, { isCurrent: sameRequest })
      if (retired()) return
      currentSlideIndexRef.current = target.visualIndex
      setCurrentSlideIndex(previous => sameRequest() ? target.visualIndex : previous)
      setSelectedLayoutSlideIndex(previous => sameRequest() ? target.visualIndex : previous)
      if (studioSyncPendingRef.current === pending) studioSyncPendingRef.current = null
      scTrace('builder.goto_new_slide.verified', { visual_index: target.visualIndex, by: target.by, native_count: order.nativeCount })
    } catch (error) {
      if (retired()) return
      if (studioSyncPendingRef.current === pending) studioSyncPendingRef.current = null
      console.warn('[Slide Composer] Could not select the new slide; choose it in the rail.', error)
    }
  }

  async function restoreStudioSyncSelection(apis: SlideComposeViewerApi, pending: StudioSyncPendingSelection, attempt: object) {
    if (STUDIO_GOTO_NEW_SLIDE_ENABLED && pending.goToNewSlide) { await goToNewSlideAfterSync(apis, pending, attempt); return }
    const request = pending.request
    const context = apis.composeCaptureSelectionContext?.()
    const sameRequest = () => studioSyncPendingRef.current === pending && pending.observedRefresh
      && studioSyncRequestRef.current === request && studioSyncSequenceRef.current === request.sequence
      && studioSyncRefreshRevisionRef.current === pending.refreshRevision && request.isOwnerCurrent()
      && composeSelectionAttemptRef.current === attempt && composeViewerApiRef.current === apis
    const priorContext = request.context
    const priorOrder = request.priorOrder
    const isCurrent = () => !!context && sameRequest() && context.isCurrent()
      && context.presentationUrl === pending.expectedUrl
      && (!pending.restoreSelection || (!!priorContext && !!priorOrder
        && context.continuationKey === priorContext.continuationKey
        && context.loadRevision === priorContext.loadRevision + 1))
    if (!isCurrent() || !context) {
      if (studioSyncPendingRef.current === pending && pending.observedRefresh) studioSyncPendingRef.current = null
      return
    }
    const state = (): StudioComposeRestoreState => ({ owner: request.owner, active: isCurrent(),
      latestRequestSequence: studioSyncSequenceRef.current, reloadRevision: studioSyncRefreshRevisionRef.current,
      interactionRevision: context.interactionRevision, structureRevision: context.structureRevision,
      frameEpoch: context.frameEpoch, templateMode: false, dirty: false, saving: false, structuralWork: false })
    const read = async () => {
      const captured = { ownerToken: request.owner.token, presentationId: request.owner.presentationId,
        frameEpoch: context.frameEpoch, structureRevision: context.structureRevision }
      if (!isCurrent()) throw new Error('Slide selection request retired')
      const receipt = await context.readNativeOrder()
      if (!isCurrent()) throw new Error('Slide selection request retired')
      return { ...captured, receipt }
    }
    const proveInsertion = (order: StudioNativeSlideOrder) => {
      if (!priorOrder) throw new Error('Prior native identity is unavailable')
      const oldIds = priorOrder.slideIds
      const newIds = order.slideIds.filter(id => !oldIds.includes(id))
      if (order.nativeCount !== priorOrder.nativeCount + 1 || newIds.length !== 1
        || order.slideIds.filter(id => oldIds.includes(id)).some((id, index) => id !== oldIds[index])) {
        throw new Error('Native order does not prove a single owned insertion')
      }
      return newIds[0]
    }
    try {
      const native = await read()
      const order = parseStudioNativeSlideOrder(native.receipt)
      if (!order) throw new Error('Native order is unavailable')
      let verified: { slideId: string; visualIndex: number; nativeCount: number; verified: true } | null = null
      let selectedGeneratedResult = false
      if (pending.restoreSelection && priorOrder) {
        const newId = proveInsertion(order)
        const primary = pending.target && pending.target.slideId === newId
          ? resolveStudioComposeRestore(pending.target, state(), native) : null
        const restorePrevious = async () => {
          const fresh = parseStudioNativeSlideOrder((await read()).receipt)
          if (!fresh) throw new Error('Native order is unavailable')
          proveInsertion(fresh)
          const previousId = priorOrder.slideIds[priorOrder.currentVisualIndex]
          const restored = await context.restoreIdentity({ slideId: previousId,
            expectedNativeCount: fresh.nativeCount, isCurrent })
          const final = parseStudioNativeSlideOrder((await read()).receipt)
          if (!final || final.nativeCount !== restored.nativeCount
            || final.currentVisualIndex !== restored.visualIndex
            || final.slideIds[restored.visualIndex] !== previousId) throw new Error('Prior native selection was not verified')
          proveInsertion(final)
          return restored
        }
        if (primary?.kind === 'ready') {
          try {
            verified = await context.restoreIdentity({ slideId: primary.lease.slideId,
              expectedNativeCount: primary.lease.nativeCount, isCurrent })
            const final = await read()
            if (verified.slideId !== primary.lease.slideId || verified.nativeCount !== primary.lease.nativeCount
              || verified.visualIndex !== primary.lease.visualIndex
              || !verifyStudioComposeRestoreSelection(primary.lease, pending.target, state(), final)) {
              throw new Error('Native selection did not match the current request')
            }
            selectedGeneratedResult = true
          } catch (error) {
            if (!isCurrent()) throw error
            verified = await restorePrevious()
          }
        } else verified = await restorePrevious()
      }
      if (!isCurrent()) return
      const commitIsCurrent = () => studioSyncRequestRef.current === request
        && studioSyncSequenceRef.current === request.sequence && request.isOwnerCurrent()
        && context.isCurrent() && context.presentationUrl === pending.expectedUrl
        && studioSyncRefreshRevisionRef.current === pending.refreshRevision
      const nativeCount = verified?.nativeCount ?? order.nativeCount
      if (verified) {
        const visualIndex = verified.visualIndex
        currentSlideIndexRef.current = visualIndex
        setCurrentSlideIndex(previous => commitIsCurrent() ? visualIndex : previous)
        setSelectedLayoutSlideIndex(previous => commitIsCurrent() ? visualIndex : previous)
      }
      setSlideComposerOverride(previous => commitIsCurrent() && previous?.refreshToken === pending.refreshToken
        ? { ...previous, slideCount: nativeCount } : previous)
      request.persistCount(nativeCount)
      if (studioSyncPendingRef.current === pending) studioSyncPendingRef.current = null
      scTrace('builder.sync_selection.verified', { visual_index: verified?.visualIndex ?? null,
        native_count: nativeCount, selected_generated_result: selectedGeneratedResult })
    } catch (error) {
      if (!isCurrent()) return
      // An old failure never replaces a newer target or requeues a numeric index.
      if (studioSyncPendingRef.current === pending) studioSyncPendingRef.current = null
      console.warn('[Slide Composer] Native selection could not be verified; choose the slide in the rail.', error)
    }
  }

  const handleSlideComposerAccepted = useCallback((job: SlideComposeAcceptedJob) => {
    const isCurrentSession = captureStudioSlideComposeSessionOwner()
    if (studioShell && (!isCurrentSession() || job.request.session_id !== questionSubmissionScopeRef.current.sessionId)) return
    const isCurrentOwner = captureStudioSlideComposeOwner()
    const targetPresentationId = (typeof job.request.presentation_id === 'string' ? job.request.presentation_id : null)
      ?? (studioShell ? job.presentation_id ?? null : slideComposerPresentationRef.current.presentationId)
    const canApplyToViewer = !studioShell || (isCurrentOwner() && (!studioSlideComposeOwnerRef.current.presentationId || targetPresentationId === studioSlideComposeOwnerRef.current.presentationId))
    const targetJobs = studioShell
      ? Object.fromEntries(Object.entries(slideComposeJobsRef.current).filter(([, item]) => item.target_presentation_id === targetPresentationId))
      : slideComposeJobsRef.current
    const jobKind: SlideComposeJobKind = job.kind ?? 'compose'
    const targetLayoutIndex = Math.max(0, job.target_index)
    const targetVisualIndex = jobKind === 'refine'
      ? targetLayoutIndex
      : getComposeVisualIndexForTarget(job.target_index, targetJobs)
    const activeComposeJobs = Object.values(targetJobs)
      .filter(item => item.status === 'building' && (item.kind ?? 'compose') === 'compose').length
    const sourceSlideCount = studioShell && !canApplyToViewer
      ? (targetPresentationId ? studioSlideComposeCountsRef.current[targetPresentationId] : null) ?? targetLayoutIndex
      : slideComposerPresentationRef.current.slideCount ?? 0
    const expectedSlideCount = sourceSlideCount +
      (jobKind === 'compose' ? activeComposeJobs + 1 : 0)
    const requestedSlideId = typeof job.request.slide_id === 'string' ? job.request.slide_id : null
    const targetSlideId = jobKind === 'refine'
      ? (job.target_slide_id ?? requestedSlideId ?? null)
      : null
    scTrace('builder.accepted', {
      job_id: job.job_id,
      kind: jobKind,
      director_target_index: job.target_index,
      target_slide_id: targetSlideId,
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
    if (canApplyToViewer) setSlideComposePanelEvent({
      jobId: job.job_id,
      status: 'building',
    })
    setSlideComposeJobs(prev => ({
      ...prev,
      [job.job_id]: {
        job_id: job.job_id,
        kind: jobKind,
        target_visual_index: targetVisualIndex,
        target_layout_index: targetLayoutIndex,
        target_slide_id: targetSlideId,
        status: 'building',
        title: job.title,
        request: job.request,
        target_presentation_id:
          (typeof job.request.presentation_id === 'string' ? job.request.presentation_id : null)
          ?? (studioShell ? job.presentation_id ?? null : slideComposerPresentationRef.current.presentationId),
        expected_slide_count: expectedSlideCount,
      },
    }))
    const composeApi = composeViewerApiRef.current

    if (canApplyToViewer && jobKind === 'refine') {
      const overlayMark = { jobId: job.job_id, kind: 'refine' as const, slideId: targetSlideId,
        ...(studioShell ? { presentationId: targetPresentationId, sessionId: job.request.session_id as string } : {}) }
      if (composeApi && targetSlideId) {
        void composeApi.refineOverlayMark(job.job_id, targetSlideId).catch(error => {
          if (studioShell && !isCurrentOwner()) return
          scTrace('builder.refine_overlay_mark.error', {
            job_id: job.job_id,
            target_slide_id: targetSlideId,
            message: error instanceof Error ? error.message : String(error),
          })
          console.warn('[Slide Composer] Failed to mark refine overlay.', error)
          pendingComposePlaceholdersRef.current.set(job.job_id, overlayMark)
        })
      } else if (targetSlideId) {
        pendingComposePlaceholdersRef.current.set(job.job_id, overlayMark)
      } else {
        console.warn('[Slide Composer] Refine job accepted without a slide id; overlay mark skipped.', {
          job_id: job.job_id,
          target_index: job.target_index,
        })
      }
    } else if (canApplyToViewer) {
      const placeholderAdd = { jobId: job.job_id, visualIndex: targetVisualIndex,
        ...(studioShell ? { presentationId: targetPresentationId, sessionId: job.request.session_id as string } : {}) }
      if (composeApi) {
        void composeApi.composePlaceholderAdd(job.job_id, targetVisualIndex).catch(error => {
          if (studioShell && !isCurrentOwner()) return
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
    }
    // TODO: replace this timer with a backend heartbeat; for now it must exceed
    // Director's 300s same-target FIFO wait plus a long Slide Builder pass.
    if (studioShell) startStudioSlideComposeWatchdog(job.job_id, `${jobKind} job ${job.job_id} exceeded watchdog`, undefined, targetPresentationId)
    else slideComposeWatchdogsRef.current[job.job_id] = setTimeout(() => {
      if (slideComposeJobsRef.current[job.job_id]?.status === 'building') {
        triggerCoalescedSlideComposeReload(`${jobKind} job ${job.job_id} exceeded watchdog`)
        void confirmSlideComposeJobAfterRefresh(job.job_id)
      }
    }, SLIDE_COMPOSE_WATCHDOG_MS)
    if (canApplyToViewer) startSlideComposePoller(job.job_id)
    if (canApplyToViewer) toast({
      title: jobKind === 'refine' ? 'Slide refinement queued' : 'Slide queued',
      description: jobKind === 'refine'
        ? `Refining slide ${targetLayoutIndex + 1} in the background.`
        : `Building slide ${targetVisualIndex + 1} in the background.`,
    })
  }, [
    clearSlideComposeWatchdog,
    confirmSlideComposeJobAfterRefresh,
    startSlideComposePoller,
    startStudioSlideComposeWatchdog,
    studioShell,
    toast,
    triggerCoalescedSlideComposeReload,
  ])

  const handleRetrySlideCompose = useCallback(async (jobId: string) => {
    const existing = slideComposeJobs[jobId]
    if (!existing) return
    const isCurrentSession = captureStudioSlideComposeSessionOwner()
    if (studioShell && (!isCurrentSession() || existing.request.session_id !== questionSubmissionScopeRef.current.sessionId)) return
    const isCurrentOwner = captureStudioSlideComposeOwner()
    const canApplyToViewer = () => !studioShell || (isCurrentOwner() && (!studioSlideComposeOwnerRef.current.presentationId || existing.target_presentation_id === studioSlideComposeOwnerRef.current.presentationId))

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
    if (studioShell) startStudioSlideComposeWatchdog(nextJobId, `compose retry ${nextJobId} exceeded watchdog`, undefined, existing.target_presentation_id ?? null)
    else slideComposeWatchdogsRef.current[nextJobId] = setTimeout(() => {
      if (slideComposeJobsRef.current[nextJobId]?.status === 'building') {
        triggerCoalescedSlideComposeReload(`compose retry ${nextJobId} exceeded watchdog`)
        void confirmSlideComposeJobAfterRefresh(nextJobId)
      }
    }, SLIDE_COMPOSE_WATCHDOG_MS)
    if (canApplyToViewer()) startSlideComposePoller(nextJobId)

    try {
      const response = await fetch('/api/slides/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryRequest),
      })
      if (!isCurrentSession()) return
      const data = await response.json().catch(() => null) as {
        status?: string
        job_id?: string
        target_index?: number
        error?: string
        errors?: string[]
      } | null
      if (!isCurrentSession()) return

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
            expected_slide_count: studioShell && !canApplyToViewer()
              ? current.expected_slide_count
              : (slideComposerPresentationRef.current.slideCount ?? 0) +
                Object.values(slideComposeJobsRef.current).filter(item => item.status === 'building' &&
                  (!studioShell || item.target_presentation_id === existing.target_presentation_id)).length,
          },
        }
      })
      if (!canApplyToViewer()) return
      const placeholderAdd = {
        jobId: nextJobId,
        visualIndex: existing.target_visual_index,
        replaceJobId: jobId,
        ...(studioShell ? { presentationId: existing.target_presentation_id, sessionId: existing.request.session_id as string } : {}),
      }
      const composeApi = composeViewerApiRef.current
      if (composeApi) {
        void composeApi
          .composePlaceholderAdd(nextJobId, existing.target_visual_index, jobId)
          .catch(error => {
            if (!canApplyToViewer()) return
            console.warn('[Slide Composer] Failed to reset in-deck placeholder for retry.', error)
            pendingComposePlaceholdersRef.current.set(nextJobId, placeholderAdd)
          })
      } else {
        pendingComposePlaceholdersRef.current.set(nextJobId, placeholderAdd)
      }
    } catch (err) {
      if (!isCurrentSession()) return
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
      if (canApplyToViewer()) toast({
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
    startStudioSlideComposeWatchdog,
    studioShell,
    toast,
    triggerCoalescedSlideComposeReload,
  ])

  const handleSelectPendingSlideCompose = useCallback((jobId: string) => {
    void composeViewerApiRef.current?.composeGoToPlaceholder(jobId).catch(error => {
      console.warn('[Slide Composer] Failed to navigate to pending placeholder.', error)
    })
  }, [])

  const handleOpenSlideRefine = useCallback((target: SlideRefineTarget) => {
    setSlideGenerationMode('refine')
    setSlideRefineTarget(target)
    setSelectedLayoutSlideIndex(Math.max(0, target.slide_index))
    setShowFormatPanel(true)
    bringToFront('slide')
  }, [bringToFront])

  const handleOpenSlideCompose = useCallback(() => {
    setSlideGenerationMode('compose')
    setSlideRefineTarget(null)
    setShowFormatPanel(true)
    bringToFront('slide')
  }, [bringToFront])

  const slideComposeThumbnailJobs = useMemo<SlideComposeThumbnailJob[]>(
    () => Object.values(slideComposeJobs)
      .filter(job => job.status === 'building' || job.status === 'error')
      .map(job => ({
        jobId: job.job_id,
        targetIndex: job.target_layout_index,
        targetLayoutIndex: job.target_layout_index,
        kind: job.kind ?? 'compose',
        targetSlideId: job.target_slide_id ?? null,
        status: job.status,
        title: job.title,
        lastProgressText: job.lastProgressText,
        errors: job.errors,
        onRetry: handleRetrySlideCompose,
        onSelect: handleSelectPendingSlideCompose,
      })),
    [handleRetrySlideCompose, handleSelectPendingSlideCompose, slideComposeJobs],
  )

  // Retire pending answers as soon as navigation/account intent changes; an
  // eventual transport completion must not echo into the newly displayed chat.
  const [studioComposeMountGeneration, setStudioComposeMountGeneration] = useState(0)
  const questionSubmissionScopeRef = useRef({
    active: true,
    generation: 0,
    sessionId: (currentSessionId || wsSessionId) as string | null,
    userId: authScopeUserId,
    routeSessionId: searchParams.get('session_id'),
    freshRouteSourceSessionId: null as string | null,
  })
  const questionRouteSessionId = searchParams.get('session_id')
  if (questionSubmissionScopeRef.current.routeSessionId !== questionRouteSessionId) {
    // A new/bare route may render while the loader still holds the old deck.
    // Retire that deck's answers without assigning any native session/cache ID.
    questionSubmissionScopeRef.current.freshRouteSourceSessionId =
      !questionRouteSessionId || questionRouteSessionId === 'new'
        ? currentSessionId || wsSessionId : null
    questionSubmissionScopeRef.current.routeSessionId = questionRouteSessionId
  }
  const questionScopeSessionId = questionRouteSessionId && questionRouteSessionId !== 'new'
    ? questionRouteSessionId
    : questionSubmissionScopeRef.current.freshRouteSourceSessionId === (currentSessionId || wsSessionId)
      ? null : currentSessionId || wsSessionId
  if (questionSubmissionScopeRef.current.sessionId !== questionScopeSessionId ||
      questionSubmissionScopeRef.current.userId !== authScopeUserId) {
    questionSubmissionScopeRef.current.generation += 1
    questionSubmissionScopeRef.current.sessionId = questionScopeSessionId
    questionSubmissionScopeRef.current.userId = authScopeUserId
  }
  React.useLayoutEffect(() => {
    questionSubmissionScopeRef.current.active = true
    // Refresh render-captured callbacks after Strict Mode retires the first setup.
    if (studioShell) setStudioComposeMountGeneration(questionSubmissionScopeRef.current.generation)
    return () => {
      questionSubmissionScopeRef.current.active = false
      questionSubmissionScopeRef.current.generation += 1
    }
  }, [])

  function captureStudioSlideComposeOwner() {
    const presentationOwner = studioSlideComposeOwnerRef.current
    const chatOwner = { ...questionSubmissionScopeRef.current }
    return () => !studioShell || (
      questionSubmissionScopeRef.current.active &&
      questionSubmissionScopeRef.current.generation === chatOwner.generation &&
      questionSubmissionScopeRef.current.sessionId === chatOwner.sessionId &&
      questionSubmissionScopeRef.current.userId === chatOwner.userId &&
      studioSlideComposeOwnerRef.current === presentationOwner &&
      chatOwner.sessionId === presentationOwner.sessionId
    )
  }

  function captureStudioSlideComposeSessionOwner() {
    const chatOwner = { ...questionSubmissionScopeRef.current }
    return () => !studioShell || (
      questionSubmissionScopeRef.current.active &&
      questionSubmissionScopeRef.current.generation === chatOwner.generation &&
      questionSubmissionScopeRef.current.sessionId === chatOwner.sessionId &&
      questionSubmissionScopeRef.current.userId === chatOwner.userId
    )
  }

  // Capture before the child submits; sampling on result delivery would adopt
  // an old synchronous result into the newly displayed session/version.
  const isCurrentSlideBuiltOwner = useMemo(
    () => studioShell ? captureStudioSlideComposeOwner() : () => true,
    [studioShell, studioSlideComposeOwnerRef.current, studioComposeMountGeneration, questionSubmissionScopeRef.current.generation],
  )

  const syncPending = studioSyncPendingRef.current
  if (syncPending) {
    if (!syncPending.request.isOwnerCurrent()) studioSyncPendingRef.current = null
    else if (directorOwnedPresentation.refreshToken === syncPending.refreshToken
      && effectivePresentationUrl === syncPending.expectedUrl) syncPending.observedRefresh = true
    else if (syncPending.observedRefresh) studioSyncPendingRef.current = null
  }

  const handleStudioSyncSelectionRequestStart = useCallback(async (lane: 'compose' | 'refine' = 'compose'): Promise<object | null> => {
    if (!studioShell) return null
    if (!isCurrentSlideBuiltOwner()) throw new Error('Slide request owner retired')
    const sequence = ++studioSyncSequenceRef.current
    studioSyncPendingRef.current = null
    studioSyncRequestRef.current = null
    const ownerToken = studioSlideComposeOwnerRef.current
    const chatOwner = { ...questionSubmissionScopeRef.current }
    const isOwnerCurrent = captureStudioSlideComposeOwner()
    const context = composeViewerApiRef.current?.composeCaptureSelectionContext?.()
    const version = ownerToken.activeVersion
    // Every admitted request has a private lifetime, even when native identity
    // is unavailable. Its late response cannot adopt a newer request's viewer.
    const record: StudioSyncSelectionRecord = {
      sequence, lane,
      owner: { token: ownerToken, userId: chatOwner.userId ?? '', sessionId: chatOwner.sessionId ?? '',
        presentationId: ownerToken.presentationId ?? '', activeVersion: version ?? '', mountGeneration: chatOwner.generation },
      isOwnerCurrent, context: null, priorOrder: null, consumed: false,
      persistCount: count => { if (isOwnerCurrent()) persistence?.updateMetadata({ slideCount: count, lastMessageAt: new Date() }) },
      ...(STUDIO_GOTO_NEW_SLIDE_ENABLED ? { startVisualIndex: currentSlideIndexRef.current } : {}),
    }
    const proof = Object.freeze({})
    studioSyncProofsRef.current.set(proof, record)
    studioSyncRequestRef.current = record
    if (lane === 'refine') return proof
    if (!context || !ownerToken.presentationId || !chatOwner.sessionId || !chatOwner.userId
      || !['blank', 'strawman', 'final'].includes(version ?? '')
      || extractPresentationIdFromViewerUrl(context.presentationUrl) !== ownerToken.presentationId) return proof
    try {
      const priorOrder = parseStudioNativeSlideOrder(await context.readNativeOrder())
      if (!isOwnerCurrent() || sequence !== studioSyncSequenceRef.current) throw new Error('Slide request owner retired')
      if (priorOrder && context.isCurrent()) { record.context = context; record.priorOrder = priorOrder }
      return proof
    } catch (error) {
      if (!isOwnerCurrent() || sequence !== studioSyncSequenceRef.current) throw new Error('Slide request owner retired')
      // Unavailable native identity must not disable otherwise supported generation.
      return proof
    }
  }, [studioShell, isCurrentSlideBuiltOwner, persistence])

  const handleSlideComposerBuilt = useCallback((result: SlideComposeBuiltResult, selection?: StudioSlideBuiltSelection) => {
    if (studioShell && !isCurrentSlideBuiltOwner()) return
    const nextSlideIndex = Math.max(0, result.slide_index)
    const targetPresentationId = result.presentation_id
    if (!isPresentationCallbackCurrent({
      callbackPresentationId: targetPresentationId,
      livePresentationId: presentationId,
    })) {
      scTrace('builder.http.slide_built.ignored_stale', {
        callback_presentation_id: targetPresentationId,
        live_presentation_id: presentationId,
      })
      return
    }
    const targetPresentationUrl = result.presentation_url ?? slideComposerOverride?.presentationUrl ?? presentationUrl
    const existingDeck = !!effectivePresentationId && targetPresentationId === effectivePresentationId
    const baseSlideCount = effectiveSlideCount ?? 0
    const nextSlideCount = studioShell && existingDeck ? baseSlideCount : Math.max(
      existingDeck ? baseSlideCount + 1 : (result.slides_built ?? 1),
      nextSlideIndex + 1,
    )
    const record = studioShell && selection?.proof ? studioSyncProofsRef.current.get(selection.proof) : null
    // Studio callbacks with a private envelope require an issued lifetime.
    // Current refine also receives one; an unknown/null late ingress cannot
    // clear the newer compose receipt merely because its session still matches.
    if (studioShell && selection && !record) return
    if (record && (record.consumed || record !== studioSyncRequestRef.current
      || record.sequence !== studioSyncSequenceRef.current || !record.isOwnerCurrent())) return
    if (record) record.consumed = true
    const refreshRevision = ++studioSyncRefreshRevisionRef.current
    const refreshToken = Math.max(Date.now(), slideComposerPresentationRef.current.refreshToken + 1,
      studioSyncRefreshTokenRef.current + 1, refreshRevision)
    studioSyncRefreshTokenRef.current = refreshToken
    const expectedUrl = withSlideComposerRefreshToken(targetPresentationUrl ?? null, refreshToken)
    studioSyncPendingRef.current = null
    if (studioShell && record && existingDeck && expectedUrl) {
      const restoreSelection = Boolean(record.lane !== 'refine' && selection?.draftStillCurrent && record.context?.isCurrent() && record.priorOrder)
      const target = restoreSelection && record.context ? createStudioComposeRestoreTarget({ owner: record.owner,
        requestSequence: record.sequence, reloadRevision: refreshRevision,
        interactionRevision: record.context.interactionRevision,
        structureRevision: record.context.structureRevision, result }) : null
      // Count-only receipts do not navigate. Missing/unsafe generation identity
      // may preserve the captured prior real slide, never a positional guess.
      studioSyncPendingRef.current = { request: record, restoreSelection,
        target: target && !record.priorOrder?.slideIds.includes(target.slideId) ? target : null,
        ...(STUDIO_GOTO_NEW_SLIDE_ENABLED && shouldArmGoToNewSlide({
          enabled: true, lane: record.lane, existingDeck, restoreSelection,
          draftStillCurrent: Boolean(selection?.draftStillCurrent),
          startVisualIndex: record.startVisualIndex, currentVisualIndex: currentSlideIndexRef.current,
        }) ? { goToNewSlide: goToNewSlideIntent(result) } : {}),
        refreshRevision, refreshToken, expectedUrl, observedRefresh: false }
    }

    setSlideComposerOverride({
      presentationUrl: targetPresentationUrl ?? null,
      presentationId: targetPresentationId,
      slideCount: nextSlideCount,
      refreshToken,
    })
    if (!studioShell || !existingDeck) {
      currentSlideIndexRef.current = nextSlideIndex
      setCurrentSlideIndex(nextSlideIndex)
      setSelectedLayoutSlideIndex(nextSlideIndex)
    }

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
    studioShell,
    isCurrentSlideBuiltOwner,
    activeVersion,
    effectivePresentationId,
    effectiveSlideCount,
    persistence,
    presentationId,
    presentationUrl,
    slideComposerOverride?.presentationUrl,
    toast,
  ])


  React.useEffect(() => {
    if (!studioShell) return
    const owner = studioSlideComposeOwnerRef.current
    const retireTimers = () => {
      for (const [jobId, pollerOwner] of Object.entries(studioSlideComposePollerOwnersRef.current)) {
        if (pollerOwner === owner) clearSlideComposePoller(jobId)
      }
      for (const [jobId, watchdog] of Object.entries(studioSlideComposeWatchdogsRef.current)) {
        if (watchdog.owner !== owner) continue
        const timer = slideComposeWatchdogsRef.current[jobId]
        if (timer) clearTimeout(timer)
        delete slideComposeWatchdogsRef.current[jobId]
      }
    }
    if (!captureStudioSlideComposeOwner()()) return retireTimers
    for (const job of Object.values(slideComposeJobsRef.current)) {
      if (job.status !== 'building' || !owner.presentationId ||
          job.target_presentation_id !== owner.presentationId ||
          job.request.session_id !== owner.sessionId) continue
      // Returning to the verified original version starts fresh recovery for
      // the retained job. Its old continuations remain permanently retired.
      startSlideComposePoller(job.job_id)
      const watchdog = studioSlideComposeWatchdogsRef.current[job.job_id]
      if (watchdog && !watchdog.fired) {
        startStudioSlideComposeWatchdog(job.job_id, watchdog.reason, watchdog.deadline)
      }
    }
    return retireTimers
  }, [studioShell, studioSlideComposeOwnerRef.current, clearSlideComposePoller, startSlideComposePoller, startStudioSlideComposeWatchdog])

  const actionSubmissionPendingRef = useRef(new Set<string>())
  const studioManualHandoffRequestRef = useRef<{
    generation: number
    sessionId: string | null
    userId: string | null
  } | null>(null)
  React.useLayoutEffect(() => {
    if (!studioShell) return
    const request = studioManualHandoffRequestRef.current
    const scope = questionSubmissionScopeRef.current
    if (request && (request.generation !== scope.generation ||
        request.sessionId !== scope.sessionId || request.userId !== scope.userId)) {
      studioManualHandoffRequestRef.current = null
      setManualDeckHandoffBusy(false)
    }
  }, [studioShell, questionSubmissionScopeRef.current.generation])

  // DB restore retires transport request owners. Re-prime only the still-owned
  // durable key after that real restore, before the session hook connects. This
  // observes a request; it sends/replays nothing and never runs on every render.
  const studioHandoffRestoreOwner = useMemo(() => ({ ...questionSubmissionScopeRef.current }),
    [studioShell, questionSubmissionScopeRef.current.generation])
  const restoreBuilderSessionMessages = useCallback((
    historicalMessages: Parameters<typeof restoreMessages>[0],
    restoredSessionState?: Parameters<typeof restoreMessages>[1],
    studioTranscriptRestoredIds?: Parameters<typeof restoreMessages>[2],
  ) => {
    const owner = studioHandoffRestoreOwner
    const isCurrentRestore = () => {
      const current = questionSubmissionScopeRef.current
      return current.active && current.generation === owner.generation
        && current.sessionId === owner.sessionId && current.userId === owner.userId
        && current.userId === authScopeUserId && currentSessionIdRef.current === owner.sessionId
    }
    if (studioShell && !isCurrentRestore()) return
    retireStudioVoiceOwner()
    if (STUDIO_VOICE_INTERACTIVE_ENABLED) {
      restoreMessages(historicalMessages, restoredSessionState,
        [...(studioTranscriptRestoredIds || []), ...session.userMessageIdsRef.current])
    } else restoreMessages(historicalMessages, restoredSessionState)
    if (!studioShell || !isCurrentRestore() || !owner.sessionId
      || restoredSessionState?.deckOwnerSessionId !== owner.sessionId) return
    const currentExpected = getExpectedStudioHandoffRequest(readCurrentStudioHandoff(owner.sessionId), {
      userId: owner.userId, sessionId: owner.sessionId,
    })
    const expected = expectedStudioHandoffRequestRef.current
    if (!currentExpected || !expected
      || currentExpected.sessionId !== expected.sessionId
      || currentExpected.userId !== expected.userId
      || currentExpected.idempotencyKey !== expected.idempotencyKey) return
    trackHandoffRequest(currentExpected)
  }, [studioShell, studioHandoffRestoreOwner, authScopeUserId, restoreMessages,
    readCurrentStudioHandoff, trackHandoffRequest, retireStudioVoiceOwner])

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
    reconnectStatus,
    ensureConnected,
    disconnect,
    clearMessages,
    restoreMessages: restoreBuilderSessionMessages,
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
  const [dismissedWorkflowKey, setDismissedWorkflowKey] = useState<string | null>(null)
  const workflowKey = searchParams.toString()
  const workflowAction = studioShell ? parseStudioWorkflowAction(searchParams.get('studio_action')) : null
  const savedThemeWorkflowId = workflowAction === 'theme' ? searchParams.get('studio_item') : null
  const [workflowBrief, setWorkflowBrief] = useState<string | null>(null)
  const briefLoadedRef = useRef(false)
  useEffect(() => {
    if (workflowAction !== 'brief' || session.isLoadingSession || briefLoadedRef.current) return
    briefLoadedRef.current = true
    try {
      const text = parseStudioWorkflowDraft(window.sessionStorage.getItem(draftKey(authScopeUserId)))
      if (text) setWorkflowBrief(text)
    } catch { /* A blocked local store must not prevent normal Studio use. */ }
  }, [workflowAction, session.isLoadingSession, authScopeUserId])
  const resolveWorkflowBrief = (useBrief: boolean) => {
    if (useBrief && workflowBrief) {
      setInputMessage(workflowBrief)
      setShowChat(true)
      selectWorkspacePane('chat')
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
    try { window.sessionStorage.removeItem(draftKey(authScopeUserId)) } catch { /* Optional local handoff. */ }
    setWorkflowBrief(null)
  }
  useEffect(() => {
    if (!savedThemeWorkflowId) return
    setShowChat(true)
    selectWorkspacePane('chat')
  }, [savedThemeWorkflowId])
  const viewerWorkflowRequest = workflowAction && workflowAction !== 'brief' && !savedThemeWorkflowId
    ? { action: workflowAction, key: searchParams.toString(), itemId: searchParams.get('studio_item') } : null
  const viewerWorkflowKey = viewerWorkflowRequest?.key
  useEffect(() => {
    // A new navigation request opens its original viewer workflow on the visible Stage.
    if (studioShell && viewerWorkflowKey) setStudioStageSelected(true)
  }, [studioShell, viewerWorkflowKey])

  useEffect(() => {
    if (!composerLibraryEnabled || session.isLoadingSession || !currentSessionId || currentSessionId === 'new' || !user) return
    const key = `${COMPOSER_READY_KEY_PREFIX}${currentSessionId}`
    try {
      const staged = JSON.parse(sessionStorage.getItem(key) || 'null') as { user_id: string; result: ComposerReady } | null
      if (!staged || staged.user_id !== (user.id || user.email) || staged.result?.session_id !== currentSessionId) return
      if (applyTemplateIngestReady(staged.result, currentSessionId)) {
        sessionStorage.removeItem(key)
      } else {
        toast({ title: 'Could not open template deck', description: 'The deck did not pass the viewer or session checks.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Could not open template deck', description: 'The saved template result could not be read.', variant: 'destructive' })
    }
  }, [composerLibraryEnabled, currentSessionId, session.isLoadingSession, user, applyTemplateIngestReady, toast])

  const textLabsSession = useTextLabsSession(effectivePresentationId)
  const buildRefineContext = useElementRefinement({
    slideContextByIndex: studioPartialMetadata ? null : slideContextByIndex,
    deckContext: studioPartialMetadata ? null : deckContext as Record<string, unknown> | null | undefined,
    sessionStoreName,
    sessionId: currentSessionId || wsSessionId || null,
    currentSlideIndex,
  })

  const generationElementContext = useMemo(() => {
    const target = generationPanel.refineContext
    if (!studioShell || generationPanel.mode !== 'refine'
      || (generationPanel.elementType !== 'METRICS' && generationPanel.elementType !== 'TABLE' && generationPanel.elementType !== 'IMAGE' && generationPanel.elementType !== 'CHART' && generationPanel.elementType !== 'TEXT_BOX')
      || !target?.gridPosition) return blankElements.activePosition

    const position = target.gridPosition
    return {
      elementId: target.elementId,
      startCol: position.start_col,
      startRow: position.start_row,
      width: position.position_width,
      height: position.position_height,
    }
  }, [studioShell, generationPanel.mode, generationPanel.elementType, generationPanel.refineContext, blankElements.activePosition])

  // Track active blank element for real-time canvas<->modal position sync
  const trackElementRef = useRef(blankElements.trackElement)
  trackElementRef.current = blankElements.trackElement
  useEffect(() => {
    trackElementRef.current(generationPanel.blankElementId)
  }, [generationPanel.blankElementId])

  const activateElementPanel = useCallback(() => {
    // Focus first: when Element and Deck are both open, equal z-indices make
    // the later-rendered Deck drawer intercept the Chart controls.
    bringToFront('element')
    setShowElementPanel(false)
    setShowTextBoxPanel(false)
    setShowFormatPanel(false)
  }, [bringToFront])

  // Text Labs generation hook
  const { handleGenerate: handleTextLabsGenerate, handleOpenPanel: handleOpenGenerationPanel } = useTextLabsGeneration({
    generationPanel,
    blankElements,
    textLabsSession,
    layoutServiceApis,
    presentationId: effectivePresentationId,
    currentSlideIndex,
    getCurrentSlideIndex,
    deckContext: studioPartialMetadata ? null : deckContext as Record<string, unknown> | null | undefined,
    researchSessionId: currentSessionId || wsSessionId || null,
    researchStoreName: sessionStoreName,
    researchUserId: user?.id ?? null,
    researchCapabilities: elementResearchCapabilities,
    getThemeSyncSnapshot,
    ensureThemeReady,
    toast,
  })

  const studioFormatBusy = templateModeOn || generationPanel.isOpen || generationPanel.isGenerating
    || isGeneratingFinal || isGeneratingStrawman || templateBlueprintSaving || templateReuseAwaitingInput
    || (buildNarration.active && !['idle', 'complete'].includes(buildNarration.phase))
    || Object.values(slideComposeJobs).some(job => job.status === 'building')
    || !studioViewerSafety?.ready || Boolean(studioViewerSafety?.busy || studioViewerSafety?.error)
  const studioFormatScopeRef = useRef({ userId: user?.id, sessionId: currentSessionId,
    presentationId: effectivePresentationId, deckOwnerSessionId, activeVersion, busy: studioFormatBusy,
    slideIndex: currentSlideIndex, templateModeOn })
  const oldFormatScope = studioFormatScopeRef.current
  if (oldFormatScope.userId !== user?.id || oldFormatScope.sessionId !== currentSessionId
    || oldFormatScope.presentationId !== effectivePresentationId || oldFormatScope.deckOwnerSessionId !== deckOwnerSessionId
    || oldFormatScope.activeVersion !== activeVersion || oldFormatScope.busy !== studioFormatBusy
    || oldFormatScope.slideIndex !== currentSlideIndex || oldFormatScope.templateModeOn !== templateModeOn) {
    studioFormatScopeRef.current = { userId: user?.id, sessionId: currentSessionId,
      presentationId: effectivePresentationId, deckOwnerSessionId, activeVersion, busy: studioFormatBusy,
      slideIndex: currentSlideIndex, templateModeOn }
  }
  const closeStudioFormat = useCallback(() => {
    studioFormatRequestRef.current = null
    setStudioFormatOpen(false); setStudioFormatTarget(null); setStudioFormatLoading(false); setStudioFormatError(null)
  }, [])
  // J2 v2: opening the Add Slide panel makes the other Element panels step aside (as activateElementPanel does),
  // and any of them opening closes it, so the drawer shows one panel.
  const handleAddSlideV2PanelOpenChange = useCallback((open: boolean) => {
    if (!open) { setAddSlideV2Open(false); return }
    generationPanel.closePanel()
    setShowTextBoxPanel(false)
    setShowElementPanel(false)
    closeStudioFormat()
    bringToFront('element')
    setAddSlideV2Open(true)
  }, [generationPanel.closePanel, closeStudioFormat, bringToFront])
  useEffect(() => {
    if (addSlideV2Open && (generationPanel.isOpen || showTextBoxPanel || showElementPanel || (studioShell && studioFormatOpen))) setAddSlideV2Open(false)
  }, [addSlideV2Open, generationPanel.isOpen, showTextBoxPanel, showElementPanel, studioShell, studioFormatOpen])
  const studioFormatMountedRef = useRef(false)
  useEffect(() => { studioFormatMountedRef.current = true; return () => { studioFormatMountedRef.current = false; studioFormatRequestRef.current = null; studioFormatCommandIntentRef.current = null } }, [])
  const studioFormatScope = studioFormatScopeRef.current
  useEffect(() => {
    const request = studioFormatRequestRef.current
    if (request && (request.scope !== studioFormatScope || !request.selection.isCurrent())) closeStudioFormat()
  }, [studioFormatScope, studioViewerSafety, closeStudioFormat])
  const handleStudioFormatRequested = useCallback(async (selection: StudioFormatSelectionHandle) => {
    const scope = studioFormatScopeRef.current
    if (!studioShell || studioFormatTemplateModeRef.current || scope.busy || !scope.userId || !scope.sessionId || scope.sessionId === 'new'
      || scope.deckOwnerSessionId !== scope.sessionId || selection.presentationId !== scope.presentationId
      || selection.slideIndex !== scope.slideIndex || !selection.isCurrent()) return
    const request = { selection, scope }
    const partialWork = {}
    if (studioShell) studioPartialLocalWorkRef.current.add(partialWork)
    studioFormatRequestRef.current = request
    const current = () => studioFormatMountedRef.current && studioFormatRequestRef.current === request
      && studioFormatScopeRef.current === scope && selection.isCurrent()
    setStudioFormatOpen(true); setStudioFormatLoading(true); setStudioFormatTarget(null); setStudioFormatError(null)
    activateElementPanel()
    try {
      const target = await selection.read()
      if (current()) setStudioFormatTarget(target)
    } catch (error) {
      if (current()) setStudioFormatError(error instanceof Error ? error.message : 'Formatting properties could not be confirmed.')
    } finally {
      studioPartialLocalWorkRef.current.delete(partialWork)
      if (studioPartialMountedRef.current) setStudioPartialRevision(revision => revision + 1)
      if (current()) setStudioFormatLoading(false)
    }
  }, [studioShell, activateElementPanel])
  const handleStudioFormatCommand = useCallback(async (action: StudioFormatCommand, params: Record<string, unknown>, target: StudioFormatTarget) => {
    const request = studioFormatRequestRef.current
    if (!request || !studioFormatMountedRef.current || studioFormatScopeRef.current !== request.scope
      || studioFormatTemplateModeRef.current || request.scope.busy || !request.selection.isCurrent() || target.selectionOwner !== request.selection.owner
      || target.presentationId !== request.scope.presentationId || target.slideIndex !== request.scope.slideIndex) {
      throw new Error('Select the element again before formatting.')
    }
    const intent = {}
    studioFormatCommandIntentRef.current = intent
    studioPartialLocalWorkRef.current.add(intent)
    try {
      const result = await request.selection.send(action, params, target)
      if (!studioFormatMountedRef.current || studioFormatRequestRef.current !== request
        || studioFormatScopeRef.current !== request.scope || !request.selection.isCurrent()) throw new Error('The selection changed before formatting was confirmed.')
      // A confirmed primitive is followed by another strict native read. Attempted
      // field values never become the source of the next formatting snapshot.
      try {
        const refreshed = await request.selection.read()
        if (studioFormatMountedRef.current && studioFormatRequestRef.current === request
          && studioFormatScopeRef.current === request.scope && request.selection.isCurrent()) setStudioFormatTarget(refreshed)
      } catch {
        if (studioFormatMountedRef.current && studioFormatRequestRef.current === request
          && studioFormatScopeRef.current === request.scope && request.selection.isCurrent()) {
          setStudioFormatTarget(null)
          setStudioFormatError('The change was confirmed, but its updated properties could not be read. Select the element again.')
        }
      }
      if (action === 'generateTextBoxContent' && (!studioFormatMountedRef.current
        || studioFormatRequestRef.current !== request || studioFormatScopeRef.current !== request.scope
        || !request.selection.isCurrent())) throw new Error('The AI edit was observed, but the current selection changed before its updated properties could be read.')
      return result
    } catch (error) {
      // Native AI work cannot be unsent. A fixed uncertainty notice may outlive
      // selection ownership only within this exact current Page scope/intent.
      if (action === 'generateTextBoxContent' && studioFormatMountedRef.current
        && studioFormatScopeRef.current === request.scope && studioFormatCommandIntentRef.current === intent
        && (studioFormatRequestRef.current !== request || !request.selection.isCurrent())) {
        toast({ title: 'Check AI text result',
          description: 'An earlier AI edit could not be confirmed and may have applied to its original text box. Check before generating it again.' })
      }
      throw error
    } finally {
      studioPartialLocalWorkRef.current.delete(intent)
      if (studioPartialMountedRef.current) setStudioPartialRevision(revision => revision + 1)
    }
  }, [toast])
  const handleOpenGenerationPanelInFront = useCallback(async (type: string) => {
    activateElementPanel()
    await handleOpenGenerationPanel(type)
  }, [activateElementPanel, handleOpenGenerationPanel])

  const handleOpenBlankGenerationPanel = useCallback((
    componentType: TextLabsComponentType,
    elementId: string,
  ) => {
    activateElementPanel()
    generationPanel.openPanelForElement(componentType, elementId)
  }, [activateElementPanel, generationPanel])

  const handleApprovedTextLabsGenerate = useCallback(async (
    formData: TextLabsFormData,
    submitIntent: ElementGenerationSubmitIntent,
    invocation?: { kind: 'chat-add'; slideIndex: number },
  ): Promise<TextLabsGenerationResult> => {
    if (!layoutServiceApis?.sendElementCommand) {
      generationPanel.setError('The presentation viewer is unavailable. Reload the presentation and try again.')
      toast({
        title: 'Presentation unavailable',
        description: 'Wait for an approved presentation viewer to load before generating an element.',
        variant: 'destructive',
      })
      return { status: 'failed', presentationId: effectivePresentationId,
        slideIndex: formData.slideIndex ?? null,
        error: 'The presentation viewer is unavailable. Reload the presentation and try again.' }
    }

    const partialWork = {}
    if (studioShell) studioPartialLocalWorkRef.current.add(partialWork)
    try { return await handleTextLabsGenerate(formData, submitIntent, invocation) }
    finally {
      studioPartialLocalWorkRef.current.delete(partialWork)
      if (studioPartialMountedRef.current) setStudioPartialRevision(revision => revision + 1)
    }
  }, [generationPanel, handleTextLabsGenerate, layoutServiceApis, toast, effectivePresentationId])

  const handleRefineElementRequested = useCallback((payload: RefineElementRequest) => {
    if (!features.useTextLabsGeneration) return

    const componentType = normalizeTextLabsElementType(payload.componentType ?? payload.elementType)
    if (!componentType) {
      console.warn('[ElementRefine] Unsupported element type from viewer:', payload.componentType ?? payload.elementType)
      return
    }

    const blankInfo = blankElements.getElement(payload.elementId)
    if (shouldOpenAsBlankPlaceholder(payload, blankInfo?.componentType)) {
      handleOpenBlankGenerationPanel(componentType, payload.elementId)
      return
    }

    const refineContext = buildRefineContext(payload, componentType)
    activateElementPanel()
    generationPanel.openPanelForRefine(componentType, refineContext)
  }, [
    activateElementPanel,
    blankElements,
    buildRefineContext,
    generationPanel,
    handleOpenBlankGenerationPanel,
  ])

  const getTemplateSlotCatalog = useCallback(async (slideIndex: number) => {
    if (!layoutServiceApis?.sendElementCommand) {
      throw new Error('The presentation viewer is unavailable.')
    }
    return layoutServiceApis.sendElementCommand('getTemplateSlotCatalog', { slideIndex })
  }, [layoutServiceApis])

  // MDC P8 (K5): execute a chat-invoked element add through the SAME pipeline
  // as the element panel, then report the outcome to the Director.
  const elementDirectiveGenerationOwnerRef = useRef({ sessionId: currentSessionId || wsSessionId,
    deckOwnerSessionId, presentationId: effectivePresentationId, epoch: 0 })
  const previousDirectiveOwner = elementDirectiveGenerationOwnerRef.current
  const nextDirectiveSessionId = currentSessionId || wsSessionId
  const directiveOwnerChanged = previousDirectiveOwner.sessionId !== nextDirectiveSessionId
    || previousDirectiveOwner.deckOwnerSessionId !== deckOwnerSessionId
    || previousDirectiveOwner.presentationId !== effectivePresentationId
  elementDirectiveGenerationOwnerRef.current = { sessionId: nextDirectiveSessionId,
    deckOwnerSessionId, presentationId: effectivePresentationId,
    epoch: previousDirectiveOwner.epoch + (directiveOwnerChanged ? 1 : 0) }
  elementDirectiveRunnerRef.current = (payload) => {
    const owner = elementDirectiveGenerationOwnerRef.current
    const ownsDirective = () => {
      const current = elementDirectiveGenerationOwnerRef.current
      return Boolean(owner.sessionId && owner.presentationId
        && current.sessionId === owner.sessionId && current.deckOwnerSessionId === owner.sessionId
        && current.presentationId === owner.presentationId && current.epoch === owner.epoch)
    }
    void (async () => {
      const report = (status: 'inserted' | 'failed' | 'dismissed', error?: string, elementId?: string) =>
        ownsDirective() && sendElementDirectiveResult({
          directive_id: payload.directive_id, status,
          element_id: status === 'inserted' ? elementId ?? null : null, error: error ?? null,
        })
      try {
        const { buildFormDataForDirective } = await import('@/lib/mdc-element-directive')
        const formData = buildFormDataForDirective(payload.element_type, payload.prompt)
        if (!formData) {
          report('failed', `unsupported element type ${payload.element_type}`)
          return
        }
        const slideCount = slideStructure?.slides?.length ?? 0
        const target = payload.slide_index
        if (!ownsDirective()) {
          report('failed', 'The requested presentation is no longer owned by this chat.')
          return
        }
        const panel = generationPanel.getSnapshot()
        if (generationPanel.hasActiveGenerations || panel.isOpen) {
          report('dismissed', 'Finish or close the active element draft before adding an element from chat.')
          return
        }
        if (target < 0 || (slideCount > 0 && target >= slideCount)) {
          report('failed', 'target slide out of range')
          return
        }
        if (currentSlideIndexRef.current !== target) {
          if (!layoutServiceApis?.goToSlide) {
            report('failed', 'viewer navigation unavailable')
            return
          }
          await layoutServiceApis.goToSlide(target)
          await new Promise(resolve => setTimeout(resolve, 400))
        }
        if (!ownsDirective() || currentSlideIndexRef.current !== target) {
          report('failed', 'The requested slide could not be confirmed. No generation was started.')
          return
        }
        const outcome = await handleApprovedTextLabsGenerate(formData, 'generate', { kind: 'chat-add', slideIndex: target })
        if (outcome.status !== 'inserted') {
          report('failed', outcome.error)
          return
        }
        if (!ownsDirective() || outcome.presentationId !== owner.presentationId || outcome.slideIndex !== target
          || !outcome.elementIds.length || outcome.elementIds.some(id => !id.trim())) {
          report('failed', 'The requested slide insertion could not be confirmed. Inspect the slide before trying again.')
          return
        }
        report('inserted', undefined, outcome.elementIds[0])
        toast({ title: 'Element added', description: `Added to slide ${target + 1} from chat.` })
      } catch (error) {
        report('failed', error instanceof Error ? error.message : 'generation failed')
      }
    })()
  }

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

  // Template Ingest (C-7, review fix + round-4 durable ack): one-shot
  // handoff. The upload dialog minted this session, staged
  // `deckster_ingest_intent_<id>` in sessionStorage, and routed here.
  // State machine:
  //   STAGED       — key present, not yet sent. Effect reads WITHOUT deleting.
  //   SENT-UNACKED — sendMessage returned true on an OPEN socket: set the
  //                  per-session ref guard (prevents double-send within this
  //                  mount) but KEEP the key. `sendMessage === true` only
  //                  proves browser queuing, not Director receipt.
  //   RETRY        — sendMessage returned false (socket not actually OPEN
  //                  despite isReady): keep the key, leave the ref guard
  //                  unset; the effect re-runs when `isReady` flips true
  //                  again and retries the send.
  //   ACKED        — the WS hook deletes the key when ANY ingest frame for
  //                  THIS session arrives (Director emits a synchronous
  //                  `state:"accepted"` template_ingest_update; ready/failed
  //                  also count). That frame is the durable acknowledgement.
  //   REMOUNT      — a fresh mount with the key still present (sent but never
  //                  acked, e.g. the tab reloaded before Director got it)
  //                  re-sends; Director's idempotent duplicate-job guard makes
  //                  re-sends safe.
  //   RECONNECT    — round-5 (R4-6): a NEW socket generation for the SAME
  //                  session while the intent key still exists and no job
  //                  record has appeared clears the sent guard — the previous
  //                  send is presumed lost with the old socket, and the effect
  //                  (which depends on `connectionGeneration`) re-sends.
  //   ACK-TIMEOUT  — round-5 (R4-6): 20s after a successful send with no
  //                  accepted/update frame having produced a job record (and
  //                  the intent key still staged), the guard is cleared and a
  //                  resend nonce re-runs the effect. Re-sends are idempotent
  //                  (Director re-acks duplicates).
  const ingestAutoSendSessionRef = useRef<string | null>(null)
  // Round-5 (R4-6): socket generation the last send was dispatched on, the
  // pending ack-timeout timer, one-per-mount chat-echo guard, and the nonce
  // that re-runs the effect after an ack timeout.
  const ingestAutoSendGenerationRef = useRef<number>(-1)
  const ingestAckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ingestChatEchoSessionRef = useRef<string | null>(null)
  const [ingestResendNonce, setIngestResendNonce] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED !== 'true') return // flag-off: byte-identical behavior
    if (!currentSessionId || currentSessionId === 'new') return
    if (!isReady) return
    // Round-3 fix (review N1/F8): only send over a socket that was OPENED
    // under this session. With the dialog's hard navigation this is belt and
    // braces, but it also protects any future SPA path where a previous
    // session's socket could still be the open one when this effect fires.
    if (socketSessionId !== currentSessionId) {
      console.warn('[TemplateIngest] Open socket belongs to a different session; deferring ingest handoff', {
        socketSessionId,
        currentSessionId,
      })
      return
    }

    const key = `${INGEST_INTENT_KEY_PREFIX}${currentSessionId}`
    let raw: string | null = null
    try {
      raw = sessionStorage.getItem(key) // read only; consumed on Director's ack frame
    } catch {
      return
    }
    if (!raw) return

    // Round-5 (R4-6): has ANY accepted/update frame produced a job record?
    // (The hook consumes the intent key on the same frame, so a lingering
    // intent key + no job record means Director never acknowledged.)
    let hasJobRecord = false
    try {
      hasJobRecord = !!sessionStorage.getItem(`${INGEST_JOB_KEY_PREFIX}${currentSessionId}`)
    } catch { /* treat as no record */ }

    if (ingestAutoSendSessionRef.current === currentSessionId) {
      if (
        connectionGeneration !== ingestAutoSendGenerationRef.current &&
        !hasJobRecord
      ) {
        // R4-6(1): new socket generation, intent still staged, no job record —
        // the earlier send died with the old socket. Re-arm and fall through.
        console.warn('[TemplateIngest] New connection with un-acked ingest intent — re-sending', {
          sentGeneration: ingestAutoSendGenerationRef.current,
          connectionGeneration,
        })
        ingestAutoSendSessionRef.current = null
      } else {
        return
      }
    }
    if (hasJobRecord) {
      // Director already acknowledged a job for this session; never double-send.
      return
    }

    let intent: IngestIntentPayload | null = null
    try {
      intent = JSON.parse(raw) as IngestIntentPayload
    } catch {
      intent = null
    }
    if (!intent?.storage_path || !intent?.file_name || !intent?.kind) {
      console.warn('[TemplateIngest] Ignoring malformed ingest intent payload')
      ingestAutoSendSessionRef.current = currentSessionId
      try { sessionStorage.removeItem(key) } catch { /* ignore */ }
      return
    }

    const ingestUploadRef: IngestUploadRef = {
      storage_path: intent.storage_path,
      file_name: intent.file_name,
      kind: intent.kind,
    }
    const messageText = 'Convert my uploaded presentation into a template'
    const success = sendMessage(messageText, undefined, undefined, {
      templateIngest: true,
      ingestUploadRef,
    })

    if (!success) {
      // Transient WS miss: the socket was not OPEN when we tried to send.
      // Keep the staged key and the ref guard unset so the effect retries
      // automatically when connectivity flips true again — no re-upload needed.
      console.warn('[TemplateIngest] WebSocket not open yet; ingest handoff will retry on reconnect')
      return
    }

    // Dispatched on an OPEN connection: guard against double-send within
    // this connection generation. The one-shot key is deliberately NOT
    // deleted here — round-4 durable ack: only an ingest frame for this
    // session (the synchronous "accepted" update, or ready/failed) consumes
    // it, in the WS hook's session-gated frame handler. If Director never
    // received the message, the RECONNECT/ACK-TIMEOUT/REMOUNT paths re-send.
    ingestAutoSendSessionRef.current = currentSessionId
    ingestAutoSendGenerationRef.current = connectionGeneration

    // Round-5 (R4-6): ack timeout. If 20s pass with the intent key still
    // staged and no accepted/update frame having produced a job record,
    // clear the sent guard and bump the nonce so the effect re-sends
    // (idempotent — Director re-acks duplicates).
    const sessionAtSend = currentSessionId
    if (ingestAckTimerRef.current) clearTimeout(ingestAckTimerRef.current)
    ingestAckTimerRef.current = setTimeout(() => {
      ingestAckTimerRef.current = null
      try {
        const stillStaged = sessionStorage.getItem(key)
        const jobRecord = sessionStorage.getItem(`${INGEST_JOB_KEY_PREFIX}${sessionAtSend}`)
        if (stillStaged && !jobRecord) {
          console.warn('[TemplateIngest] No Director acknowledgement within 20s — re-arming ingest resend')
          if (ingestAutoSendSessionRef.current === sessionAtSend) {
            ingestAutoSendSessionRef.current = null
          }
          setIngestResendNonce(n => n + 1)
        }
      } catch { /* sessionStorage unavailable — nothing to re-send from */ }
    }, 20000)

    // Mirror the normal send path: show the message in chat and persist it —
    // once per mount+session (round-5: re-sends must not duplicate the echo).
    if (ingestChatEchoSessionRef.current !== currentSessionId) {
      ingestChatEchoSessionRef.current = currentSessionId
      const messageId = crypto.randomUUID()
      const timestamp = Date.now()
      session.userMessageIdsRef.current.add(messageId)
      session.setUserMessages(prev => [...prev, {
        id: messageId,
        text: messageText,
        timestamp,
      }])
      if (persistence) {
        persistence.queueMessage({
          message_id: messageId,
          session_id: currentSessionId,
          timestamp: new Date(timestamp).toISOString(),
          type: 'chat_message',
          payload: { text: messageText },
        } as DirectorMessage, messageText)
        if (!session.hasTitleFromUserMessageRef.current && !session.hasTitleFromPresentationRef.current) {
          persistence.updateMetadata({ title: `Template: ${intent.file_name}` })
          session.hasTitleFromUserMessageRef.current = true
        }
      }
    }
  }, [currentSessionId, isReady, socketSessionId, connectionGeneration, ingestResendNonce, sendMessage, session, persistence, toast])

  // Round-4 (BFCache liveness follow-up from the round-3 review): a page
  // restored from the back/forward cache does not re-run mount effects, so a
  // job record written while this page was frozen (e.g. the R3-2 path stored
  // a terminal status for this session while another tab/page was live)
  // would go unnoticed until a reload. `pageshow` with `event.persisted`
  // re-arms the mount poller check below.
  const [ingestPageShowNonce, setIngestPageShowNonce] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED !== 'true') return // flag-off: inert
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setIngestPageShowNonce(n => n + 1)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // Template Ingest (C-5, M-6): reconnect polling. If a non-terminal ingest job
  // was persisted for this session (the tab reloaded / the WS dropped mid-job),
  // poll Director's job endpoint via the Next proxy every 5s (max 60 attempts)
  // and surface a completed job exactly like a template_ingest_ready frame.
  // Round-4 (R3-2): a stored terminal 'complete'/'failed' status — written by
  // the WS hook when the job's terminal frame arrived while ANOTHER session
  // was displayed — is also fetched here (first check runs immediately), so
  // returning to the origin session renders its result via the REST route.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED !== 'true') return // flag-off: inert
    if (!currentSessionId || currentSessionId === 'new') return

    const key = `${INGEST_JOB_KEY_PREFIX}${currentSessionId}`
    let stored: { job_id?: string; status?: string } | null = null
    try {
      stored = JSON.parse(sessionStorage.getItem(key) || 'null')
    } catch {
      stored = null
    }
    if (!stored?.job_id) return
    if ((stored.status || '').toLowerCase() === 'cancelled') {
      // Terminal with nothing to render — clear the stale record.
      try { sessionStorage.removeItem(key) } catch { /* ignore */ }
      return
    }

    const jobId = stored.job_id
    // Round-5 fix (R4-5): the ORIGIN session this poll was started for,
    // captured BEFORE any await. After EVERY await we re-check BOTH the
    // cleanup `cancelled` flag AND origin === currently displayed session
    // (`currentSessionIdRef` — live, updated on SPA session switches). On a
    // mismatch the resolved terminal result is recorded into the ORIGIN
    // session's job record only (so returning to the origin renders it via
    // this same poller) and is NEVER applied to the displayed session.
    const originSessionId = currentSessionId
    const originIsDisplayed = () =>
      !cancelled && originSessionId === currentSessionIdRef.current
    const persistOriginTerminal = (status: 'complete' | 'failed' | 'cancelled') => {
      try {
        sessionStorage.setItem(key, JSON.stringify({ job_id: jobId, status }))
      } catch { /* ignore */ }
    }
    let attempts = 0
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    const stop = () => { if (timer) clearInterval(timer) }
    const pollOnce = async () => {
      if (cancelled) return
      attempts += 1
      if (attempts > 60) {
        stop()
        return
      }
      // If the live WS already resolved the job (key cleared), stop polling.
      try {
        if (!sessionStorage.getItem(key)) {
          stop()
          return
        }
      } catch { /* keep polling */ }

      try {
        const res = await fetch(`/api/ingest-jobs/${encodeURIComponent(jobId)}`)
        // R4-5 guard #1 (post-fetch): the page may have switched sessions
        // (B→C) while this response was in flight.
        if (cancelled) { stop(); return }
        if (!res.ok) return // transient — keep polling until attempts cap
        const body = await res.json()
        // R4-5 guard #2 (post-json).
        if (cancelled) { stop(); return }
        const status = String(body?.status || body?.state || '').toLowerCase()
        if (status === 'complete' || status === 'completed') {
          stop()
          const result = (body?.result || body) as TemplateIngestReady['payload']
          if (!originIsDisplayed()) {
            // Late B result with C displayed: record B's terminal status only.
            persistOriginTerminal('complete')
            return
          }
          if (result?.template_id || result?.viewer_url) {
            // Round-5 (R4-5): the apply helper re-validates the origin
            // session against the hook's displayed session at call time
            // (belt and braces); a refusal keeps the origin job record.
            const applied = applyTemplateIngestReady(result, originSessionId)
            if (!applied) {
              persistOriginTerminal('complete')
              return
            }
            try { sessionStorage.removeItem(key) } catch { /* ignore */ }
            toast({
              title: 'Template saved',
              description: 'Your uploaded presentation finished converting while you were away.',
            })
          } else {
            // Terminal but unrenderable payload — clear the stale record.
            try { sessionStorage.removeItem(key) } catch { /* ignore */ }
          }
        } else if (status === 'failed' || status === 'cancelled') {
          stop()
          if (!originIsDisplayed()) {
            persistOriginTerminal(status as 'failed' | 'cancelled')
            return
          }
          try { sessionStorage.removeItem(key) } catch { /* ignore */ }
          if (status === 'failed') {
            toast({
              title: 'Template ingest failed',
              // R4-11: Director's job body may carry `errors[]` (SB 413 /
              // budget details) or FastAPI `detail` instead of `error`.
              description: String(
                body?.error || body?.errors?.[0] || body?.detail
                || 'The uploaded presentation could not be converted.'
              ),
              variant: 'destructive',
            })
          }
        } else if (status) {
          try { sessionStorage.setItem(key, JSON.stringify({ job_id: jobId, status })) } catch { /* ignore */ }
        }
      } catch {
        // network hiccup — keep polling until attempts cap
      }
    }

    // First check runs immediately (renders a stored terminal result without
    // the 5s delay), then every 5s until terminal/cap.
    timer = setInterval(pollOnce, 5000)
    void pollOnce()

    return () => {
      cancelled = true
      stop()
    }
    // Round-5 (R4-6): `templateIngestJobId` re-arms the poller when the job
    // record/state appears AFTER mount (the accepted/update frame landed
    // later than the mount check); `connectionGeneration` re-arms it on each
    // new socket so a reconnect re-checks the stored record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId, ingestPageShowNonce, templateIngestJobId, connectionGeneration])

  // Template Ingest (C-5, M-6): cancel an in-flight ingest job over the WS
  // (mirrors handleCancelTemplateReuse below).
  const handleCancelTemplateIngest = useCallback(() => {
    if (!templateIngestJobId) return
    const sent = sendControlMessage('template_ingest_cancel', { job_id: templateIngestJobId })
    if (!sent) {
      toast({
        title: 'Could not cancel template import',
        description: 'Director is not connected. Reconnect the session and try again.',
        variant: 'destructive',
      })
    }
  }, [templateIngestJobId, sendControlMessage, toast])

  // FIXED: Clear loading state when final presentation URL arrives
  const lastFinalPresentationUrlRef = useRef<string | null>(null)
  useEffect(() => {
    isGeneratingFinalRef.current = isGeneratingFinal
  }, [isGeneratingFinal])

  useEffect(() => {
    if (finalPresentationUrl && isGeneratingFinal) {
      setIsGeneratingFinal(false)
      setTemplateReuseAwaitingInput(false)
      console.log('Final presentation ready - hiding loader')
    }

    if (finalPresentationUrl && finalPresentationUrl !== lastFinalPresentationUrlRef.current) {
      setTemplateReuseAwaitingInput(false)
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
    const hasSlideStructure = Array.isArray((slideStructure as any)?.slides)
      ? (slideStructure as any).slides.length > 0
      : Array.isArray(slideStructure)
        ? slideStructure.length > 0
        : Boolean(slideStructure)
    return deriveBuilderStage({
      activeVersion,
      presentationUrl: effectivePresentationUrl,
      slideCount: effectiveSlideCount,
      hasSlideStructure,
    })
  }, [activeVersion, effectivePresentationUrl, effectiveSlideCount, slideStructure])
  const buildSelectionsLocked = Boolean(
    finalPresentationUrl
    && !isBlankPresentation
    && (effectiveSlideCount ?? 0) > 1,
  )
  const generationSelectionsLocked = Boolean(
    buildSelectionsLocked || isGeneratingFinal || isGeneratingStrawman || templateReuseAwaitingInput
  )
  const templateSelectionLocked = generationSelectionsLocked

  useEffect(() => {
    templateSelectionLockedRef.current = generationSelectionsLocked
  }, [generationSelectionsLocked])

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
    if (studioShell && messages.length === 0 && session.userMessages.length === 0) {
      const viewport = messagesEndRef.current?.closest('[data-radix-scroll-area-viewport]')
      if (viewport) viewport.scrollTop = 0
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, session.userMessages, studioShell])

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
  // Research settings freeze. These toggles decide what the deck is BUILT from,
  // and the strawman is where they are first spent — web/deep research fire
  // there and extraction-readiness is read there. Changing them afterwards
  // yields a deck whose grounding disagrees with its own settings, so the
  // Director refuses late changes too ([TAP:RESEARCH_SETTINGS_LOCKED]); this is
  // only the matching UI. `hasStrawman` is the Director's own signal, latched.
  const researchSettingsLocked = hasStrawman

  // Typed messages and structured answers share synchronous readiness gates.
  // Reconnection itself remains the transport's job; disconnected is not a blocker.
  const preflightDirectorTurn = useCallback((source: BlockedSendSource = 'typed') => {
    if (!user) {
      console.warn('Cannot send message: user not authenticated')
      return false
    }

    if (session.isLoadingSession || awaitingDirectorReply || isExecutingSendRef.current || questionSubmissionPendingRef.current) {
      return false
    }

    if (activeTemplate && isGeneratingFinal) {
      return false
    }

    // Raw-upload readiness gate. Background source enrichment is explicitly
    // non-blocking once the file is stored and linked to this session. The
    // composer disables Send only for transport/link failures, and this is
    // shared preflight for typed messages and structured answers. It is the last point at
    // which we still know the truth: the Director is told uploads exist purely
    // via `fileUpload`/`storeName` below, so sending while a file is still
    // uploading silently builds the deck without that document.
    const stillUploading = uploadedFiles.find(f => f.status === 'uploading')
    const failedUploadFile = uploadedFiles.find(f => f.status === 'error')
    if (stillUploading || failedUploadFile) {
      toast({
        title: stillUploading ? 'Still uploading your file' : 'Upload failed',
        description: stillUploading
          ? `${stillUploading.name} is still being stored. It will be attached in a moment.`
          : `${failedUploadFile!.name} couldn't be uploaded. Remove it or try again before sending.`,
        variant: stillUploading ? 'default' : 'destructive',
      })
      if (STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED) {
        setBlockedSendNotice(previous => nextBlockedSendNotice(previous, uploadBlockedSendNotice(
          { name: (stillUploading ?? failedUploadFile)!.name, status: stillUploading ? 'uploading' : 'error' }, source)))
      }
      return false
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
      if (STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED) {
        setBlockedSendNotice(previous => nextBlockedSendNotice(previous, quotaBlockedSendNotice(
          { which, resetLabel, caps: q.caps }, source)))
      }
      return false
    }

    if (activeTemplate && !isTemplateGenerationReady(activeTemplate)) {
      toast({
        title: 'Template generation locked',
        description: templateGenerationUnavailableReason(activeTemplate),
      })
      if (STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED) {
        setBlockedSendNotice(previous => nextBlockedSendNotice(previous,
          templateBlockedSendNotice(templateGenerationUnavailableReason(activeTemplate), source)))
      }
      return false
    }

    if (STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED) setBlockedSendNotice(null)
    return true
  }, [user, session.isLoadingSession, awaitingDirectorReply, activeTemplate,
    isGeneratingFinal, uploadedFiles, quota.status, toast])

  const handleSendMessage = useCallback(async (
    e?: React.FormEvent,
    messageOverride?: string,
    turnContext?: { manualDeck?: ManualDeckContext },
  ) => {
    if (e) e.preventDefault()
    const messageText = (messageOverride ?? inputMessage).trim()
    if (!messageText) return
    const submittedDraft = inputMessage
    const submittedAction = pendingActionInput
    const submittedActionRevision = pendingActionIntentRef.current.revision
    const attachedFiles = uploadedFiles.filter(isAttachedUpload)
    const messageAttachments = snapshotAttachedUploads(attachedFiles)
    const messagePayload = messageAttachments.length > 0
      ? { text: messageText, attachments: messageAttachments }
      : { text: messageText }
    const fileCount = attachedFiles.length

    const origin = { ...questionSubmissionScopeRef.current }
    const isCurrentSubmission = () => (
      questionSubmissionScopeRef.current.active &&
      questionSubmissionScopeRef.current.generation === origin.generation &&
      questionSubmissionScopeRef.current.sessionId === origin.sessionId &&
      questionSubmissionScopeRef.current.userId === origin.userId
    )
    const isCurrentActionIntent = () => !submittedAction || (
      pendingActionIntentRef.current.action === submittedAction &&
      pendingActionIntentRef.current.revision === submittedActionRevision
    )
    const mayDispatchSubmission = () => isCurrentSubmission() && isCurrentActionIntent()
    if (!origin.active || origin.sessionId !== (currentSessionId || wsSessionId)) return
    if (!isCurrentActionIntent()) return
    if (!preflightDirectorTurn()) return
    session.markStudioUserIntent()

    // A blank Layout presentation may already contain user-authored slides or
    // elements. Inspect the persisted source immediately before the first build
    // turn so theme selection alone does not trigger the choice dialog and no
    // stale client-side slide count can lose manual work.
    const manualSourcePresentationId = blankPresentationId ?? presentationId ?? effectivePresentationId
    const shouldInspectManualDeck = shouldInspectManualDeckBeforeBuild({
      hasPendingAction: Boolean(pendingActionInput),
      hasManualDeckContext: Boolean(turnContext?.manualDeck),
      templateModeOn,
      sourcePresentationId: manualSourcePresentationId,
      directorWorkflowState,
      isBlankPresentation,
      activeVersion,
    })
    if (shouldInspectManualDeck) {
      if (pendingManualDeckBuild || manualDeckInspectionInFlightRef.current) return
      manualDeckInspectionInFlightRef.current = true
      try {
        const response = await fetch(
          `${getLayoutServiceUrl()}/api/presentations/${encodeURIComponent(manualSourcePresentationId!)}`,
          { cache: 'no-store' },
        )
        if (!mayDispatchSubmission()) return
        if (response.ok) {
          const body = await response.json().catch(() => null) as Record<string, unknown> | null
          if (!mayDispatchSubmission()) return
          const snapshot = body?.presentation ?? body
          if (!snapshot || typeof snapshot !== 'object' || !Array.isArray((snapshot as Record<string, unknown>).slides)) {
            toast({
              title: 'Could not verify your current slides',
              description: 'Layout returned an incomplete presentation. Your deck was left unchanged; retry before building.',
              variant: 'destructive',
            })
            return
          }
          const inspection = inspectManualDeck(snapshot)
          if (inspection.hasMeaningfulWork) {
            setManualDeckHandoffError(null)
            setPendingManualDeckBuild({
              messageText,
              presentationId: manualSourcePresentationId!,
              presentationUrl: effectivePresentationUrl
                ?? `${getLayoutServiceUrl()}/p/${encodeURIComponent(manualSourcePresentationId!)}`,
              summary: inspection.summary,
              operationId: crypto.randomUUID(),
            })
            return
          }
        } else {
          console.warn('[Manual Deck] Layout inspection failed:', response.status)
          toast({
            title: 'Could not verify your current slides',
            description: 'Your deck was left unchanged. Retry when the presentation is available so customized slides cannot be lost.',
            variant: 'destructive',
          })
          return
        }
      } catch (error) {
        if (!mayDispatchSubmission()) return
        console.warn('[Manual Deck] Could not inspect presentation before build.', error)
        toast({
          title: 'Could not verify your current slides',
          description: error instanceof ServiceUrlConfigError
            ? error.message
            : 'Your deck was left unchanged. Check your connection and retry before building.',
          variant: 'destructive',
        })
        return
      } finally {
        manualDeckInspectionInFlightRef.current = false
      }
    }

    if (isExecutingSendRef.current) {
      console.log('Already executing send, skipping duplicate call')
      return
    }

    isExecutingSendRef.current = true

    try {
      // Sending a Director turn is non-idempotent. A user submission may
      // explicitly reset exhausted reconnect state, but the exact message stays
      // in the composer until OPEN rather than being guessed/replayed on a
      // fixed handshake timeout.
      if (!isReady) {
        if (!connecting) {
          connect()
        }
        toast({
          title: connecting ? 'Director is reconnecting' : 'Reconnecting to Director',
          description: 'Your message is still in the composer. Send it when the connection is ready.',
        })
        return
      }

      const sendTypedTurn = async (options: Parameters<typeof sendMessageWhenConnected>[3]) => {
        let success = false
        try {
          success = await sendMessageWhenConnected(messageText, undefined, fileCount,
            options, undefined, mayDispatchSubmission)
        } catch (error) {
          console.warn('Could not send Director message:', error)
        }
        if (!isCurrentSubmission()) return false
        if (success !== true) {
          if (!isCurrentActionIntent()) return false
          toast({
            title: "Couldn't reach the Director",
            description: 'Your message was not sent — the connection dropped and could not be reopened. It is still in the box; try again.',
            variant: 'destructive',
          })
          return false
        }
        return true
      }
      const clearSubmittedComposer = () => {
        // A completed send consumes its snapshot, not edits made while waiting.
        if (submittedDraft.trim() === messageText) {
          setInputMessage(current => current === submittedDraft ? '' : current)
        }
        if (submittedAction && isCurrentActionIntent()) setPendingActionInput(null)
        for (const file of attachedFiles) removeFile(file.id)
      }
      const beginTemplateReuse = () => {
        // Keep the native build animation, but never start it for unsent bytes.
        if (activeTemplate) {
          setTemplateReuseAwaitingInput(false)
          setIsGeneratingFinal(true)
        }
      }

      // Handle pending action input
      if (submittedAction) {
        const { action, messageId, timestamp } = submittedAction

        const success = await sendTypedTurn({
          deepResearch: researchEnabled,
          webSearch: webSearchEnabled,
          extendedGeneration: extendedGenerationEnabled,
          useKnowledgeGraph: canUseKnowledgeGraph && knowledgeGraphEnabled,
          fileUpload: !!sessionStoreName,
          storeName: sessionStoreName,
          actionValue: action.value,
          actionLabel: action.label,
          ...buildSendOptions,
          manualDeck: turnContext?.manualDeck,
        })
        if (!success || !isCurrentSubmission()) return
        beginTemplateReuse()

        session.userMessageIdsRef.current.add(messageId)

        session.setUserMessages(prev => [...prev, {
          id: messageId,
          text: messageText,
          timestamp: timestamp,
          attachments: messageAttachments,
        }])

        if (currentSessionId && persistence) {
          persistence.queueMessage({
            message_id: messageId,
            session_id: currentSessionId,
            timestamp: new Date(timestamp).toISOString(),
            type: 'chat_message',
            payload: {
              ...messagePayload,
              action_value: action.value,
              action_label: action.label,
            }
          } as unknown as DirectorMessage, messageText)
        }

        clearSubmittedComposer()
        return
      }

      // For unsaved sessions, create database session first
      if (isUnsavedSession) {
        console.log('Creating database session for first message')
        const newSessionId = currentSessionId || wsSessionId

        try {
          const created = createdDirectorSessionRef.current
          const dbSession = created?.ownerId === origin.userId && created.sourceSessionId === newSessionId
            ? created : await createSession(newSessionId)
          if (!isCurrentSubmission()) return

          if (dbSession) {
            // A confirmed history row is not a sent message. Retain it for retry
            // even before React has rerendered isUnsavedSession/currentSessionId.
            if (dbSession.id !== newSessionId) {
              toast({ title: 'Could not verify the chat session', description: 'Your message is still in the composer. Retry after the current session is available.', variant: 'destructive' })
              return
            }
            createdDirectorSessionRef.current = { id: dbSession.id, ownerId: origin.userId, sourceSessionId: newSessionId }
            session.justCreatedSessionRef.current = dbSession.id
            setIsUnsavedSession(false)
            try {
              if (builderCacheOwner) {
                sessionStorage.removeItem(unsavedBuilderSessionKey(builderCacheOwner, dbSession.id))
              }
            } catch {}
            if (!currentSessionId) {
              // This branch confirms an existing transport ID before dispatch;
              // it is not the session hook's fresh-assignment certificate.
              retireStudioVoiceOwner()
              const stageObservation = studioInitialOwnerObservationRef.current
              studioInitialRouteAdoptionRef.current = stageObservation
                ? createStudioInitialRouteAdoptionIntent(studioInitialBlankProofRef.current, stageObservation,
                    { operationCurrent: isCurrentSubmission(), confirmedSessionId: dbSession.id }) : null
              setCurrentSessionId(dbSession.id)
              router.push(`/builder?session_id=${dbSession.id}`)
            }
            console.log('Database session created:', dbSession.id)

            const success = await sendTypedTurn({
              deepResearch: researchEnabled,
              webSearch: webSearchEnabled,
              extendedGeneration: extendedGenerationEnabled,
              useKnowledgeGraph: canUseKnowledgeGraph && knowledgeGraphEnabled,
              fileUpload: !!sessionStoreName,
              storeName: sessionStoreName,
              ...buildSendOptions,
              manualDeck: turnContext?.manualDeck,
            })
            if (!success || !isCurrentSubmission()) return
            beginTemplateReuse()

            const messageId = crypto.randomUUID()
            const timestamp = Date.now()

            session.userMessageIdsRef.current.add(messageId)

            session.setUserMessages(prev => [...prev, {
              id: messageId,
              text: messageText,
              timestamp: timestamp,
              attachments: messageAttachments,
            }])

            clearSubmittedComposer()

            // FIX 11: Save first message directly via API
            try {
              const firstMessagePayload = {
                id: messageId,
                messageType: 'chat_message',
                timestamp: new Date(timestamp).toISOString(),
                payload: messagePayload,
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

              if (!isCurrentSubmission()) return
              if (persistence) {
                const generatedTitle = persistence.generateTitle(messageText)
                console.log('Setting initial title from first message:', generatedTitle)

                await fetch(`/api/sessions/${dbSession.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: generatedTitle }),
                })
                if (isCurrentSubmission()) session.hasTitleFromUserMessageRef.current = true
              }
            } catch (error) {
              console.error('[FIX 11] Error saving first message:', error)
            }

            return
          } else {
            console.error('createSession returned null')
            alert('Failed to create session. Please check your connection and try again.')
            return
          }
        } catch (error) {
          if (!isCurrentSubmission()) return
          console.error('Error creating session:', error)
          alert(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}. Please try refreshing the page.`)
          return
        }
      }

      // A resumed session used to get its own send path here: trigger reconnection,
      // then immediately read `connected`/`isReady` — React state captured in
      // this closure, so still false however well the connect went — and either
      // bail with a toast or send and ignore the result. It duplicated the main
      // path and dropped messages in both directions. The unified send below
      // reconnects and waits on the socket REF, so it is correct for a resumed
      // session too; all that is left to do here is retire the flag.
      const messageId = crypto.randomUUID()
      const timestamp = Date.now()

      // Deliver FIRST, then commit to the UI. The previous order rendered the
      // bubble and queued it for persistence before attempting the send, so a
      // closed socket produced a message that looked sent, was stored as sent,
      // and reached nobody — indistinguishable to the user from the Director
      // ignoring them. Nothing below is allowed to run unless the bytes left.
      const success = await sendTypedTurn({
        deepResearch: researchEnabled,
        webSearch: webSearchEnabled,
        extendedGeneration: extendedGenerationEnabled,
        useKnowledgeGraph: canUseKnowledgeGraph && knowledgeGraphEnabled,
        fileUpload: !!sessionStoreName,
        storeName: sessionStoreName,
        ...buildSendOptions,
        manualDeck: turnContext?.manualDeck,
      })

      if (!success || !isCurrentSubmission()) return
      beginTemplateReuse()

      session.userMessageIdsRef.current.add(messageId)
      session.setUserMessages(prev => [...prev, {
        id: messageId,
        text: messageText,
        timestamp: timestamp,
        attachments: messageAttachments,
      }])

      if (currentSessionId && persistence) {
        persistence.queueMessage({
          message_id: messageId,
          session_id: currentSessionId,
          timestamp: new Date(timestamp).toISOString(),
          type: 'chat_message',
          payload: messagePayload
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

      clearSubmittedComposer()
      if (session.isResumedSession) {
        session.setIsResumedSession(false)
      }
    } finally {
      setTimeout(() => {
        isExecutingSendRef.current = false
      }, 500)
    }
  }, [
    inputMessage, preflightDirectorTurn, isReady, sendMessage, sendMessageWhenConnected, currentSessionId, persistence,
    session.isResumedSession, connected, connecting, connect, isUnsavedSession,
    createSession, router, uploadedFiles, removeFile, setPendingActionInput, researchEnabled,
    webSearchEnabled, extendedGenerationEnabled, knowledgeGraphEnabled,
    showKnowledgeGraphToggle, sessionStoreName, quota.status, toast,
    buildSendOptions, activeTemplate, isGeneratingFinal, pendingActionInput,
    blankPresentationId, presentationId, effectivePresentationId,
    effectivePresentationUrl, isBlankPresentation, activeVersion,
    pendingManualDeckBuild, templateModeOn,
      canUseKnowledgeGraph, builderCacheOwner,
  ])

  const handleCancelManualDeckBuild = useCallback(() => {
    if (manualDeckHandoffBusy) return
    setPendingManualDeckBuild(null)
    setManualDeckHandoffError(null)
  }, [manualDeckHandoffBusy])

  const handlePrependGeneratedSlides = useCallback(() => {
    const pending = pendingManualDeckBuild
    if (!pending || manualDeckHandoffBusy) return

    const manualDeck = createManualDeckContext({
      presentationId: pending.presentationId,
      presentationUrl: pending.presentationUrl,
      summary: pending.summary,
      operationId: pending.operationId,
    })
    setPendingManualDeckBuild(null)
    setManualDeckHandoffError(null)
    void handleSendMessage(undefined, pending.messageText, { manualDeck })
  }, [handleSendMessage, manualDeckHandoffBusy, pendingManualDeckBuild])

  const handleStartHandoffSession = useCallback(async () => {
    const pending = pendingManualDeckBuild
    const sourceSessionId = currentSessionId || wsSessionId
    const userId = user?.id || user?.email
    if (!pending || !sourceSessionId || !userId || manualDeckHandoffBusy) return

    const origin = { ...questionSubmissionScopeRef.current }
    const isCurrentOrigin = () => questionSubmissionScopeRef.current.active &&
      questionSubmissionScopeRef.current.generation === origin.generation &&
      questionSubmissionScopeRef.current.sessionId === origin.sessionId &&
      questionSubmissionScopeRef.current.userId === origin.userId
    const previousRequest = studioManualHandoffRequestRef.current
    if (studioShell && (!isCurrentOrigin() || origin.sessionId !== sourceSessionId || origin.userId !== userId ||
        (previousRequest && previousRequest.generation === origin.generation &&
         previousRequest.sessionId === origin.sessionId && previousRequest.userId === origin.userId))) return
    const studioRequest = studioShell ? {
      generation: origin.generation, sessionId: origin.sessionId, userId: origin.userId,
    } : null
    if (studioRequest) studioManualHandoffRequestRef.current = studioRequest
    const isCurrentHandoff = () => !studioShell ||
      (isCurrentOrigin() && studioManualHandoffRequestRef.current === studioRequest)

    setManualDeckHandoffBusy(true)
    setManualDeckHandoffError(null)
    const idempotencyKey = pending.operationId

    try {
      // Immediate-connection sessions do not have a frontend history row until
      // their first message. Save this source first so the customized deck is
      // visible in history even though its build request moves to a new session.
      if (isUnsavedSession) {
        const sourceRow = await createSession(sourceSessionId, 'Customized slides')
        if (!isCurrentHandoff()) return
        if (!sourceRow) throw new Error('Could not save the customized deck to session history.')
        setIsUnsavedSession(false)
        try { sessionStorage.removeItem(`deckster_unsaved_${sourceSessionId}`) } catch {}
      }

      if (!isCurrentHandoff()) return
      const sourceSaveResponse = await fetch(`/api/sessions/${encodeURIComponent(sourceSessionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStage: 0,
          blankPresentationUrl: pending.presentationUrl,
          blankPresentationId: pending.presentationId,
          slideCount: pending.summary.slide_count,
          lastMessageAt: new Date().toISOString(),
        }),
      })
      if (!isCurrentHandoff()) return
      if (!sourceSaveResponse.ok) {
        throw new Error('Could not save the customized deck to session history.')
      }

      const attachedFiles = uploadedFiles.filter(isAttachedUpload)
      const attachments = snapshotAttachedUploads(attachedFiles)
      const request = buildSessionHandoffRequest({
        userId,
        idempotencyKey,
        pendingRequest: pending.messageText,
        theme: buildThemeSelection,
        templateMode: Boolean(activeTemplate),
        templateId: activeTemplate?.id,
        deepResearch: researchEnabled,
        webSearch: webSearchEnabled,
        useKnowledgeGraph: showKnowledgeGraphToggle && knowledgeGraphEnabled,
        storeName: sessionStoreName,
        manualDeckSummary: pending.summary,
      })
      if (!isCurrentHandoff()) return
      const response = await fetch(
        `/api/director/sessions/${encodeURIComponent(sourceSessionId)}/handoff`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        },
      )
      if (!isCurrentHandoff()) return
      const responseBody = await response.json().catch(() => ({})) as Partial<DirectorHandoffResponse> & {
        error?: string
        detail?: string
      }
      if (!isCurrentHandoff()) return
      if (
        !response.ok ||
        responseBody.status !== 'ready' ||
        typeof responseBody.new_session_id !== 'string'
      ) {
        throw new Error(responseBody.detail || responseBody.error || 'Director could not create the new session.')
      }

      const newSessionId = responseBody.new_session_id
      const pendingSubmission: PendingHandoffSubmission = {
        version: 1,
        source_session_id: sourceSessionId,
        new_session_id: newSessionId,
        idempotency_key: idempotencyKey,
        ...(studioShell ? { owner_user_id: authScopeUserId, submission_state: 'staged' as const } : {}),
        text: pending.messageText,
        store_name: sessionStoreName,
        file_count: attachedFiles.length,
        attachments,
        deep_research: researchEnabled,
        web_search: webSearchEnabled,
        extended_generation: extendedGenerationEnabled,
        use_knowledge_graph: showKnowledgeGraphToggle && knowledgeGraphEnabled,
        theme: buildThemeSelection,
        template_mode: Boolean(activeTemplate),
        template_id: activeTemplate?.id ?? null,
        ...(hasTemplateOverrides ? { element_overrides: templateOverrides } : {}),
      }
      pendingHandoffMemoryRef.current = pendingSubmission
      try {
        savePendingHandoff(window.sessionStorage, pendingSubmission)
      } catch (error) {
        // Same-page navigation can still complete from memory. The Director
        // idempotency key protects a retry if browser storage is unavailable.
        console.warn('[Manual Deck] Could not persist handoff submission in session storage.', error)
      }
      writeBuilderSessionOptions(
        builderCacheOwner,
        newSessionId,
        activeTemplate,
        buildThemeSelection,
        activeBuildThemeProfileForSelection,
      )

      // Create the frontend history row before navigation when possible. If the
      // local write is briefly unavailable, useBuilderSession will adopt the
      // already-verified Director session at the destination URL.
      const generatedTitle = persistence?.generateTitle(pending.messageText)
        ?? pending.messageText.slice(0, 50)
      const newSessionRow = await createSession(newSessionId, generatedTitle)
      if (!isCurrentHandoff()) return

      disconnect()
      retireStudioVoiceOwner()
      clearMessages()
      session.setUserMessages([])
      session.lastLoadedSessionRef.current = null
      session.hasTitleFromUserMessageRef.current = false
      session.hasTitleFromPresentationRef.current = false
      session.answeredActionsRef.current.clear()
      setInputMessage('')
      setSessionStoreName(pendingSubmission.store_name)
      setPendingManualDeckBuild(null)
      setManualDeckHandoffBusy(false)

      if (newSessionRow) {
        session.justCreatedSessionRef.current = newSessionId
        setCurrentSessionId(newSessionId)
        setIsUnsavedSession(false)
        try { sessionStorage.removeItem(`deckster_unsaved_${newSessionId}`) } catch {}
      }
      router.push(`/builder?session_id=${encodeURIComponent(newSessionId)}`)
    } catch (error) {
      if (!isCurrentHandoff()) return
      const message = error instanceof Error ? error.message : 'Could not start the new session.'
      setManualDeckHandoffError(message)
      setManualDeckHandoffBusy(false)
      toast({
        title: 'Session handoff failed',
        description: `${message} Your current session is still open.`,
        variant: 'destructive',
      })
    } finally {
      if (studioRequest && studioManualHandoffRequestRef.current === studioRequest) {
        studioManualHandoffRequestRef.current = null
      }
    }
  }, [
    activeBuildThemeProfileForSelection, activeTemplate, buildThemeSelection,
    clearMessages, createSession, currentSessionId, disconnect,
    extendedGenerationEnabled, hasTemplateOverrides, isUnsavedSession,
    knowledgeGraphEnabled, manualDeckHandoffBusy, pendingManualDeckBuild,
    persistence, researchEnabled, router, session, sessionStoreName,
    showKnowledgeGraphToggle, templateOverrides, toast, uploadedFiles, user,
    webSearchEnabled, wsSessionId, studioShell,
    authScopeUserId,
  ])

  // Current Director can resume the durable request during connection. An owned
  // receipt retires automatic submission; local send success retains the request
  // for observation/recovery and does not imply server or native completion.
  useEffect(() => {
    if (!isReady || !currentSessionId || typeof window === 'undefined') return
    const pending = studioShell ? readCurrentStudioHandoff(currentSessionId)
      : readPendingHandoff(window.sessionStorage, currentSessionId)
      ?? (pendingHandoffMemoryRef.current?.new_session_id === currentSessionId
        ? pendingHandoffMemoryRef.current
        : null)
    if (!pending) return
    if (studioShell && !canAutomaticallySubmitStudioHandoff(pending, {
      userId: authScopeUserId, sessionId: currentSessionId,
    })) return

    const submissionKey = `${pending.new_session_id}:${pending.idempotency_key}`
    if (handoffSubmissionInFlightRef.current.has(submissionKey)) return
    handoffSubmissionInFlightRef.current.add(submissionKey)

    const sent = sendMessage(pending.text, undefined, pending.file_count, {
      deepResearch: pending.deep_research,
      webSearch: pending.web_search,
      extendedGeneration: pending.extended_generation,
      useKnowledgeGraph: pending.use_knowledge_graph,
      fileUpload: !!pending.store_name,
      storeName: pending.store_name,
      theme: pending.theme,
      templateMode: pending.template_mode,
      templateId: pending.template_id,
      elementOverrides: pending.element_overrides,
      // Identity is recomputed here rather than carried through the handoff
      // payload: it comes from this browser's profile + stored form, which the
      // new session shares, so the replayed build carries the same values
      // without widening the handoff contract.
      ...(deckIdentity ? { deckIdentity } : {}),
      handoffIdempotencyKey: pending.idempotency_key,
    })
    if (!sent) {
      handoffSubmissionInFlightRef.current.delete(submissionKey)
      return
    }

    if (studioShell) {
      const retained = markStudioHandoffSubmitted(pending, {
        userId: authScopeUserId, sessionId: currentSessionId,
      }, sent)
      pendingHandoffMemoryRef.current = retained
      setPendingHandoffRevision(value => value + 1)
      if (retained) {
        try {
          savePendingHandoff(window.sessionStorage, retained)
          setHandoffStorageWarning(null)
        } catch {
          setHandoffStorageWarning({ sessionId: currentSessionId,
            text: 'This request was sent, but its recovery record could not be saved in this browser. Keep this tab open to retain its recovery record. Reload recovery is uncertain.' })
        }
      }
    } else {
      clearPendingHandoff(window.sessionStorage, currentSessionId)
      pendingHandoffMemoryRef.current = null
    }
    const timestamp = Date.now()
    const messageId = pending.idempotency_key
    const attachments = attachmentsFromPayload({ attachments: pending.attachments })
    session.userMessageIdsRef.current.add(messageId)
    session.userMessageContentMapRef.current.set(pending.text.trim().toLowerCase(), messageId)
    session.setUserMessages(previous => previous.some(message => message.id === messageId)
      ? previous
      : [...previous, {
          id: messageId,
          text: pending.text,
          timestamp,
          attachments,
        }])
    session.hasTitleFromUserMessageRef.current = true
    setInputMessage('')
    setSessionStoreName(pending.store_name)
    setResearchEnabled(pending.deep_research)
    setWebSearchEnabled(pending.web_search || pending.deep_research)
    setExtendedGenerationEnabled(pending.extended_generation)
    setKnowledgeGraphEnabled(pending.use_knowledge_graph)
    clearAllFiles()

    const persistedMessage = {
      id: messageId,
      messageType: 'chat_message',
      timestamp: new Date(timestamp).toISOString(),
      payload: attachments.length > 0
        ? { text: pending.text, attachments }
        : { text: pending.text },
      userText: pending.text,
    }
    void fetch(`/api/sessions/${encodeURIComponent(currentSessionId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [persistedMessage] }),
    }).catch(error => console.warn('[Manual Deck] Could not persist handed-off user message.', error))
  }, [
    clearAllFiles, currentSessionId, deckIdentity, isReady, sendMessage,
    session.hasTitleFromUserMessageRef, session.setUserMessages,
    session.userMessageContentMapRef, session.userMessageIdsRef,
    studioShell, authScopeUserId, readCurrentStudioHandoff, pendingHandoffRevision,
  ])

  // Handle action button clicks
  const handleActionClick = useCallback(async (action: ActionRequest['payload']['actions'][0], actionRequestMessageId: string, answerKey: string = actionRequestMessageId) => {
    const origin = { ...questionSubmissionScopeRef.current }
    const isCurrentSubmission = () => (
      questionSubmissionScopeRef.current.active &&
      questionSubmissionScopeRef.current.generation === origin.generation &&
      questionSubmissionScopeRef.current.sessionId === origin.sessionId &&
      questionSubmissionScopeRef.current.userId === origin.userId
    )
    if (!origin.active || origin.sessionId !== (currentSessionId || wsSessionId)) return
    // answerKey is the bare id unless NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED, then the ask instance: a re-ask that re-uses the id
    // (the plan gate does) is a new ask, not an answered one.
    const pendingKey = JSON.stringify([origin.generation, origin.sessionId, origin.userId, answerKey])
    // One native request owns one choice, including choices that open input.
    if (actionSubmissionPendingRef.current.has(pendingKey) ||
        session.answeredActionsRef.current.has(answerKey)) return
    session.markStudioUserIntent()
    const messageId = crypto.randomUUID()
    const timestamp = Date.now()

    if (action.requires_input) {
      session.answeredActionsRef.current.add(answerKey)
      setPendingActionInput({ action, messageId, timestamp })
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    } else {
      actionSubmissionPendingRef.current.add(pendingKey)
      try {
        // Same rule as the composer: deliver first, commit after. Clicking a
        // button into a closed socket used to mark the action answered, render
        // the reply, show the generating loader and then quietly send nothing —
        // leaving a deck that looked like it was building and never was.
        let success = false
        try {
          success = await sendMessageWhenConnected(action.label, undefined, undefined, {
            deepResearch: researchEnabled,
            webSearch: webSearchEnabled,
            extendedGeneration: extendedGenerationEnabled,
            useKnowledgeGraph: canUseKnowledgeGraph && knowledgeGraphEnabled,
            fileUpload: !!sessionStoreName,
            storeName: sessionStoreName,
            actionValue: action.value,
            actionLabel: action.label,
            ...buildSendOptions,
          }, undefined, isCurrentSubmission)
        } catch {
          // Reconnect can reject as well as refuse; preserve the native retry UI.
        }
        if (!isCurrentSubmission()) return
        if (success !== true) {
          toast({
            title: "Couldn't reach the Director",
            description: `"${action.label}" was not sent — the connection dropped and could not be reopened. Try again.`,
            variant: 'destructive',
          })
          return
        }

        session.answeredActionsRef.current.add(answerKey)
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
            payload: { text: action.label, action_value: action.value, action_label: action.label }
          } as unknown as DirectorMessage, action.label)
        }

        // Only now is the build genuinely under way, so only now show the loader.
        if (action.value === 'accept_strawman') {
          setIsGeneratingFinal(true)
          console.log('Starting final deck generation - showing loader')
        }
        if (activeTemplate && action.value.startsWith('template_')) {
          setTemplateReuseAwaitingInput(false)
          setIsGeneratingFinal(true)
        }
      } finally {
        actionSubmissionPendingRef.current.delete(pendingKey)
      }
    }
  }, [sendMessageWhenConnected, currentSessionId, wsSessionId, setPendingActionInput, persistence, researchEnabled, webSearchEnabled, extendedGenerationEnabled, knowledgeGraphEnabled, canUseKnowledgeGraph, sessionStoreName, buildSendOptions, activeTemplate, session, toast])

  const handleCancelTemplateReuse = useCallback(() => {
    const sent = sendControlMessage('cancel_template_reuse')
    setIsGeneratingFinal(false)
    setTemplateReuseAwaitingInput(false)
    setPendingActionInput(null)
    if (!sent) {
      toast({
        title: 'Could not stop template reuse',
        description: 'Director is not connected. Reconnect the session and try again.',
        variant: 'destructive',
      })
    }
  }, [sendControlMessage, toast])

  // Wrapped session select handler (clears local UI state too)
  const handleSessionSelectWrapped = useCallback((sessionId: string) => {
    retireStudioVoiceOwner()
    setIsGeneratingFinal(false)
    setTemplateReuseAwaitingInput(false)
    setIsGeneratingStrawman(false)
    if (!studioShell) setSlideThumbnailUrlsByPresentation({})
    setShowChatHistory(false)
    setSessionStoreName(null)
    // The KG switch is a per-deck privacy choice, never a global sticky bit.
    setKnowledgeGraphEnabled(false)
    session.handleSessionSelect(sessionId)
  }, [session.handleSessionSelect, retireStudioVoiceOwner])

  const handleNewChatWrapped = useCallback(() => {
    retireStudioVoiceOwner()
    if (builderOptionsScope) skipBuilderOptionsPersistRef.current = builderOptionsScope
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
    setKnowledgeGraphEnabled(false)
    setIsGeneratingFinal(false)
    setTemplateReuseAwaitingInput(false)
    setIsGeneratingStrawman(false)
    setShowChatHistory(false)
    setSessionStoreName(null)
    clearAllFiles()
    session.handleNewChat()
  }, [builderOptionsScope, clearAllFiles, session.handleNewChat, retireStudioVoiceOwner])
  handleNewChatWrappedRef.current = handleNewChatWrapped

  const studioInitialNativeWork = Boolean(templateModeOn || templateModeSourcePresentationId || slideComposerOverride
    || studioCanvasLifecycle.hasGeneratedDeck || studioCanvasLifecycle.hasAuthoredDeck
    || isGeneratingFinal || isGeneratingStrawman || generationPanel.isGenerating
    || generationPanel.hasActiveGenerations || generationPanel.mode === 'edit' || generationPanel.mode === 'refine'
    || manualDeckHandoffBusy || pendingManualDeckBuild
    || (studioViewerSafety?.presentationId === effectivePresentationId && studioViewerSafety.presentationUrl === effectivePresentationUrl))
  const studioInitialKnownFresh = Boolean(session.studioInitialFreshCanonicalEntry
    && session.studioInitialFreshCanonicalEntry.authUserId === authScopeUserId
    && session.studioInitialFreshCanonicalEntry.sessionId === (currentSessionId || wsSessionId)
    && session.studioInitialFreshCanonicalEntry.sessionId === wsSessionId
    && session.studioInitialFreshCanonicalEntry.isCurrentAssignment())
  const studioPartialSessionId = currentSessionId || wsSessionId
  const studioPartialRouteSessionId = searchParams.get('session_id')
  const studioPartialAssignmentOwned = Boolean(studioShell && user?.id === authScopeUserId && !isAuthLoading
    && !session.isLoadingSession && !session.isCreatingSession
    && studioPartialSessionId && studioPartialSessionId !== 'new' && wsSessionId === studioPartialSessionId
    && (studioPartialRouteSessionId === studioPartialSessionId || studioInitialKnownFresh)
    && (deckOwnerSessionId === studioPartialSessionId || studioInitialKnownFresh))
  const studioPartialAssignmentKey = JSON.stringify([studioPartialSessionId, wsSessionId,
    studioPartialRouteSessionId, studioPartialAssignmentOwned, studioInitialKnownFresh])
  if (studioPartialAssignmentObservationRef.current?.scope !== studioPartialAuthority.scope
    || studioPartialAssignmentObservationRef.current.key !== studioPartialAssignmentKey) {
    const observation = { scope: studioPartialAuthority.scope, key: studioPartialAssignmentKey }
    studioPartialAssignmentObservationRef.current = observation
    studioPartialAssignmentRef.current = {
      userId: authScopeUserId, sessionId: studioPartialSessionId || '',
      isCurrent: () => studioPartialAssignmentOwned && studioPartialAuthority.isCurrent()
        && studioPartialAssignmentObservationRef.current === observation,
    }
  }
  studioPartialIngressRef.current = (message, transport) => {
    if (!studioShell || !effectiveBuildNarrationEnabled || !studioPartialAuthority.isCurrent()) return
    const assignment = studioPartialAssignmentRef.current
    if (!assignment) return
    const receipt = captureStudioPartialBuildReceipt({ authority: studioPartialAuthority, assignment, transport, message })
    if (!receipt || buildNarration.retiredBuildIds.includes(receipt.buildId)) return
    const candidates = studioPartialCandidatesRef.current
    if (!candidates || candidates.scope !== studioPartialAuthority.scope) return
    candidates.receipts.set(receipt.buildId, receipt)
    // Select only after the actual reducer has admitted its current build.
    // A second queued stale frame cannot erase a newer pending candidate.
    for (const key of candidates.receipts.keys()) {
      if (candidates.receipts.size <= 32) break
      if (key !== buildNarration.buildId && key !== receipt.buildId) candidates.receipts.delete(key)
    }
    setStudioPartialRevision(revision => revision + 1)
  }
  const studioInitialObservation: StudioInitialStageOwnerObservation = {
    automatic: studioAutomaticBlankSelection ?? null,
    selected: studioInitialSelectedTarget,
    authUserId: authScopeUserId,
    currentSessionId,
    wsSessionId,
    rawRouteSessionId: searchParams.get('session_id'),
    templateMode: templateModeOn,
    restoration: studioInitialKnownFresh ? 'none' : session.isLoadingSession ? 'pending' : session.studioFrontendTranscriptReceipt ? 'restored' : 'none',
    nativeWorkPresent: studioInitialNativeWork,
    admittedNativeOwner: studioNativeAdmittedOwnerRef.current,
    explicitBlankOwner: studioExplicitBlankOwnerRef.current,
    freshCanonicalEntry: session.studioInitialFreshCanonicalEntry,
  }
  studioInitialOwnerObservationRef.current = studioInitialObservation
  // Loading a locally assigned fresh UUID is not restoration of an unknown
  // deck. The loading branch remains authoritative; defer token observation
  // until it settles so a pending render cannot consume the first blank proof.
  if (!(session.isLoadingSession && studioInitialKnownFresh)) {
    studioInitialBlankProofRef.current = reconcileStudioInitialStageOwner(
      studioInitialBlankProofRef.current, studioInitialObservation, studioInitialRouteAdoptionRef.current,
    )
  }
  const studioInitialNativeDeferred = shouldDeferStudioInitialNative({
    enabled: studioShell,
    selected: studioInitialSelectedTarget,
    automaticBlankTarget: studioInitialBlankProofRef.current.target,
    hasOwnedSelection: studioCanvasLifecycle.hasOwnedSelection,
    viewerUrlAllowed: !LAYOUT_URL_CONFIG_ERROR && evaluateLayoutViewerUrl(studioInitialSelectedTarget.presentationUrl, LAYOUT_VIEWER_URL_POLICY).status === 'allowed',
    initialStageEligible: !session.isLoadingSession && (studioCanvasLifecycle.showLanding
      || (!isGeneratingFinal && !isGeneratingStrawman && buildNarration.phase === 'awaiting_user')),
    nativeWorkPresent: studioInitialNativeWork,
    errorPresent: Boolean(wsError || transportNotice || currentStatus?.status === 'error'
      || buildNarration.phase === 'error' || generationPanel.error || manualDeckHandoffError),
    admittedNativeOwner: studioNativeAdmittedOwnerRef.current,
    explicitBlankOwner: studioExplicitBlankOwnerRef.current,
  })
  const handleStudioNativeMounted = useCallback((owner: object) => {
    if (studioSlideComposeOwnerRef.current === owner) {
      studioNativeAdmittedOwnerRef.current = owner
      studioPartialNativeSeenScopeRef.current = studioPartialAuthority.scope
    }
  }, [studioPartialAuthority])
  const studioPartialRegistration = useMemo(() => ({
    scope: studioPartialAuthority.scope, owner: studioInitialSelectedTarget.owner,
    presentationId: effectivePresentationId, presentationUrl: effectivePresentationUrl,
    layout: null as typeof layoutServiceApis, compose: null as SlideComposeViewerApi | null,
  }), [studioPartialAuthority, studioInitialSelectedTarget.owner, effectivePresentationId, effectivePresentationUrl])
  studioPartialRenderedWorkRef.current = Boolean(generationPanel.isGenerating || generationPanel.hasActiveGenerations
    || studioFormatLoading || templateBlueprintSaving
    || Object.values(slideComposeJobs).some(job => job.status === 'building'))
  studioPartialNativeRegistrationRef.current = studioPartialRegistration
  const handleStudioPartialApiReady = useCallback((apis: typeof layoutServiceApis) => {
    if (studioPartialNativeRegistrationRef.current !== studioPartialRegistration) return
    studioPartialRegistration.layout = apis
    setLayoutServiceApis(apis)
  }, [studioPartialRegistration])
  const handleStudioPartialComposeApiReady = useCallback((apis: SlideComposeViewerApi | null) => {
    if (studioPartialNativeRegistrationRef.current !== studioPartialRegistration) return
    studioPartialRegistration.compose = apis
    handleComposeApiReady(apis)
  }, [studioPartialRegistration, handleComposeApiReady])
  studioPartialReadCurrentRef.current = context => {
    const assignment = studioPartialAssignmentRef.current
    if (!assignment) throw new Error('Partial display assignment unavailable')
    const registration = studioPartialNativeRegistrationRef.current
    const layout = registration?.layout, compose = registration?.compose
    return {
      ...studioPartialDisplayInput, assignment, versionIntent: studioPartialVersionIntentRef.current,
      receipt: studioPartialCandidateRef.current,
      selected: { owner: studioInitialSelectedTarget.owner,
        presentationId: effectivePresentationId || '', presentationUrl: effectivePresentationUrl || '' },
      native: registration && layout && compose && context ? {
        api: compose, context, readSafety: () => layout.getStudioIntroductionSafety?.() ?? null,
        isCurrent: () => studioPartialAuthority.isCurrent()
          && !studioPartialRenderedWorkRef.current && studioPartialLocalWorkRef.current.size === 0
          && studioPartialNativeRegistrationRef.current === registration
          && registration.scope === studioPartialAuthority.scope
          && registration.owner === studioSlideComposeOwnerRef.current
          && registration.layout === layout && registration.compose === compose
          && composeViewerApiRef.current === compose,
      } : null,
    }
  }
  const studioPartialIsNativeAbsent = () => studioPartialAuthority.isCurrent()
    && !studioPartialRenderedWorkRef.current && studioPartialLocalWorkRef.current.size === 0
    && studioPartialNativeRegistrationRef.current === studioPartialRegistration
    && studioSlideComposeOwnerRef.current === studioInitialSelectedTarget.owner
    && studioPartialAssignmentRef.current?.isCurrent() === true && studioInitialKnownFresh
    && !layoutServiceApis && !composeViewerApiRef.current && !studioViewerSafety
    && !studioPartialRegistration.layout && !studioPartialRegistration.compose
    && studioPartialNativeSeenScopeRef.current !== studioPartialAuthority.scope
    && (studioInitialNativeDeferred || (!effectivePresentationId && !effectivePresentationUrl))
  studioPartialNativeAbsenceRef.current = studioPartialIsNativeAbsent
  useEffect(() => {
    if (!studioShell || !effectiveBuildNarrationEnabled || !studioPartialAuthority.isCurrent()) return
    const candidate = studioPartialCandidateRef.current
    if (!candidate || candidate.presentationId === effectivePresentationId) return
    let context: StudioComposeSelectionContext | null
    try { context = studioPartialRegistration.compose?.composeCaptureSelectionContext?.() ?? null }
    catch { return }
    const readCurrent = () => {
      const read = studioPartialReadCurrentRef.current
      if (!read) throw new Error('Partial display owner retired')
      return read(context)
    }
    const transition = prepareStudioPartialStageTransition(readCurrent)
      ?? prepareStudioInitialPartialStageTransition(() => {
        const next = readCurrent()
        return { ...next, selected: { ...next.selected,
          presentationId: next.selected.presentationId || null, presentationUrl: next.selected.presentationUrl || null },
          isNativeAbsent: studioPartialNativeAbsenceRef.current ?? (() => false) }
      })
    if (!transition) return
    // React may defer/replay this updater. Recheck the captured live native
    // frame, latest Page owner/build and explicit intent at publication.
    setStudioPartialDisplayed(previous => {
      const settled = settleStudioPartialStageTransition(transition)
      if (!settled) return previous
      return settled
    })
  }, [studioShell, effectiveBuildNarrationEnabled, studioPartialAuthority, studioPartialRevision,
    buildNarration.buildId, buildNarration.buildPresentationId, buildNarration.phase,
    effectivePresentationId, effectivePresentationUrl, studioViewerSafety, layoutServiceApis,
    studioPartialRegistration, studioInitialNativeDeferred, studioInitialKnownFresh,
    generationPanel.isGenerating, generationPanel.hasActiveGenerations, studioFormatLoading,
    templateBlueprintSaving, slideComposeJobs,
    session.isLoadingSession, session.isCreatingSession])
  const studioPartialCandidate = studioPartialCandidateRef.current
  const studioPartialPending = Boolean(studioShell && effectiveBuildNarrationEnabled
    && studioPartialCandidate?.scope === studioPartialAuthority.scope
    && studioPartialCandidate.buildId === buildNarration.buildId
    && studioPartialCandidate.presentationId === buildNarration.buildPresentationId
    && studioPartialCandidate.presentationId !== effectivePresentationId
    && !templateModeOn && !templateModeSourcePresentationUrl
    && !hasStudioPartialStageVersionIntent(studioPartialVersionIntentRef.current, studioPartialAuthority, buildNarration.buildId))
  const handleStudioPartialVersionSwitch = (version: 'blank' | 'strawman' | 'final') => {
    if (!studioPartialAuthority.isCurrent() || studioSlideComposeOwnerRef.current !== studioInitialSelectedTarget.owner
      || studioPartialVersionHandlerRef.current !== handleStudioPartialVersionSwitch) return
    studioPartialVersionIntentRef.current = captureStudioPartialStageVersionIntent({
      authority: studioPartialAuthority, buildId: buildNarration.buildId, version,
    })
    setStudioPartialDisplayed(null)
    setStudioPartialRevision(revision => revision + 1)
    retireStudioVoiceOwner(); cancelOutlinePreview(); switchVersion(version)
  }
  studioPartialVersionHandlerRef.current = handleStudioPartialVersionSwitch
  const previousVersionInputs = studioPartialVersionInputsRef.current
  const studioPartialVersionObservation = previousVersionInputs?.authority === studioPartialAuthority
    && previousVersionInputs.buildId === buildNarration.buildId ? previousVersionInputs.observation : {}
  studioPartialVersionInputsRef.current = {
    authority: studioPartialAuthority, owner: studioInitialSelectedTarget.owner, buildId: buildNarration.buildId,
    observation: studioPartialVersionObservation,
  }
  // Same-owner renders may replace the private handler before its portal commits.
  // Keep the visible callback stable while still retiring old owner/build intent.
  const handleStudioPartialVersionIntent = useCallback((version: 'blank' | 'strawman' | 'final') => {
    const current = studioPartialVersionInputsRef.current
    if (!studioPartialAuthority.isCurrent() || studioSlideComposeOwnerRef.current !== studioInitialSelectedTarget.owner
      || current?.authority !== studioPartialAuthority || current.owner !== studioInitialSelectedTarget.owner
      || current.buildId !== buildNarration.buildId || current.observation !== studioPartialVersionObservation) return
    studioPartialVersionHandlerRef.current?.(version)
  }, [studioPartialAuthority, studioInitialSelectedTarget.owner, buildNarration.buildId, studioPartialVersionObservation])
  const handleStudioPartialNativeReadback = (readback: StudioPartialNativeReadback) => {
    const owner = studioInitialSelectedTarget.owner
    const current = () => studioPartialAuthority.isCurrent() && studioSlideComposeOwnerRef.current === owner
      && studioPartialNativeReadbackHandlerRef.current === handleStudioPartialNativeReadback
      && studioPartialMetadata && readback.presentationId === effectivePresentationId
      && readback.presentationUrl === effectivePresentationUrl && readback.isCurrent()
    if (!current() || !Number.isSafeInteger(readback.nativeCount) || readback.nativeCount < 1
      || !Number.isSafeInteger(readback.currentVisualIndex) || readback.currentVisualIndex < 0) return
    if (current()) currentSlideIndexRef.current = readback.currentVisualIndex
    setCurrentSlideIndex(previous => current() ? readback.currentVisualIndex : previous)
    setStudioPartialNativeIndex(previous => current() ? {
      owner, presentationId: readback.presentationId, presentationUrl: readback.presentationUrl,
      count: readback.nativeCount, index: readback.currentVisualIndex,
      isFrameCurrent: readback.isFrameCurrent, isCurrent: readback.isCurrent,
    } : previous)
    const jobs = Object.fromEntries(Object.entries(slideComposeJobsRef.current)
      .filter(([, job]) => job.target_presentation_id === readback.presentationId))
    const resolved = resolveSlideComposeVisualIndex(readback.currentVisualIndex, { slideCount: readback.nativeCount, jobs })
    if (resolved?.kind === 'slide') {
      setSelectedLayoutSlideIndex(previous => current() ? resolved.layoutIndex : previous)
    }
  }
  studioPartialNativeReadbackHandlerRef.current = handleStudioPartialNativeReadback
  // NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED: no approval gate is enabled while a build runs, is paused or stopped, or the session is over.
  const approvalGatesLocked = askGatesLocked({
    generatingFinal: isGeneratingFinal, narrationPhase: buildNarration.phase, narrationControl: buildNarration.control,
    workflowState: directorWorkflowState,
  })
  const retiredIntroActions = lockApprovalGateStatuses(
    historicalActionStatuses(messages, session.answeredActionsRef.current, session.userMessages), messages, approvalGatesLocked)
  const studioMandatoryDecision = messages.some(message => message.type === 'action_request'
    && message.session_id === (currentSessionId || wsSessionId) && !retiredIntroActions.has(message.message_id)
    && Boolean((message.payload as any).question_set || (message as ActionRequest).payload.actions.some(action =>
      action.value === 'accept_plan' || action.value === 'accept_strawman')))
  const nativeIntroTargetReady = Boolean(studioViewerSafety?.ready && studioCanvasLifecycle.hasOwnedSelection
    && studioViewerSafety.presentationId === effectivePresentationId && studioViewerSafety.presentationUrl === effectivePresentationUrl)
  const studioIntroInputs = {
    workspaceReady: studioShell && !!user && !isAuthLoading && !session.isLoadingSession
      && workspaceWidth > 0 && connected && !connecting
      && (effectivePresentationUrl && !studioInitialNativeDeferred ? nativeIntroTargetReady : studioCanvasLifecycle.showLanding),
    initialEntry: studioWelcome && !session.isResumedSession && session.userMessages.length === 0,
    activeBuild: isGeneratingFinal || isGeneratingStrawman || templateReuseAwaitingInput
      || (buildNarration.active && !['idle', 'complete'].includes(buildNarration.phase)),
    decisionPending: studioMandatoryDecision || buildNarration.phase === 'awaiting_user'
      || !!pendingActionInput || !!pendingManualDeckBuild || questionSubmissionPendingRef.current,
    errorPresent: !!wsError || currentStatus?.status === 'error' || buildNarration.phase === 'error'
      || themeSync.status === 'failed' || !!generationPanel.error || !!manualDeckHandoffError || !!studioViewerSafety?.error,
    modalOpen: showOnboarding || topUpOpen || showComposerLibrary || !!pendingManualDeckBuild
      || (!effectivePresentationUrl && workflowKey !== dismissedWorkflowKey && !!workflowAction),
    dirtyDraft: !!inputMessage.trim() || uploadedFiles.length > 0 || !!workflowBrief || templateBlueprintDirty
      || !!generationPanel.currentDraft || studioViewerEditing || !!selectedElementId || !!selectedTextBoxId
      || isElementDrawerOpen || isSlideDrawerOpen || isTemplateParamsDrawerOpen || !!studioViewerSafety?.dirty,
    workInFlight: awaitingDirectorReply || isExecutingSendRef.current || questionSubmissionPendingRef.current
      || manualDeckHandoffBusy || generationPanel.hasActiveGenerations || templateBlueprintSaving
      || templateSnapshotLoading || themeSync.status === 'syncing' || !!studioViewerSafety?.busy
      || Object.values(slideComposeJobs).some(job => job.status === 'building'),
  }

  const voiceDisplayedSessionId = currentSessionId || wsSessionId || null
  const voiceRouteSessionId = searchParams.get('session_id')
  const voiceNavigationExtras = new URLSearchParams(searchParams.toString())
  voiceNavigationExtras.delete('session_id')
  const voiceTranscriptOwned = Boolean(studioVoiceTranscriptReceipt?.isCurrent()
    && studioVoiceTranscriptReceipt.userId === authScopeUserId
    && studioVoiceTranscriptReceipt.sessionId === voiceDisplayedSessionId)
  const voiceDisplayedOwned = Boolean(voiceDisplayedSessionId && voiceDisplayedSessionId === wsSessionId
    && questionSubmissionScopeRef.current.active
    && questionSubmissionScopeRef.current.userId === authScopeUserId
    && questionSubmissionScopeRef.current.sessionId === voiceDisplayedSessionId
    && (voiceRouteSessionId === voiceDisplayedSessionId || studioInitialKnownFresh
      || (!currentSessionId && (!voiceRouteSessionId || voiceRouteSessionId === 'new'))))
  const voiceChatVisible = studioShell && showChat && isDeckDrawerOpen && workspaceLayout.chatVisible && !studioViewerFullscreen
  const studioDirectorCall = useStudioDirectorCall({
    enabled: STUDIO_VOICE_INTERACTIVE_ENABLED,
    authority: studioVoiceOwnerRef.current!,
    observation: {
      authUserId: authScopeUserId, sessionId: voiceDisplayedSessionId,
      routeSessionId: voiceRouteSessionId, navigationExtras: voiceNavigationExtras.toString(),
      presentationId: effectivePresentationId, presentationUrl: effectivePresentationUrl,
      activeVersion, templateIdentity: JSON.stringify([templateModeOn, activeTemplate?.id ?? null, templateModeSourcePresentationId]),
      transcriptEpoch: studioVoiceTranscriptReceipt?.epoch ?? null,
      restoreReceipt: session.studioFrontendTranscriptReceipt,
      eligible: STUDIO_VOICE_INTERACTIVE_ENABLED && voiceTranscriptOwned && voiceDisplayedOwned
        && voiceChatVisible && !isAuthLoading && !session.isLoadingSession && !session.isCreatingSession
        && connected && !connecting && !transportNotice?.requiresResend && !studioIntroInputs.modalOpen,
      freshAssignment: studioInitialKnownFresh ? session.studioInitialFreshCanonicalEntry : null,
      automaticBlank: studioAutomaticBlankSelection ?? null,
    },
    messages, userMessages: session.userMessages,
    userMessageIdsRef: session.userMessageIdsRef, userMessageContentMapRef: session.userMessageContentMapRef,
    answeredActionsRef: session.answeredActionsRef, askGatesLocked: approvalGatesLocked, messageListSessionId: currentSessionId,
    transcript: studioVoiceTranscriptReceipt, chatRootRef: studioVoiceChatRootRef,
    transcriptRootRef: studioVoiceTranscriptRootRef, textareaRef,
  })

  return (
    <StudioIntroductionProvider enabled={studioShell} eligibility={studioIntroInputs}
      getEligibility={() => {
        const native = effectivePresentationUrl && !studioInitialNativeDeferred ? layoutServiceApis?.getStudioIntroductionSafety?.() : null
        const targetReady = !effectivePresentationUrl || studioInitialNativeDeferred || Boolean(native?.ready && studioCanvasLifecycle.hasOwnedSelection
          && native.presentationId === effectivePresentationId && native.presentationUrl === effectivePresentationUrl)
        return { ...studioIntroInputs, workspaceReady: studioIntroInputs.workspaceReady && targetReady,
          dirtyDraft: studioIntroInputs.dirtyDraft || !!native?.dirty,
          errorPresent: studioIntroInputs.errorPresent || !!native?.error,
          workInFlight: studioIntroInputs.workInFlight || !!native?.busy
            || isExecutingSendRef.current || questionSubmissionPendingRef.current }
      }}>
    <div data-studio-v4-shell={studioShell ? "true" : undefined} data-studio-v4-tokens={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === 'true' ? 'true' : undefined} className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {studioShell && <StudioRail homeHref="https://deckster.xyz" sessionUsage={<TokenUsageStrip tokenUsage={tokenUsage} displayMode="counter" />} />}
      {studioShell && !effectivePresentationUrl && !session.isLoadingSession && workflowKey !== dismissedWorkflowKey && <>
        <ThemePanel isOpen={workflowAction === 'theme' && !savedThemeWorkflowId} onClose={() => setDismissedWorkflowKey(workflowKey)} presentationId={null} buildThemeSelection={buildThemeSelection} themeSync={themeSync} selectionLocked={generationSelectionsLocked} onBuildThemeChange={handleBuildThemeChange} />
        <Dialog open={workflowAction === 'templates' || workflowAction === 'master'} onOpenChange={open => { if (!open) setDismissedWorkflowKey(workflowKey) }}>
          <DialogContent data-studio-v4-dialog="workflow"><DialogHeader><DialogTitle>{workflowAction === 'master' ? 'Open a deck to edit its footer and logo' : 'Choose a template'}</DialogTitle><DialogDescription>{workflowAction === 'master' ? 'Footer and logo belong to a presentation. Open an existing deck or build one with Director first.' : 'Choose the saved structure you want to reuse. Your message is sent only when you press Send.'}</DialogDescription></DialogHeader>
            <div data-studio-workflow-body="true">{workflowAction === 'templates' && templateBuilderEnabled ? <TemplatePickerContent mode="generation" standalone preferredTemplateId={searchParams.get('studio_item')} onSelect={template => { handleSelectTemplate(template); setDismissedWorkflowKey(workflowKey) }} /> : workflowAction === 'templates' ? <p>Templates are not enabled in this environment.</p> : <div className="flex gap-3"><button type="button" onClick={() => router.push('/dashboard')}>Open Decks</button><button type="button" onClick={() => setDismissedWorkflowKey(workflowKey)}>Continue in chat</button></div>}</div>
          </DialogContent>
        </Dialog>
      </>}

      {/* Main Content */}
      <div data-studio-v4-shell-column="true" className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <BuilderHeader
          wsError={wsError}
          onNewPresentation={handleNewChatWrapped}
          deckTitle={slideStructure?.metadata?.main_title || "Studio"}
          onOpenChatHistory={() => setShowChatHistory((prev) => !prev)}
          isChatHistoryOpen={showChatHistory}
          toolbarSlotRef={setToolbarPortalTarget}
          onToolbarInteract={studioOverlayWorkspace ? revealStudioStage : undefined}
        />

        {/* Main Content Area */}
        <div ref={workspaceRef} data-studio-intro-surface={studioShell ? "builder" : undefined} data-studio-v4-shell-workspace="true" data-studio-workspace-welcome={studioWelcome ? "true" : undefined} data-studio-workspace-mode={studioShell ? workspaceLayout.dualPane ? 'dual' : 'single' : undefined} data-studio-workspace-overlay={studioShell ? String(studioOverlayWorkspace) : undefined} data-studio-panel-keep-canvas={studioShell && STUDIO_PANEL_KEEP_CANVAS_ENABLED ? "true" : undefined} className="flex-1 flex relative overflow-hidden" style={studioShell ? { '--studio-collapsed-inspector-width': `${studioTemplateVisible && templateParamsCollapsed ? TEMPLATE_PANEL_COLLAPSED_WIDTH : 0}px` } as React.CSSProperties : undefined}>
          {studioShell && !workspaceLayout.dualPane && (
            <div data-studio-workspace-switch="true" role="group" aria-label="Workspace pane">
              {studioOverlayWorkspace && <button type="button" aria-pressed={studioStageSelected || (!workspaceLayout.chatVisible && !workspaceLayout.inspectorVisible)} onClick={() => { retireStudioVoiceOwner(); setStudioStageSelected(true) }}>Stage</button>}
              <button type="button" aria-pressed={studioOverlayWorkspace ? workspaceLayout.chatVisible : workspaceLayout.presentedPane === 'chat'} onClick={() => { selectWorkspacePane('chat'); if (!showChat) setShowChat(true) }}>Chat</button>
              <button type="button" aria-pressed={studioOverlayWorkspace ? workspaceLayout.inspectorVisible : workspaceLayout.presentedPane === 'inspector'} disabled={!activeInspector} onClick={() => selectWorkspacePane('inspector')}>Inspector</button>
            </div>
          )}
          {studioShell && showStudioInspectorTabs && (
            <div data-studio-inspector-switch="true" data-studio-workspace-visible={String(workspaceLayout.inspectorVisible)} style={{ width: studioInspectorWidth }} role="group" aria-label="Inspector panels">
              {availableInspectors.map(inspector => (
                <button key={inspector} type="button" aria-pressed={activeInspector === inspector} onClick={() => { setPreferredInspector(inspector); selectWorkspacePane('inspector') }}>{inspector === 'element' ? 'Element' : inspector === 'slide' ? 'Slide' : 'Template'}</button>
              ))}
            </div>
          )}
          {isTemplateParamsDrawerOpen && (
            <div data-studio-workspace-drawer={studioShell ? 'template' : undefined} data-studio-workspace-visible={studioShell ? String(studioTemplateVisible) : undefined} data-studio-inspector-tabs={studioShell && showStudioInspectorTabs ? 'true' : undefined} aria-hidden={studioShell && !studioTemplateVisible ? true : undefined} {...(studioShell && !studioTemplateVisible ? { inert: true } : {})} style={studioShell ? { width: templateParamsCollapsed ? TEMPLATE_PANEL_COLLAPSED_WIDTH : studioInspectorWidth } : { display: 'contents' }}>
            <TemplateParamsPanel
              isOpen={isTemplateParamsDrawerOpen}
              width={studioShell ? studioInspectorWidth : drawerWidth}
              collapsed={templateParamsCollapsed}
              snapshot={templateSnapshot}
              currentSlideIndex={activeTemplateSlideIndex}
              overrides={templateOverrides}
              loading={templateSnapshotLoading}
              blueprintEditorV2Enabled={blueprintEditorV2Enabled}
              blueprintDirty={templateBlueprintDirty}
              blueprintSaving={templateBlueprintSaving}
              selectedElementId={selectedTemplateElementId}
              onCollapsedChange={setTemplateParamsCollapsed}
              onResizeStart={studioShell ? (event) => handleStudioResizeStart(event, 'inspector') : handleDrawerResizeStart}
              onOverrideChange={handleTemplateOverrideChange}
              onBlueprintChange={handleTemplateBlueprintChange}
              onSaveBlueprint={handleTemplateBlueprintSave}
            />
            </div>
          )}

          {/* === Element Drawer === */}
          <div
            data-builder-panel="element"
            data-studio-workspace-drawer={studioShell ? 'element' : undefined}
            data-studio-workspace-visible={studioShell ? String(studioElementVisible) : undefined}
            data-studio-workspace-open={studioShell ? String(isElementDrawerOpen) : undefined}
            data-studio-inspector-tabs={studioShell && showStudioInspectorTabs ? 'true' : undefined}
            className={cn(
              "absolute inset-y-0 left-0 ease-out",
              isResizingDrawer ? "" : "transition-transform duration-300"
            )}
            style={{
              width: studioShell ? studioInspectorWidth : drawerWidth,
              transform: studioShell ? 'none' : isElementDrawerOpen ? 'translateX(0px)' : `translateX(-${drawerWidth}px)`,
              zIndex: isElementDrawerOpen ? 10 + panelZIndices.element : 60,
              pointerEvents: isElementDrawerOpen ? 'auto' : 'none',
            }}
          >
            {/* Panel area */}
            <div
              className={`absolute inset-y-0 left-0 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-900 dark:text-slate-100 overflow-hidden ${isElementDrawerOpen ? 'shadow-xl' : ''}`}
              data-studio-workspace-content={studioShell ? 'true' : undefined}
              aria-hidden={studioShell && !studioElementVisible ? true : undefined}
              {...(studioShell && !studioElementVisible ? { inert: true } : {})}
              style={{ width: studioShell ? studioInspectorWidth : drawerWidth }}
            >
              {studioShell && studioFormatOpen && <>
                {studioFormatLoading && <p role="status" className="px-4 py-3 text-sm">Reading selected element properties…</p>}
                {studioFormatError && <div role="alert" className="px-4 py-3 text-sm">{studioFormatError}</div>}
                <StudioFormatInspector isOpen={studioFormatOpen} target={studioFormatTarget} readSnapshot={studioFormatTarget ?? undefined}
                  busy={studioFormatBusy || studioFormatLoading} onClose={closeStudioFormat}
                  onSendCommand={handleStudioFormatCommand}/>
              </>}
              {features.useTextLabsGeneration && (
                <GenerationPanel
                  isOpen={generationPanel.isOpen}
                  activationId={generationPanel.activationId}
                  draftKey={generationPanel.draftKey}
                  draft={generationPanel.currentDraft}
                  onDraftChange={generationPanel.updateCurrentDraft}
                  elementType={generationPanel.elementType}
                  onClose={() => {
                    generationPanel.closePanel()
                  }}
                  onGenerate={handleApprovedTextLabsGenerate}
                  onElementTypeChange={generationPanel.changeElementType}
                  isGenerating={generationPanel.isGenerating}
                  error={generationPanel.error}
                  retryStrategy={generationPanel.retryStrategy}
                  slideIndex={currentSlideIndex}
                  presentationId={effectivePresentationId}
                  elementContext={generationElementContext}
                  mode={generationPanel.mode}
                  getTemplateSlotCatalog={getTemplateSlotCatalog}
                  existingTextTarget={generationPanel.refineContext ? {
                    elementId: generationPanel.refineContext.elementId,
                    semanticRole: generationPanel.refineContext.semanticRole,
                    slotName: generationPanel.refineContext.slotName,
                    slotKind: generationPanel.refineContext.slotKind,
                    accessoryType: generationPanel.refineContext.accessoryType,
                    generationConfig: generationPanel.refineContext.generationConfig,
                  } : null}
                  existingInfographicTarget={
                    generationPanel.refineContext && generationPanel.elementType === 'INFOGRAPHIC'
                      ? {
                          elementId: generationPanel.refineContext.elementId,
                          rendererType: generationPanel.refineContext.existingElement.renderer_type as string | null,
                          mode: generationPanel.refineContext.existingElement.mode as string | null,
                          metadata: generationPanel.refineContext.existingElement.properties as Record<string, unknown> | null,
                          generationConfig: generationPanel.refineContext.generationConfig,
                          content: generationPanel.refineContext.existingElement.content,
                        }
                      : null
                  }
                  existingDiagramTarget={generationPanel.refineContext ? {
                    subtype: generationPanel.refineContext.diagramSubtype,
                    generationConfig: generationPanel.refineContext.generationConfig as import('@/types/textlabs').DiagramGenerationConfig | null,
                    zIndex: generationPanel.refineContext.zIndex,
                  } : null}
                  researchMode={generationPanel.researchMode}
                  researchWeb={generationPanel.researchWeb}
                  researchUploadedDocs={generationPanel.researchUploadedDocs}
                  researchKnowledgeGraph={generationPanel.researchKnowledgeGraph}
                  researchCapabilities={elementResearchCapabilities}
                  onResearchModeChange={generationPanel.setResearchMode}
                  onResearchWebChange={generationPanel.setResearchWeb}
                  onResearchUploadedDocsChange={generationPanel.setResearchUploadedDocs}
                  onResearchKnowledgeGraphChange={generationPanel.setResearchKnowledgeGraph}
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
              {process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true' && <div ref={setAddSlideV2Host} data-studio-add-slide-v2-host="true" />}
            </div>

            {/* Handle */}
            {((features.useTextLabsGeneration && generationPanel.isOpen) || addSlideV2Open) && (
              <button
                type="button"
                onClick={() => {
                  if (studioShell && !studioElementVisible) { setPreferredInspector('element'); selectWorkspacePane('inspector') }
                  else { generationPanel.closePanel(); setAddSlideV2Open(false) }
                }}
                className={cn(
                  "absolute top-[33%] -translate-y-1/2",
                  "w-4 py-3 rounded-r-md shadow-sm border border-l-0",
                  "flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                  "transition-colors pointer-events-auto",
                  "bg-purple-200 hover:bg-purple-300 border-purple-400 text-purple-700 dark:bg-purple-900/50 dark:hover:bg-purple-800/60 dark:border-purple-700 dark:text-purple-200"
                )}
                style={{ left: drawerWidth }}
                data-studio-drawer-handle={studioShell ? 'element' : undefined}
              aria-expanded={studioShell ? studioElementVisible : undefined}
              title={studioShell && !studioElementVisible ? 'Show element panel' : 'Close element panel'}
              >
                <ChevronLeft className="h-2.5 w-2.5" />
                <span className="[writing-mode:vertical-rl] text-[9px] font-semibold uppercase tracking-wider select-none leading-none">
                  Element
                </span>
              </button>
            )}
          </div>

          {/* === Slide Drawer === */}
          {features.slideComposerEnabled && (
            <div
              data-builder-panel="slide"
              data-studio-workspace-drawer={studioShell ? 'slide' : undefined}
              data-studio-workspace-visible={studioShell ? String(studioSlideVisible) : undefined}
              data-studio-workspace-open={studioShell ? String(isSlideDrawerOpen) : undefined}
              data-studio-inspector-tabs={studioShell && showStudioInspectorTabs ? 'true' : undefined}
              className={cn(
                "absolute inset-y-0 left-0 ease-out",
                isResizingDrawer ? "" : "transition-transform duration-300"
              )}
              style={{
                width: studioShell ? studioInspectorWidth : drawerWidth,
                transform: studioShell ? 'none' : isSlideDrawerOpen ? 'translateX(0px)' : `translateX(-${drawerWidth}px)`,
                zIndex: isSlideDrawerOpen ? 10 + panelZIndices.slide : 60,
                pointerEvents: isSlideDrawerOpen ? 'auto' : 'none',
              }}
            >
              {/* Panel area */}
              <div
                className={`absolute inset-y-0 left-0 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-900 dark:text-slate-100 overflow-hidden ${isSlideDrawerOpen ? 'shadow-xl' : ''}`}
                data-studio-workspace-content={studioShell ? 'true' : undefined}
                aria-hidden={studioShell && !studioSlideVisible ? true : undefined}
                {...(studioShell && !studioSlideVisible ? { inert: true } : {})}
                style={{ width: studioShell ? studioInspectorWidth : drawerWidth }}
              >
                <SlideGenerationPanel
                  isOpen={showFormatPanel}
                  onClose={() => setShowFormatPanel(false)}
                  mode={slideGenerationMode}
                  refineTarget={slideRefineTarget}
                  currentSlide={selectedLayoutSlideIndex + 1}
                  currentLayout={currentSlideLayout}
                  sessionId={resolveSlideComposeSessionId({
                    deckOwnerSessionId,
                    currentSessionId,
                    wsSessionId,
                  })}
                  presentationId={effectivePresentationId}
                  research={{
                    useUploadedDocuments: uploadedFiles.some(isAttachedUpload) || Boolean(sessionStoreName),
                    useWebSearch: webSearchEnabled,
                    useDeepResearch: researchEnabled && webSearchEnabled,
                    useKnowledgeGraph: canUseKnowledgeGraph && knowledgeGraphEnabled,
                  }}
                  buildThemeSelection={buildThemeSelection}
                  activeBuildThemeProfileName={activeBuildThemeProfileForSelection?.name ?? null}
                  enabled={features.slideComposerEnabled}
                  studioOwner={studioShell ? studioSlideComposeOwnerRef.current : undefined}
                  onSelectionRequestStart={studioShell ? handleStudioSyncSelectionRequestStart : undefined}
                  onBuilt={handleSlideComposerBuilt}
                  onAccepted={handleSlideComposerAccepted}
                  jobEvent={slideComposePanelEvent}
                />
              </div>

              {/* Handle */}
              <button
                type="button"
                onClick={() => {
                  if (studioShell && isSlideDrawerOpen && !studioSlideVisible) { setPreferredInspector('slide'); selectWorkspacePane('inspector'); return }
                  const next = !showFormatPanel
                  setShowFormatPanel(next)
                  if (next) {
                    setSlideGenerationMode('compose')
                    setSlideRefineTarget(null)
                    bringToFront('slide')
                  }
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
                data-studio-drawer-handle={studioShell ? 'slide' : undefined}
              aria-expanded={studioShell ? studioSlideVisible : undefined}
              title={studioShell && isSlideDrawerOpen && !studioSlideVisible ? 'Show slide panel' : showFormatPanel ? 'Close slide panel' : 'Open slide panel'}
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
            data-builder-panel="deck"
            data-studio-workspace-drawer={studioShell ? 'deck' : undefined}
            data-studio-workspace-visible={studioShell ? String(workspaceLayout.chatVisible) : undefined}
            data-studio-workspace-open={studioShell ? String(isDeckDrawerOpen) : undefined}
            className={cn(
              "absolute inset-y-0 left-0 ease-out",
              isResizingDrawer ? "" : "transition-transform duration-300"
            )}
            style={{
              width: studioShell ? studioChatWidth : drawerWidth,
              transform: studioShell ? 'none' : isDeckDrawerOpen ? 'translateX(0px)' : `translateX(-${drawerWidth}px)`,
              zIndex: isDeckDrawerOpen ? 10 + panelZIndices.deck : 60,
              pointerEvents: isDeckDrawerOpen ? 'auto' : 'none',
            }}
          >
            {/* Panel area */}
            <div
              ref={studioVoiceChatRootRef}
              className={`absolute inset-y-0 left-0 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col ${isDeckDrawerOpen ? 'shadow-xl' : ''}`}
              data-studio-workspace-content={studioShell ? 'true' : undefined}
              aria-hidden={studioShell && !workspaceLayout.chatVisible ? true : undefined}
              {...(studioShell && !workspaceLayout.chatVisible ? { inert: true } : {})}
              style={{ width: studioShell ? studioChatWidth : drawerWidth }}
            >
              {showChat && (
                <>
                  {studioShell && <StudioDirectorHeader connectionState={connectionState} isLoadingSession={session.isLoadingSession}
                    actions={STUDIO_VOICE_INTERACTIVE_ENABLED ? <DirectorCallEntry call={studioDirectorCall.call} disabled={!studioDirectorCall.eligible} /> : undefined} />}
                  {studioShell && <StudioDirectorNotice
                    className="mx-3 mt-2"
                    notice={transportNotice?.sessionId === (currentSessionId || wsSessionId) ? transportNotice : null}
                    handoffStatus={handoffRequestStatus?.sessionId === (currentSessionId || wsSessionId) ? handoffRequestStatus : null}
                  />}
                  {studioShell && handoffStorageWarning?.sessionId === (currentSessionId || wsSessionId) && (
                    <p role="alert" className="mx-3 mt-2 rounded-lg border border-[var(--ss-line)] bg-[var(--ss-panel)] p-3 text-xs text-[var(--ss-text)]">
                      {handoffStorageWarning.text}
                    </p>
                  )}
                  <TokenUsageStrip
                    displayMode={studioShell ? "warning" : "all"}
                    tokenUsage={tokenUsage}
                    quota={quota}
                    onTopUp={() => {
                      setTopUpReason(undefined)
                      setTopUpOpen(true)
                    }}
                  />

                  {STUDIO_VOICE_INTERACTIVE_ENABLED && <DirectorCallPanel
                    call={studioDirectorCall.call} awaitingReply={awaitingDirectorReply}
                    building={isGeneratingFinal || isGeneratingStrawman}
                    latestDirectorText={studioDirectorCall.latestDirectorText}
                    latestUserText={studioDirectorCall.latestUserText}
                    pendingAsk={studioDirectorCall.pendingAsk} isCurrentAsk={studioDirectorCall.isCurrentAsk}
                    getQuestionRoot={studioDirectorCall.getQuestionRoot} focusComposer={studioDirectorCall.focusComposer}
                  />}
                  <ScrollArea className="flex-1">
                    <div ref={studioVoiceTranscriptRootRef} className="px-3 py-4 space-y-4">
                      <MessageList
                        sessionId={currentSessionId}
                        presentationContext={studioShell && effectivePresentationUrl && (!isBlankPresentation || (slideStructure?.slides ?? []).length > 0) ? {
                          title: slideStructure?.metadata?.main_title ?? null,
                          slideCount: effectiveSlideCount,
                        } : undefined}
                        connectionState={studioShell ? undefined : connected ? 'connected' : connecting ? 'connecting' : wsError ? 'error' : 'disconnected'}
                        onDraftPrompt={text => {
                          if (inputMessage.trim()) setWorkflowBrief(text)
                          else { setInputMessage(text); requestAnimationFrame(() => textareaRef.current?.focus()) }
                        }}
                        studioFrontendTranscriptReceipt={studioShell ? session.studioFrontendTranscriptReceipt : null}
                        studioGreetingSafety={studioShell ? {
                          pendingRestoration: session.isLoadingSession,
                          pendingWork: isExecutingSendRef.current || questionSubmissionPendingRef.current || session.isCreatingSession,
                          noticePresent: Boolean(wsError || transportNotice || currentStatus?.status === 'error'),
                          hasUserIntent: session.hasStudioUserIntent,
                        } : undefined}
                        userMessages={session.userMessages}
                        messages={messages}
                        userMessageIdsRef={session.userMessageIdsRef}
                        userMessageContentMapRef={session.userMessageContentMapRef}
                        hasSeenWelcomeRef={session.hasSeenWelcomeRef}
                        answeredActionsRef={session.answeredActionsRef}
                        onActionClick={handleActionClick}
                        askGatesLocked={approvalGatesLocked}
                        onSubmitAnswers={async (text: string, displayText?: string) => {
                          const origin = { ...questionSubmissionScopeRef.current }
                          const isCurrentSubmission = () => (
                            questionSubmissionScopeRef.current.active &&
                            questionSubmissionScopeRef.current.generation === origin.generation &&
                            questionSubmissionScopeRef.current.sessionId === origin.sessionId &&
                            questionSubmissionScopeRef.current.userId === origin.userId
                          )
                          if (!origin.active || origin.sessionId !== (currentSessionId || wsSessionId) ||
                              !text.trim() || !preflightDirectorTurn('answers')) return
                          session.markStudioUserIntent()
                          questionSubmissionPendingRef.current = true
                          try {
                            // Keep the native question prose and compact echo/options.
                            // A true return means browser transport accepted the bytes,
                            // not that the Director or persistence acknowledged them.
                            let success = false
                            try {
                              success = await sendMessageWhenConnected(text, undefined, undefined, {
                                displayText,
                                deepResearch: researchEnabled,
                                webSearch: webSearchEnabled,
                                extendedGeneration: extendedGenerationEnabled,
                                useKnowledgeGraph: showKnowledgeGraphToggle && knowledgeGraphEnabled,
                                fileUpload: !!sessionStoreName,
                                storeName: sessionStoreName,
                                ...(deckIdentity ? { deckIdentity } : {}),
                              }, undefined, isCurrentSubmission)
                            } catch (error) {
                              console.warn('Could not send Director answers:', error)
                            }
                            if (!isCurrentSubmission()) return
                            if (success !== true) {
                              toast({
                                title: "Couldn't reach the Director",
                                description: 'Your answers were not sent. They are still in the question card; check your connection and try again.',
                                variant: 'destructive',
                              })
                              return
                            }
                            const echo = displayText || text
                            const ts = Date.now()
                            const mid = `user-qa-${ts}`
                            session.setUserMessages(prev => [...prev, { id: mid, text: echo, timestamp: ts }])
                            if (currentSessionId && persistence) {
                              persistence.queueMessage({
                                message_id: mid,
                                session_id: currentSessionId,
                                timestamp: new Date(ts).toISOString(),
                                type: 'chat_message',
                                payload: { text: echo }
                              } as unknown as DirectorMessage, echo)
                            }
                          } finally {
                            questionSubmissionPendingRef.current = false
                          }
                        }}
                        messagesEndRef={messagesEndRef}
                        slideContextByIndex={slideContextByIndex}
                        ephemeralFadeToken={ephemeralFadeToken}
                        ephemeralMessageIds={ephemeralMessageIds}
                        onEphemeralFadeComplete={clearEphemeralIds}
                        currentStatus={currentStatus}
                        isGeneratingFinal={isGeneratingFinal}
                        suppressEphemeral={effectiveBuildNarrationEnabled}
                      />
                      {STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED && blockedSendNotice && (
                        <div ref={blockedSendNoticeRef}>
                          <StudioBlockedSendNotice notice={blockedSendNotice} onDismiss={() => setBlockedSendNotice(null)} />
                        </div>
                      )}
                      {/* Template Ingest (C-5, M-6): cancel the in-flight ingest job */}
                      {process.env.NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED === 'true' && templateIngestJobId && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleCancelTemplateIngest}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline underline-offset-2 transition-colors"
                          >
                            Cancel import
                          </button>
                        </div>
                      )}
                      {/* Template Ingest (C-7) review cards: original slide PNGs + fidelity */}
                      {templateIngestResult?.per_slide_fidelity && templateIngestResult.per_slide_fidelity.length > 0 && (
                        <TemplateIngestReviewCards slides={templateIngestResult.per_slide_fidelity} />
                      )}
                    </div>
                  </ScrollArea>

                  {effectiveBuildNarrationEnabled && (
                    <DirectorPresence narration={buildNarration} currentStatus={currentStatus} loadingSession={studioShell ? session.isLoadingSession : undefined} />
                  )}

                  {workflowBrief && <div className="studio-brief-handoff" role="region" aria-label="Brief ready">
                    <div><strong>Your brief is ready</strong><p>{inputMessage.trim() ? 'Use it to replace the current unsent message, or keep your message.' : 'Add it to the composer, review it, then send when ready.'}</p></div>
                    <button type="button" onClick={() => resolveWorkflowBrief(true)}>Use brief</button>
                    <button type="button" onClick={() => resolveWorkflowBrief(false)}>Keep my message</button>
                  </div>}
                  <ChatInput
                    composerTextareaRef={studioShell ? textareaRef : undefined}
                    studioSavedThemeRequest={savedThemeWorkflowId ? { id: savedThemeWorkflowId, key: workflowKey } : undefined}
                    inputMessage={inputMessage}
                    onInputChange={setInputMessage}
                    mentionSlides={
                      // MDC P6: @slide picker source (flag-gated inside ChatInput)
                      (slideStructure?.slides || []).map((sl: { title?: string; slide_id?: string }, i: number) => ({
                        index: i, title: sl?.title || '', slide_id: sl?.slide_id ?? null,
                      }))
                    }
                    awaitingReply={awaitingDirectorReply}
                    onStopAwaiting={stopAwaitingReply}
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
                    researchSettingsLocked={researchSettingsLocked}
                    researchEnabled={researchEnabled}
                    onResearchEnabledChange={handleResearchEnabledChange}
                    webSearchEnabled={webSearchEnabled}
                    onWebSearchEnabledChange={handleWebSearchEnabledChange}
                    knowledgeGraphEnabled={knowledgeGraphEnabled}
                    onKnowledgeGraphEnabledChange={setKnowledgeGraphEnabled}
                    showKnowledgeGraphToggle={showKnowledgeGraphToggle}
                    knowledgeGraphAccess={knowledgeGraphAccess}
                    onKnowledgeGraphAccessClick={async () => {
                      if (knowledgeGraphAccess === 'locked') {
                        router.push('/pricing')
                        return
                      }
                      const enabled = await subscribeToKnowledgeGraph()
                      if (enabled) {
                        setKnowledgeGraphEnabled(true)
                        toast({
                          title: 'Knowledge enabled',
                          description: 'This deck can now use the knowledge you have chosen to connect.',
                        })
                      } else {
                        toast({
                          title: 'Could not enable Knowledge',
                          description: 'Open Knowledge settings to check access or try again.',
                          variant: 'destructive',
                        })
                      }
                    }}
                    isReady={isReady}
                    isLoadingSession={session.isLoadingSession}
                    connected={connected}
                    showConnectionStatus={!studioShell}
                    connecting={connecting}
                    user={user}
                    currentSessionId={currentSessionId}
                    onRequestSession={session.handleRequestSession}
                    templateBuilderEnabled={templateBuilderEnabled}
                    activeTemplate={activeTemplate}
                    onSelectTemplate={handleSelectTemplate}
                    onOpenComposerLibrary={composerLibraryEnabled ? () => setShowComposerLibrary(true) : undefined}
                    onClearTemplate={handleClearTemplate}
                    templateSelectionLocked={generationSelectionsLocked}
                    isTemplateReuseRunning={Boolean(activeTemplate && isGeneratingFinal)}
                    onCancelTemplateReuse={handleCancelTemplateReuse}
                    buildTheme={buildThemeSelection}
                    onBuildThemeChange={handleBuildThemeChange}
                    activeBuildThemeProfile={activeBuildThemeProfileForSelection}
                    onActiveBuildThemeProfileChange={handleActiveBuildThemeProfileChange}
                    themeSyncStatus={themeSync.status}
                    themeSyncError={themeSync.error}
                  />
                </>
              )}
            </div>

            {/* Handle */}
            <button
              type="button"
              onClick={() => {
                if (studioShell && isDeckDrawerOpen && !workspaceLayout.chatVisible) { selectWorkspacePane('chat'); return }
                const next = !showChat
                if (!next) retireStudioVoiceOwner()
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
              data-studio-drawer-handle={studioShell ? 'director' : undefined}
              aria-expanded={studioShell ? workspaceLayout.chatVisible : undefined}
              title={studioShell && isDeckDrawerOpen && !workspaceLayout.chatVisible ? 'Show chat panel' : showChat ? 'Close chat panel' : 'Open chat panel'}
            >
              {isDeckDrawerOpen ? (
                <ChevronLeft className="h-2.5 w-2.5" />
              ) : (
                <ChevronRight className="h-2.5 w-2.5" />
              )}
              <span className="[writing-mode:vertical-rl] text-[9px] font-semibold uppercase tracking-wider select-none leading-none">
                {studioShell ? 'Director' : 'Deck'}
              </span>
            </button>
          </div>

          {!studioShell && showDrawerResizeHandle && (
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

          {studioShell && !studioOverlayWorkspace && (['chat', 'inspector'] as const).map(side => {
            const visible = side === 'chat' ? workspaceLayout.chatVisible : workspaceLayout.inspectorVisible && !(activeInspector === 'template' && templateParamsCollapsed)
            if (!visible) return null
            const width = side === 'chat' ? studioChatWidth : studioInspectorWidth
            return (
              <div
                key={side}
                data-studio-workspace-resize={side}
                role="separator"
                tabIndex={0}
                aria-orientation="vertical"
                aria-label={side === 'chat' ? 'Resize chat panel' : 'Resize inspector panel'}
                aria-valuenow={Math.round(width)}
                aria-valuemin={Math.round(Math.min(width, side === 'chat' ? 280 : 320))}
                aria-valuemax={Math.round(side === 'chat' ? workspaceLayout.chatMax : workspaceLayout.inspectorMax)}
                title="Drag or use arrow keys to resize; Home resets width"
                onMouseDown={event => handleStudioResizeStart(event, side)}
                onKeyDown={event => handleStudioResizeKey(event, side)}
                onDoubleClick={() => persistStudioPaneWidth(side, side === 'chat' ? 304 : DEFAULT_DRAWER_WIDTH)}
                style={{ [side === 'chat' ? 'left' : 'right']: width - 3 }}
              />
            )
          })}

          {/* Presentation fills the area, shifts right when any drawer is open */}
          <div
            data-studio-v4-shell-presentation="true"
            data-studio-canvas-covered={studioCanvasCovered ? "true" : undefined}
            aria-hidden={studioCanvasCovered ? true : undefined}
            {...(studioCanvasCovered ? { inert: true } : {})}
            className={cn(
              "flex-1 min-w-0 min-h-0 flex flex-col",
              STUDIO_PANEL_KEEP_CANVAS_ENABLED
                ? presentationWrapperTransition({ isResizingDrawer, keepCanvas: studioShell })
                : isResizingDrawer ? "" : "transition-[margin] duration-300 ease-out"
            )}
            style={studioShell ? { marginLeft: workspaceLayout.left, marginRight: workspaceLayout.right } : { marginLeft: drawerOffset }}
          >
          {session.isLoadingSession ? (
            studioShell ? <StudioWaitingState scope="canvas" message="Loading session..." /> : (
            <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-slate-800 h-full">
              <div className="text-center">
                <div className="h-8 w-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">Loading session...</p>
              </div>
            </div>
            )
          ) : (
          <PresentationArea
            onStudioFormatRequested={studioShell ? handleStudioFormatRequested : undefined}
            studioFormatBusy={studioShell ? studioFormatBusy : undefined}
            studioIntroReplay={studioShell ? <StudioIntroductionButton className="studio-canvas-intro-replay" /> : undefined}
            onEditModeChange={studioShell ? setStudioViewerEditing : undefined}
            onStudioIntroductionSafetyChange={studioShell ? handleStudioViewerSafety : undefined}
            studioCanvasLifecycle={studioShell ? studioCanvasLifecycle : undefined}
            studioInitialNativeDeferred={studioInitialNativeDeferred}
            studioPartialStagePending={studioShell ? studioPartialPending : undefined}
            studioPartialArtifact={studioShell ? studioPartialMetadata : undefined}
            onStudioPartialNativeReadback={studioShell ? handleStudioPartialNativeReadback : undefined}
            studioNativeOwner={studioShell ? studioSlideComposeOwnerRef.current : undefined}
            onStudioNativeMounted={studioShell ? handleStudioNativeMounted : undefined}
            showOutlinePreview={showOutlinePreview}
            awaitingDirectorReply={studioShell ? awaitingDirectorReply : undefined}
            studioWorkflowRequest={viewerWorkflowRequest}
            presentationUrl={effectivePresentationUrl}
            presentationId={effectivePresentationId}
            slideCount={effectiveSlideCount}
            slideStructure={effectiveSlideStructure}
            strawmanPreviewUrl={strawmanPreviewUrl}
            finalPresentationUrl={finalPresentationUrl}
            activeVersion={effectiveActiveVersion}
            isBlankPresentation={effectiveIsBlankPresentation}
            onVersionSwitch={studioShell ? handleStudioPartialVersionIntent
              : (version) => { retireStudioVoiceOwner(); cancelOutlinePreview(); switchVersion(version) }}
            currentStage={currentStage}
            currentSlideIndex={studioPartialMetadata
              ? (studioPartialNativeIndex?.owner === studioInitialSelectedTarget.owner
                ? (studioPartialNativeIndex.isCurrent() ? studioPartialNativeIndex.index : currentSlideIndex) : 0)
              : currentSlideIndex}
            onSlideChange={(slideNum) => {
              const nextVisualIndex = Math.max(0, slideNum - 1)
              // Keep the imperative insertion owner current before React
              // schedules the corresponding render.
              currentSlideIndexRef.current = nextVisualIndex
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
            buildNarrationEnabled={effectiveBuildNarrationEnabled}
            blankPlaceholderDismissed={blankPlaceholderDismissed}
            onDismissBlankPlaceholder={() => {
              if (studioShell && studioSlideComposeOwnerRef.current !== studioInitialSelectedTarget.owner) return
              studioExplicitBlankOwnerRef.current = studioInitialSelectedTarget.owner
              setBlankPlaceholderDismissed(true)
            }}
            slideContextByIndex={effectiveBuildNarrationEnabled && !studioPartialMetadata ? slideContextByIndex : null}
            narrationNavigate={effectiveBuildNarrationEnabled
              && (!studioShell || (!studioPartialPending
                && !hasStudioPartialStageVersionIntent(studioPartialVersionIntentRef.current, studioPartialAuthority, buildNarration.buildId)
                && (!studioPartialMetadata || (studioPartialDisplayed?.buildId === buildNarration.buildId
                  && studioPartialDisplayed.presentationId === buildNarration.buildPresentationId)))) ? narrationNavigate : null}
            buildNarration={effectiveBuildNarrationEnabled ? buildNarration : null}
            buildNarrationApi={
              effectiveBuildNarrationEnabled
                ? {
                    onPin: pinNarrationSlide,
                    // Pause/Stop/Resume (Phase 5) — needs BOTH flags; the
                    // component renders nothing when enabled is false.
                    control: {
                      enabled: features.buildControlEnabled,
                      onPause: () => {
                        const requestId = sendBuildControl('pause', buildNarration.buildId ?? undefined)
                        if (requestId) {
                          markNarrationControl('pause_requested', buildNarration.buildId, requestId)
                        }
                      },
                      onResume: () => {
                        const requestId = sendBuildControl('resume', buildNarration.buildId ?? undefined)
                        if (requestId) {
                          markNarrationControl('resume_requested', buildNarration.buildId, requestId)
                        }
                      },
                      onStop: () => {
                        const requestId = sendBuildControl('stop', buildNarration.buildId ?? undefined)
                        if (requestId) {
                          markNarrationControl('stop_requested', buildNarration.buildId, requestId)
                        }
                      },
                    },
                  }
                : null
            }
            onApiReady={studioShell ? handleStudioPartialApiReady : setLayoutServiceApis}
            onComposeApiReady={studioShell ? handleStudioPartialComposeApiReady : handleComposeApiReady}
            onRefineSlide={features.slideRefinerEnabled ? handleOpenSlideRefine : undefined}
            onGenerateSlide={studioShell && features.slideComposerEnabled ? handleOpenSlideCompose : undefined}
            // J2 v2: same session / research / theme sources as the Slide panel above (P7). `submit` (J2-MAP item8: async,
            // page-owned registration) exists only with the composer and its async mode on; otherwise Generate stays disabled.
            addSlideV2Settings={process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true' ? {
              sessionId: resolveSlideComposeSessionId({ deckOwnerSessionId, currentSessionId, wsSessionId }),
              presentationId: effectivePresentationId,
              research: {
                useUploadedDocuments: uploadedFiles.some(isAttachedUpload) || Boolean(sessionStoreName),
                useWebSearch: webSearchEnabled,
                useDeepResearch: researchEnabled && webSearchEnabled,
                useKnowledgeGraph: canUseKnowledgeGraph && knowledgeGraphEnabled,
              },
              themeProfileName: activeBuildThemeProfileForSelection?.name ?? null,
              panelOpen: addSlideV2Open,
              panelHost: addSlideV2Host,
              onPanelOpenChange: handleAddSlideV2PanelOpenChange,
              ...createAddSlideV2Hooks({
                // `submit` needs the composer and its async mode; the Blank target resolver is always there.
                generationEnabled: features.slideComposerEnabled && features.slideComposerAsyncEnabled,
                presentationId: effectivePresentationId,
                fetchImpl: (url, init) => fetch(url, init),
                newJobId: () => crypto.randomUUID(),
                captureSessionOwner: captureStudioSlideComposeSessionOwner,
                // Same predicate handleSlideComposerAccepted applies before it registers a job.
                isSessionAdmitted: sessionId => !studioShell || sessionId === questionSubmissionScopeRef.current.sessionId,
                selection: () => ({
                  visualIndex: currentSlideIndexRef.current,
                  realSlideCount: effectiveSlideCount ?? 0,
                  jobs: studioShell
                    ? Object.fromEntries(Object.entries(slideComposeJobsRef.current).filter(([, item]) => item.target_presentation_id === effectivePresentationId))
                    : slideComposeJobsRef.current,
                }),
                onAccepted: handleSlideComposerAccepted,
                // DEC-P9: the viewer follows the new slide when the user is still on the slide they started from.
                follow: addSlideV2FollowRef.current,
              }),
              // J2V2-REGENERATE (flag NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED): rebuild the generated slide on screen through
              // the Slide panel's own Refine route. The accepted job is the page's usual refine job: the original gets the refine
              // overlay and stays until slide_ready swaps the new slide in at the same index; a failure keeps it.
              regenerate: process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true' ? createAddSlideV2RegenerateHooks({
                regenerateEnabled: features.slideRefinerEnabled && features.slideComposerEnabled && features.slideComposerAsyncEnabled,
                store: addSlideV2Generated,
                contextByIndex: () => (studioPartialMetadata ? null : slideContextByIndex),
                jobState: jobId => slideComposeJobsRef.current[jobId],
                fetchImpl: (url, init) => fetch(url, init),
                newJobId: () => crypto.randomUUID(),
                captureSessionOwner: captureStudioSlideComposeSessionOwner,
                isSessionAdmitted: sessionId => !studioShell || sessionId === questionSubmissionScopeRef.current.sessionId,
                selection: () => ({
                  visualIndex: currentSlideIndexRef.current,
                  realSlideCount: effectiveSlideCount ?? 0,
                  jobs: studioShell
                    ? Object.fromEntries(Object.entries(slideComposeJobsRef.current).filter(([, item]) => item.target_presentation_id === effectivePresentationId))
                    : slideComposeJobsRef.current,
                }),
                onAccepted: handleSlideComposerAccepted,
              }) : undefined,
            } : undefined}
            onTextBoxSelected={(elementId, formatting, selectedComponentType) => {
              if (studioShell) closeStudioFormat()
              if (features.useTextLabsGeneration) {
                setSelectedTextBoxId(elementId)
                setSelectedTextBoxFormatting(formatting)
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
              if (studioShell) closeStudioFormat()
              setSelectedTextBoxId(null)
              setSelectedTextBoxFormatting(null)
              if (!generationPanel.isGenerating && (generationPanel.mode === 'edit' || generationPanel.mode === 'refine')) {
                generationPanel.closePanel()
              }
            }}
            onElementSelected={(elementId, elementType, properties) => {
              if (studioShell) closeStudioFormat()
              if (features.useTextLabsGeneration && isTextLabsMappable(elementType)) {
                setSelectedElementId(elementId)
                setSelectedElementType(elementType)
                setSelectedElementProperties(properties)
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
              if (studioShell) closeStudioFormat()
              setSelectedElementId(null)
              setSelectedElementType(null)
              setSelectedElementProperties(null)
              if (!generationPanel.isGenerating && (generationPanel.mode === 'edit' || generationPanel.mode === 'refine')) {
                generationPanel.closePanel()
              }
            }}
            onElementDeleted={(elementId) => {
              const deletedActiveElement = selectedElementId === elementId
                || selectedTextBoxId === elementId
                || generationPanel.editElementId === elementId
                || generationPanel.refineContext?.elementId === elementId
                || generationPanel.blankElementId === elementId
              if (!deletedActiveElement) return
              setSelectedElementId(null)
              setSelectedElementType(null)
              setSelectedElementProperties(null)
              setSelectedTextBoxId(null)
              setSelectedTextBoxFormatting(null)
              if (!generationPanel.isGenerating) generationPanel.closePanel()
            }}
            blankElements={blankElements}
            generationPanel={generationPanel}
            onOpenBlankGenerationPanel={handleOpenBlankGenerationPanel}
            onOpenGenerationPanel={features.useTextLabsGeneration ? handleOpenGenerationPanelInFront : undefined}
            onRefineElementRequested={features.useTextLabsGeneration ? handleRefineElementRequested : undefined}
            buildThemeSelection={buildThemeSelection}
            themeSync={themeSync}
            onBuildThemeChange={handleBuildThemeChange}
            connected={connected}
            connecting={connecting}
            toolbarPortalTarget={toolbarPortalTarget}
            toolbarOffset={studioShell ? 0 : drawerOffset > TEMPLATE_PANEL_COLLAPSED_WIDTH ? Math.max(drawerOffset - 112, 0) : 0}
            publishSessionId={currentSessionId || wsSessionId}
            deckTitle={effectiveSlideStructure?.metadata?.main_title ?? null}
            hasFinalDeck={Boolean(finalPresentationId || finalPresentationUrl)}
            publishFinalPresentationId={studioShell ? finalPresentationId : undefined}
            publishThumbnailUrlsByPresentation={studioShell ? slideThumbnailUrlsByPresentation : undefined}
            publishThumbnailOwnerSessionId={studioShell ? currentSessionIdRef.current : undefined}
            sessionId={wsSessionId}
            deckOwnerSessionId={deckOwnerSessionId}
            templateSavePresentationId={templateSavePresentationId}
            templateBuilderEnabled={templateBuilderEnabled}
            onSelectTemplate={handleSelectTemplate}
            onTemplateOptimizationFailed={handleTemplateOptimizationFailed}
            templateSelectionLocked={templateSelectionLocked}
            templateModeOn={templateModeOn}
            onTemplateModeChange={(enabled) => { cancelOutlinePreview(); handleTemplateModeChange(enabled) }}
            templateModeAvailable={Boolean(activeTemplate)}
            templateSnapshot={templateSnapshot}
            templateSnapshotLoading={templateSnapshotLoading}
            composeJobs={studioPartialMetadata
              ? slideComposeThumbnailJobs.filter(job => slideComposeJobsRef.current[job.jobId]?.target_presentation_id === effectivePresentationId)
              : slideComposeThumbnailJobs}
            thumbnailUrlsBySlide={
              effectivePresentationId
                ? slideThumbnailUrlsByPresentation[effectivePresentationId] ?? {}
                : {}
            }
            onThumbnailInvalidated={studioShell ? invalidateThumbnailUrls : undefined}
            onThumbnailMutationCapture={studioShell ? captureThumbnailMutation : undefined}
            studioOwnerUserId={studioShell ? authScopeUserId : undefined}
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
      {composerLibraryEnabled && <ComposerLibraryDialog open={showComposerLibrary} onOpenChange={setShowComposerLibrary} />}
      <ChatHistorySidebar
        isOpen={showChatHistory}
        onClose={() => setShowChatHistory(false)}
        currentSessionId={currentSessionId || undefined}
        onSessionSelect={handleSessionSelectWrapped}
        onNewChat={handleNewChatWrapped}
      />

      {/* Onboarding Modal */}
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />

      <ManualDeckConflictDialog
        open={Boolean(pendingManualDeckBuild)}
        summary={pendingManualDeckBuild?.summary ?? null}
        busy={manualDeckHandoffBusy}
        error={manualDeckHandoffError}
        onCancel={handleCancelManualDeckBuild}
        onPrependGenerated={handlePrependGeneratedSlides}
        onStartNewSession={handleStartHandoffSession}
      />

      {/* Reserve credit top-up */}
      <TopUpModal open={topUpOpen} onOpenChange={setTopUpOpen} reason={topUpReason} />

    </div>
    </StudioIntroductionProvider>
  )
}

function BuilderLoadingState({ message = 'Loading builder...' }: { message?: string }) {
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true') return <StudioWaitingState scope="screen" message={message} />
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <div className="text-center">
        <div className="h-10 w-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  )
}

function BuilderAuthBoundary() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const authScopeUserId = user?.id ?? user?.email ?? ''
  const mountedAccountRef = useRef('')
  const accountChanged = Boolean(
    !isLoading
    && authScopeUserId
    && mountedAccountRef.current
    && mountedAccountRef.current !== authScopeUserId
  )
  if (!isLoading && authScopeUserId && !mountedAccountRef.current) {
    mountedAccountRef.current = authScopeUserId
  }

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !authScopeUserId)) {
      router.replace('/auth/signin?callbackUrl=%2Fbuilder')
    }
  }, [authScopeUserId, isAuthenticated, isLoading, router])

  useEffect(() => {
    if (accountChanged && typeof window !== 'undefined') {
      // The URL may still name account A's session. A hard navigation both
      // disposes every async callback and ensures B starts with a fresh deck.
      window.location.replace('/builder?session_id=new')
    }
  }, [accountChanged])

  // Never leave the previous account's Builder tree mounted while NextAuth is
  // revalidating. The authenticated account id is also the React key, forcing
  // a complete state/socket remount on an A -> B transition.
  if (isLoading) return <BuilderLoadingState />
  if (accountChanged) return <BuilderLoadingState />
  if (!isAuthenticated || !authScopeUserId) {
    return <BuilderLoadingState message="Redirecting to sign in..." />
  }

  return (
    <AuthenticatedBuilderContent
      key={authScopeUserId}
      authScopeUserId={authScopeUserId}
    />
  )
}

export default function BuilderPage() {
  return (
    <WebSocketErrorBoundary>
      <Suspense fallback={<BuilderLoadingState />}>
        <BuilderAuthBoundary />
      </Suspense>
    </WebSocketErrorBoundary>
  )
}
