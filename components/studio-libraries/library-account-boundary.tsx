"use client"

import { createContext, useContext, useMemo, useRef, type MutableRefObject, type ReactNode } from "react"
import { useAuth } from "@/hooks/use-auth"

export type StudioLibraryAccount = {
  owner: string
  ready: boolean
  current: MutableRefObject<{ owner: string | null; ready: boolean }>
}

const StudioLibraryAccountContext = createContext<StudioLibraryAccount | null>(null)

export function useStudioLibraryAccount(): StudioLibraryAccount | null {
  return useContext(StudioLibraryAccountContext)
}

// Existing results may settle while the same owner's sign-in is revalidated.
// Consumers still own their mounted, request-generation and pending guards.
export function libraryAccountIsCurrent(account: StudioLibraryAccount | null): boolean {
  return !!account && account.current.current.owner === account.owner
}

export function libraryAccountCanStart(account: StudioLibraryAccount | null): boolean {
  return libraryAccountIsCurrent(account) && !!account?.current.current.ready
}

// Standalone Templates/Themes only; do not wrap Builder's native dialogs.
export function StudioLibraryAccountBoundary({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth()
  const owner = user?.id && (isAuthenticated || isLoading) ? user.id : null
  const ready = !!owner && isAuthenticated && !isLoading
  const current = useRef<{ owner: string | null; ready: boolean }>({ owner: null, ready: false })
  // Old contexts share this ref, so owner retirement precedes child cleanup.
  current.current = { owner, ready }
  const account = useMemo<StudioLibraryAccount | null>(
    () => owner ? { owner, ready, current } : null,
    [owner, ready],
  )

  if (!account) {
    return <p role="status">{isLoading ? "Verifying your account…" : "Sign in to view your library."}</p>
  }

  return <StudioLibraryAccountContext.Provider key={account.owner} value={account}>{children}</StudioLibraryAccountContext.Provider>
}
