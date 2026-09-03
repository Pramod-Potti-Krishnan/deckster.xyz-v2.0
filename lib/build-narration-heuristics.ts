// Build Narration — pure state machine + heuristics (BUILD_COT_NARRATION_PLAN §5.1).
//
// IMPORT-FREE BY DESIGN (type-only imports are erased at transpile): this file
// is unit-tested by scripts/test-build-narration.mjs, which transpiles it with
// ts.transpileModule and runs it in a bare vm sandbox where value imports do
// not resolve. Keep every export here a pure function or plain data.
//
// Two input sources feed the reducer, in priority order:
//   1. TYPED frames (build_phase / build_event / slide_built) — Phase 2+
//      Directors emit these behind BUILD_EVENTS_ENABLED.
//   2. HEURISTIC mapping of today's frames (ephemeral chat lines,
//      status_update text, slide_update, presentation_url) — works against
//      production Directors and remains forever as the old-Director fallback.
// Once ANY typed frame arrives for a build, heuristic-derived events are
// dropped (the same underlying step would otherwise render twice, because
// Director keeps emitting ephemeral chat for old-frontend compatibility).

import type {
  BuildPhasePayload,
  BuildEventPayload,
  SlideBuiltPayload,
} from '../types/build-narration';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NarrationPhase =
  | 'idle'
  | 'planning'
  | 'strawman'
  | 'awaiting_user'
  | 'building'
  | 'qa'
  | 'finalizing'
  | 'complete'
  | 'paused'
  | 'stopped'
  | 'error';

export type SlideBuildState = 'pending' | 'building' | 'built' | 'qa' | 'error' | 'skipped';

export type NarrationControl =
  | 'running'
  | 'pause_requested'
  | 'paused'
  | 'resume_requested'
  | 'stop_requested'
  | 'stopped';

export interface NarrationEvent {
  id: string;
  scope: 'deck' | 'slide';
  stage: string;
  status: 'started' | 'progress' | 'done' | 'error';
  text: string;
  detail?: string | null;
  slideIndex?: number | null;
  seq: number;
  ts: number;
}

export interface GhostSlide {
  index: number; // 0-based
  title: string;
  points: string[];
  slideType?: string | null;
}

export interface NarrationState {
  active: boolean;
  source: 'heuristic' | 'typed';
  buildId: string | null;
  phase: NarrationPhase;
  phaseLabel: string;
  startedAt: number | null;
  slideCount: number;
  ghosts: GhostSlide[];
  deckEvents: NarrationEvent[];
  slideEvents: Record<number, NarrationEvent[]>;
  slideStates: Record<number, SlideBuildState>;
  slidesDone: number;
  thumbnails: Record<number, string>;
  qaVerdicts: Record<number, string>;
  focusSlide: number | null;
  pinnedSlide: number | null;
  control: NarrationControl;
  seqCounter: number;
  lastEventAt: number | null;
  seenEphemeralIds: string[];
  /** Recently superseded build ids; stale reconnect frames from these are ignored. */
  retiredBuildIds: string[];
}

export const DECK_EVENT_CAP = 60;
export const SLIDE_EVENT_CAP = 12;
export const RETIRED_BUILD_ID_CAP = 16;

export function initialNarrationState(): NarrationState {
  return {
    active: false,
    source: 'heuristic',
    buildId: null,
    phase: 'idle',
    phaseLabel: '',
    startedAt: null,
    slideCount: 0,
    ghosts: [],
    deckEvents: [],
    slideEvents: {},
    slideStates: {},
    slidesDone: 0,
    thumbnails: {},
    qaVerdicts: {},
    focusSlide: null,
    pinnedSlide: null,
    control: 'running',
    seqCounter: 0,
    lastEventAt: null,
    seenEphemeralIds: [],
    retiredBuildIds: [],
  };
}

// ---------------------------------------------------------------------------
// Heuristic text classification
// ---------------------------------------------------------------------------

// Slide Builder per-slide callback text relayed as ephemeral chat
// (backend/slide-builder pipeline/iterator.py: "Building slide 4/9 — chart…").
// Only the extended/v2 path produces these; the standard path has no
// per-slide text at all (verified — BUILD_COT_NARRATION_VERIFICATION.md §1).
const SLIDE_TEXT_RE = /(?:building|composing)\s+slide\s+(\d+)\s*(?:\/|of)\s*(\d+)/i;

