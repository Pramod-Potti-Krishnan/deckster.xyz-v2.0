import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { pickAllowedKeys } from '@/lib/api-hardening-core';

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

    // Filter out "ghost" sessions: older than 7 days with no messages
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch sessions
    const sessions = await prisma.chatSession.findMany({
      where: {
        userId: user.id,
        status: status as string,
        // Exclude old empty sessions that clutter the UI
        NOT: {
          AND: [
            { lastMessageAt: null },
            { createdAt: { lt: sevenDaysAgo } }
          ]
        }
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
        blankPresentationUrl: true,
        strawmanPreviewUrl: true,
        finalPresentationUrl: true,
        blankPresentationId: true,
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
 * What POST answers with for a chat session row: the two fields the Builder's clients read (the id, and geminiStoreName
 * when it adopts an id), nothing else. The row also holds userId, the presentation urls and ids and the Knowledge store
 * ids, which a caller never needs back from a create (P-73).
 */
const SESSION_CREATE_RESPONSE_KEYS = ['id', 'geminiStoreName'] as const;

/**
 * POST /api/sessions
 * Create a new chat session
 *
 * Body:
 * - sessionId: string (UUID from WebSocket)
 * - title?: string (optional initial title)
 *
 * Answers (a 2xx always means the row is the caller's):
 * - 201 { session }                      a new row, owned by the caller
 * - 200 { session }                      the caller's OWN row already has that id (it was a 409 with the whole row before P-73)
 * - 404 { error: 'Session not found' }   the id is another user's chat: no row, nothing about its owner, nothing written (P-73)
 * Logs carry no e-mail, no DATABASE_URL and no raw error text; a 500 answers a generic message (P-74).
 */
export async function POST(req: NextRequest) {
  console.log('='.repeat(80));
  console.log('[Session Create] Starting session creation...');
  console.log('[Session Create] Timestamp:', new Date().toISOString());
  console.log('[Session Create] Environment:', process.env.NODE_ENV);
  console.log('[Session Create] DATABASE_URL configured:', !!process.env.DATABASE_URL);
  console.log('[Session Create] DIRECT_URL configured:', !!process.env.DIRECT_URL);

  try {
    // Authenticate user
    console.log('[Session Create] Step 1: Authenticating user...');
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.error('[Session Create] ❌ Unauthorized - no session or email');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Session Create] ✅ Authenticated');

    // Get user from database
    console.log('[Session Create] Step 2: Finding user in database...');
    console.log('[Session Create] Attempting Prisma query: user.findUnique by email');

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      });
      console.log('[Session Create] ✅ Prisma query successful, user found:', !!user);
    } catch (dbError: any) {
      console.error('[Session Create] ❌ Database error during user lookup:');
      console.error('[Session Create] Error name:', dbError.name);
      console.error('[Session Create] Error code:', dbError.code);
      console.error('[Session Create] Client version:', dbError.clientVersion);
      throw dbError; // Re-throw to be caught by outer catch
    }

    // If user doesn't exist in DB (shouldn't happen with PrismaAdapter, but handle gracefully)
    if (!user) {
      console.warn('[Session Create] ⚠️ User not found in database, creating');
      console.log('[Session Create] Step 3: Creating user in database...');

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
        console.log('[Session Create] ✅ User created successfully:', user.id);
      } catch (createError: any) {
        console.error('[Session Create] ❌ Failed to create user:');
        console.error('[Session Create] Code:', createError.code);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }
    } else {
      console.log('[Session Create] ✅ User found in database:', user.id);
    }

    // Parse request body
    console.log('[Session Create] Step 4: Parsing request body...');
    const body = await req.json();
    const { sessionId, title } = body;
    console.log('[Session Create] Session ID:', sessionId);
    console.log('[Session Create] Title given:', !!title);

    if (!sessionId) {
      console.error('[Session Create] ❌ sessionId is required');
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Check if session already exists
    console.log('[Session Create] Step 5: Checking if session already exists...');
    const existing = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (existing) {
      // Another user's chat is answered exactly like an id that cannot be used: no row, nothing about its owner (P-73).
      // The [id] routes check the owner the same way (app/api/sessions/[id]/route.ts).
      if (existing.userId !== user.id) {
        console.warn('[Session Create] ⚠️ Session id belongs to another user, refused:', sessionId);
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      console.log('[Session Create] ⚠️ Session already exists:', sessionId);
      return NextResponse.json(
        { session: pickAllowedKeys(existing, SESSION_CREATE_RESPONSE_KEYS) },
        { status: 200 }
      );
    }

    console.log('[Session Create] ✅ Session does not exist, creating new one');

    // Create new session
    console.log('[Session Create] Step 6: Creating chat session...');
    console.log('[Session Create] Data:', {
      id: sessionId,
      userId: user.id,
      hasTitle: !!title,
      currentStage: 1,
      status: 'active'
    });

    const newSession = await prisma.chatSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        title: title || null,
        currentStage: 1,
        status: 'active'
      }
    });

    console.log('[Session Create] ✅ Chat session created successfully:', newSession.id);
    console.log('='.repeat(80));

    return NextResponse.json({
      session: pickAllowedKeys(newSession, SESSION_CREATE_RESPONSE_KEYS)
    }, { status: 201 });

  } catch (error: any) {
    // The error's kind and code only: a Prisma message quotes the query (the e-mail included) and a connection error can quote the URL.
    console.error('='.repeat(80));
    console.error('[Session Create] ❌ FATAL ERROR creating session');
    console.error('[Session Create] Error type:', error?.constructor?.name);
    console.error('[Session Create] Error code:', error?.code);
    console.error('[Session Create] Client version:', error?.clientVersion);
    console.error('='.repeat(80));

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
