import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();

    interface UserRow {
      id: string;
      username: string;
      password_hash: string;
      salt: string;
    }

    const user = db
      .prepare('SELECT id, username, password_hash, salt FROM users WHERE username = ?')
      .get(trimmedUsername) as unknown as UserRow | undefined;

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const { token, expiresAt } = createSession(user.id);
    await setSessionCookie(token, expiresAt);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}
