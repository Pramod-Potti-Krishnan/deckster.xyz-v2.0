import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect } from "react"
import { tokenManager } from "@/lib/token-manager"

export function useAuth() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Check for mock user in localStorage
  let mockUserData = null
  if (typeof window !== 'undefined') {
    const mockUserStr = localStorage.getItem('mockUser')
    if (mockUserStr) {
      try {
        mockUserData = JSON.parse(mockUserStr)
      } catch (e) {
        console.error('Failed to parse mock user:', e)
      }
    }
  }
  const hasMockUser = !!mockUserData

  const user = session?.user || mockUserData
  const isLoading = status === "loading"
  const isAuthenticated = status === "authenticated" || hasMockUser

  // Update token manager when session changes
  useEffect(() => {
    if (session?.accessToken) {
      tokenManager.setTokens(
        session.accessToken as string,
        session.refreshToken as string,
        session.expiresIn as number
      )
    } else if (!session && !isLoading) {
      // Check for mock authentication
      const mockUser = localStorage.getItem('mockUser')
      if (mockUser) {
        try {
          const userData = JSON.parse(mockUser)
          const mockToken = btoa(JSON.stringify({
            sub: userData.id,
            email: userData.email,
            exp: Math.floor(Date.now() / 1000) + 3600
          }))
          tokenManager.setTokens(mockToken, undefined, 3600)
        } catch (error) {
          console.error('Failed to parse mock user:', error)
          tokenManager.clearTokens()
        }
      } else {
        tokenManager.clearTokens()
      }
    }
  }, [session, isLoading])

  const getToken = useCallback(async () => {
    try {
      return await tokenManager.getValidToken()
    } catch (error) {
      console.error('Failed to get valid token:', error)
      return null
    }
  }, [])

  const login = useCallback(async () => {
    await signIn("google", {
      callbackUrl: "/builder",
    })
  }, [])

  const logout = useCallback(async () => {
    tokenManager.clearTokens()
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
    getToken,
  }
}