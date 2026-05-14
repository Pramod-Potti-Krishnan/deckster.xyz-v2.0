import type { AgentId } from "@/lib/marketing/homepage-v2-content"

export type ScopeId = "deck" | "slide" | "element"

export type SpeakerId = "user" | AgentId

export interface ChatLineSpec {
  id: string
  speaker: SpeakerId
  text: string
  /** Milliseconds to fully reveal the text via typewriter. */
  typeMs: number
}

export type SlideElementType = "title" | "metric" | "chart"

export interface TitleData {
  kind: "title"
  text: string
  subtitle?: string
}
export interface MetricData {
  kind: "metric"
  value: string
  label: string
  color: string
}
export interface ChartData {
  kind: "chart"
  bars: number[]
  color: string
  label: string
}

export type SlideElementData = TitleData | MetricData | ChartData

export interface SlideElementSpec {
  id: string
  type: SlideElementType
  /** 12-col grid; col is start (0..11), span is width (1..12) */
  col: number
  span: number
  /** 6-row grid; row is start (0..5), rowSpan is height */
  row: number
  rowSpan: number
  data: SlideElementData
}

export type ChoreoStep =
  | { t: number; kind: "scope"; scope: ScopeId }
  | { t: number; kind: "chat"; line: ChatLineSpec }
  | { t: number; kind: "agent_pulse_start"; agent: AgentId }
  | { t: number; kind: "agent_pulse_stop"; agent: AgentId }
  | { t: number; kind: "theme"; bgColor: string }
  | { t: number; kind: "element_add"; element: SlideElementSpec }
  | { t: number; kind: "reset" }

export interface ChoreoState {
  scope: ScopeId
  chatLines: ChatLineSpec[]
  /** Set of agents currently pulsing. */
  pulsingAgents: ReadonlySet<AgentId>
  slideBg: string
  slideElements: SlideElementSpec[]
  /** Increments on every reset so child keys can fully remount. */
  seq: number
}

export const INITIAL_STATE: ChoreoState = {
  scope: "deck",
  chatLines: [],
  pulsingAgents: new Set(),
  slideBg: "transparent",
  slideElements: [],
  seq: 0,
}
