import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/sessions/[id]/messages
 * Batch save messages for a session
 *
 * Body:
 * - messages: Array<{
 *     id: string (message_id),
 *     messageType: string,
 *     timestamp: Date,
 *     payload: any,
 *     userText?: string (for user messages)
 *   }>
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { id: sessionId } = await params;

    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify session exists and ownership
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (chatSession.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Log received messages for debugging
    console.log(`[API] Saving ${messages.length} messages to session ${sessionId}`);
    messages.forEach((msg, i) => {
      if (msg.userText) {
        console.log(`[API] Message ${i} (${msg.id}): userText = "${msg.userText.substring(0, 30)}..."`);
      }
    });

    // Batch insert messages with deduplication (upsert)
    const results = await Promise.allSettled(
      messages.map(async (msg: any) => {
        return prisma.chatMessage.upsert({
          where: { id: msg.id },
          update: {
            // Only update if content might have changed
            payload: msg.payload,
            // FIXED: Only update userText if new value is provided (don't overwrite with null)
            ...(msg.userText ? { userText: msg.userText } : {})
          },
          create: {
            id: msg.id,
            sessionId: sessionId,
            messageType: msg.messageType,
            timestamp: new Date(msg.timestamp),
            payload: msg.payload,
            userText: msg.userText || null
          }
        });
      })
    );

    // Count successes and failures
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // Update session lastMessageAt
    if (successful > 0 && messages.length > 0) {
      const latestTimestamp = messages.reduce((latest, msg) => {
        const msgTime = new Date(msg.timestamp);
        return msgTime > latest ? msgTime : latest;
      }, new Date(0));

      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          lastMessageAt: latestTimestamp,
          updatedAt: new Date()
        }
      });
    }

    return NextResponse.json({
      saved: successful,
      failed,
      total: messages.length
    });

  } catch (error) {
    console.error('Error saving messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sessions/[id]/messages
 * Fetch messages for a session
 *
 * Query params:
 * - limit: number (default: 100)
 * - offset: number (default: 0)
 * - messageType: string (optional filter)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { id: sessionId } = await params;

    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify session exists and ownership
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (chatSession.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const messageType = searchParams.get('messageType');

    // Build where clause
    const where: any = { sessionId };
    if (messageType) {
      where.messageType = messageType;
    }

    // Fetch messages
    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: limit,
      skip: offset
    });

    // Get total count
    const totalCount = await prisma.chatMessage.count({ where });

    return NextResponse.json({
      messages,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
