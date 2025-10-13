import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // Custom logic can be added here
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
)

// Protect these routes
// Note: /builder is temporarily unprotected for development
export const config = {
  matcher: [
    "/dashboard/:path*",
    // "/builder/:path*", // Commented out for dev - no auth required
    "/billing/:path*",
    "/settings/:path*",
  ],
}