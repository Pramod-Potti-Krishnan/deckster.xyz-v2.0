"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useCopyToClipboard — copy text and expose a transient `copied` flag for
 * "Copied!" affordances (pattern previously inlined in admin/coupons).
 */
export function useCopyToClipboard(resetAfterMs: number = 2000) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), resetAfterMs)
      return true
    } catch {
      setCopied(false)
      return false
    }
  }, [resetAfterMs])

  return { copied, copy }
}
