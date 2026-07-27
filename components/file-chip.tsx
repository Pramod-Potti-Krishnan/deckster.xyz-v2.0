'use client'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  X,
  FileText,
  File,
  Image,
  FileSpreadsheet,
  FileCode,
  Check,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getUploadStatusPresentation,
  type UploadLifecycleStatus,
} from '@/lib/upload-status'

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  status: UploadLifecycleStatus
  uploadProgress: number
  errorMessage?: string
  geminiFileUri?: string
  geminiFileName?: string  // NEW: Gemini's internal file name
  geminiStoreName?: string // NEW: File Search Store resource name
}

interface FileChipProps {
  file: UploadedFile
  onRemove: () => void
  variant?: 'default' | 'compact' | 'icon'
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText
  if (mimeType.includes('code') || mimeType.includes('javascript') || mimeType.includes('python')) return FileCode
  return File
}

function getFileAccent(mimeType: string) {
  if (mimeType.startsWith('image/')) return "border-sky-200 bg-sky-50 text-sky-700"
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (mimeType.includes('pdf')) return "border-rose-200 bg-rose-50 text-rose-700"
  if (mimeType.includes('document') || mimeType.includes('text')) return "border-blue-200 bg-blue-50 text-blue-700"
  if (mimeType.includes('code') || mimeType.includes('javascript') || mimeType.includes('python')) return "border-violet-200 bg-violet-50 text-violet-700"
  return "border-gray-200 bg-gray-50 text-gray-600"
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function FileChip({ file, onRemove, variant = 'default' }: FileChipProps) {
  const FileIcon = getFileIcon(file.type)
  const isCompact = variant === 'compact'
  const isIcon = variant === 'icon'
  const status = getUploadStatusPresentation(
    file.status,
    file.name,
    file.errorMessage,
  )

  if (isIcon) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={status.ariaLabel}
        className={cn(
          "group relative h-16 w-20 shrink-0 rounded-xl border bg-white shadow-sm transition-colors",
          file.status === 'success' && "border-gray-200",
          file.status === 'uploading' && "border-purple-200 bg-purple-50/50",
          file.status === 'processing' && "border-blue-200 bg-blue-50/50",
          file.status === 'degraded' && "border-amber-200 bg-amber-50/70",
          file.status === 'error' && "border-destructive/40 bg-destructive/10"
        )}
        title={`${file.name} — ${status.label}${file.errorMessage ? `: ${file.errorMessage}` : ''}`}
      >
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label={`Remove ${file.name}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>

        <div className="flex h-full flex-col items-center justify-center gap-0.5 px-1.5 py-1.5">
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border",
            getFileAccent(file.type)
          )}>
            <FileIcon className="h-4 w-4" />
          </div>
          <span className="block max-w-full truncate text-[7px] font-medium leading-none text-gray-600">
            {file.name}
          </span>
          <span className={cn(
            "block max-w-full truncate text-[7px] font-medium leading-none",
            file.status === 'degraded' ? "text-amber-700" :
              file.status === 'error' ? "text-destructive" :
                file.status === 'success' ? "text-emerald-700" :
                  file.status === 'processing' ? "text-blue-700" :
                    "text-purple-700"
          )}>
            {file.status === 'processing'
              ? 'Enriching'
              : file.status === 'degraded'
                ? 'Partial'
                : file.status === 'success'
                  ? 'Ready'
                  : file.status === 'error'
                    ? 'Failed'
                    : 'Uploading'}
          </span>
        </div>

        <div className="absolute bottom-1 right-1 rounded-full bg-white shadow-sm">
          {file.status === 'uploading' && (
            <Loader2 className="h-3 w-3 animate-spin text-purple-600" />
          )}
          {file.status === 'processing' && (
            <Sparkles className="h-3 w-3 text-blue-600" />
          )}
          {file.status === 'success' && (
            <Check className="h-3 w-3 text-green-600" />
          )}
          {file.status === 'degraded' && (
            <AlertTriangle className="h-3 w-3 text-amber-600" />
          )}
          {file.status === 'error' && (
            <AlertCircle className="h-3 w-3 text-destructive" />
          )}
        </div>

        {status.showProgress && (
          <Progress value={file.uploadProgress} className="absolute bottom-0 left-2 right-2 h-0.5" />
        )}
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={status.ariaLabel}
      className={cn(
        "flex items-center border transition-colors",
        isCompact
          ? "gap-1.5 rounded-md px-2 py-1"
          : "gap-2 rounded-lg px-3 py-2",
        file.status === 'success' && "bg-secondary border-secondary",
        file.status === 'uploading' && "bg-secondary/50 border-secondary",
        file.status === 'processing' && "bg-blue-50/70 border-blue-200",
        file.status === 'degraded' && "bg-amber-50/70 border-amber-200",
        file.status === 'error' && "bg-destructive/10 border-destructive"
      )}>
      <FileIcon className={cn(
        "flex-shrink-0 text-muted-foreground",
        isCompact ? "h-3.5 w-3.5" : "h-4 w-4"
      )} />

      <div className="flex-1 min-w-0">
        {isCompact ? (
          <p className="truncate text-[11px] font-medium leading-4" title={file.name}>
            {file.name}
            <span className="ml-1 font-normal text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
          </p>
        ) : (
          <>
            <p className="text-sm font-medium truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </>
        )}

        {status.showProgress && (
          <Progress value={file.uploadProgress} className="h-1 mt-1" />
        )}
        {(file.status === 'processing' || file.status === 'success' || file.status === 'degraded') && (
          <p className={cn(
            "text-[10px] mt-1",
            file.status === 'degraded' ? "text-amber-700" :
              file.status === 'success' ? "text-emerald-700" :
                "text-blue-700"
          )} title={file.errorMessage}>
            {status.label}
          </p>
        )}

        {file.status === 'error' && file.errorMessage && (
          <p className="text-xs text-destructive mt-1" title={file.errorMessage}>
            {file.errorMessage}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {status.showActivity && (
          <Loader2 className={cn(
            "animate-spin text-muted-foreground",
            isCompact ? "h-3.5 w-3.5" : "h-4 w-4"
          )} />
        )}
        {file.status === 'processing' && (
          <Sparkles className={cn("text-blue-600", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        )}
        {file.status === 'success' && (
          <Check className={cn("text-green-600", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        )}
        {file.status === 'degraded' && (
          <AlertTriangle className={cn("text-amber-600", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        )}
        {file.status === 'error' && (
          <AlertCircle className={cn("text-destructive", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        )}

        <Button
          variant="ghost"
          size="icon"
          className={cn(isCompact ? "h-5 w-5" : "h-6 w-6")}
          onClick={onRemove}
          type="button"
          aria-label={`Remove ${file.name}`}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
