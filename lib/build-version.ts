export const BUILD_FINGERPRINT =
  process.env.NEXT_PUBLIC_DECKSTER_BUILD_SHA
  || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  || 'local-development'

export const BUILD_FINGERPRINT_SHORT = BUILD_FINGERPRINT.slice(0, 12)
