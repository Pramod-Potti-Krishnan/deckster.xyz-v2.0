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
