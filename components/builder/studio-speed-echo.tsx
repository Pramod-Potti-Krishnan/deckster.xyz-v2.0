"use client"

// FRONTEND-2, NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED (default off): the "Sending…" echo of the user's message, drawn at the end of the chat until the page commits
// the real bubble (lib/studio-speed-perceived.ts). Same markup and classes as MessageList's user bubble, plus data-studio-speed-echo and one status line. The page
// renders it right after <MessageList /> (after the transcript's end anchor, so it sits where the real bubble will appear), only with the flag on; MessageList
// itself is not changed.
import React, { useEffect, useRef } from "react"
import { User } from "lucide-react"
import { FileChip, type UploadedFile } from "@/components/file-chip"
import { SPEED_ECHO_FAILED_LABEL, SPEED_ECHO_PENDING_LABEL, type SpeedEchoView } from "@/lib/studio-speed-perceived"
import "./studio-speed-perceived.css"

export function StudioSpeedEcho({ echo, studio, rootProps }: { echo: SpeedEchoView; studio: boolean; rootProps?: Record<string, string> }) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    rootRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" })
  }, [echo.key, echo.status])
  const failed = echo.status === "failed"
  return (
    <div ref={rootRef} data-studio-director-message={studio ? "user" : undefined} data-studio-speed-echo={echo.status} className="flex gap-3 justify-end" {...rootProps}>
      <div className="flex-1 max-w-[85%] text-right">
        <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 mb-0.5">You</p>
        <p className="text-xs text-gray-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">{echo.text}</p>
        {echo.attachments.length > 0 && (
          <div
            className="mt-2 flex flex-wrap justify-end gap-1.5"
            aria-label={`${echo.attachments.length} attached file${echo.attachments.length === 1 ? '' : 's'}`}
          >
            {echo.attachments.map(attachment => (
              <FileChip
                key={attachment.id}
                file={{
                  ...attachment,
                  status: 'success',
                  uploadProgress: 100,
                } satisfies UploadedFile}
                onRemove={() => undefined}
                removable={false}
                showStatus={false}
                variant="compact"
              />
            ))}
          </div>
        )}
        <p data-studio-speed-echo-part="status" role={failed ? "alert" : "status"} aria-live={failed ? "assertive" : "polite"}>
          {failed ? SPEED_ECHO_FAILED_LABEL : SPEED_ECHO_PENDING_LABEL}
        </p>
      </div>
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-800 dark:bg-slate-700 flex items-center justify-center">
        <User className="h-3 w-3 text-white" />
      </div>
    </div>
  )
}
