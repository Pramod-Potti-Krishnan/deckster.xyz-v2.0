import { cn } from "@/lib/utils"

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "light",
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: "left" | "center"
  tone?: "light" | "dark"
  className?: string
}) {
  const isDark = tone === "dark"
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {eyebrow ? (
        <span
          className={cn(
            "mb-4 inline-block text-xs font-semibold uppercase tracking-[0.18em]",
            isDark ? "text-white/60" : "text-primary/80 dark:text-primary/70",
          )}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={cn(
          "text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl",
          isDark ? "text-white" : "text-foreground dark:text-white",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-5 text-balance text-lg leading-relaxed md:text-xl",
            isDark ? "text-white/70" : "text-muted-foreground dark:text-white/65",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
