import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  async function middleware(req) {
    const token = (req as any).nextauth.token

    console.log('🔵🔵🔵 [Middleware] =============== REQUEST START ===============')
    console.log('🔵 [Middleware] Path:', req.nextUrl.pathname)
    console.log('🔵 [Middleware] Has token?', !!token)

    if (token) {
      console.log('✅ [Middleware] User:', token.email)
      console.log('✅ [Middleware] Approved:', token.approved)

      // Check if user is approved (except for pending page)
      if (!req.nextUrl.pathname.startsWith('/auth/pending')) {
        if (!token.approved) {
          console.log('❌ [Middleware] NOT approved - redirect to pending')
          return NextResponse.redirect(new URL('/auth/pending', req.url))
        }
      }
    }

    console.log('✅ [Middleware] Access granted')
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/",
    },
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/builder/:path*",
    "/billing/:path*",
    "/settings/:path*",
  ],
}