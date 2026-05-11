import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { id: sessionId } = await params

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get all files for session
    const files = await prisma.uploadedFile.findMany({
      where: { sessionId },
      orderBy: { uploadedAt: 'asc' }
    })

    return NextResponse.json({ files })
  } catch (error) {
    console.error('Get session files error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    })

    if (!chatSession || chatSession.userId !== user.id) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const existingFiles = await prisma.uploadedFile.count({
      where: { sessionId }
    })

    if (existingFiles >= 5) {
      return NextResponse.json(
        { error: 'Maximum 5 files per session' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const fileName = typeof body.fileName === 'string' ? body.fileName : ''
    const fileSize = Number(body.fileSize || 0)
    const fileType = typeof body.fileType === 'string' ? body.fileType : 'application/octet-stream'
    const geminiFileUri = typeof body.geminiFileUri === 'string' ? body.geminiFileUri : ''
    const geminiFileName = typeof body.geminiFileName === 'string' ? body.geminiFileName : null
    const geminiStoreName = typeof body.geminiStoreName === 'string' ? body.geminiStoreName : null

    if (!fileName || !geminiFileUri) {
      return NextResponse.json(
        { error: 'Missing file metadata' },
        { status: 400 }
      )
    }

    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        sessionId,
        userId: user.id,
        fileName,
        fileSize,
        fileType,
        geminiFileUri,
        geminiFileName,
        geminiStoreName,
        uploadStatus: 'indexed',
        uploadError: null,
      }
    })

    if (geminiStoreName && chatSession.geminiStoreName !== geminiStoreName) {
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          geminiStoreName,
          geminiStoreId: geminiStoreName,
          updatedAt: new Date()
        }
      })
    }

    return NextResponse.json({ file: uploadedFile })
  } catch (error) {
    console.error('Create session file error:', error)
    return NextResponse.json(
      { error: 'Failed to record file' },
      { status: 500 }
    )
  }
}
