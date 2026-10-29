import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import db, { checkpointDb } from '@/lib/db';
import { hashPassword, createSession, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 30 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, underscores, and hyphens' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(trimmedUsername);

    if (existing) {
      return NextResponse.json(
        { error: 'A user with this username already exists' },
        { status: 409 }
      );
    }

    const userId = crypto.randomUUID();
    const { hash, salt } = hashPassword(password);
    const now = Date.now();

    db.prepare(`
      INSERT INTO users (id, username, password_hash, salt, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, trimmedUsername, hash, salt, now);

    const { token, expiresAt } = createSession(userId);
    await setSessionCookie(token, expiresAt);
    checkpointDb();

    return NextResponse.json({
      user: {
        id: userId,
        username: trimmedUsername,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
