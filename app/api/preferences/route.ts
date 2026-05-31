import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"

// GET — return the user's notification/privacy preferences (upsert defaults if none)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prefs = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: {},
      create: { userId: session.user.id },
    })

    return NextResponse.json({
      emailAccountActivity: prefs.emailAccountActivity,
      emailProductUpdates: prefs.emailProductUpdates,
      emailMarketing: prefs.emailMarketing,
      activityTracking: prefs.activityTracking,
    })
  } catch (error) {
    console.error("[api/preferences] GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    )
  }
}

// PATCH — update one or more preference fields
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // Whitelist only known boolean fields
    const allowed = [
      "emailAccountActivity",
      "emailProductUpdates",
      "emailMarketing",
      "activityTracking",
    ] as const

    const data: Record<string, boolean> = {}
    for (const key of allowed) {
      if (typeof body[key] === "boolean") {
        data[key] = body[key]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid preference fields provided" },
        { status: 400 }
      )
    }

    const prefs = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: data,
      create: { userId: session.user.id, ...data },
    })

    return NextResponse.json({
      emailAccountActivity: prefs.emailAccountActivity,
      emailProductUpdates: prefs.emailProductUpdates,
      emailMarketing: prefs.emailMarketing,
      activityTracking: prefs.activityTracking,
    })
  } catch (error) {
    console.error("[api/preferences] PATCH error:", error)
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    )
  }
}
