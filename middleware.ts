import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export default withAuth(
  async function middleware(req) {
    console.log('🔵🔵🔵 [Middleware] =============== REQUEST START ===============')
    console.log('🔵 [Middleware] Timestamp:', new Date().toISOString())
    console.log('🔵 [Middleware] Path:', req.nextUrl.pathname)
    console.log('🔵 [Middleware] Full URL:', req.url)
    console.log('🔵 [Middleware] Search params:', req.nextUrl.searchParams.toString())
    console.log('🔵 [Middleware] Query params:', Object.fromEntries(req.nextUrl.searchParams))

    // Log all cookies
    const allCookies = req.cookies.getAll()
    console.log('🍪 [Middleware] Total cookies:', allCookies.length)
    console.log('🍪 [Middleware] Cookie names:', allCookies.map(c => c.name))
    console.log('🍪 [Middleware] NextAuth cookies:', allCookies.filter(c => c.name.includes('next-auth')).map(c => ({ name: c.name, hasValue: !!c.value, valueLength: c.value?.length })))

    // Check for OAuth callback scenario
    const callbackUrl = req.nextUrl.searchParams.get('callbackUrl')
    const isComingFromOAuth = !!callbackUrl
    console.log('🔐 [Middleware] OAuth callback detected?', isComingFromOAuth)
    if (callbackUrl) {
      console.log('🔐 [Middleware] Callback URL:', callbackUrl)
    }

    // Try to get token
    console.log('🔑 [Middleware] Attempting to get token...')
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    console.log('🔑 [Middleware] Token found:', !!token)

    if (token) {
      console.log('✅ [Middleware] Token EXISTS - Full token data:', {
        email: token.email,
        name: token.name,
        approved: token.approved,
        hasId: !!token.id,
        id: token.id,
        tier: token.tier,
        sub: token.sub,
        exp: token.exp,
        expReadable: token.exp ? new Date(token.exp * 1000).toISOString() : 'N/A',
        iat: token.iat,
        iatReadable: token.iat ? new Date(token.iat * 1000).toISOString() : 'N/A',
        jti: token.jti,
      })

      // Check if user is approved (except for pending page)
      if (!req.nextUrl.pathname.startsWith('/auth/pending')) {
        if (!token.approved) {
          console.log('❌ [Middleware] User NOT approved - redirecting to pending page')
          console.log('❌ [Middleware] Redirect reason: token.approved =', token.approved)
          return NextResponse.redirect(new URL('/auth/pending', req.url))
        } else {
          console.log('✅ [Middleware] User IS approved (approved =', token.approved, ')')
        }
      }

      console.log('✅✅✅ [Middleware] ALL CHECKS PASSED - Allowing access to:', req.nextUrl.pathname)
      return NextResponse.next()
    } else {
      console.log('❌ [Middleware] NO TOKEN FOUND')
      console.log('❌ [Middleware] This means getToken() returned null/undefined')
      console.log('❌ [Middleware] Possible reasons:')
      console.log('   1. Session cookie not set yet (timing issue)')
      console.log('   2. Cookie name mismatch')
      console.log('   3. NEXTAUTH_SECRET mismatch')
      console.log('   4. Cookie not being sent by browser')

      // If coming from OAuth callback, this is likely a timing issue
      if (isComingFromOAuth) {
        console.log('⚠️  [Middleware] TIMING ISSUE DETECTED!')
        console.log('⚠️  [Middleware] User just completed OAuth but cookie not readable yet')
        console.log('⚠️  [Middleware] This is the race condition we\'re debugging')
        console.log('⚠️  [Middleware] The authorized callback already ran and should have denied access')
      }

      // The withAuth wrapper will handle the redirect to sign-in page
      console.log('🔵🔵🔵 [Middleware] =============== REQUEST END (NO TOKEN) ===============')
      return NextResponse.next()
    }
  },
  {
    callbacks: {
      // This callback runs BEFORE the main middleware function
      authorized: async ({ req }) => {
        console.log('🟡🟡🟡 [Auth Check] =============== AUTHORIZATION CHECK START ===============')
        console.log('🟡 [Auth Check] Timestamp:', new Date().toISOString())
        console.log('🟡 [Auth Check] Path:', req.nextUrl.pathname)
        console.log('🟡 [Auth Check] Full URL:', req.url)
        console.log('🟡 [Auth Check] This callback runs FIRST, before the main middleware function')

        // Check for OAuth callback scenario
        const callbackUrl = req.nextUrl.searchParams.get('callbackUrl')
        const isComingFromOAuth = !!callbackUrl
        console.log('🟡 [Auth Check] OAuth callback URL present?', isComingFromOAuth, callbackUrl || '')

        // Log all cookies
        const allCookies = req.cookies.getAll()
        console.log('🟡 [Auth Check] Total cookies:', allCookies.length)
        console.log('🟡 [Auth Check] All cookie names:', allCookies.map(c => c.name))

        const nextAuthCookies = allCookies.filter(c => c.name.includes('next-auth'))
        console.log('🟡 [Auth Check] NextAuth cookie count:', nextAuthCookies.length)
        if (nextAuthCookies.length > 0) {
          console.log('🟡 [Auth Check] NextAuth cookies details:', nextAuthCookies.map(c => ({
            name: c.name,
            hasValue: !!c.value,
            valueLength: c.value?.length,
            valuePreview: c.value?.substring(0, 20) + '...'
          })))
        } else {
          console.log('🟡 [Auth Check] ⚠️  WARNING: No NextAuth cookies found!')
        }

        // Try to get token
        console.log('🟡 [Auth Check] Calling getToken()...')
        const tokenStart = Date.now()
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
        const tokenDuration = Date.now() - tokenStart
        console.log('🟡 [Auth Check] getToken() completed in', tokenDuration, 'ms')

        const isAuthorized = !!token
        console.log('🟡 [Auth Check] Token found:', isAuthorized)

        if (isAuthorized) {
          console.log('✅ [Auth Check] TOKEN EXISTS')
          console.log('✅ [Auth Check] Token email:', token.email)
          console.log('✅ [Auth Check] Token approved:', token.approved)
          console.log('✅✅✅ [Auth Check] AUTHORIZATION GRANTED - Will proceed to main middleware')
        } else {
          console.log('❌ [Auth Check] NO TOKEN FOUND')
          console.log('❌ [Auth Check] getToken() returned:', token)

          if (isComingFromOAuth) {
            console.log('⚠️⚠️⚠️  [Auth Check] CRITICAL: OAuth callback but no token!')
            console.log('⚠️  [Auth Check] This is the RACE CONDITION causing the redirect loop')
            console.log('⚠️  [Auth Check] User completed OAuth, but cookie not readable yet')
            console.log('⚠️  [Auth Check] Will redirect to sign-in page with callbackUrl preserved')
          }

          console.log('❌❌❌ [Auth Check] AUTHORIZATION DENIED - Will redirect to sign-in page')
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