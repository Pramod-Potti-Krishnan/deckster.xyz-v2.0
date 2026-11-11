"use client"

/**
 * KNOWLEDGE (P4-15 composer half, DARK): what the composer draws for the Google Drive connector, from the approved UX mock
 * (drive-connector-ux.html D1a attach menu, D2a connect prompt, D3b chips, D8a-c errors). ChatInput renders these ONLY when the page
 * passes a `gdrive` prop, which it does only with both Drive flags on and an entitled user; without the prop none of this exists.
 */
import React from "react"
import { AlertTriangle, Check, Loader2, Paperclip, Upload, X } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StudioComposerHint } from "./studio-composer-hint"
import { contextLabel, linkedIdsOf, type GdriveChip, type GdriveNotice } from "@/lib/connectors-gdrive-composer"
import type { GdriveComposerApi } from "@/hooks/use-gdrive-composer"
import "./gdrive-composer.css"

/** The mock's Drive mark in the lucide stroke style (lucide has no Google Drive icon). */
export function DriveIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-gdrive-icon="true">
      <path d="M8 3h8l6 10-4 7H6l-4-7z" />
      <path d="M8 3l6 10h8M2 13h12l-4 7" />
    </svg>
  )
}

interface GdriveAttachMenuProps {
  studio: boolean
  /** features.enableFileUploads: the base's Paperclip exists, so "Upload file" stays in the menu. */
  uploadEnabled: boolean
  uploadDisabled: boolean
  busy: boolean
  onUpload: () => void
  onAddFromDrive: () => void
}

/** D1a: the Paperclip opens a small menu (Upload file / Add from Google Drive) instead of going straight to the file picker. */
export function GdriveAttachMenu({ studio, uploadEnabled, uploadDisabled, busy, onUpload, onAddFromDrive }: GdriveAttachMenuProps) {
  const [open, setOpen] = React.useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <StudioComposerHint enabled={studio} label="Attach files" suppressed={open}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-gdrive-attach="true"
            className="flex items-center justify-center rounded-lg p-1.5 text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-200 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={studio ? undefined : "Attach"}
            aria-label="Attach"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
      </StudioComposerHint>
      <DropdownMenuContent side="top" align="start" data-gdrive-menu="true" className="gdrive-menu">
        {uploadEnabled && (
          <DropdownMenuItem data-gdrive-menu-item="upload" disabled={uploadDisabled} onSelect={() => onUpload()}>
            <Upload className="h-4 w-4" aria-hidden="true" />Upload file
          </DropdownMenuItem>
        )}
        <DropdownMenuItem data-gdrive-menu-item="drive" disabled={busy} onSelect={() => onAddFromDrive()}>
          <DriveIcon />Add from Google Drive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Chip({ chip, onRemove }: { chip: GdriveChip; onRemove: () => void }) {
  const dismiss = chip.state === "error"
  return (
    <li data-gdrive-chip={chip.state} data-gdrive-kind={chip.errorKind}>
      {chip.state === "linking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : chip.state === "error" ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : <DriveIcon className="h-3.5 w-3.5" />}
      <span data-gdrive-chip-name="true" title={chip.title}>{chip.title}</span>
      <button
        type="button"
        data-gdrive-chip-remove="true"
        aria-label={dismiss ? `Dismiss ${chip.title}` : `Remove ${chip.title} from this chat`}
        title={dismiss ? "Dismiss" : "Remove from this chat (the file stays in your library)"}
        disabled={chip.state === "linking"}
        onClick={onRemove}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </li>
  )
}

function Alert({ tone, text, onReconnect, onDismiss }: { tone: GdriveNotice["tone"]; text: string; onReconnect?: () => void; onDismiss?: () => void }) {
  return (
    <div role={tone === "info" ? "status" : "alert"} data-gdrive-alert={tone}>
      {tone === "info" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
      <div>
        <span>{text}</span>
        {onReconnect && <button type="button" data-gdrive-reconnect="true" onClick={onReconnect}>Reconnect</button>}
      </div>
      {onDismiss && <button type="button" data-gdrive-alert-dismiss="true" aria-label="Dismiss" onClick={onDismiss}><X className="h-3 w-3" aria-hidden="true" /></button>}
    </div>
  )
}

/** D3b chips + D8 alerts above the composer, and the D2a connect prompt. */
export function GdriveChipsBar({ gdrive }: { gdrive: GdriveComposerApi }) {
  const { chips, notices } = gdrive
  const linked = linkedIdsOf(chips).length
  const errors = chips.filter(chip => chip.state === "error" && chip.message)
  return (
    <>
      {(chips.length > 0 || notices.length > 0) && (
        <div data-gdrive-composer="bar">
          {linked > 0 && (
            <div data-gdrive-context="true" role="status"><span aria-hidden="true" data-gdrive-dot="true" /><span>{contextLabel(linked)}</span></div>
          )}
          {chips.length > 0 && (
            <ul data-gdrive-chips="true" aria-label="Google Drive files for this chat">
              {chips.map(chip => <Chip key={chip.id} chip={chip} onRemove={() => gdrive.removeChip(chip.id)} />)}
            </ul>
          )}
          {errors.map(chip => (
            <Alert key={`e:${chip.id}`} tone={chip.errorKind === "expired" ? "warn" : "error"} text={chip.message ?? ""} onReconnect={chip.errorKind === "expired" ? gdrive.connect : undefined} />
          ))}
          {notices.map(notice => (
            <Alert key={notice.id} tone={notice.tone} text={notice.text} onReconnect={notice.action === "reconnect" ? gdrive.connect : undefined} onDismiss={() => gdrive.dismissNotice(notice.id)} />
          ))}
        </div>
      )}
      <Dialog open={gdrive.connectOpen} onOpenChange={open => { if (!open) gdrive.cancelConnect() }}>
        <DialogContent data-gdrive-dialog="connect" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DriveIcon className="h-5 w-5" />Connect Google Drive</DialogTitle>
            <DialogDescription>Deckster only sees the files you pick. It cannot browse the rest of your Drive.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" data-gdrive-btn="ghost" onClick={gdrive.cancelConnect}>Not now</button>
            <button type="button" data-gdrive-btn="primary" onClick={gdrive.connect}>Connect</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
