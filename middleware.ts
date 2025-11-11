import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  async function middleware(req) {
    const token = (req as any).nextauth.token

    if (token) {
      // Check if user is approved (except for pending page)
      if (!req.nextUrl.pathname.startsWith('/auth/pending')) {
        if (!token.approved) {
          return NextResponse.redirect(new URL('/auth/pending', req.url))
        }
      }
    }

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