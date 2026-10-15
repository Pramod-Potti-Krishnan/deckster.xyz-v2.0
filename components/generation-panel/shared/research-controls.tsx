'use client'

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ElementResearchCapabilities, ElementResearchMode } from '@/types/textlabs'
import { STUDIO_DISABLED_REASONS_ENABLED, REASON_SOURCE_UNAVAILABLE } from '@/lib/studio-disabled-reasons'

const RESEARCH_OFF_REASON = 'Enable Research to select sources.'
/** PASS2B J6-01 (NEXT_PUBLIC_STUDIO_DISABLED_REASONS, default off): the one id that describes every source greyed only because Research is off. */
const RESEARCH_OFF_REASON_ID = 'research-sources-reason'
const sourceReasonId = (label: string) => `research-${label.replace(/\s+/g, '-').toLowerCase()}-reason`
/** Why a source is greyed (null when it is selectable): its own capability reason first, then "Research is off". */
const sourceReason = (researchEnabled: boolean, capability: { available: boolean; reason?: string | null }) => !capability.available && capability.reason
  ? capability.reason
  : !researchEnabled ? RESEARCH_OFF_REASON : null

export interface ResearchControlsProps {
  researchMode: ElementResearchMode
  researchWeb: boolean
  researchUploadedDocs: boolean
  researchKnowledgeGraph: boolean
  researchCapabilities: ElementResearchCapabilities
  onResearchEnabledChange: (enabled: boolean) => void
  onResearchWebChange: (enabled: boolean) => void
  onResearchUploadedDocsChange: (enabled: boolean) => void
  onResearchKnowledgeGraphChange: (enabled: boolean) => void
}

export function ResearchControls({
  researchMode,
  researchWeb,
  researchUploadedDocs,
  researchKnowledgeGraph,
  researchCapabilities,
  onResearchEnabledChange,
  onResearchWebChange,
  onResearchUploadedDocsChange,
  onResearchKnowledgeGraphChange,
}: ResearchControlsProps) {
  const enabled = researchMode === 'on'
  return (
    <TooltipProvider delayDuration={200}>
      <section aria-labelledby="element-research-heading" className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span id="element-research-heading" className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Research</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="How research context is used" className="rounded p-0.5 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-slate-200">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-64 text-[11px] leading-4">
                Your prompt comes first, then the current slide, then deck context. Selected research sources provide supporting evidence.
              </TooltipContent>
            </Tooltip>
          </div>
          <Switch aria-label="Enable research" checked={enabled} onCheckedChange={onResearchEnabledChange} className="scale-90" />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1" role="group" aria-label="Research sources">
          <ResearchSourceCheckbox label="Web Search" checked={researchWeb} researchEnabled={enabled} capability={researchCapabilities.web} onCheckedChange={onResearchWebChange} />
          <ResearchSourceCheckbox label="Uploaded Documents" checked={researchUploadedDocs} researchEnabled={enabled} capability={researchCapabilities.uploaded_documents} onCheckedChange={onResearchUploadedDocsChange} />
          <ResearchSourceCheckbox label="Knowledge Graph" checked={researchKnowledgeGraph} researchEnabled={enabled} capability={researchCapabilities.knowledge_graph} onCheckedChange={onResearchKnowledgeGraphChange} />
        </div>
        {STUDIO_DISABLED_REASONS_ENABLED && (
          <VisibleSourceReasons
            researchEnabled={enabled}
            sources={[
              ['Web Search', researchCapabilities.web],
              ['Uploaded Documents', researchCapabilities.uploaded_documents],
              ['Knowledge Graph', researchCapabilities.knowledge_graph],
            ]}
          />
        )}
      </section>
    </TooltipProvider>
  )
}

function ResearchSourceCheckbox({
  label,
  checked,
  researchEnabled,
  capability,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  researchEnabled: boolean
  capability: { available: boolean; reason?: string | null }
  onCheckedChange: (enabled: boolean) => void
}) {
  const disabled = !researchEnabled || !capability.available
  const reason = sourceReason(researchEnabled, capability)
  // PASS2B J6-01: with the flag on the reason is a visible line under the row (VisibleSourceReasons) and the checkbox is described by that line,
  // so the sr-only copy inside the label is dropped (it would be read twice). Flag off: exactly as before.
  const visibleReason = STUDIO_DISABLED_REASONS_ENABLED && disabled
  const reasonId = visibleReason && reason === RESEARCH_OFF_REASON ? RESEARCH_OFF_REASON_ID : sourceReasonId(label)
  return (
    <label
      title={reason ?? undefined}
      className={cn(
      'flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-[10px] font-medium',
      disabled ? 'cursor-not-allowed text-slate-400 dark:text-slate-500' : 'cursor-pointer text-slate-700 dark:text-slate-200',
      )}
    >
      <Checkbox
        aria-label={`Use ${label}`}
        aria-describedby={reason || visibleReason ? reasonId : undefined}
        checked={researchEnabled && capability.available && checked}
        disabled={disabled}
        onCheckedChange={value => onCheckedChange(value === true)}
        className="h-3.5 w-3.5"
      />
      <span className="whitespace-nowrap">{label}</span>
      {reason && !visibleReason && <span id={reasonId} className="sr-only">{reason}</span>}
    </label>
  )
}

/**
 * PASS2B J6-01: one short line per distinct reason, under the sources row, for every greyed source: the same words the hover title always had,
 * now readable without hovering (a disabled checkbox cannot take keyboard focus, so a title is unreachable for keyboard and touch users).
 * Sources greyed only because Research is off share one line.
 */
function VisibleSourceReasons({
  researchEnabled,
  sources,
}: {
  researchEnabled: boolean
  sources: ReadonlyArray<readonly [string, { available: boolean; reason?: string | null }]>
}) {
  const lines: Array<{ id: string; text: string }> = []
  for (const [label, capability] of sources) {
    if (researchEnabled && capability.available) continue
    const reason = sourceReason(researchEnabled, capability) ?? REASON_SOURCE_UNAVAILABLE
    const id = reason === RESEARCH_OFF_REASON ? RESEARCH_OFF_REASON_ID : sourceReasonId(label)
    if (!lines.some(line => line.id === id)) lines.push({ id, text: reason })
  }
  if (!lines.length) return null
  return (
    <div data-studio-research-reasons="true" className="mt-1 space-y-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
      {lines.map(line => <p key={line.id} id={line.id}>{line.text}</p>)}
    </div>
  )
}
