import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const couponAuthEnabled = process.env.COUPON_AUTH_ENABLED === "true"

export default withAuth(
  async function middleware(req) {
    const token = (req as any).nextauth.token

    if (token) {
      const pathname = req.nextUrl.pathname

      if (!token.approved) {
        if (couponAuthEnabled) {
          if (!pathname.startsWith("/redeem") && !pathname.startsWith("/auth/pending")) {
            return NextResponse.redirect(new URL("/redeem", req.url))
          }
        } else {
          if (!pathname.startsWith("/auth/pending")) {
            return NextResponse.redirect(new URL("/auth/pending", req.url))
          }
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
    "/redeem",
  ],
}
