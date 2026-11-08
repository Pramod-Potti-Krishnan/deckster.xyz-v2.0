// FRONTEND-1's a11y and picker follow-ups (frontend1/a11y-picker-followups, 4 Nov, no flag: always on), restacked onto Studio dev eeb78d4f by FRONTEND-2 (merge only). This strip is the change's registration, written in the restack.
//   UX-23/24/25 accessibility basics: Settings > Notifications and Privacy name each Switch by aria-labelledby (the visible Label gets an id), the Intelligence task buttons carry an aria-label, and the disabled primary button
//   (.sl-primary:disabled) draws from shared tokens (WCAG AA). Plus the simplified model picker's drag view (components/model-choice/model-picker-simple.tsx, lib/studio-model-picker-simple.ts: pinned by its own proof).
// Three app files rewrite or add whole lines: A11Y_PICKER_FOLLOWUPS_EDITS holds [line now, line before] (a pure insertion has an empty line before) and the strip puts the line before back. The four CSS lines this change
// adds carry the marker A11Y-PICKER-FOLLOWUPS (a whole token, a CSS comment) and come out. Strip the change and each of the five files is dev's, byte for byte. Plain node, nothing read from disk or git here.
// How the older pins reach it: registered in scripts/studio-later-changes.mjs (two lines: its scope files and this strip; the change adds no .env.example block).

export const A11Y_PICKER_FOLLOWUPS_MARKER_RE = /(?<![\w-])A11Y-PICKER-FOLLOWUPS(?![\w-])/

/** [line now, line before] per edited line in the three app files. */
export const A11Y_PICKER_FOLLOWUPS_EDITS = {
  "app/(app)/settings/notifications/page.tsx": [
    [
      "              <div><Label htmlFor={id} id={`${id}-label`}>{row.label}</Label><p id={`${id}-help`}>{row.desc}</p><p id={`${id}-status`} className={confirmed && !hasChoice ? \"sn-confirmed\" : undefined} role=\"status\">{LAUNCH_WORDING ? \"Not available\" : saving === row.key ? \"Saving local choice…\" : hasChoice ? `Unsaved local choice · last confirmed ${confirmed?.[row.key] ? \"on\" : \"off\"}` : confirmed ? `${savedKey === row.key ? \"Save confirmed\" : \"Last confirmed\"} · ${confirmed[row.key] ? \"On\" : \"Off\"}` : \"Not loaded\"}</p></div>\n",
      "              <div><Label htmlFor={id}>{row.label}</Label><p id={`${id}-help`}>{row.desc}</p><p id={`${id}-status`} className={confirmed && !hasChoice ? \"sn-confirmed\" : undefined} role=\"status\">{LAUNCH_WORDING ? \"Not available\" : saving === row.key ? \"Saving local choice…\" : hasChoice ? `Unsaved local choice · last confirmed ${confirmed?.[row.key] ? \"on\" : \"off\"}` : confirmed ? `${savedKey === row.key ? \"Save confirmed\" : \"Last confirmed\"} · ${confirmed[row.key] ? \"On\" : \"Off\"}` : \"Not loaded\"}</p></div>\n"
    ],
    [
      "              <Switch id={id} aria-labelledby={`${id}-label`} checked={LAUNCH_WORDING ? false : choices[row.key] ?? confirmed?.[row.key] ?? false} onCheckedChange={(next) => void savePreference(row.key, next)} disabled={disabled} aria-describedby={`${id}-help ${id}-status${saveErrors[row.key] ? ` ${id}-error` : \"\"}`} />\n",
      "              <Switch id={id} checked={LAUNCH_WORDING ? false : choices[row.key] ?? confirmed?.[row.key] ?? false} onCheckedChange={(next) => void savePreference(row.key, next)} disabled={disabled} aria-describedby={`${id}-help ${id}-status${saveErrors[row.key] ? ` ${id}-error` : \"\"}`} />\n"
    ],
    [
      "                  <Label id={`notification-legacy-${row.key}-label`}>{row.label}</Label>\n",
      "                  <Label>{row.label}</Label>\n"
    ],
    [
      "                  aria-labelledby={`notification-legacy-${row.key}-label`}\n",
      ""
    ]
  ],
  "app/(app)/settings/privacy/page.tsx": [
    [
      "          <div className=\"sp-row\"><div><Label htmlFor=\"privacy-activity-tracking\" id=\"privacy-activity-label\">Activity Tracking</Label><p id=\"privacy-activity-help\">Allow us to collect usage data to improve the product</p><p id=\"privacy-activity-status\" className={confirmed !== null && choice === null ? \"sp-confirmed\" : undefined} role=\"status\">{saving ? \"Saving local choice…\" : choice !== null ? `Unsaved local choice · last confirmed ${confirmed ? \"on\" : \"off\"}` : confirmed === null ? \"Not loaded\" : `${saved ? \"Save confirmed\" : \"Last confirmed\"} · ${confirmed ? \"On\" : \"Off\"}`}</p></div><Switch id=\"privacy-activity-tracking\" aria-labelledby=\"privacy-activity-label\" checked={choice ?? confirmed ?? false} onCheckedChange={(next) => void saveTracking(next)} disabled={disabled} aria-describedby={`privacy-activity-help privacy-activity-status${saveError ? \" privacy-activity-error\" : \"\"}`} /></div>\n",
      "          <div className=\"sp-row\"><div><Label htmlFor=\"privacy-activity-tracking\">Activity Tracking</Label><p id=\"privacy-activity-help\">Allow us to collect usage data to improve the product</p><p id=\"privacy-activity-status\" className={confirmed !== null && choice === null ? \"sp-confirmed\" : undefined} role=\"status\">{saving ? \"Saving local choice…\" : choice !== null ? `Unsaved local choice · last confirmed ${confirmed ? \"on\" : \"off\"}` : confirmed === null ? \"Not loaded\" : `${saved ? \"Save confirmed\" : \"Last confirmed\"} · ${confirmed ? \"On\" : \"Off\"}`}</p></div><Switch id=\"privacy-activity-tracking\" checked={choice ?? confirmed ?? false} onCheckedChange={(next) => void saveTracking(next)} disabled={disabled} aria-describedby={`privacy-activity-help privacy-activity-status${saveError ? \" privacy-activity-error\" : \"\"}`} /></div>\n"
    ],
    [
      "              <Label id=\"privacy-activity-legacy-label\">Activity Tracking</Label>\n",
      "              <Label>Activity Tracking</Label>\n"
    ],
    [
      "                aria-labelledby=\"privacy-activity-legacy-label\"\n",
      ""
    ]
  ],
  "components/studio-personal/intelligence-workspace.tsx": [
    [
      "        <section className=\"sp-workflow-tasks\" aria-labelledby=\"sp-workflows-heading\"><div className=\"sp-section-heading\"><h2 id=\"sp-workflows-heading\">Choose the work you want to do</h2></div>{taskIds.map(id => { const Icon = taskDetails[id].icon; return <button type=\"button\" key={id} className=\"sp-workflow-task\" aria-label={catalog.tasks[id].label} aria-pressed={activeTask === id} onClick={() => setActiveTask(id)}><span className=\"sp-task-icon\"><Icon size={20} aria-hidden=\"true\" /></span><span><strong>{catalog.tasks[id].label}</strong><small>{taskDetails[id].description}</small>{briefs[id] && <em>Local brief drafted</em>}</span><ArrowRight size={15} aria-hidden=\"true\" /></button> })}<div className=\"sp-inline-note\"><Info size={16} aria-hidden=\"true\" /><p>Model assignments and reusable model preferences are not connected. Studio’s existing settings and permission checks remain authoritative.</p></div></section>\n",
      "        <section className=\"sp-workflow-tasks\" aria-labelledby=\"sp-workflows-heading\"><div className=\"sp-section-heading\"><h2 id=\"sp-workflows-heading\">Choose the work you want to do</h2></div>{taskIds.map(id => { const Icon = taskDetails[id].icon; return <button type=\"button\" key={id} className=\"sp-workflow-task\" aria-pressed={activeTask === id} onClick={() => setActiveTask(id)}><span className=\"sp-task-icon\"><Icon size={20} aria-hidden=\"true\" /></span><span><strong>{catalog.tasks[id].label}</strong><small>{taskDetails[id].description}</small>{briefs[id] && <em>Local brief drafted</em>}</span><ArrowRight size={15} aria-hidden=\"true\" /></button> })}<div className=\"sp-inline-note\"><Info size={16} aria-hidden=\"true\" /><p>Model assignments and reusable model preferences are not connected. Studio’s existing settings and permission checks remain authoritative.</p></div></section>\n"
    ]
  ]
}

