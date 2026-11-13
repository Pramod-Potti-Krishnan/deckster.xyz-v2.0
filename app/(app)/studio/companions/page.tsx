"use client"
// FRONTEND-2 (B66, AVATAR-SPAWN): "My companions" and the "Create my avatar" create / pick / delete flow, a MOCK (no network, no image call, no paid call; the photo is never stored).
// Off (NEXT_PUBLIC_STUDIO_AVATAR_SPAWN not exactly "true", or the Studio shell off): 404, as before this change. The flow, its state and its words are in components/studio-avatar-spawn/.
import { notFound } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { STUDIO_AVATAR_SPAWN_ENABLED } from "@/lib/studio-avatar-spawn"
import { StudioAvatarSpawnApp } from "@/components/studio-avatar-spawn/studio-avatar-spawn-app"

export default function StudioCompanionsPage() {
  if (!STUDIO_AVATAR_SPAWN_ENABLED) notFound()
  return <CompanionsBody />
}

function CompanionsBody() {
  const { user } = useAuth()
  return <StudioAvatarSpawnApp userId={user?.id ?? null} />
}
