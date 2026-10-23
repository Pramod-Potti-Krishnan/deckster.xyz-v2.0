import { withAuth } from "next-auth/middleware"
import type { NextRequestWithAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextFetchEvent } from "next/server"
import { studioP2AdminOn } from "@/lib/studio-p2-admin"

const couponAuthEnabled = process.env.COUPON_AUTH_ENABLED === "true"

const guarded = withAuth(
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
      signIn: "/auth/signin",
    },
  }
)

// PASS2 ADMIN hardening (NEXT_PUBLIC_STUDIO_P2_ADMIN, default off): /admin/* is guarded here too. Nobody signed in goes to sign-in and comes back; a signed-in account that is not the admin
// (the email in DEV_BYPASS_EMAIL, the same rule the admin API routes apply: this does not change who is admin) goes to Studio, where the pages sent it after a 403 anyway. The API routes keep their
// own checks. The matcher below is static, so with the flag off /admin/* reaches this file and is handed straight through, as if it were not matched.
const adminGuarded = withAuth(
  function adminMiddleware(req) {
    const email = (req as any).nextauth.token?.email
    if (!email || email !== process.env.DEV_BYPASS_EMAIL) {
      return NextResponse.redirect(new URL("/builder", req.url))
    }
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

export default function middleware(req: NextRequestWithAuth, event: NextFetchEvent) {
  const pathname = req.nextUrl.pathname
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return studioP2AdminOn(process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN) ? adminGuarded(req, event) : NextResponse.next()
  }
  return guarded(req, event)
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/builder/:path*",
    "/studio/:path*",
    "/knowledge/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/redeem",
    "/admin/:path*",
  ],
}
