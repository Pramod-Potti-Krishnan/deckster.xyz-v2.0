import { cn } from "@/lib/utils"

const COLORS = {
  purple: "bg-[hsl(250,90%,60%)]",
  cyan: "bg-[hsl(200,90%,60%)]",
  magenta: "bg-[hsl(320,80%,60%)]",
  blue: "bg-[hsl(220,80%,60%)]",
  violet: "bg-[hsl(280,70%,60%)]",
  emerald: "bg-[hsl(160,75%,55%)]",
} as const

const SIZES = {
  sm: "h-64 w-64 blur-[80px]",
  md: "h-96 w-96 blur-[100px]",
  lg: "h-[36rem] w-[36rem] blur-[140px]",
  xl: "h-[48rem] w-[48rem] blur-[180px]",
} as const

export function GradientBlob({
  className,
  color = "purple",
  size = "lg",
  opacity = 30,
}: {
  className?: string
  color?: keyof typeof COLORS
  size?: keyof typeof SIZES
  opacity?: number
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full",
        COLORS[color],
        SIZES[size],
        className,
      )}
      style={{ opacity: opacity / 100 }}
    />
  )
}
