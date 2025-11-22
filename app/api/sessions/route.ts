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
      console.error('[Session Create] Unauthorized - no session or email');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Session Create] Authenticated user:', session.user.email);

    // Get user from database
    let user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    // If user doesn't exist in DB (shouldn't happen with PrismaAdapter, but handle gracefully)
    if (!user) {
      console.warn('[Session Create] User not found in database, creating:', session.user.email);

      // Create user record (fallback in case PrismaAdapter didn't create it)
      try {
        user = await prisma.user.create({
          data: {
            email: session.user.email,
            name: session.user.name || null,
            image: session.user.image || null,
            tier: 'free',
            approved: false,
          }
        });
        console.log('[Session Create] User created successfully:', user.id);
      } catch (createError) {
        console.error('[Session Create] Failed to create user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }
    } else {
      console.log('[Session Create] User found in database:', user.id);
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
