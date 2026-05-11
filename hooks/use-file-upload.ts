'use client'

import { useState, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { UploadedFile } from '@/components/file-chip'
import { validateFile } from '@/lib/file-validation'
import { apiConfig, uploadConfig } from '@/lib/config'

const MAX_FILES = uploadConfig.maxFiles
const RESEARCHER_BASE_URL = apiConfig.knowledgeServiceUrl.replace(/\/$/, '')
const POLL_ATTEMPTS = 30
const POLL_INTERVAL_MS = 3000

type StorageUploadUrlResponse = {
  signed_url: string
  storage_path: string
  expires_in?: number
}

type ProcessUploadedResponse = {
  success?: boolean
  job_id?: string
  status?: string
  session_id?: string
  file_name?: string
  file_uri?: string
  storage_path?: string
  message?: string
  annotation_status?: string
}

type IngestStatusResponse = {
  job_id: string
  session_id?: string
  file_name?: string
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'unknown'
  storage_path?: string
  error?: string | null
}

interface UseFileUploadOptions {
  sessionId: string
  userId: string
  onUploadComplete?: (files: UploadedFile[]) => void
}

async function readResponseBody(response: Response): Promise<any> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function getErrorMessage(body: any, fallback: string): string {
  if (!body) return fallback
  if (typeof body === 'string') return body
  if (typeof body.error === 'string') return body.error
  if (typeof body.message === 'string') return body.message
  if (typeof body.detail === 'string') return body.detail
  if (body.detail && typeof body.detail.message === 'string') return body.detail.message
  if (body.detail && typeof body.detail.error_code === 'string') return body.detail.error_code
  return fallback
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function useFileUpload({ sessionId, userId, onUploadComplete }: UseFileUploadOptions) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const { toast } = useToast()
  const researcherSessionIdRef = useRef<string | null>(null)
  const researcherSessionPromiseRef = useRef<Promise<string> | null>(null)

  // Keep sessionId in a ref so the uploadFile callback always reads the latest value
  // (avoids stale closure when session is created just before upload)
  const sessionIdRef = useRef(sessionId)
  if (sessionIdRef.current !== sessionId && sessionId) {
    sessionIdRef.current = sessionId
    researcherSessionIdRef.current = null
    researcherSessionPromiseRef.current = null
  }

  const updateFile = useCallback((fileId: string, updates: Partial<UploadedFile>) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, ...updates } : f))
  }, [])

  const ensureResearcherSession = useCallback(async (): Promise<string> => {
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) {
      throw new Error('No active session')
    }

    if (researcherSessionIdRef.current) {
      return researcherSessionIdRef.current
    }

    if (researcherSessionPromiseRef.current) {
      return researcherSessionPromiseRef.current
    }

    researcherSessionPromiseRef.current = (async () => {
      const response = await fetch(`${RESEARCHER_BASE_URL}/api/v1/sessions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId || 'anonymous',
          session_id: currentSessionId,
          session_name: `Session_${currentSessionId.slice(0, 8)}`,
          metadata: {
            frontend_session_id: currentSessionId,
            upload_path: 'direct_supabase',
          },
        }),
      })

      const body = await readResponseBody(response)
      if (!response.ok) {
        throw new Error(getErrorMessage(body, `Failed to create Researcher session (${response.status})`))
      }

      const researcherSessionId = body?.session_id || currentSessionId
      researcherSessionIdRef.current = researcherSessionId
      return researcherSessionId
    })()

    try {
      return await researcherSessionPromiseRef.current
    } finally {
      researcherSessionPromiseRef.current = null
    }
  }, [userId])

  const requestStorageUploadUrl = useCallback(async (
    researcherSessionId: string,
    file: File,
    contentType: string,
  ): Promise<StorageUploadUrlResponse> => {
    const response = await fetch(`${RESEARCHER_BASE_URL}/api/v1/files/storage-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: researcherSessionId,
        filename: file.name,
        content_type: contentType,
      }),
    })

    const body = await readResponseBody(response)
    if (!response.ok) {
      throw new Error(getErrorMessage(body, `Failed to prepare upload (${response.status})`))
    }

    if (!body?.signed_url || !body?.storage_path) {
      throw new Error('Researcher did not return a signed upload URL')
    }

    return body
  }, [])

  const putFileToStorage = useCallback(async (
    signedUrl: string,
    file: File,
    contentType: string,
  ) => {
    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    })

    if (!response.ok) {
      const body = await readResponseBody(response)
      throw new Error(getErrorMessage(body, `Storage upload failed (${response.status})`))
    }
  }, [])

  const processUploadedFile = useCallback(async (
    researcherSessionId: string,
    storagePath: string,
    file: File,
    contentType: string,
  ): Promise<ProcessUploadedResponse> => {
    const response = await fetch(`${RESEARCHER_BASE_URL}/api/v1/files/process-uploaded`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: researcherSessionId,
        storage_path: storagePath,
        original_filename: file.name,
        content_type: contentType,
        display_name: file.name,
      }),
    })

    const body = await readResponseBody(response)
    if (!response.ok && response.status !== 202) {
      throw new Error(getErrorMessage(body, `Failed to ingest upload (${response.status})`))
    }

    if (response.status === 202 && !body?.job_id) {
      throw new Error('Researcher queued ingest without returning a job id')
    }

    return body
  }, [])

  const pollIngestStatus = useCallback(async (
    jobId: string,
    fileId: string,
  ): Promise<IngestStatusResponse> => {
    let unknownCount = 0
    await sleep(2000)

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      const response = await fetch(`${RESEARCHER_BASE_URL}/api/v1/files/ingest-status/${jobId}`)
      const body = await readResponseBody(response)

      if (!response.ok) {
        throw new Error(getErrorMessage(body, `Failed to check ingest status (${response.status})`))
      }

      const job = body as IngestStatusResponse
      const progress = Math.min(95, 75 + Math.round((attempt / POLL_ATTEMPTS) * 20))
      updateFile(fileId, { uploadProgress: progress })

      if (job.status === 'ready') {
        return job
      }

      if (job.status === 'failed') {
        throw new Error(job.error || 'Researcher failed to ingest this file')
      }

      if (job.status === 'unknown') {
        unknownCount += 1
        if (unknownCount > 1) {
          throw new Error('Researcher could not find the ingest job')
        }
      }

      await sleep(POLL_INTERVAL_MS)
    }

    throw new Error('Timed out waiting for Researcher to ingest the file')
  }, [updateFile])

  const recordUploadedFile = useCallback(async (
    researcherSessionId: string,
    file: File,
    fileUri: string,
    fileName: string | null,
  ) => {
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) return

    try {
      const response = await fetch(`/api/sessions/${currentSessionId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          geminiFileUri: fileUri,
          geminiFileName: fileName,
          geminiStoreName: researcherSessionId,
        }),
      })

      if (!response.ok) {
        const body = await readResponseBody(response)
        console.warn('[FileUpload] File ingested but metadata save failed:', getErrorMessage(body, response.statusText))
      }
    } catch (error) {
      console.warn('[FileUpload] File ingested but metadata save failed:', error)
    }
  }, [])

  const uploadFile = useCallback(async (file: File): Promise<UploadedFile> => {
    const currentSessionId = sessionIdRef.current
    console.log(`[FileUpload] Starting upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB), sessionId=${currentSessionId}`)

    if (!currentSessionId) {
      toast({
        title: 'No active session',
        description: 'Please start a conversation before uploading files.',
        variant: 'destructive'
      })
      throw new Error('No active session')
    }

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
      const contentType = file.type || 'application/octet-stream'
      const researcherSessionId = await ensureResearcherSession()
      updateFile(fileId, { uploadProgress: 10 })

      const uploadUrl = await requestStorageUploadUrl(researcherSessionId, file, contentType)
      updateFile(fileId, { uploadProgress: 25 })

      await putFileToStorage(uploadUrl.signed_url, file, contentType)
      updateFile(fileId, { uploadProgress: 65 })

      const processResult = await processUploadedFile(researcherSessionId, uploadUrl.storage_path, file, contentType)
      updateFile(fileId, { uploadProgress: processResult.job_id ? 75 : 95 })

      const ingestResult = processResult.job_id
        ? await pollIngestStatus(processResult.job_id, fileId)
        : null

      const fileName = ingestResult?.file_name || processResult.file_name || file.name
      const fileUri = processResult.file_uri || ingestResult?.storage_path || processResult.storage_path || uploadUrl.storage_path

      await recordUploadedFile(researcherSessionId, file, fileUri, fileName)

      // Update file status to success
      const successFile: UploadedFile = {
        ...uploadedFile,
        status: 'success',
        uploadProgress: 100,
        geminiFileUri: fileUri,
        geminiFileName: fileName,
        geminiStoreName: researcherSessionId,
      }

      setFiles(prev => prev.map(f => f.id === fileId ? successFile : f))
      console.log(`[FileUpload] Direct upload succeeded: ${file.name}, researcherSessionId=${researcherSessionId}`)

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
  }, [
    ensureResearcherSession,
    pollIngestStatus,
    processUploadedFile,
    putFileToStorage,
    recordUploadedFile,
    requestStorageUploadUrl,
    toast,
    updateFile,
  ])

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
