"use client"

// Template "What changed" admission report, Studio half: what the Template library (composer-library-dialog.tsx) draws under a template's row.
// Flag NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT (exact "true", default off), read once by the dialog. The dialog wraps the row's first block in
// admissionReportAround(...): flag off it returns that block itself (the row is the tree it always was); flag on it returns the block with the report after it,
// or the block itself when there is no report to show. The report's rules (what reads as one, the rank order, the emphasised outcomes, the strip) are in
// lib/studio-template-admission-report.ts (pure, pinned by scripts/test-studio-template-admission-report.mjs); this file is the React around them.
import type { ReactNode } from 'react'
import { EyeOff, Image as ImageIcon, Info, Layers, ScanSearch, Scissors, SlidersHorizontal, Type, Wrench } from 'lucide-react'
import {
  ADMISSION_OUTCOME_WORDS, admissionReportFor, type AdmissionOutcomeOrOther, type AdmissionReportView,
} from '@/lib/studio-template-admission-report'
import './studio-template-admission-report.css'

const OUTCOME_ICON: Record<AdmissionOutcomeOrOther, typeof Info> = {
  text_left_out: Type, floor: Layers, dropped: EyeOff, picture: ImageIcon, check: ScanSearch, rebuilt: Wrench, simplified: SlidersHorizontal, text_split: Scissors, other: Info,
}

/** One template's report: the headline, the changes in rank order (the four that need a look emphasised), and the slide strip when the answer has slides. */
export function AdmissionReportBlock({ view, studioShell }: { view: AdmissionReportView; studioShell: boolean }) {
  return (
    <div data-studio-admission-report={studioShell ? 'true' : undefined} role="group" aria-label="What changed" className="space-y-2 rounded-md bg-muted/40 p-3 text-xs">
      <p className="font-medium">What changed</p>
      <p data-studio-admission-headline={studioShell ? 'true' : undefined} className="text-muted-foreground">{view.headline}</p>
      {view.rows.length > 0 && <details data-studio-admission-details={studioShell ? 'true' : undefined} open={view.open}>
        <summary className="cursor-pointer text-muted-foreground">List of changes</summary>
        <ul aria-label="Changes" className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
          {view.rows.map((row, index) => {
            const Icon = OUTCOME_ICON[row.outcome]
            return <li key={index} data-studio-admission-row={studioShell ? row.outcome : undefined} data-studio-admission-emphasis={studioShell && row.emphasised ? 'true' : undefined}
              className={`flex items-start gap-2 ${row.emphasised ? 'font-medium' : ''}`}>
              <Icon role="img" aria-label={ADMISSION_OUTCOME_WORDS[row.outcome]} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{row.text}</span>
            </li>
          })}
        </ul>
        {view.moreLine && <p data-studio-admission-more={studioShell ? 'true' : undefined} className="mt-1.5 text-muted-foreground">{view.moreLine}</p>}
        {view.strip && view.strip.length > 0 && <div className="mt-2 space-y-1">
          <p className="text-muted-foreground">Slide by slide</p>
          <ul aria-label="Slide by slide" className="flex flex-wrap gap-1">
            {view.strip.map(chip => <li key={chip.slide} title={chip.label} aria-label={chip.label} data-studio-admission-chip={studioShell ? chip.kind : undefined}
              className="min-w-[1.5rem] rounded border px-1 text-center">{chip.slide}</li>)}
          </ul>
          {view.stripNote && <p className="text-muted-foreground">{view.stripNote}</p>}
        </div>}
      </details>}
    </div>
  )
}

/**
 * The row's first block `node`, with the template's report after it. `template.admission_report` is the library list's (no slides); `jobReport` is the tracked
 * upload's job read for this template (with slides), or null: it wins when it reads as a report. Flag off, or no report to show: `node` itself.
 */
export function admissionReportAround(enabled: boolean, template: object, jobReport: unknown, node: ReactNode, studioShell: boolean): ReactNode {
  if (!enabled) return node
  const view = admissionReportFor(jobReport, (template as { admission_report?: unknown }).admission_report)
  return view ? <>{node}<AdmissionReportBlock view={view} studioShell={studioShell} /></> : node
}
