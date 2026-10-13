// PASS2-PK-FOUR item 4 (frontend-2): the MOCK event source for the template workspace. DEV/TEST ONLY.
// Reached only through ./adapter.ts behind NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE_MOCK === "true" at build time (default off: not in
// the bundle). No network, no storage writes except its own "Finish now" marker.
//
// Deterministic and timer-driven: the whole event timeline is a pure function of the upload record (session id, file name, the time
// the dialog handed off) and the mock config, so leaving and coming back (or reloading) replays the same events and lands on the
// same state. Config (optional) in sessionStorage `deckster_template_workspace_mock`:
//   { "scenario": "happy" | "unlockable" | "paused" | "failed" | "failed_convert" | "long" | "over_cap",
//     "pace": "demo" | "real", "slides": <number>, "sessions": { "<session id>": { ...the same keys, for one upload } } }
// "real" pace follows the frames' timing (as-is at 58 s, about 4 min 40 s for 30 slides); "demo" is ten times faster.
import type { TemplateElementRole, TemplateWorkspaceEvent } from './contract'
import { TEMPLATE_WORKSPACE_PARALLEL_SLIDES } from './contract'
import type { TemplateFixtureDeck, TemplateWorkspaceSource } from './adapter'
import type { TemplateWorkspaceRecord } from './registry'
import { mockSlideElements, mockSlideHtml, mockSlideLabel, mockSlideLayout } from './mock-deck'

export type TemplateMockScenario = 'happy' | 'unlockable' | 'paused' | 'failed' | 'failed_convert' | 'long' | 'over_cap'
export interface TemplateMockConfig {
  scenario: TemplateMockScenario
  pace: 'demo' | 'real'
  slides: number
}

export const TEMPLATE_MOCK_CONFIG_KEY = 'deckster_template_workspace_mock'
const RESUME_PREFIX = 'deckster_template_workspace_mock_resume_'
const SCENARIOS: TemplateMockScenario[] = ['happy', 'unlockable', 'paused', 'failed', 'failed_convert', 'long', 'over_cap']

const PACES = {
  demo: { convertMs: 6000, analyseMs: 2600, landMs: 1300, staggerMs: 900, tailMs: 600 },
  real: { convertMs: 58000, analyseMs: 26500, landMs: 1500, staggerMs: 3000, tailMs: 1200 },
} as const

export function readTemplateMockConfig(sessionId?: string): TemplateMockConfig {
  let raw: Record<string, unknown> = {}
  try { raw = JSON.parse(window.sessionStorage.getItem(TEMPLATE_MOCK_CONFIG_KEY) || '{}') || {} } catch { raw = {} }
  const own = sessionId && raw.sessions && typeof raw.sessions === 'object' ? (raw.sessions as Record<string, unknown>)[sessionId] : null
  if (own && typeof own === 'object') raw = { ...raw, ...(own as Record<string, unknown>) }
  const scenario = SCENARIOS.includes(raw.scenario as TemplateMockScenario) ? raw.scenario as TemplateMockScenario : 'happy'
  const pace = raw.pace === 'real' ? 'real' : 'demo'
  const fallback = scenario === 'long' ? 120 : scenario === 'over_cap' ? 140 : 30
  const slides = typeof raw.slides === 'number' && Number.isInteger(raw.slides) && raw.slides > 0 && raw.slides <= 400 ? raw.slides : fallback
  return { scenario, pace, slides }
}

/** "Tidewell-QBR-master-2026.pptx" -> "Tidewell QBR master" (the server's name for the template, as the frames show it). */
export function mockTemplateName(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').replace(/\s+(19|20)\d\d$/, '').replace(/\s+/g, ' ').trim() || 'Uploaded template'
}

const ROLE_NAMES: Record<string, string> = { 'Chart · columns': 'Chart data', 'Source note': 'Source' }
const rolesOf = (index: number, policy: 'fixed' | 'fillable' | 'any'): TemplateElementRole[] =>
  mockSlideElements(index).filter(e => policy === 'any' || e.policy === policy).map(e => ({ element_id: e.id, role: ROLE_NAMES[e.role] ?? e.role, policy: e.policy }))

const LAYOUT_LABELS: Record<string, string> = {
  title: 'Title', agenda: 'Agenda', section: 'Section', kpi: 'KPI dashboard', chart_takeaway: 'Chart + takeaway', line_chart: 'Line chart', table: 'Table',
  two_columns: 'Two columns', timeline: 'Timeline', three_cards: 'Three cards', quote: 'Quote', big_number: 'Big number', team: 'Team', picture_text: 'Picture + text',
}
const LAYOUT_ORDER = Object.keys(LAYOUT_LABELS)

type Timed = { at: number; event: TemplateWorkspaceEvent }

