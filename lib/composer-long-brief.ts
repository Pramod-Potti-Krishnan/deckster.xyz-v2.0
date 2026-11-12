/**
 * Composer ask 14, long new-topic brief. Import-free.
 * Director takes a brief of 20 to 4,000 characters, or up to 16,000 with COMPOSER_LONG_BRIEF_ENABLED
 * (stage_template_router.py `use_fields["brief"]`, LONG_BRIEF_MAX in composer_stage1b.py). Its `use` route reads the
 * JSON body with no size limit, so with the Studio flag on the reference-size cap is lifted for `use` only: 16,000
 * UTF-16 units is at most 48,000 bytes of UTF-8 (a CJK brief), plus the JSON frame.
 */
export const COMPOSER_BRIEF_MIN = 20
export const COMPOSER_BRIEF_MAX = 4000
export const COMPOSER_LONG_BRIEF_MAX = 16000
export const COMPOSER_REFERENCE_MAX_BYTES = 16384
export const COMPOSER_LONG_BRIEF_MAX_BYTES = 65536

/** Largest trimmed brief, in the same `String.length` units the proxy and the dialog already count. */
export function composerBriefMax(longBriefEnabled: boolean): number {
  return longBriefEnabled ? COMPOSER_LONG_BRIEF_MAX : COMPOSER_BRIEF_MAX
}

/** Request-body cap in bytes. Only `use` grows with the flag; `upload-reference` stays a small storage reference. */
export function composerReferenceMaxBytes(use: boolean, longBriefEnabled: boolean): number {
  return use && longBriefEnabled ? COMPOSER_LONG_BRIEF_MAX_BYTES : COMPOSER_REFERENCE_MAX_BYTES
}

export function composerBriefLengthValid(brief: string, longBriefEnabled: boolean): boolean {
  const length = brief.trim().length
  return length >= COMPOSER_BRIEF_MIN && length <= composerBriefMax(longBriefEnabled)
}

/** The dialog's "too long / too short" copy, with the limit written out (4,000 or 16,000). */
export function composerBriefLimitMessage(longBriefEnabled: boolean): string {
  const max = String(composerBriefMax(longBriefEnabled)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `Describe the new presentation in ${COMPOSER_BRIEF_MIN} to ${max} characters.`
}
