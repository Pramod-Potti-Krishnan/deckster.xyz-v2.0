"use client"

// Template "What changed" admission report, the slide strip of a library row. Flag NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT (read by the dialog and handed in
// as `enabled`; this file reads no environment). The library list gives each row its report WITHOUT `slides`; the template read (Director's GET templates/{id}, through
// the Studio proxy) has them. With the flag on the dialog asks for that read ONCE per template, when the row's report is opened (a report that opens by itself asks
// once it is drawn), one read at a time, keeps the answer for as long as the dialog lives, and fails quietly: a read that fails, or answers with no report, leaves the
// row as the list drew it and is not asked again. Flag off: an inert answer (no read, nothing kept, no effect that does anything).
import { useCallback, useEffect, useRef, useState } from 'react'
import { composerRequest } from '@/lib/composer-library'
import { templateDetailReport } from '@/lib/studio-template-admission-report'

export interface AdmissionDetails {
  /** The template read's report of `templateId` (not looked into here), or null: not asked yet, on its way, failed, or the row has none. */
  report: (templateId: string) => unknown
  /** The row's report is drawn open by itself: ask for the template read once this render is on screen. Safe to call on every render. */
  want: (templateId: string) => void
  /** The person opened the row's report: ask for the template read now (once). */
  open: (templateId: string) => void
}

const INERT: AdmissionDetails = { report: () => null, want() {}, open() {} }

export function useAdmissionDetails(enabled: boolean): AdmissionDetails {
  const [reports, setReports] = useState<Record<string, unknown>>({})
  const asked = useRef<Set<string>>(new Set())
  const wanted = useRef<Set<string>>(new Set())
  const queue = useRef<Promise<void>>(Promise.resolve())
  const controller = useRef<AbortController | null>(null)

  const open = useCallback((templateId: string) => {
    if (asked.current.has(templateId)) return
    asked.current.add(templateId)
    const signal = (controller.current ??= new AbortController()).signal
    // One read at a time, in the order asked: a template read loads the whole stored template on Director.
    queue.current = queue.current.then(async () => {
      if (signal.aborted) return
      try {
        const row = await composerRequest<unknown>(`templates/${encodeURIComponent(templateId)}`, undefined, signal)
        const report = templateDetailReport(row, templateId)
        if (report && !signal.aborted) setReports(current => ({ ...current, [templateId]: report }))
      } catch { /* quietly: the row stays as the list drew it */ }
    })
  }, [])

  // Rows whose report opens by itself are asked after the render that drew them (every render: `open` asks each template once).
  useEffect(() => { wanted.current.forEach(open) })
  // The dialog going away stops what is on its way and forgets what was asked.
  useEffect(() => () => {
    controller.current?.abort()
    controller.current = null
    asked.current = new Set()
    queue.current = Promise.resolve()
  }, [])

  if (!enabled) return INERT
  return { report: templateId => reports[templateId] ?? null, want: templateId => { wanted.current.add(templateId) }, open }
}
