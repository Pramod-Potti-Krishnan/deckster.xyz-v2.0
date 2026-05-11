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
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'success' | 'error'
  uploadProgress: number
  errorMessage?: string
  geminiFileUri?: string
  geminiFileName?: string  // NEW: Gemini's internal file name
  geminiStoreName?: string // NEW: File Search Store resource name
}

interface FileChipProps {
  file: UploadedFile
  onRemove: () => void
  variant?: 'default' | 'compact'
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText
  if (mimeType.includes('code') || mimeType.includes('javascript') || mimeType.includes('python')) return FileCode
  return File
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

  return (
    <div className={cn(
      "flex items-center border transition-colors",
      isCompact
        ? "gap-1.5 rounded-md px-2 py-1"
        : "gap-2 rounded-lg px-3 py-2",
      file.status === 'success' && "bg-secondary border-secondary",
      file.status === 'uploading' && "bg-secondary/50 border-secondary",
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

        {file.status === 'uploading' && (
          <Progress value={file.uploadProgress} className="h-1 mt-1" />
        )}

        {file.status === 'error' && file.errorMessage && (
          <p className="text-xs text-destructive mt-1" title={file.errorMessage}>
            {file.errorMessage}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {file.status === 'uploading' && (
          <Loader2 className={cn(
            "animate-spin text-muted-foreground",
            isCompact ? "h-3.5 w-3.5" : "h-4 w-4"
          )} />
        )}
        {file.status === 'success' && (
          <Check className={cn("text-green-600", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} />
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
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
