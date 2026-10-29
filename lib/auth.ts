import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import db, { checkpointDb } from '@/lib/db';

const SESSION_COOKIE_NAME = 'bibescu_auth_token';
const SESSION_MAX_AGE_DAYS = 30;

export interface SafeUser {
  id: string;
  username: string;
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const computedHash = crypto.scryptSync(password, salt, 64);
    const targetHash = Buffer.from(storedHash, 'hex');
    if (computedHash.length !== targetHash.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedHash, targetHash);
  } catch {
    return false;
  }
}

export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAt);
  checkpointDb();

  return { token, expiresAt };
}

export function getSessionUser(token: string): SafeUser | null {
  if (!token) return null;

  interface SessionRow {
    token: string;
    user_id: string;
    expires_at: number;
    username: string;
  }

  const row = db.prepare(`
    SELECT s.token, s.user_id, s.expires_at, u.username
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token) as unknown as SessionRow | undefined;

  if (!row) return null;

  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return { id: row.user_id, username: row.username };
}

export function deleteSession(token: string): void {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  checkpointDb();
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionUser(token);
}

export async function setSessionCookie(token: string, expiresAt: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    deleteSession(token);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
