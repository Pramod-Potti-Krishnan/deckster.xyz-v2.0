import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

// Local development only. The gate is the server-side NODE_ENV and nothing else:
// a NEXT_PUBLIC_* variable is exposed to the browser bundle and must never be
// able to switch on a credential mint.
const isDevelopment = process.env.NODE_ENV === 'development';

// No fallback signing key: without JWT_SECRET the route refuses instead of minting.
const missingSecretResponse = () => NextResponse.json(
  { error: 'Mock tokens are unavailable: JWT_SECRET is not set' },
  { status: 500 }
);

export async function POST(request: NextRequest) {
  if (!isDevelopment) {
    return NextResponse.json(
      { error: 'Mock tokens are only available in development mode' },
      { status: 403 }
    );
  }

  if (!process.env.JWT_SECRET) {
    return missingSecretResponse();
  }

  try {
    const body = await request.json();
    const userId = body.user_id || 'test_user';
    
    // Create a mock JWT token for development
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    
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
  if (!isDevelopment) {
    return NextResponse.json(
      { error: 'Mock tokens are only available in development mode' },
      { status: 403 }
    );
  }

  if (!process.env.JWT_SECRET) {
    return missingSecretResponse();
  }

  return NextResponse.json({
    status: 'Mock token endpoint is available',
    usage: 'POST /api/dev/mock-token with { user_id: "your_user_id" }',
    development_mode: true
  });
}