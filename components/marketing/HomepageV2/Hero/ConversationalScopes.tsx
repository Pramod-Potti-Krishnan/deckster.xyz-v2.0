import {
  BookOpen,
  MousePointerSquareDashed,
  RectangleHorizontal,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  CONVERSATION_SCOPES,
  type ScopeIconName,
} from "@/lib/marketing/homepage-v2-content"

const ICONS: Record<ScopeIconName, LucideIcon> = {
  BookOpen,
  RectangleHorizontal,
  MousePointerSquareDashed,
}

export function ConversationalScopes() {
  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {CONVERSATION_SCOPES.map((scope) => {
        const Icon = ICONS[scope.iconName]
        return (
          <article
            key={scope.id}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-md transition-all hover:scale-[1.02] hover:border-white/25 hover:bg-white/[0.06]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-45"
              style={{ backgroundColor: scope.color }}
            />
            <div className="relative flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `${scope.color}1f`,
                  boxShadow: `inset 0 0 0 1px ${scope.color}55`,
                }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: scope.color }}
                  aria-hidden
                />
              </span>
              <div className="min-w-0">
                <div
                  className="text-[11px] font-bold tracking-[0.18em] text-white/80"
                  style={{ color: scope.color }}
                >
                  {scope.label}
                </div>
                <p className="mt-1 text-sm leading-snug text-white/75">
                  {scope.blurb}
                </p>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