/** The full, deterministic timeline (absolute times, ms). Exported for tests. */
export function buildTemplateMockTimeline(record: Pick<TemplateWorkspaceRecord, 'session_id' | 'file_name' | 'created_at'>, config: TemplateMockConfig, resumedAt: number | null = null): Timed[] {
  const pace = PACES[config.pace]
  const N = config.slides
  const t0 = record.created_at
  const job_id = `mock-${record.session_id}`
  const out: Array<{ at: number; event: Omit<TemplateWorkspaceEvent, 'job_id' | 'seq'> & { type: TemplateWorkspaceEvent['type'] } }> = []
  const push = (at: number, event: Record<string, unknown>) => out.push({ at, event: event as never })

  // Conversion: stage events, thumbnails fill in.
  push(t0 + 400, { type: 'stage', stage: 'converting', slide_count: N })
  if (config.scenario === 'over_cap') {
    push(t0 + 1500, { type: 'failed', reason_code: 'too_many_slides', reason: `This deck has ${N} slides; a template can have up to 120.`, retryable: false })
    return finish(out, job_id)
  }
  const placeFrom = t0 + pace.convertMs * 0.2
  const placeSpan = pace.convertMs * 0.6
  const placeTicks = Math.min(N, 30)
  for (let k = 1; k <= placeTicks; k++) push(placeFrom + (placeSpan * k) / placeTicks, { type: 'stage', stage: 'placing', slides_converted: Math.round((N * k) / placeTicks), slide_count: N })
  if (config.scenario === 'failed_convert') {
    push(t0 + pace.convertMs * 0.55, { type: 'failed', reason_code: 'unreadable_file', reason: 'Part of this file could not be read: it may be password-protected or damaged. Save a fresh copy as .pptx and upload it again.', retryable: false })
    return finish(out.filter(item => item.at <= t0 + pace.convertMs * 0.55), job_id)
  }
  push(t0 + pace.convertMs * 0.86, { type: 'stage', stage: 'checking', slides_converted: N, slide_count: N })

  const asIsAt = t0 + pace.convertMs
  let elements = 0
  for (let i = 0; i < N; i++) elements += mockSlideElements(i).length
  push(asIsAt, {
    type: 'as_is_ready', template_id: `mock-template-${record.session_id}`, template_name: mockTemplateName(record.file_name),
    presentation_id: `mock-${record.session_id}`, viewer_url: 'mock://template-workspace', slide_count: N, element_count: elements, use_original: 'available',
    changes: [
      { slide_index: null, text: 'Avenir Next is not a web font, so text uses a metric-matched stand-in with the same line breaks.' },
      { slide_index: 5, text: 'The line chart on slide 6 is now a native chart, rebuilt from its embedded data.' },
      { slide_index: 15, text: 'The map on slide 16 stays one picture; its labels are editable text on top.' },
    ],
    slides: Array.from({ length: N }, (_, i) => ({ slide_index: i, label: mockSlideLabel(i) })),
  })

  // Locking: three workers take slides in order; each slide analyses, lands its roles, then locks.
  const slideMs = pace.analyseMs + pace.landMs
  type Job = { index: number; start: number; end: number }
  const schedule = (indices: number[], from: number): Job[] => {
    const free = Array.from({ length: TEMPLATE_WORKSPACE_PARALLEL_SLIDES }, (_, w) => from + w * pace.staggerMs)
    return indices.map(index => {
      const w = free.indexOf(Math.min(...free))
      const start = free[w]
      const end = start + (config.scenario === 'unlockable' && index === 9 ? pace.analyseMs : slideMs)
      free[w] = end
      return { index, start, end }
    })
  }
  let jobs = schedule(Array.from({ length: N }, (_, i) => i), asIsAt + 200)
  let stopAt: number | null = null
  if (config.scenario === 'paused' || config.scenario === 'failed') {
    const byEnd = [...jobs].sort((a, b) => a.end - b.end)
    const stopAfter = Math.min(N - 1, Math.max(1, Math.round(N * 0.6)))
    stopAt = byEnd[stopAfter - 1].end + 400
  }
  const emitJob = (job: Job, upTo: number | null) => {
    const emitAt = (at: number, event: Record<string, unknown>) => { if (upTo === null || at <= upTo) push(at, event) }
    emitAt(job.start, { type: 'slide_analysing', slide_index: job.index, fixed: rolesOf(job.index, 'fixed') })
    if (config.scenario === 'unlockable' && job.index === 9) {
      emitAt(job.end, { type: 'slide_unlockable', slide_index: job.index, reason_code: 'chart_not_rebuildable', reason: `Slide ${job.index + 1}’s donut chart can’t be rebuilt as slots, so it stays in the template exactly as it is.` })
      return
    }
    emitAt(job.start + pace.analyseMs, { type: 'slide_analysed', slide_index: job.index, roles: rolesOf(job.index, 'any') })
    emitAt(job.end, { type: 'slide_locked', slide_index: job.index, layout_id: mockSlideLayout(job.index) })
  }
  jobs.forEach(job => emitJob(job, stopAt))
  let lastEnd = Math.max(...jobs.map(job => job.end))
  if (stopAt !== null) {
    push(stopAt, config.scenario === 'paused'
      ? { type: 'paused', reason_code: 'daily_budget', retryable: true, reason: 'Today’s analysis budget is used up. Locking finishes tomorrow, or now if you start a new-topic deck.' }
      : { type: 'failed', reason_code: 'service_error', retryable: true, reason: 'The analysis service stopped answering. Nothing is lost.' })
    if (resumedAt !== null && resumedAt > stopAt) {
      const remaining = jobs.filter(job => job.end > stopAt!).map(job => job.index)
      jobs = schedule(remaining, resumedAt)
      jobs.forEach(job => emitJob(job, null))
      lastEnd = Math.max(...jobs.map(job => job.end))
    } else {
      return finish(out, job_id, N, null)
    }
  }
  return finish(out, job_id, N, lastEnd + pace.tailMs, config, record.session_id)
}

