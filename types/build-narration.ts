// Build Narration wire contracts (BUILD_COT_NARRATION_PLAN §4 C1-C3).
//
// IMPORTANT: keep this file IMPORT-FREE. The unit-test harness
// (scripts/test-*.mjs) transpiles .ts sources with ts.transpileModule and runs
// them in a bare vm sandbox where path-alias imports do not resolve. The
// narration heuristics and reducer libs import ONLY from this file via a
// relative path.
//
// These mirror backend/director/src/models/websocket_messages.py
// (BuildPhasePayload / BuildEventPayload / SlideBuiltPayload). slide_built is
// the SHARED superset contract with STAGE_F_VISUAL_QA_PLAN C4 — both build_id
// and session_id present; thumbnail_url/qa_verdict nullable until Stage F
// ships them.

export type BuildPhaseName =
  | 'planning'
  | 'strawman'
  | 'building'
  | 'qa'
  | 'finalizing'
  | 'complete'
  | 'paused'
  | 'stopped'
  | 'error';

export type BuildEventScope = 'deck' | 'slide';
export type BuildEventStatus = 'started' | 'progress' | 'done' | 'error';

export interface BuildPhasePayload {
  build_id: string;
  phase: BuildPhaseName;
  label: string;
  /** Echoed only for build-control acknowledgements. */
  control_request_id?: string | null;
  slide_count?: number | null;
  slides_done?: number | null;
  auto_proceed?: boolean | null;
  presentation_id?: string | null;
  /** FLOW-CONTROL: a paused build acknowledging a message sent while paused (Director DIRECTOR_FLOW_STEER_ENABLED). */
  steer_pending?: boolean | null; // FLOW-CONTROL
  /** FLOW-CONTROL: the slides (0-based) a resume's instructions were applied to, on the `building` acknowledgement. */
  applied_to?: number[] | null; // FLOW-CONTROL
}

export interface BuildEventPayload {
  build_id: string;
  seq: number;
  scope: BuildEventScope;
  stage: string;
  status?: BuildEventStatus;
  text: string;
  detail?: string | null;
  slide_index?: number | null;
  job_id?: string | null;
  ts?: string | null;
}

export interface SlideBuiltPayload {
  session_id: string;
  presentation_id: string;
  slide_index: number;
  slide_count: number;
  build_id?: string | null;
  thumbnail_url?: string | null;
  qa_verdict?: string | null;
  qa_skipped_reason?: string | null;
}

export interface BuildPhaseMessage {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'build_phase';
  payload: BuildPhasePayload;
}

export interface BuildEventMessage {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'build_event';
  payload: BuildEventPayload;
}

export interface SlideBuiltMessage {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'slide_built';
  payload: SlideBuiltPayload;
}

// FE -> Director control frame (Phase 5; sender ships dark until then).
export type BuildControlAction = 'pause' | 'resume' | 'stop';

export interface BuildControlData {
  action: BuildControlAction;
  build_id?: string;
  /** Idempotency/correlation key shared by HTTP primary + WS fallback. */
  request_id?: string;
  /** Per-connection capability issued by Director; never persisted. */
  control_token?: string;
  /** Authenticated user identity bound to the capability. */
  user_id?: string;
  /** FLOW-CONTROL (NEXT_PUBLIC_STUDIO_FLOW_AMEND_INSTRUCTIONS): resume only; what to change for the slides not yet built (1000 characters at most). */
  instructions?: string; // FLOW-CONTROL
}
