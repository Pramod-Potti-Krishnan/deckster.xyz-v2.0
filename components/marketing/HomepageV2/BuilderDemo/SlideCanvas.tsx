"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  AGENT_TEAM,
  type AgentId,
} from "@/lib/marketing/homepage-v2-content"
import type {
  ChartData,
  ChoreoState,
  MetricData,
  SlideElementSpec,
  TitleData,
} from "./types"

interface SlideCanvasProps {
  state: ChoreoState
  reducedMotion: boolean
}

export function SlideCanvas({ state, reducedMotion }: SlideCanvasProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      <SlideSurface state={state} reducedMotion={reducedMotion} />
      <AgentRail pulsing={state.pulsingAgents} reducedMotion={reducedMotion} />
    </div>
  )
}

function SlideSurface({ state, reducedMotion }: SlideCanvasProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
      {/* 16:9 aspect ratio surface */}
      <div className="relative w-full pt-[56.25%]">
        <motion.div
          aria-label="Slide preview"
          className="absolute inset-0"
          animate={{ backgroundColor: state.slideBg }}
          initial={false}
          transition={{
            duration: reducedMotion ? 0 : 0.7,
            ease: "easeOut",
          }}
          style={{
            backgroundColor:
              state.slideBg === "transparent" ? "#0e1422" : undefined,
          }}
        >
          {/* 12-col x 6-row grid overlay (no visible lines, just layout). */}
          <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-2 p-3 sm:gap-3 sm:p-4">
            <AnimatePresence>
              {state.slideElements.map((el) => (
                <motion.div
                  key={`${state.seq}-${el.id}`}
                  initial={
                    reducedMotion
                      ? false
                      : { opacity: 0, y: 8, scale: 0.98 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.45,
                    ease: "easeOut",
                  }}
                  style={{
                    gridColumn: `${el.col + 1} / span ${el.span}`,
                    gridRow: `${el.row + 1} / span ${el.rowSpan}`,
                  }}
                  className="min-h-0 min-w-0"
                >
                  <ElementRenderer element={el} reducedMotion={reducedMotion} />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* When no elements yet, show a faint placeholder so the canvas
                doesn't look empty during the first ~6 seconds of the loop. */}
            {state.slideElements.length === 0 ? (
              <div
                aria-hidden
                className="col-span-12 row-span-6 flex items-center justify-center"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/25">
                  awaiting plan
                </span>
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

interface ElementRendererProps {
  element: SlideElementSpec
  reducedMotion: boolean
}

function ElementRenderer({ element, reducedMotion }: ElementRendererProps) {
  switch (element.data.kind) {
    case "title":
      return <TitleEl data={element.data} />
    case "metric":
      return <MetricEl data={element.data} />
    case "chart":
      return <ChartEl data={element.data} reducedMotion={reducedMotion} />
  }
}

function TitleEl({ data }: { data: TitleData }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <h3 className="text-balance text-base font-bold leading-tight text-white sm:text-xl md:text-2xl">
        {data.text}
      </h3>
      {data.subtitle ? (
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/55 sm:text-xs">
          {data.subtitle}
        </p>
      ) : null}
    </div>
  )
}

function MetricEl({ data }: { data: MetricData }) {
  return (
    <div
      className="flex h-full flex-col justify-center rounded-lg border px-3 py-2"
      style={{
        backgroundColor: `${data.color}14`,
        borderColor: `${data.color}55`,
        boxShadow: `inset 0 0 30px -10px ${data.color}66`,
      }}
    >
      <div
        className="text-xl font-bold leading-none tracking-tight sm:text-2xl md:text-3xl"
        style={{ color: data.color }}
      >
        {data.value}
      </div>
      <div className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-white/65 sm:text-[10px]">
        {data.label}
      </div>
    </div>
  )
}

function ChartEl({
  data,
  reducedMotion,
}: {
  data: ChartData
  reducedMotion: boolean
}) {
  const max = Math.max(...data.bars, 1)
  return (
    <div
      className="flex h-full flex-col rounded-lg border px-3 py-2"
      style={{
        backgroundColor: `${data.color}10`,
        borderColor: `${data.color}45`,
      }}
    >
      <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/65 sm:text-[10px]">
        {data.label}
      </div>
      <div className="flex flex-1 items-end gap-1.5 sm:gap-2">
        {data.bars.map((value, i) => {
          const heightPct = (value / max) * 100
          return (
            <motion.div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                backgroundColor: data.color,
                opacity: 0.85,
              }}
              initial={
                reducedMotion ? { height: `${heightPct}%` } : { height: 0 }
              }
              animate={{ height: `${heightPct}%` }}
              transition={{
                duration: reducedMotion ? 0 : 0.7,
                delay: reducedMotion ? 0 : 0.1 + i * 0.08,
                ease: "easeOut",
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

interface AgentRailProps {
  pulsing: ReadonlySet<AgentId>
  reducedMotion: boolean
}

function AgentRail({ pulsing, reducedMotion }: AgentRailProps) {
  return (
    <div
      aria-label="Agent activity"
      className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-md"
    >
      {AGENT_TEAM.map((agent) => {
        const active = pulsing.has(agent.id)
        return (
          <div
            key={agent.id}
            className="flex items-center gap-1.5"
            title={agent.name}
          >
            <span className="relative inline-flex h-2.5 w-2.5">
              {active && !reducedMotion ? (
                <span
                  aria-hidden
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                  style={{ backgroundColor: agent.color }}
                />
              ) : null}
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full transition-opacity"
                style={{
                  backgroundColor: agent.color,
                  opacity: active ? 1 : 0.25,
                }}
              />
            </span>
            <span
              className="hidden text-[10px] font-medium tracking-wide transition-colors sm:inline"
              style={{ color: active ? "#ffffff" : "rgba(255,255,255,0.45)" }}
            >
              {agent.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
