// Template "What changed" admission report, Studio half (flag NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT): the lines this change adds to the Template library
// dialog, which other pins hold to a base commit ("without the added lines the file is <base>'s"). scripts/studio-template-progress-strip.mjs applies these first, so every
// sibling pin that strips the template-progress lines strips these too (the same pattern as the J2-04 and template-progress lines). scripts/test-studio-template-admission-report.mjs
// proves the strip against the dialog's own base commit and that every addition is flag-gated or inert flag off.
//
// Every addition is inert with the flag off: ADMISSION_REPORT is false, so admissionReportAround(...) returns the row's block itself (the same React element), and
// `templateProgress.report(template.id)` is the hook's value for "nothing" (null) or the tracked job's report, which nothing reads while the flag is off.

const DIALOG = 'components/builder/composer-library-dialog.tsx'

export const ADMISSION_ADDITIONS = [
  // the import of the wrapper, with its comment
  [/\/\/ NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT \(default off\): [^\n]*\nimport \{ admissionReportAround \} from '@\/components\/builder\/composer-admission-report'\n/, ''],
  // the flag, read once, with its comment
  [/\/\/ NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT \(exact "true", default off\)\.[^\n]*\nconst ADMISSION_REPORT = process\.env\.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT === 'true'\n/, ''],
  // the row's first block, handed to the wrapper: the opening of the call ...
  [/\{admissionReportAround\(ADMISSION_REPORT, template, templateProgress\.report\(template\.id\), (<div data-studio-composer-record-row=)/, '$1'],
  // ... and its closing
  [/(\n {16}<\/div>), studioShell\)\}(\n {16}\{newTopicEnabled && newTopicTemplateId === template\.id)/, '$1$2'],
]

/** `text` of repo file `rel` without this change's additions (any other file comes back as it is). */
export function stripAdmissionReport(rel, text) {
  return rel === DIALOG ? ADMISSION_ADDITIONS.reduce((out, [from, to]) => out.replace(from, to), text) : text
}