/** Existing files with changed lines. */
export const A11Y_PICKER_FOLLOWUPS_FILES = [
  "app/(app)/settings/notifications/page.tsx",
  "app/(app)/settings/privacy/page.tsx",
  "components/studio-personal/intelligence-workspace.tsx",
  "components/studio-libraries/libraries.css",
  "components/studio-libraries/themes-fidelity.css"
]

/** Every file this change's commit touches. */
export const A11Y_PICKER_FOLLOWUPS_SCOPE_FILES = new Set([
  "app/(app)/settings/notifications/page.tsx",
  "app/(app)/settings/privacy/page.tsx",
  "components/model-choice/model-picker-simple.tsx",
  "components/studio-libraries/libraries.css",
  "components/studio-libraries/themes-fidelity.css",
  "components/studio-personal/intelligence-workspace.tsx",
  "lib/studio-model-picker-simple.ts",
  "scripts/studio-a11y-picker-followups-strip.mjs",
  "scripts/studio-later-changes.mjs",
  "scripts/test-studio-a11y-basics.mjs",
  "scripts/test-studio-model-picker-simple.mjs"
])

/** The file as it was before this change. Any other file is returned as it is. */
export function stripA11yPickerFollowups(rel, text) {
  if (typeof text !== 'string' || !A11Y_PICKER_FOLLOWUPS_FILES.includes(rel)) return text
  let out = text
  for (const [now, was] of A11Y_PICKER_FOLLOWUPS_EDITS[rel] || []) out = out.replace(now, () => was)
  return out.split('\n').filter(line => !A11Y_PICKER_FOLLOWUPS_MARKER_RE.test(line)).join('\n')
}
