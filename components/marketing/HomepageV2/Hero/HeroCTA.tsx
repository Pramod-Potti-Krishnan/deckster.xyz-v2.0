"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trackCta } from "@/lib/analytics"
import { HERO_COPY } from "@/lib/marketing/homepage-v2-content"

export function HeroCTA() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)

  const handleStart = () => {
    trackCta("hero_primary")
    if (status === "authenticated" && session?.user) {
      setLoading(true)
      router.push("/builder")
      return
    }
    setLoading(true)
    router.push("/pricing")
  }

  const isWorking = loading || status === "loading"

  // Single decisive action — the "see the team in action" path moved to the
  // ScrollCue connector at the slide's bottom edge.
  return (
    <div className="flex justify-center">
      <Button
        size="lg"
        onClick={handleStart}
        disabled={isWorking}
        className="group h-14 rounded-full bg-primary px-8 text-base font-semibold text-white shadow-[0_18px_40px_-12px_hsl(250_90%_60%/0.55)] transition-all hover:scale-[1.03] hover:bg-primary/90 hover:shadow-[0_22px_46px_-12px_hsl(250_90%_60%/0.7)] sm:text-lg"
      >
        {isWorking ? "Loading…" : HERO_COPY.primaryCta}
        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </div>
  )
}
