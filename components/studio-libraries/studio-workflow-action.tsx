"use client"

import { useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { lastBuilderSessionKey } from "@/lib/last-builder-session"
import { draftKey, getStudioWorkflowHref } from "@/lib/studio-workflow"

/** Opening an existing Studio workflow does not select, send, or mutate anything. */
export function StudioWorkflowAction({ action, itemId, brief, children, className = "sl-button", disabled = false, canStart }: {
  action: "templates" | "theme" | "master" | "brief"
  itemId?: string; brief?: string; children: ReactNode; className?: string; disabled?: boolean; canStart?: () => boolean
}) {
  const router = useRouter()
  const { user } = useAuth()
  const [error, setError] = useState("")
  const latestCanStart = useRef(canStart)
  latestCanStart.current = canStart
  // Retain the captured owner's predicate as well as the latest readiness.
  const permitted = () => !disabled && (!canStart || canStart())
    && (!latestCanStart.current || latestCanStart.current())

  function open() {
    if (!permitted()) return
    const userId = user?.id ?? user?.email
    let sessionId: string | undefined
    try {
      sessionId = userId ? window.localStorage.getItem(lastBuilderSessionKey(userId)) || undefined : undefined
    } catch { /* The existing return path also falls back to a new Studio. */ }
    if (action === "brief") {
      if (!permitted()) return
      if (!user?.id || !brief?.trim()) { setError("Sign in and add a story brief before continuing."); return }
      if (brief.trim().length > 20000) { setError("This brief is longer than 20,000 characters. Shorten it before continuing; your draft is still here."); return }
      try {
        window.sessionStorage.setItem(draftKey(user.id), JSON.stringify({ version: 1, createdAt: Date.now(), text: brief.trim() }))
      } catch { if (!permitted()) return; setError("Your browser could not stage the brief. Your draft is still here; copy it before leaving."); return }
    }
    if (!permitted()) return
    setError("")
    router.push(getStudioWorkflowHref(action, sessionId, itemId))
  }

  return <><button type="button" className={className} disabled={disabled} onClick={open}>{children}</button>{error && <p role="alert" className="sl-field-error sp-error">{error}</p>}</>
}
