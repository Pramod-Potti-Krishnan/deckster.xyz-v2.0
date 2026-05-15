"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FinalCTAButton() {
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
    signIn("google", { callbackUrl: "/builder" }).catch(() => setLoading(false))
  }

  const isWorking = loading || status === "loading"

  return (
    <Button
      size="lg"
      onClick={handleStart}
      disabled={isWorking}
      className="group h-14 rounded-full bg-primary px-10 text-base font-semibold text-white shadow-[0_18px_40px_-12px_hsl(250_90%_60%/0.55)] transition-all hover:scale-[1.03] hover:bg-primary/90 hover:shadow-[0_22px_46px_-12px_hsl(250_90%_60%/0.7)] sm:text-lg"
    >
      {isWorking ? "Loading…" : "Start free trial"}
      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
    </Button>
  )
}
