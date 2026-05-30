import type { ReactNode } from "react"
import { SettingsSidebar } from "@/components/settings/settings-sidebar"

/**
 * Settings hub shell. Renders the page heading + left sub-nav; child routes
 * (profile, appearance, notifications, privacy, security, knowledge-graph)
 * render into the content column. Sits inside app/(app)/layout.tsx, so it also
 * gets the shared AppHeader.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Settings</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Manage your account, preferences, and data
        </p>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <SettingsSidebar />
        </aside>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </main>
  )
}
