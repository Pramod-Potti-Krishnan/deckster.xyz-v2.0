import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"
import { STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED, parseServerPutBody } from "@/lib/studio-template-auto-apply-server"

// FRONTEND-2 (PK, 2 Nov 17:48Z: the template auto-apply check is per USER across devices): the user's standing "Use my best-matching template" check, stored on UserPreferences.templateAutoApply
// (column fe_user_preferences.template_auto_apply, NULL = never set = ON; prisma/sql/20261102_template_auto_apply.sql must be applied BEFORE the schema field is merged).
// Flag NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER (exact "true", default off, with NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH): while it is off this route answers 404 to everything and touches neither the session nor the database.
//
//   GET -> 200 { templateAutoApply: boolean | null }              (a user with no row, or never set: null)
//   PUT { templateAutoApply: boolean } -> 200 { templateAutoApply: boolean }   (anything else: 400; signed out: 401)
//
// This route is separate from app/api/preferences/route.ts (the settings pages), which is not touched. Every query narrows with an explicit `select`: only this column is read or returned.
// Nothing here logs the user, a value or an error (an error message may carry either): a failure is one fixed line.
export const dynamic = "force-dynamic"

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 })
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })

export async function GET() {
  if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) return notFound()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return unauthorized()

    const row = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
      select: { templateAutoApply: true },
    })
    return NextResponse.json({ templateAutoApply: row?.templateAutoApply ?? null })
  } catch {
    console.error("[api/preferences/template-auto-apply] GET failed")
    return NextResponse.json({ error: "Failed to fetch the preference" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) return notFound()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return unauthorized()

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 })
    }
    const templateAutoApply = parseServerPutBody(body)
    if (templateAutoApply === null) {
      return NextResponse.json({ error: "Expected { templateAutoApply: boolean }" }, { status: 400 })
    }

    const row = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: { templateAutoApply },
      create: { userId: session.user.id, templateAutoApply },
      select: { templateAutoApply: true },
    })
    return NextResponse.json({ templateAutoApply: row.templateAutoApply })
  } catch {
    console.error("[api/preferences/template-auto-apply] PUT failed")
    return NextResponse.json({ error: "Failed to save the preference" }, { status: 500 })
  }
}
