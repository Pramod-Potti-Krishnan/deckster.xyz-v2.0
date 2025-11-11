import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useCallback } from "react"

export function useAuth() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Use real NextAuth session only (dev bypass handled in auth-options.ts)
  const user = session?.user
  const isLoading = status === "loading"
  const isAuthenticated = status === "authenticated"

  const login = useCallback(async () => {
    await signIn("google", {
      callbackUrl: "/builder",
    })
  }, [])

  const logout = useCallback(async () => {
    await signOut({
      callbackUrl: "/",
    })
  }, [])

  const requireAuth = useCallback(
    (redirectTo = "/auth/signin") => {
      if (!isLoading && !isAuthenticated) {
        router.push(redirectTo)
      }
    },
    [isLoading, isAuthenticated, router]
  )

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    requireAuth,
  }
}