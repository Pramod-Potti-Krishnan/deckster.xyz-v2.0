"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowRight, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HERO_COPY } from "@/lib/marketing/homepage-v2-content"

export function HeroCTA() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)

  const handleStart = () => {
    if (status === "authenticated" && session?.user) {
      setLoading(true)
      router.push("/builder")
      return
    }
    setLoading(true)
    router.push("/pricing")
  }

  const handleScrollToDemo = () => {
    const target = document.getElementById("builder-demo")
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const isWorking = loading || status === "loading"

  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
      <Button
        size="lg"
        onClick={handleStart}
        disabled={isWorking}
        className="group h-14 rounded-full bg-primary px-8 text-base font-semibold text-white shadow-[0_18px_40px_-12px_hsl(250_90%_60%/0.55)] transition-all hover:scale-[1.03] hover:bg-primary/90 hover:shadow-[0_22px_46px_-12px_hsl(250_90%_60%/0.7)] sm:text-lg"
      >
        {isWorking ? "Loading…" : HERO_COPY.primaryCta}
        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
      </Button>

      <Button
        size="lg"
        variant="ghost"
        onClick={handleScrollToDemo}
        className="h-14 rounded-full border border-white/20 bg-white/5 px-8 text-base font-medium text-white backdrop-blur-md transition-all hover:bg-white/10 hover:text-white sm:text-lg"
      >
        <PlayCircle className="mr-2 h-5 w-5" />
        {HERO_COPY.secondaryCta}
      </Button>
    </div>
  )
}
