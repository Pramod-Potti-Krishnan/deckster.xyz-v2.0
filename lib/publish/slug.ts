// Slug minting for published decks.
//
// The slug doubles as the capability token for unlisted links, so it must be
// high-entropy and unpredictable: 10 chars of base62 ≈ 59.5 bits from
// crypto-quality randomness (node:crypto — no new deps).

import { randomBytes } from 'node:crypto'

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// Largest multiple of 62 below 256 — bytes >= this are rejected so every
// character is drawn uniformly (no modulo bias).
const REJECTION_THRESHOLD = 248

export const SLUG_LENGTH = 10

export function generateSlug(length: number = SLUG_LENGTH): string {
  const chars: string[] = []
  while (chars.length < length) {
    const bytes = randomBytes(length * 2)
    for (const byte of bytes) {
      if (byte >= REJECTION_THRESHOLD) continue
      chars.push(BASE62[byte % 62])
      if (chars.length === length) break
    }
  }
  return chars.join('')
}
