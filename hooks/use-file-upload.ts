'use client'

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { UploadedFile } from '@/components/file-chip'
import { validateFile } from '@/lib/file-validation'
import { uploadConfig } from '@/lib/config'

const MAX_FILE_SIZE = uploadConfig.maxFileSize
const MAX_FILES = uploadConfig.maxFiles

interface UseFileUploadOptions {
  sessionId: string
  userId: string
  onUploadComplete?: (files: UploadedFile[]) => void
}

export function useFileUpload({ sessionId, userId, onUploadComplete }: UseFileUploadOptions) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const { toast } = useToast()

  const uploadFile = useCallback(async (file: File): Promise<UploadedFile> => {
    console.log(`[FileUpload] Starting upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB), sessionId=${sessionId}`)
    const fileId = crypto.randomUUID()

    // Create initial file object
    const uploadedFile: UploadedFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading',
      uploadProgress: 0
    }

    setFiles(prev => [...prev, uploadedFile])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sessionId', sessionId)
      formData.append('userId', userId)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()

      // Update file status to success
      const successFile: UploadedFile = {
        ...uploadedFile,
        status: 'success',
        uploadProgress: 100,
        geminiFileUri: result.geminiFileUri,
        geminiFileName: result.geminiFileName,
        geminiStoreName: result.geminiStoreName, // NEW: Store name from response
      }

      setFiles(prev => prev.map(f => f.id === fileId ? successFile : f))
      console.log(`[FileUpload] Upload succeeded: ${file.name}, geminiFileUri=${result.geminiFileUri}`)

      return successFile
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      console.error(`[FileUpload] Upload failed: ${file.name}`, error)

      const errorFile: UploadedFile = {
        ...uploadedFile,
        status: 'error',
        uploadProgress: 0,
        errorMessage
      }

      setFiles(prev => prev.map(f => f.id === fileId ? errorFile : f))

      toast({
        title: 'Upload failed',
        description: `${file.name}: ${errorMessage}`,
        variant: 'destructive'
      })

      throw error
    }
  }, [sessionId, userId, toast])

  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    console.log(`[FileUpload] Files selected: ${selectedFiles.length}`, selectedFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`))

    // Validate file count
    if (files.length + selectedFiles.length > MAX_FILES) {
      toast({
        title: 'Too many files',
        description: `You can only attach up to ${MAX_FILES} files per session.`,
        variant: 'destructive'
      })
      return
    }

    // Validate each file
    const invalidFiles: string[] = []
    const validFiles: File[] = []

    for (const file of selectedFiles) {
      const error = validateFile(file)
      if (error) {
        console.warn(`[FileUpload] File rejected: ${file.name} — ${error.message}`)
        invalidFiles.push(`${file.name}: ${error.message}`)
      } else {
        validFiles.push(file)
      }
    }

    if (invalidFiles.length > 0) {
      toast({
        title: 'Invalid files',
        description: invalidFiles.join('\n'),
        variant: 'destructive'
      })
    }

    // Upload valid files
    const uploadPromises = validFiles.map(file => uploadFile(file))

    try {
      const uploadedFiles = await Promise.allSettled(uploadPromises)
      const successfulUploads = uploadedFiles
        .filter((result): result is PromiseFulfilledResult<UploadedFile> => result.status === 'fulfilled')
        .map(result => result.value)

      if (successfulUploads.length > 0 && onUploadComplete) {
        onUploadComplete(successfulUploads)
      }

      if (successfulUploads.length < validFiles.length) {
        toast({
          title: 'Some uploads failed',
          description: `${successfulUploads.length} of ${validFiles.length} files uploaded successfully.`,
          variant: 'destructive'
        })
      } else if (successfulUploads.length > 0) {
        toast({
          title: 'Upload successful',
          description: `${successfulUploads.length} file(s) uploaded successfully.`
        })
      }
    } catch (error) {
      console.error('File upload error:', error)
    }
  }, [files.length, uploadFile, onUploadComplete, toast])

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }, [])

  const clearAllFiles = useCallback(() => {
    setFiles([])
  }, [])

  return {
    files,
    handleFilesSelected,
    removeFile,
    clearAllFiles
  }
}
