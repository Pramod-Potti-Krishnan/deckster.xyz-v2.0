'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface FileUploadButtonProps {
  onFilesSelected: (files: File[]) => void
  maxFiles: number
  currentFileCount: number
  disabled?: boolean
  onRequestSession?: () => Promise<void>  // Callback to create session before file upload
  isCreatingSession?: boolean              // Loading state during session creation
}

export function FileUploadButton({
  onFilesSelected,
  maxFiles,
  currentFileCount,
  disabled = false,
  onRequestSession,
  isCreatingSession = false
}: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleClick = async () => {
    if (currentFileCount >= maxFiles) {
      toast({
        title: 'Maximum files reached',
        description: `You can only attach up to ${maxFiles} files per session.`,
        variant: 'destructive'
      })
      return
    }

    // If session creation callback provided, create session first
    if (onRequestSession) {
      try {
        await onRequestSession()
      } catch (error) {
        toast({
          title: 'Failed to create session',
          description: 'Please try again',
          variant: 'destructive'
        })
        return
      }
    }

    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    const remainingSlots = maxFiles - currentFileCount
    if (files.length > remainingSlots) {
      toast({
        title: 'Too many files',
        description: `You can only attach ${remainingSlots} more file(s).`,
        variant: 'destructive'
      })
      return
    }

    onFilesSelected(files)

    // Reset input to allow re-uploading the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={disabled || isCreatingSession || currentFileCount >= maxFiles}
        className="flex items-center gap-2"
      >
        {isCreatingSession ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing...
          </>
        ) : (
          <>
            <Paperclip className="h-4 w-4" />
            Attach Files ({currentFileCount}/{maxFiles})
          </>
        )}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.csv,.pptx,.ppt,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg,.py,.js,.ts,.java,.go,.rs"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  )
}
