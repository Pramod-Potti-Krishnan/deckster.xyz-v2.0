// Template "wow" flow, Studio half (flag NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS): the lines this change adds to the Template library dialog, which
// other pins hold to a base commit ("without the added lines the file is <base>'s"). Sibling pins call stripTemplateProgress(rel, text) first and
// then do what they always did, the way they already strip the J2-04 status lines (scripts/studio-add-slide-status-strip.mjs). scripts/test-studio-template-progress.mjs
// proves the strip against the dialog's own base commit, that every addition is flag-gated or inert flag off, and runs the dialog flag off and on.
//
// Every addition is inert with the flag off: `templateProgress` is the hook's inert answer (enabled false, no view, `uploadHeld` false, `held()` false,
// `around(node)` returns `node` itself), so each expression below has the value the line had before.

const DIALOG = 'components/builder/composer-library-dialog.tsx'

export const DIALOG_ADDITIONS = [
  // the import of the hook
  [/\/\/ NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS \(default off\): [^\n]*\nimport \{ useTemplateProgress \} from '@\/components\/builder\/composer-template-progress'\n/, ''],
  // the hook call, with its comment
  [/ {2}\/\/ NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS \(exact "true"\)\.[^\n]*\n {2}const templateProgress = useTemplateProgress\(\{\n(?: {4}[^\n]*\n)+ {2}\}\)\n\n/, ''],
  // upload(): hand the job to the hook instead of waiting for it
  [/ {6}\/\/ NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS: the job is read in the background[^\n]*\n {6}if \(templateProgress\.enabled\) \{\n(?: {8}[^\n]*\n)+ {6}\}\n/, ''],
  // the Upload button
  [/ \|\| templateProgress\.uploadHeld/, ''],
  // the progress slot: the card above the dialog's own line
  [/\{templateProgress\.around\(recoveryNotice \?\? \(progress && (<p [\s\S]*?<\/p>)\), studioShell\)\}/, '{recoveryNotice ?? (progress && $1)}'],
  // the three row buttons
  [/ \|\| templateProgress\.held\(template\.id, 'use'\)/, ''],
  [/ \|\| templateProgress\.held\(template\.id, 'ditto'\)/, ''],
  [/ \|\| templateProgress\.held\(template\.id, 'new-topic'\)/, ''],
]

/** `text` of repo file `rel` without this change's additions (any other file comes back as it is). */
export function stripTemplateProgress(rel, text) {
  return rel === DIALOG ? DIALOG_ADDITIONS.reduce((out, [from, to]) => out.replace(from, to), text) : text
}
