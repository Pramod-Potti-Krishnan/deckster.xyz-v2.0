import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token

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
      authorized: ({ token }) => !!token,
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