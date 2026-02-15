import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize any CSS color string to #rrggbb format for <input type="color">.
 * Handles: #rgb, #rrggbb, rgb(r,g,b), rgba(r,g,b,a).
 * Returns fallback for unrecognized formats.
 */
export function normalizeColorToHex(value: string | undefined | null, fallback = '#000000'): string {
  if (!value) return fallback

  const v = value.trim()

  // Already #rrggbb
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v

  // #rgb → #rrggbb
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const match = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (match) {
    const r = Math.min(255, Number(match[1]))
    const g = Math.min(255, Number(match[2]))
    const b = Math.min(255, Number(match[3]))
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Named colors or unrecognized — return fallback
  return fallback
}
