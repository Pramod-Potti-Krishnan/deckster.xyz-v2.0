import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

/**
 * Activate a draft session (transition from 'draft' to 'active')
 * Called when user sends their first message in a session
 *
 * POST /api/sessions/[id]/activate
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const sessionId = params.id

    // 2. Verify session exists and belongs to user
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        status: true,
        firstMessageAt: true,
        lastMessageAt: true
      }
    })

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (chatSession.userId !== session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized - session belongs to different user' },
        { status: 403 }
      )
    }

    // 3. Check if already activated
    if (chatSession.status === 'active' && chatSession.firstMessageAt) {
      console.log('[Session Activate] Already active:', sessionId)
      return NextResponse.json({
        message: 'Session already active',
        session: chatSession
      })
    }

    // 4. Activate session
    const now = new Date()
    const updatedSession = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: 'active',
        firstMessageAt: now,
        lastMessageAt: now
      }
    })

    console.log('[Session Activate] ✅ Session activated:', sessionId, {
      previousStatus: chatSession.status,
      newStatus: 'active',
      firstMessageAt: now.toISOString()
    })

    return NextResponse.json({
      message: 'Session activated successfully',
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        firstMessageAt: updatedSession.firstMessageAt,
        lastMessageAt: updatedSession.lastMessageAt
      }
    })

  } catch (error) {
    console.error('[Session Activate] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to activate session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
