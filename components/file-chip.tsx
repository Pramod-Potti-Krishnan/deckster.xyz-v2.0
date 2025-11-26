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
}

interface FileChipProps {
  file: UploadedFile
  onRemove: () => void
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

export function FileChip({ file, onRemove }: FileChipProps) {
  const FileIcon = getFileIcon(file.type)

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
      file.status === 'success' && "bg-secondary border-secondary",
      file.status === 'uploading' && "bg-secondary/50 border-secondary",
      file.status === 'error' && "bg-destructive/10 border-destructive"
    )}>
      <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </p>

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
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {file.status === 'success' && (
          <Check className="h-4 w-4 text-green-600" />
        )}
        {file.status === 'error' && (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onRemove}
          type="button"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
