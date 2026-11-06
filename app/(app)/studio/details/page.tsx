import { AccountDetailsWorkspace } from "@/components/studio-personal/details-workspace"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default function DetailsPage() {
  // Authentication and approval use the existing /studio middleware matcher.
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true") notFound()
  return <AccountDetailsWorkspace />
}