function finish(out: Array<{ at: number; event: Record<string, unknown> }>, job_id: string, N = 0, readyAt: number | null = null, config?: TemplateMockConfig, sessionId?: string): Timed[] {
  // Progress after each finished slide, with the time left from this schedule.
  const doneTimes = out.filter(item => item.event.type === 'slide_locked' || item.event.type === 'slide_unlockable').map(item => item.at).sort((a, b) => a - b)
  const lastDone = doneTimes.length ? doneTimes[doneTimes.length - 1] : 0
  doneTimes.forEach((at, k) => out.push({ at: at + 1, event: { type: 'slides_done', slides_done: k + 1, slide_count: N, eta_seconds: readyAt === null ? null : Math.max(0, Math.round((lastDone - at) / 1000)) } }))
  if (readyAt !== null && config && sessionId) {
    const seen = new Set<string>()
    const representatives: Array<{ layout_id: string; label: string; slide_index: number }> = []
    for (let i = 0; i < N; i++) {
      const layout = mockSlideLayout(i)
      if (config.scenario === 'unlockable' && i === 9) continue
      if (!seen.has(layout)) { seen.add(layout); representatives.push({ layout_id: layout, label: LAYOUT_LABELS[layout] ?? layout, slide_index: i }) }
    }
    representatives.sort((a, b) => LAYOUT_ORDER.indexOf(a.layout_id) - LAYOUT_ORDER.indexOf(b.layout_id))
    out.push({ at: readyAt, event: { type: 'template_ready', template_id: `mock-template-${sessionId}`, capabilities: { use_original: 'available', new_topic: 'available' }, layouts: { count: representatives.length, representatives } } })
  }
  // Stable order: by time, then by insertion; seq follows that order.
  return out.map((item, order) => ({ ...item, order })).sort((a, b) => a.at - b.at || a.order - b.order)
    .map((item, seq) => ({ at: item.at, event: { ...item.event, job_id, seq: seq + 1 } as unknown as TemplateWorkspaceEvent }))
}

const fixtureDeck: TemplateFixtureDeck = {
  slideHtml: mockSlideHtml,
  slideLabel: mockSlideLabel,
  slideElements: mockSlideElements,
}

export function createMockTemplateWorkspaceSource(record: TemplateWorkspaceRecord, userKey: string): TemplateWorkspaceSource {
  void userKey
  const resumeKey = `${RESUME_PREFIX}${record.session_id}`
  const readResume = (): number | null => {
    try { const value = Number(window.sessionStorage.getItem(resumeKey)); return Number.isFinite(value) && value > 0 ? value : null } catch { return null }
  }
  const running = new Set<{ start: () => void }>()
  const source: TemplateWorkspaceSource = {
    kind: 'mock',
    subscribe(emit) {
      let timeline: Timed[] = []
      let next = 0
      let timer: ReturnType<typeof setTimeout> | null = null
      const pump = () => {
        timer = null
        const now = Date.now()
        while (next < timeline.length && timeline[next].at <= now) emit(timeline[next++].event)
        if (next < timeline.length) timer = setTimeout(pump, Math.max(0, timeline[next].at - Date.now()))
      }
      // (Re)start from the beginning: events already seen come again with the same seq, which the reducer ignores.
      const run = { start: () => { if (timer) clearTimeout(timer); timeline = buildTemplateMockTimeline(record, readTemplateMockConfig(record.session_id), readResume()); next = 0; pump() } }
      running.add(run)
      run.start()
      return () => { if (timer) clearTimeout(timer); timer = null; running.delete(run) }
    },
    commands: {
      resume: () => {
        try { window.sessionStorage.setItem(resumeKey, String(Date.now())) } catch { /* the mock cannot resume without storage */ }
        running.forEach(run => run.start())
      },
      startDeck: async mode => `Mock event source: a new deck would start here from this template (${mode === 'as_is' ? 'Reuse as-is' : 'New topic'}). Nothing was created.`,
    },
    fixture: () => fixtureDeck,
  }
  return source
}