// Director's canned strawman progress lines (websocket.py PROGRESS_MESSAGES,
// idx 0-5) → stage slugs. Matched by prefix so minor copy tweaks still map.
const DECK_STAGE_PATTERNS: Array<{ re: RegExp; stage: string }> = [
  { re: /^reviewing your topic/i, stage: 'framing' },
  { re: /^researching the topic/i, stage: 'research' },
  { re: /^drafting the deck outline/i, stage: 'outline' },
  { re: /^choosing layouts/i, stage: 'slide_layouts' },
  { re: /^researching each slide/i, stage: 'slide_research' },
  { re: /^packaging your outline/i, stage: 'package' },
];

export interface ParsedEphemeral {
  scope: 'deck' | 'slide';
  stage: string;
  slideIndex?: number;
  slideCount?: number;
}

export function parseEphemeralText(text: string): ParsedEphemeral {
  const slideMatch = SLIDE_TEXT_RE.exec(text || '');
  if (slideMatch) {
    const oneBased = parseInt(slideMatch[1], 10);
    const total = parseInt(slideMatch[2], 10);
    return {
      scope: 'slide',
      stage: 'render',
      slideIndex: Math.max(0, oneBased - 1),
      slideCount: Number.isFinite(total) ? total : undefined,
    };
  }
  for (const p of DECK_STAGE_PATTERNS) {
    if (p.re.test(text || '')) return { scope: 'deck', stage: p.stage };
  }
  return { scope: 'deck', stage: 'progress' };
}

// status_update.text → phase hints. Texts verified against Director source
// (BUILD_COT_NARRATION_VERIFICATION.md §1/§4): outline gen, standard content
// gen, extended-path phase statuses.
export interface StatusInterpretation {
  phase?: NarrationPhase;
  label?: string;
  event?: { stage: string; text: string };
}

export function interpretStatus(statusText: string, status: string): StatusInterpretation {
  const t = (statusText || '').toLowerCase();
  if (t.startsWith('generating presentation outline')) {
    return { phase: 'planning', label: 'Designing your deck plan…' };
  }
  if (
    t.startsWith('generating presentation content') ||
    t.startsWith('generating hero slides') ||
    t.startsWith('creating presentation layout') ||
    t.startsWith('composing content slides') ||
    t.startsWith('composing ') // "Composing {N} slides (v2 path)..."
  ) {
    return {
      phase: 'building',
      label: 'Building your slides…',
      event: { stage: 'content', text: statusText },
    };
  }
  if (t.startsWith('incorporating research data')) {
    return { phase: 'building', label: 'Building your slides…', event: { stage: 'research', text: statusText } };
  }
  if (status === 'thinking' || status === 'generating') {
    return {};
  }
  return {};
}

// The single condition both message-list branches use to decide whether the
// ephemeral thinking-stream renders in CHAT (false) or is rerouted to the
// canvas (true). Pinned by test: flag off ⇒ NEVER reroute.
export function shouldRerouteEphemeral(narrationEnabled: boolean): boolean {
  return narrationEnabled === true;
}

export function effectiveNarrationEnabled(globalFlag: boolean, hasActiveTemplate: boolean): boolean {
  return globalFlag === true && hasActiveTemplate !== true;
}

// Canvas v2 R1: the blank backend deck is real and editable, but on landing it
// reads as an ugly grey slide — cover it with the designed placeholder until
// the user dismisses it or a real version (strawman/final) takes the stage.
// Pure so the vm suite can pin the truth table; flag off ⇒ never.
export function shouldShowBlankPlaceholder(
  narrationEnabled: boolean,
  activeVersion: string | null | undefined,
  isBlankPresentation: boolean | null | undefined,
  dismissed: boolean | null | undefined,
): boolean {
  if (narrationEnabled !== true) return false;
  if (dismissed === true) return false;
  return activeVersion === 'blank' && isBlankPresentation === true;
}

// Canvas v2 R2: every status line carries an icon. Pure slug→key map (the
// lucide lookup lives in components/build-narration/stage-icons.tsx) so the
// vm suite can pin the vocabulary. Unknown slugs get 'default'.
const STAGE_ICON_KEYS: Record<string, string> = {
  framing: 'framing',
  research: 'research',
  outline: 'outline',
  slide_layouts: 'slide_layouts',
  slide_research: 'slide_research',
  theme: 'theme',
  package: 'package',
  plan: 'plan',
  validate: 'validate',
  render: 'render',
  insert: 'insert',
  content: 'content',
  qa: 'qa',
  style: 'style',
  progress: 'default',
};

