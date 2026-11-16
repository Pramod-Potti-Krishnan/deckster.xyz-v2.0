"use client"

import { ExternalLink, Globe, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DRIVE_BADGE_LABEL, DRIVE_LINK_LABEL, type CitationSourceRow } from "@/lib/connectors-gdrive-citations"

// P4-15 piece B (NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED, mock D5): a slide's sources with Drive, Web and Uploaded badges. Markup only: the rows come from
// citationSourceRows (lib/connectors-gdrive-citations.ts), which is [] unless the flag is on and a citation is a Drive file, and this draws nothing for no rows.

function DriveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M8 3h8l6 10-4 7H6l-4-7z" />
      <path d="M8 3l6 10h8M2 13h12l-4 7" />
    </svg>
  )
}

const BADGE = "gap-1 rounded px-1.5 py-0 text-[10px] font-semibold"
const BADGE_CLASS = {
  drive: "border-transparent bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  web: "border-transparent bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  upload: "border-transparent bg-muted text-muted-foreground",
} as const
const LINK = "ml-auto inline-flex flex-none items-center gap-1 font-medium text-teal-700 hover:underline dark:text-teal-300"

export function StudioCitationSources({ rows, className }: { rows: ReadonlyArray<CitationSourceRow>; className?: string }) {
  if (rows.length === 0) return null
  return (
    <ul aria-label="Sources" data-studio-citation-sources="true" className={["flex min-w-0 flex-col gap-1", className || ""].join(" ")}>
      {rows.map(row => (
        <li
          key={row.key}
          data-studio-citation-source={row.kind}
          className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-card/70 px-2.5 py-1 text-xs"
        >
          {row.kind === "drive" ? <DriveIcon className="h-3.5 w-3.5 flex-none text-teal-700 dark:text-teal-300" />
            : row.kind === "web" ? <Globe className="h-3.5 w-3.5 flex-none text-violet-700 dark:text-violet-300" aria-hidden />
            : <Upload className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden />}
          <span className="min-w-0 truncate font-medium text-foreground/90" title={row.name}>{row.name}</span>
          <Badge data-studio-citation-badge={row.kind} variant="outline" className={`${BADGE} ${BADGE_CLASS[row.kind]}`}>
            {row.kind === "drive" ? <><DriveIcon className="h-2.5 w-2.5" />{DRIVE_BADGE_LABEL}</>
              : row.kind === "web" ? (row.host ? `Web · ${row.host}` : "Web")
              : "Uploaded"}
          </Badge>
          {row.href && (
            <a href={row.href} target="_blank" rel="noopener noreferrer" data-studio-citation-link={row.kind} className={LINK}>
              {row.kind === "drive" ? DRIVE_LINK_LABEL : "Open page"}<ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
