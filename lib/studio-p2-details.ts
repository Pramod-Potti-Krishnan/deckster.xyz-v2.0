/**
 * PASS2-PAGES Your details (streams/ops/PASS2-PAGES/your-details.md) DET-03: the presenter card carries the mock's full field set: author,
 * professional title, organization, contact email, website, confidentiality line and a logo URL (https only). It stays a local preview, as
 * before: nothing is saved or applied to decks. DET-12 (shared shell row) is its own PR; the other rows are keep / third option.
 *
 * Flag NEXT_PUBLIC_STUDIO_P2_DETAILS: exact "true" and the literal Studio shell. Off: every rendered byte is unchanged.
 * Import-free on purpose, so scripts/test-studio-p2-details.mjs can run the real file in a bare vm.
 */
export const STUDIO_P2_DETAILS_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_DETAILS === 'true'

/** A logo URL the preview may show: absolute https only, no credentials. Anything else is null (and the field says why). */
export function httpsLogoUrl(value: string): string | null {
  const text = value.trim()
  if (!text) return null
  let url: URL
  try { url = new URL(text) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return null
  return url.toString()
}

/** The field's message: null when empty or usable. */
export function logoUrlProblem(value: string): string | null {
  return value.trim() && !httpsLogoUrl(value) ? 'Use a full https:// address to an image.' : null
}

/** The website as shown on a slide: without the scheme and a trailing slash ("https://acme.com/" -> "acme.com"). */
export function websiteForSlide(value: string): string {
  return value.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

/** The byline's contact part: email and website joined, either may be empty. */
export function contactLine(email: string, website: string): string {
  return [email.trim(), websiteForSlide(website)].filter(Boolean).join(' · ')
}
