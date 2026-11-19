"use client"
// FRONTEND-2 (B66, AVATAR-SPAWN): "My companions" and the "Create my avatar" create / pick / delete flow, a MOCK (no network, no image call, no paid call; the photo is never stored).
// Off (NEXT_PUBLIC_STUDIO_AVATAR_SPAWN not exactly "true", or the Studio shell off): 404, as before this change. The flow, its state and its words are in components/studio-avatar-spawn/.
import { notFound } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { STUDIO_AVATAR_SPAWN_ENABLED } from "@/lib/studio-avatar-spawn"
import { StudioAvatarSpawnApp } from "@/components/studio-avatar-spawn/studio-avatar-spawn-app"
import { STUDIO_MY_COMPANIONS_ENABLED } from "@/lib/studio-my-companions" // MY-COMPANIONS
import { MyCompanionsPage } from "@/components/studio-avatar-spawn/my-companions-page" // MY-COMPANIONS

export default function StudioCompanionsPage() {
  // MY-COMPANIONS (NEXT_PUBLIC_STUDIO_MY_COMPANIONS): the owner's own companions, list only. It wins over the upload mock even when that flag is on too: until Step B's real client there is nothing real to upload to.
  if (STUDIO_MY_COMPANIONS_ENABLED) return <MyCompanionsPage /> // MY-COMPANIONS
  if (!STUDIO_AVATAR_SPAWN_ENABLED) notFound()
  return <CompanionsBody />
}

function CompanionsBody() {
  const { user } = useAuth()
  return <StudioAvatarSpawnApp userId={user?.id ?? null} />
}
