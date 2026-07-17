'use client'

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ElementResearchCapabilities, ElementResearchMode } from '@/types/textlabs'

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
  const reason = !capability.available && capability.reason
    ? capability.reason
    : !researchEnabled ? 'Enable Research to select sources.' : null
  const reasonId = `research-${label.replace(/\s+/g, '-').toLowerCase()}-reason`
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
        aria-describedby={reason ? reasonId : undefined}
        checked={researchEnabled && capability.available && checked}
        disabled={disabled}
        onCheckedChange={value => onCheckedChange(value === true)}
        className="h-3.5 w-3.5"
      />
      <span className="whitespace-nowrap">{label}</span>
      {reason && <span id={reasonId} className="sr-only">{reason}</span>}
    </label>
  )
}
