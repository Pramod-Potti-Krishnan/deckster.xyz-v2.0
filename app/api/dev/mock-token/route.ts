import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { isStudioDevDeployment } from '@/lib/dev-deployment';

// C-07: a local development server only. NODE_ENV must be 'development' AND the dev-mode flag must be on; any other
// environment (production, test, preview, UAT) answers 404 as if the route did not exist. Not flag-gated: applies everywhere.
function mockTokenAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development' && env.NEXT_PUBLIC_DEV_MODE === 'true';
}

export async function POST(request: NextRequest) {
  if (isStudioDevDeployment()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!mockTokenAllowed()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const userId = body.user_id || 'test_user';
    
    // Create a mock JWT token for development
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'dev-secret-key-for-testing-only'
    );
    
    const token = await new SignJWT({
      user_id: userId,
      email: `${userId}@test.com`,
      name: 'Test User',
      tier: 'free',
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .setIssuedAt()
      .sign(secret);
    
    console.log('🔐 Generated mock JWT token for development:', userId);
    
    return NextResponse.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
      user_id: userId,
      warning: 'This is a mock token for development only'
    });
    
  } catch (error) {
    console.error('Mock token generation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate mock token',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (isStudioDevDeployment()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!mockTokenAllowed()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: 'Mock token endpoint is available',
    usage: 'POST /api/dev/mock-token with { user_id: "your_user_id" }',
    development_mode: true
  });
}
