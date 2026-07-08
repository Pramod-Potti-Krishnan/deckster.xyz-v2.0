// Passcode hashing + unlock-cookie helpers for restricted published decks.
//
// - Passcodes are hashed with scrypt (node:crypto — no new deps).
// - A successful unlock sets an httpOnly cookie whose value is
//   HMAC-SHA256(`${slug}:${passcodeHash}`, NEXTAUTH_SECRET); the /p/[slug]
//   server component verifies it before rendering. Because the passcode hash
//   is folded into the MAC, changing the passcode (a new hash) rotates the
//   expected cookie value automatically — old unlock cookies stop verifying.
//   Rotating the slug also invalidates old cookies for free (the cookie name
//   and MAC input both change).

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_KEY_LENGTH = 64

/** 30 days, in seconds */
export const UNLOCK_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/** Minimum passcode length enforced at set time (raises brute-force keyspace) */
export const MIN_PASSCODE_LENGTH = 6

export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(passcode, salt, SCRYPT_KEY_LENGTH)
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`
}

export function verifyPasscode(passcode: string, storedHash: string): boolean {
  const [scheme, saltHex, hashHex] = storedHash.split(':')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const actual = scryptSync(passcode, salt, expected.length)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function unlockCookieName(slug: string): string {
  return `dpub_${slug}`
}

export function unlockCookieValue(slug: string, passcodeHash: string): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET must be configured to unlock restricted decks')
  }
  // Fold the passcode hash into the MAC so a passcode change rotates the cookie
  return createHmac('sha256', secret).update(`${slug}:${passcodeHash}`).digest('hex')
}

export function verifyUnlockCookie(
  slug: string,
  passcodeHash: string,
  cookieValue: string | undefined
): boolean {
  if (!cookieValue) return false
  try {
    const expected = Buffer.from(unlockCookieValue(slug, passcodeHash))
    const actual = Buffer.from(cookieValue)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
