import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export default withAuth(
  async function middleware(req) {
    // Get session token for database sessions
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    // Check if user is approved (except for pending page)
    if (token && !req.nextUrl.pathname.startsWith('/auth/pending')) {
      if (!token.approved) {
        // Redirect unapproved users to pending page
        return NextResponse.redirect(new URL('/auth/pending', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // For database sessions, check if request has session cookie
      authorized: async ({ req }) => {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
        return !!token
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