export function iconKeyForStage(stage: string | null | undefined): string {
  if (!stage) return 'default';
  return STAGE_ICON_KEYS[stage] || 'default';
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export type NarrationAction =
  | { type: 'reset' }
  | { type: 'dismiss' }
  | { type: 'session_start'; ts: number } // user sent a message / status went thinking pre-deck
  | { type: 'status'; status: string; text: string; ts: number }
  | { type: 'ephemeral'; id: string; text: string; ts: number }
  | { type: 'strawman'; ghosts: GhostSlide[]; ts: number }
  | { type: 'awaiting_user'; ts: number }
  | { type: 'accepted'; ts: number } // accept clicked / isGeneratingFinal flipped
  | { type: 'final_url'; ts: number }
  | { type: 'pin'; slideIndex: number | null }
  | { type: 'control'; control: NarrationControl; ts: number }
  | { type: 'control_timeout'; requested: NarrationControl; fallback: NarrationControl; ts: number }
  | { type: 'typed_phase'; payload: BuildPhasePayload; ts: number; pendingControl?: NarrationControl }
  | { type: 'typed_event'; payload: BuildEventPayload; ts: number }
  | { type: 'typed_slide_built'; payload: SlideBuiltPayload; ts: number }
  | { type: 'typed_sync'; buildState: unknown; ts: number; pendingControl?: NarrationControl }
  | { type: 'hydrate'; state: NarrationState };

function capList<T>(list: T[], cap: number): T[] {
  return list.length > cap ? list.slice(list.length - cap) : list;
}

function pushDeckEvent(state: NarrationState, ev: NarrationEvent): NarrationState {
  return {
    ...state,
    deckEvents: capList([...state.deckEvents, ev], DECK_EVENT_CAP),
    seqCounter: Math.max(state.seqCounter, ev.seq) + 1,
    lastEventAt: ev.ts,
  };
}

function pushSlideEvent(state: NarrationState, slideIndex: number, ev: NarrationEvent): NarrationState {
  const existing = state.slideEvents[slideIndex] || [];
  return {
    ...state,
    slideEvents: { ...state.slideEvents, [slideIndex]: capList([...existing, ev], SLIDE_EVENT_CAP) },
    seqCounter: Math.max(state.seqCounter, ev.seq) + 1,
    lastEventAt: ev.ts,
    focusSlide: state.pinnedSlide !== null ? state.focusSlide : slideIndex,
  };
}

function setSlideState(state: NarrationState, slideIndex: number, s: SlideBuildState): NarrationState {
  const prev = state.slideStates[slideIndex];
  // Never regress a terminal state back to building (out-of-order events).
  if ((prev === 'built' || prev === 'skipped') && (s === 'building' || s === 'pending')) return state;
  const slideStates = { ...state.slideStates, [slideIndex]: s };
  const slidesDone = Object.values(slideStates).filter((v) => v === 'built').length;
  return { ...state, slideStates, slidesDone };
}

const PHASE_LABELS: Record<NarrationPhase, string> = {
  idle: '',
  planning: 'Designing your deck plan…',
  strawman: 'Outline ready — shaping your slides…',
  awaiting_user: 'Outline ready — waiting for your go-ahead',
  building: 'Building your slides…',
  qa: 'Running quality checks…',
  finalizing: 'Finishing your deck…',
  complete: 'Your deck is ready',
  paused: 'Paused',
  stopped: 'Stopped',
  error: 'Something went wrong',
};

export function phaseLabelFor(phase: NarrationPhase): string {
  return PHASE_LABELS[phase] || '';
}

function toPhase(state: NarrationState, phase: NarrationPhase, ts: number, label?: string): NarrationState {
  if (state.phase === phase && (!label || state.phaseLabel === label)) return state;
  return {
    ...state,
    active: phase !== 'idle',
    phase,
    phaseLabel: label || phaseLabelFor(phase),
    startedAt: state.startedAt ?? ts,
  };
}

function normalizedRetiredBuildIds(state: NarrationState): string[] {
  if (!Array.isArray(state.retiredBuildIds)) return [];
  return capList(
    state.retiredBuildIds.filter((value): value is string => typeof value === 'string' && value.length > 0),
    RETIRED_BUILD_ID_CAP,
  );
}

function settledControlForPhase(phase: NarrationPhase): NarrationControl {
  if (phase === 'paused') return 'paused';
  if (phase === 'stopped') return 'stopped';
  return 'running';
}

function normalizeNarrationState(state: NarrationState): NarrationState {
  const control =
    state.control === 'pause_requested' ||
    state.control === 'resume_requested' ||
    state.control === 'stop_requested'
      ? settledControlForPhase(state.phase)
      : state.control;
  return { ...state, control, retiredBuildIds: normalizedRetiredBuildIds(state) };
}

function typedStateForBuild(state: NarrationState, buildId?: string | null): NarrationState | null {
  const retiredBuildIds = normalizedRetiredBuildIds(state);
  if (buildId && retiredBuildIds.includes(buildId)) return null;
  if (buildId && state.buildId && state.buildId !== buildId) {
    return {
      ...initialNarrationState(),
      source: 'typed',
      buildId,
      retiredBuildIds: capList([...retiredBuildIds, state.buildId], RETIRED_BUILD_ID_CAP),
    };
  }
  return { ...state, source: 'typed', buildId: buildId ?? state.buildId, retiredBuildIds };
}

export function narrationReducer(state: NarrationState, action: NarrationAction): NarrationState {
  switch (action.type) {
    case 'reset':
      return initialNarrationState();

    case 'hydrate':
      return normalizeNarrationState(action.state);

    case 'dismiss':
      return { ...state, active: false, phase: state.phase === 'complete' ? 'idle' : state.phase };

    case 'session_start': {
      if (state.active || state.phase === 'complete') return state;
      return toPhase({ ...state, startedAt: action.ts }, 'planning', action.ts);
    }

    case 'status': {
      const interp = interpretStatus(action.text, action.status);
      let next = state;
      // A status while idle activates planning (pre-deck thinking).
      if (!next.active && (action.status === 'thinking' || action.status === 'generating')) {
        next = toPhase(next, interp.phase || 'planning', action.ts, interp.label);
      } else if (interp.phase && next.active) {
        // Never leave building/qa back to planning on stray statuses.
        const rank: Partial<Record<NarrationPhase, number>> = {
          planning: 1, strawman: 2, awaiting_user: 2, building: 3, qa: 4, finalizing: 5, complete: 6,
        };
        const cur = rank[next.phase] || 0;
        const proposed = rank[interp.phase] || 0;
        if (proposed >= cur || next.phase === 'paused') {
          next = toPhase(next, interp.phase, action.ts, interp.label);
        }
      }
      if (interp.event && next.active && next.source === 'heuristic') {
        next = pushDeckEvent(next, {
          id: `status-${next.seqCounter}`,
          scope: 'deck',
          stage: interp.event.stage,
          status: 'progress',
          text: interp.event.text,
          seq: next.seqCounter,
          ts: action.ts,
        });
      }
      // A completed/idle status while still in pre-strawman planning means the
      // turn ended without a build (Q&A / clarifying question) — recede.
      if (
        (action.status === 'complete' || action.status === 'idle') &&
        state.phase === 'planning' &&
        state.ghosts.length === 0
      ) {
        return initialNarrationState();
      }
      return next;
    }

    case 'ephemeral': {
      if (state.source === 'typed') return state; // typed frames supersede
      if (state.seenEphemeralIds.includes(action.id)) return state;
      const parsed = parseEphemeralText(action.text);
      let next: NarrationState = {
        ...state,
        seenEphemeralIds: capList([...state.seenEphemeralIds, action.id], 200),
      };
      if (!next.active) next = toPhase(next, 'planning', action.ts);
      const ev: NarrationEvent = {
        id: action.id,
        scope: parsed.scope,
        stage: parsed.stage,
        status: 'progress',
        text: action.text,
        slideIndex: parsed.slideIndex ?? null,
        seq: next.seqCounter,
        ts: action.ts,
      };
      if (parsed.scope === 'slide' && parsed.slideIndex !== undefined) {
        // Per-slide activity implies the build phase (extended path).
        if (next.phase !== 'building' && next.phase !== 'qa') {
          next = toPhase(next, 'building', action.ts);
        }
        if (parsed.slideCount && parsed.slideCount > next.slideCount) {
          next = { ...next, slideCount: parsed.slideCount };
        }
        next = setSlideState(next, parsed.slideIndex, 'building');
        return pushSlideEvent(next, parsed.slideIndex, ev);
      }
      return pushDeckEvent(next, ev);
    }

    case 'strawman': {
      let next = toPhase(state, 'strawman', action.ts);
      next = {
        ...next,
        ghosts: action.ghosts,
        slideCount: action.ghosts.length || next.slideCount,
      };
      // Seed pending states without clobbering already-known ones.
      const slideStates = { ...next.slideStates };
      for (const g of action.ghosts) {
        if (!slideStates[g.index]) slideStates[g.index] = 'pending';
      }
      return { ...next, slideStates };
    }

    case 'awaiting_user':
      // Only meaningful straight after the strawman (auto-proceed skips this).
      if (state.phase !== 'strawman' && state.phase !== 'planning') return state;
      return toPhase(state, 'awaiting_user', action.ts);

    case 'accepted':
      if (!state.active && state.ghosts.length === 0) return state;
      return toPhase(state, 'building', action.ts);

    case 'final_url': {
      if (!state.active) return state;
      let next = toPhase(state, 'complete', action.ts);
      // Everything not errored/skipped lands as built at completion.
      const slideStates: Record<number, SlideBuildState> = { ...next.slideStates };
      for (const k of Object.keys(slideStates)) {
        const i = Number(k);
        if (slideStates[i] === 'pending' || slideStates[i] === 'building' || slideStates[i] === 'qa') {
          slideStates[i] = 'built';
        }
      }
      const slidesDone = Object.values(slideStates).filter((v) => v === 'built').length;
      return { ...next, slideStates, slidesDone };
    }

    case 'pin':
      return { ...state, pinnedSlide: action.slideIndex, focusSlide: action.slideIndex ?? state.focusSlide };

    case 'control': {
      let next: NarrationState = { ...state, control: action.control };
      if (action.control === 'paused') next = toPhase(next, 'paused', action.ts);
      if (action.control === 'stopped') next = toPhase(next, 'stopped', action.ts);
      if (action.control === 'running' && (state.phase === 'paused' || state.phase === 'stopped')) {
        next = toPhase(next, 'building', action.ts);
      }
      return next;
    }

    case 'control_timeout': {
      if (state.control !== action.requested) return state;
      return { ...state, control: action.fallback };
    }

    // ------------------------------------------------------------------
    // Typed frames (Phase 2+). First typed frame flips the source; from then
    // on heuristic ephemeral lines are ignored (see 'ephemeral').
    // ------------------------------------------------------------------

    case 'typed_phase': {
      const p = action.payload;
      let next = typedStateForBuild(state, p.build_id);
      if (!next) return state;
      next = toPhase(next, p.phase as NarrationPhase, action.ts, p.label);
      if (typeof p.slide_count === 'number' && p.slide_count > 0) {
        next = { ...next, slideCount: p.slide_count };
      }
      // The hook supplies pendingControl only while it owns a live request +
      // timeout. Without that proof, a typed phase is authoritative and must
      // settle any orphaned optimistic state restored from an older render.
      next = { ...next, control: action.pendingControl ?? settledControlForPhase(p.phase as NarrationPhase) };
      return next;
    }

    case 'typed_event': {
      const p = action.payload;
      let next = typedStateForBuild(state, p.build_id);
      if (!next) return state;
      if (!next.active) next = toPhase(next, 'planning', action.ts);
      const ev: NarrationEvent = {
        id: `${p.build_id}-${p.seq}`,
        scope: p.scope,
        stage: p.stage,
        status: p.status || 'progress',
        text: p.text,
        detail: p.detail ?? null,
        slideIndex: p.slide_index ?? null,
        seq: p.seq,
        ts: action.ts,
      };
      // Dedupe on build_id + seq (reconnect replays); seq restarts at 0 for
      // fresh builds and must not collide with a dismissed prior build.
      const already =
        p.scope === 'deck'
          ? next.deckEvents.some((e) => e.id === ev.id)
          : (next.slideEvents[p.slide_index ?? -1] || []).some((e) => e.id === ev.id);
      if (already) return next;
      if (p.scope === 'slide' && typeof p.slide_index === 'number') {
        if (p.status === 'error') {
          next = setSlideState(next, p.slide_index, 'error');
        } else if (p.stage === 'qa') {
          next = setSlideState(next, p.slide_index, 'qa');
        } else if (p.status === 'done' && (p.stage === 'content' || p.stage === 'render' || p.stage === 'insert')) {
          // Standard path: content-done IS the per-slide completion signal
          // (slide_built with the presentation id bursts at finalization).
          next = setSlideState(next, p.slide_index, 'built');
        } else {
          next = setSlideState(next, p.slide_index, 'building');
        }
        return pushSlideEvent(next, p.slide_index, ev);
      }
      return pushDeckEvent(next, ev);
    }

    case 'typed_sync': {
      // Director sync_response.build_state — reconnect re-hydration.
      const bs = action.buildState as
        | { build_id?: string; phase?: string; slide_count?: number; slides?: Record<string, string> }
        | null
        | undefined;
      if (!bs || typeof bs !== 'object' || !bs.phase) return state;
      const terminal = bs.phase === 'complete' || bs.phase === 'error' || bs.phase === 'idle';
      if (terminal && !bs.build_id && !state.buildId) return state;
      let next = typedStateForBuild(state, bs.build_id);
      if (!next) return state;
      next = toPhase(next, bs.phase as NarrationPhase, action.ts);
      const slideStates: Record<number, SlideBuildState> = { ...next.slideStates };
      const slides = bs.slides && typeof bs.slides === 'object' ? bs.slides : {};
      for (const k of Object.keys(slides)) {
        const i = Number(k);
        const v = slides[k] as SlideBuildState;
        if (Number.isFinite(i) && (v === 'pending' || v === 'building' || v === 'built' || v === 'error' || v === 'skipped' || v === 'qa')) {
          slideStates[i] = v;
        }
      }
      const slidesDone = Object.values(slideStates).filter((v) => v === 'built').length;
      const slideCount = typeof bs.slide_count === 'number' && bs.slide_count > 0 ? bs.slide_count : next.slideCount;
      const control = action.pendingControl ?? settledControlForPhase(bs.phase as NarrationPhase);
      // A reconnect snapshot saying complete is historical truth, not a new
      // live overlay. Reconcile its build identity/slides but keep it receded;
      // live completion still gets its settle beat through typed_phase/URL.
      const active = bs.phase === 'complete' ? false : next.active;
      return { ...next, active, slideStates, slidesDone, slideCount, control };
    }

    case 'typed_slide_built': {
      const p = action.payload;
      // Once typed identity is established, an identity-less completion frame
      // cannot safely be attributed to this build (it may be a delayed Stage-F
      // frame from a superseded attempt). New Directors always include it.
      if (!p.build_id && state.buildId) return state;
      let next = typedStateForBuild(state, p.build_id);
      if (!next) return state;
      if (p.slide_count > next.slideCount) next = { ...next, slideCount: p.slide_count };
      next = setSlideState(next, p.slide_index, 'built');
      if (p.thumbnail_url) {
        next = { ...next, thumbnails: { ...next.thumbnails, [p.slide_index]: p.thumbnail_url } };
      }
      if (p.qa_verdict) {
        next = { ...next, qaVerdicts: { ...next.qaVerdicts, [p.slide_index]: p.qa_verdict } };
      }
      if (next.pinnedSlide === null) next = { ...next, focusSlide: p.slide_index };
      return next;
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Snapshot (sessionStorage) helpers — pure serialize/deserialize; the hook
// owns the actual storage calls.
// ---------------------------------------------------------------------------

export const NARRATION_SNAPSHOT_VERSION = 1;

export interface NarrationSnapshot {
  v: number;
  savedAt: number;
  state: NarrationState;
}

export function serializeNarration(state: NarrationState, now: number): string {
  const snap: NarrationSnapshot = { v: NARRATION_SNAPSHOT_VERSION, savedAt: now, state };
  return JSON.stringify(snap);
}

export function deserializeNarration(raw: string | null, now: number, maxAgeMs: number): NarrationState | null {
  if (!raw) return null;
  try {
    const snap = JSON.parse(raw) as NarrationSnapshot;
    if (!snap || snap.v !== NARRATION_SNAPSHOT_VERSION || !snap.state) return null;
    if (typeof snap.savedAt !== 'number' || now - snap.savedAt > maxAgeMs) return null;
    // Never resurrect a finished/receded canvas.
    if (!snap.state.active || snap.state.phase === 'complete' || snap.state.phase === 'idle') return null;
    return normalizeNarrationState(snap.state);
  } catch {
    return null;
  }
}
