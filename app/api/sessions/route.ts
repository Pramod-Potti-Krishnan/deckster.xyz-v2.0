import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/sessions
 * List user's chat sessions
 *
 * Query params:
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - status: 'active' | 'archived' | 'deleted' (default: 'active')
 */
export async function GET(req: NextRequest) {
  try {
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

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || 'active';

    // Fetch sessions
    const sessions = await prisma.chatSession.findMany({
      where: {
        userId: user.id,
        status: status as string
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        lastMessageAt: true,
        currentStage: true,
        strawmanPreviewUrl: true,
        finalPresentationUrl: true,
        slideCount: true,
        status: true,
        isFavorite: true,
        // Include last message for preview
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: {
            id: true,
            messageType: true,
            timestamp: true,
            userText: true,
            payload: true
          }
        }
      }
    });

    // Get total count
    const totalCount = await prisma.chatSession.count({
      where: {
        userId: user.id,
        status: status as string
      }
    });

    return NextResponse.json({
      sessions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions
 * Create a new chat session
 *
 * Body:
 * - sessionId: string (UUID from WebSocket)
 * - title?: string (optional initial title)
 */
export async function POST(req: NextRequest) {
  try {
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

    // Parse request body
    const body = await req.json();
    const { sessionId, title } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Check if session already exists
    const existing = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Session already exists', session: existing },
        { status: 409 }
      );
    }

    // Create new session
    const newSession = await prisma.chatSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        title: title || null,
        currentStage: 1,
        status: 'active'
      }
    });

    return NextResponse.json({
      session: newSession
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
