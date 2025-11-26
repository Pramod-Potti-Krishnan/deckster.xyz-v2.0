import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const BACKEND_FILE_SERVICE_URL = process.env.BACKEND_FILE_SERVICE_URL || 'http://localhost:8000'

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const sessionId = formData.get('sessionId') as string
    const userId = formData.get('userId') as string

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Missing sessionId or userId' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 20 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)` },
        { status: 400 }
      )
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Validate user owns session
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    })

    if (!chatSession || chatSession.userId !== user.id) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 403 }
      )
    }

    // Check file count limit
    const existingFiles = await prisma.uploadedFile.count({
      where: { sessionId }
    })

    if (existingFiles >= 5) {
      return NextResponse.json(
        { error: 'Maximum 5 files per session' },
        { status: 400 }
      )
    }

    // Forward file to backend RAG service
    const backendFormData = new FormData()
    backendFormData.append('file', file)
    backendFormData.append('session_id', sessionId)
    backendFormData.append('user_id', userId)

    let backendResponse
    try {
      backendResponse = await fetch(`${BACKEND_FILE_SERVICE_URL}/api/v1/files/upload`, {
        method: 'POST',
        body: backendFormData
      })
    } catch (fetchError) {
      console.error('Backend connection error:', fetchError)
      throw new Error(`Backend service unavailable at ${BACKEND_FILE_SERVICE_URL}. Please ensure the backend is running.`)
    }

    if (!backendResponse.ok) {
      let errorMessage = 'Backend upload failed'
      try {
        const errorData = await backendResponse.json()
        errorMessage = errorData.detail || errorData.error || errorMessage
      } catch {
        errorMessage = `Backend returned ${backendResponse.status}: ${backendResponse.statusText}`
      }
      throw new Error(errorMessage)
    }

    const backendResult = await backendResponse.json()

    // Store file metadata in database
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        sessionId,
        userId: user.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        geminiFileUri: backendResult.gemini_file_uri,
        geminiFileId: backendResult.gemini_file_id
      }
    })

    return NextResponse.json({
      id: uploadedFile.id,
      fileName: uploadedFile.fileName,
      fileSize: uploadedFile.fileSize,
      fileType: uploadedFile.fileType,
      geminiFileUri: uploadedFile.geminiFileUri,
      uploadedAt: uploadedFile.uploadedAt
    })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
