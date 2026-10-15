// PASS2B G42 (flag NEXT_PUBLIC_STUDIO_TEMPLATES_NOTICE_PLAIN, default off). Import-free: two sentences only.
//
// The Templates page shows a notice when saved templates are not switched on (NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED unset). Its words were written for
// developers ("not enabled in this environment", "when enabled"); the accepted v4 mockup has no such notice. Behind the flag the notice says the same
// thing in plain words. It stays (the condition is unchanged: saved templates really are unavailable), and PK may reword it: change PLAIN here.

export const TEMPLATES_NOTICE_ORIGINAL = 'Saved templates are not enabled in this environment. You can sketch a local draft; connected creation and reuse remain in Studio when enabled.'
export const TEMPLATES_NOTICE_PLAIN = 'Saved templates are not available yet. You can still sketch a draft here and continue planning it in Studio.'

/** The notice's words for a flag already resolved (and Studio-qualified) by the caller. */
export function templatesNoticeText(plain: boolean): string {
  return plain === true ? TEMPLATES_NOTICE_PLAIN : TEMPLATES_NOTICE_ORIGINAL
}
