// CA-J1F10. Literal "true" turns the fix on. Unset or anything else keeps the old hrefs.
export const LEGAL_LINKS_FIXED_ENABLED = process.env.NEXT_PUBLIC_LEGAL_LINKS_FIXED_ENABLED === 'true'

const HREFS = {
  terms: { off: '/terms', on: '/legal/terms' },
  privacy: { off: '/privacy', on: '/legal/privacy' },
} as const

export function legalHref(page: 'terms' | 'privacy'): '/terms' | '/privacy' | '/legal/terms' | '/legal/privacy' {
  const fixed = process.env.NEXT_PUBLIC_LEGAL_LINKS_FIXED_ENABLED === 'true'
  return HREFS[page][fixed ? 'on' : 'off']
}
