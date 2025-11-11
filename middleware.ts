import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  async function middleware(req) {
    console.log('🔵🔵🔵 [Middleware] =============== REQUEST START ===============')
    console.log('🔵 [Middleware] Timestamp:', new Date().toISOString())
    console.log('🔵 [Middleware] Path:', req.nextUrl.pathname)
    console.log('🔵 [Middleware] Full URL:', req.url)

    // Log all cookies (especially looking for session token)
    const allCookies = req.cookies.getAll()
    console.log('🍪 [Middleware] Total cookies:', allCookies.length)
    console.log('🍪 [Middleware] Cookie names:', allCookies.map(c => c.name))
    console.log('🍪 [Middleware] NextAuth session cookies:', allCookies.filter(c => c.name.includes('session')).map(c => ({ name: c.name, hasValue: !!c.value })))

    // With database sessions, the withAuth middleware handles session checking
    // The token is passed via req.nextauth.token by the authorized callback
    const token = (req as any).nextauth?.token
    console.log('🔑 [Middleware] Session token from withAuth:', !!token)

    if (token) {
      console.log('✅ [Middleware] User authenticated via database session')
      console.log('✅ [Middleware] User email:', token.email)
      console.log('✅ [Middleware] User approved status:', token.approved)

      // Check if user is approved (except for pending page)
      if (!req.nextUrl.pathname.startsWith('/auth/pending')) {
        if (!token.approved) {
          console.log('❌ [Middleware] User NOT approved - redirecting to pending page')
          return NextResponse.redirect(new URL('/auth/pending', req.url))
        } else {
          console.log('✅ [Middleware] User IS approved')
        }
      }
    }

    console.log('✅✅✅ [Middleware] ALL CHECKS PASSED - Allowing access to:', req.nextUrl.pathname)
    console.log('🔵🔵🔵 [Middleware] =============== REQUEST END ===============')
    return NextResponse.next()
  },
  {
    callbacks: {
      // For database sessions, withAuth checks if session exists in database
      authorized: async ({ token, req }) => {
        console.log('🟡🟡🟡 [Auth Check] =============== AUTHORIZATION CHECK START ===============')
        console.log('🟡 [Auth Check] Timestamp:', new Date().toISOString())
        console.log('🟡 [Auth Check] Path:', req.nextUrl.pathname)
        console.log('🟡 [Auth Check] Using DATABASE SESSIONS (not JWT)')

        // Log all cookies
        const allCookies = req.cookies.getAll()
        console.log('🟡 [Auth Check] Total cookies:', allCookies.length)
        console.log('🟡 [Auth Check] All cookie names:', allCookies.map(c => c.name))

        const sessionCookies = allCookies.filter(c => c.name.includes('session-token'))
        console.log('🟡 [Auth Check] Session token cookies:', sessionCookies.length)
        if (sessionCookies.length > 0) {
          console.log('✅ [Auth Check] Session token cookie found:', sessionCookies.map(c => c.name))
        } else {
          console.log('❌ [Auth Check] No session token cookie found!')
        }

        // With database sessions, token is populated by withAuth from database
        const isAuthorized = !!token
        console.log('🟡 [Auth Check] Token/Session exists:', isAuthorized)

        if (isAuthorized) {
          console.log('✅ [Auth Check] SESSION EXISTS in database')
          console.log('✅ [Auth Check] User email:', token?.email)
          console.log('✅✅✅ [Auth Check] AUTHORIZATION GRANTED')
        } else {
          console.log('❌ [Auth Check] NO SESSION found in database')
          console.log('❌❌❌ [Auth Check] AUTHORIZATION DENIED')
        }

        console.log('🟡🟡🟡 [Auth Check] =============== AUTHORIZATION CHECK END ===============')
        console.log('🟡 [Auth Check] Returning authorization result:', isAuthorized)
        console.log('')

        return isAuthorized
      },
    },
    pages: {
      signIn: "/",  // Redirect to landing page for sign-in
    },
  }
)

// Protect these routes - now includes /builder
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/builder/:path*",  // Now protected - requires authentication
    "/billing/:path*",
    "/settings/:path*",
  ],
}