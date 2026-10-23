// FRONTEND-2 P3-4 slice B: every long Studio request ends (NEXT_PUBLIC_STUDIO_JOB_DEADLINES, default off). The exact text this change adds
// to the files it touches (with enough of the base text around it to be unique), so a pin that holds one of them to an earlier commit
// can first put the base text back (stripJobDeadlines(rel, text)), the way the other *-strip.mjs files do. scripts/test-studio-job-deadlines.mjs
// proves that stripping gives back the base file byte for byte. New files (no base text): lib/studio-job-deadlines.ts, this file, the test.

// { file: [[text this change has, text the base has], ...] }; each `added` occurs once in the file.
const CHANGES = {
 "lib/api/download-service.ts": [
  [
   "  presentationUrl: string,\n  quality: DownloadQuality = 'high',\n  slideCount?: number | null\n): Promise<DownloadResult> {\n",
   "  presentationUrl: string,\n  quality: DownloadQuality = 'high'\n): Promise<DownloadResult> {\n"
  ],
  [
   "\n  // NEXT_PUBLIC_STUDIO_JOB_DEADLINES (P3-4, default off): the export is aborted at its slide-scaled deadline and ends in the failure\n  // the caller already shows. Loaded only when on; off, the request is exactly as before.\n  const jobs = process.env.NEXT_PUBLIC_STUDIO_JOB_DEADLINES === 'true' ? await import('@/lib/studio-job-deadlines') : null\n  const deadline = jobs ? jobs.startJobDeadline(jobs.exportDeadlineMs(slideCount)) : null\n  try {\n",
   "\n  try {\n"
  ],
  [
   "        'Accept': 'application/pdf'\n      },\n      body: JSON.stringify(request),\n      ...(deadline ? { signal: deadline.signal } : {})\n    });\n\n",
   "        'Accept': 'application/pdf'\n      },\n      body: JSON.stringify(request)\n    });\n\n"
  ],
  [
   "    if (!response.ok) {\n      deadline?.clear()\n      return await handleErrorResponse(response, 'PDF');\n",
   "    if (!response.ok) {\n      return await handleErrorResponse(response, 'PDF');\n"
  ],
  [
   "\n    // Get the blob\n    const blob = await response.blob();\n    deadline?.clear()\n\n    // Generate filename\n    const filename = generateFilename(presentationUrl, 'pdf');\n",
   "\n    // Get the blob\n    const blob = await response.blob();\n\n    // Generate filename\n    const filename = generateFilename(presentationUrl, 'pdf');\n"
  ],
  [
   "  } catch (error) {\n    deadline?.clear()\n    if (jobs && deadline?.timedOut()) return { success: false, error: jobs.jobDeadlineMessage('The PDF export', jobs.exportDeadlineMs(slideCount)) };\n    console.error('PDF download error:', error);\n",
   "  } catch (error) {\n    console.error('PDF download error:', error);\n"
  ],
  [
   "\n  // NEXT_PUBLIC_STUDIO_JOB_DEADLINES (P3-4, default off): as for the PDF.\n  const jobs = process.env.NEXT_PUBLIC_STUDIO_JOB_DEADLINES === 'true' ? await import('@/lib/studio-job-deadlines') : null\n  const deadline = jobs ? jobs.startJobDeadline(jobs.exportDeadlineMs(slideCount)) : null\n  try {\n",
   "\n  try {\n"
  ],
  [
   "        'Accept': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'\n      },\n      body: JSON.stringify(request),\n      ...(deadline ? { signal: deadline.signal } : {})\n    });\n\n",
   "        'Accept': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'\n      },\n      body: JSON.stringify(request)\n    });\n\n"
  ],
  [
   "    if (!response.ok) {\n      deadline?.clear()\n      return await handleErrorResponse(response, 'PPTX');\n",
   "    if (!response.ok) {\n      return await handleErrorResponse(response, 'PPTX');\n"
  ],
  [
   "\n    // Get the blob\n    const blob = await response.blob();\n    deadline?.clear()\n\n    // Generate filename\n    const filename = generateFilename(presentationUrl, 'pptx');\n",
   "\n    // Get the blob\n    const blob = await response.blob();\n\n    // Generate filename\n    const filename = generateFilename(presentationUrl, 'pptx');\n"
  ],
  [
   "  } catch (error) {\n    deadline?.clear()\n    if (jobs && deadline?.timedOut()) return { success: false, error: jobs.jobDeadlineMessage('The PowerPoint export', jobs.exportDeadlineMs(slideCount)) };\n    console.error('PPTX download error:', error);\n",
   "  } catch (error) {\n    console.error('PPTX download error:', error);\n"
  ]
 ],
 "components/narration-voice-picker.tsx": [
  [
   "import { useToast } from '@/hooks/use-toast'\n\n// NEXT_PUBLIC_STUDIO_JOB_DEADLINES (P3-4, default off): a narration request that hangs is aborted at its deadline (script / render 315 s,\n// the voice 30 s) and ends in the toast and button state the request already has. Off: the plain fetch, and nothing extra is loaded.\nasync function narrationFetch(input: string, init: RequestInit | undefined, kind: 'long' | 'voice'): Promise<Response> {\n  if (process.env.NEXT_PUBLIC_STUDIO_JOB_DEADLINES !== 'true') return fetch(input, init)\n  const jobs = await import('@/lib/studio-job-deadlines')\n  const ms = kind === 'long' ? jobs.NARRATION_LONG_DEADLINE_MS : jobs.NARRATION_VOICE_DEADLINE_MS\n  const deadline = jobs.startJobDeadline(ms)\n  try {\n    return await fetch(input, { ...init, signal: deadline.signal })\n  } catch (error) {\n    if (deadline.timedOut()) throw new Error(jobs.jobDeadlineMessage(kind === 'long' ? 'Narration' : 'Loading the voice', ms))\n    throw error\n  } finally {\n    deadline.clear()\n  }\n}\n\n",
   "import { useToast } from '@/hooks/use-toast'\n\n"
  ],
  [
   "      try {\n        const response = await narrationFetch(`/api/narration/voice?sessionId=${sessionId}`, undefined, 'voice')\n        const data = await response.json()\n",
   "      try {\n        const response = await fetch(`/api/narration/voice?sessionId=${sessionId}`)\n        const data = await response.json()\n"
  ],
  [
   "      try {\n        const response = await narrationFetch('/api/narration/voice', {\n          method: 'PATCH',\n",
   "      try {\n        const response = await fetch('/api/narration/voice', {\n          method: 'PATCH',\n"
  ],
  [
   "          body: JSON.stringify({ sessionId, voiceId: voice.id }),\n        }, 'voice')\n        const data = await response.json().catch(() => ({}))\n",
   "          body: JSON.stringify({ sessionId, voiceId: voice.id }),\n        })\n        const data = await response.json().catch(() => ({}))\n"
  ],
  [
   "    try {\n      const response = await narrationFetch('/api/narration/script', {\n        method: 'POST',\n",
   "    try {\n      const response = await fetch('/api/narration/script', {\n        method: 'POST',\n"
  ],
  [
   "        body: JSON.stringify({ slug, overwrite }),\n      }, 'long')\n      const data = await response.json().catch(() => ({}))\n",
   "        body: JSON.stringify({ slug, overwrite }),\n      })\n      const data = await response.json().catch(() => ({}))\n"
  ],
  [
   "    try {\n      const response = await narrationFetch('/api/narration/render', {\n        method: 'POST',\n",
   "    try {\n      const response = await fetch('/api/narration/render', {\n        method: 'POST',\n"
  ],
  [
   "        body: JSON.stringify({ slug, estimate: !confirmed }),\n      }, 'long')\n      const data = await response.json().catch(() => ({}))\n",
   "        body: JSON.stringify({ slug, estimate: !confirmed }),\n      })\n      const data = await response.json().catch(() => ({}))\n"
  ]
 ],
 ".env.example": [
  [
   "\n# P3-4 EVERY LONG STUDIO REQUEST ENDS (FRONTEND-2, Studio side of P3-4, slice B). On for the exact value \"true\"; default off, and then\n# nothing changes and nothing extra is loaded. Build-time value: change it on Vercel and redeploy. On, these requests, which could hang\n# with a spinner and no end, are aborted at a deadline and end in the failure state they already have (the user runs them again; nothing\n# is retried automatically): the PowerPoint export (30 s + 3 s per slide, at most 5 min: derived from the logged 42.7 s for a 42-slide\n# PDF, 3x margin), the PDF export (the same rule; the Download menu passes no slide count, so 5 min there), narration script and render\n# (315 s: their routes run at most 300 s) and reading or saving the narration voice (30 s). Director's own jobs (slide compose / refine,\n# deck build, chat directives) are not timed here: Director's job ledger fails those itself.\nNEXT_PUBLIC_STUDIO_JOB_DEADLINES=\"false\"\n",
   ""
  ]
 ]
}

export const JOB_DEADLINES_FILES = Object.keys(CHANGES)

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripJobDeadlines(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}
