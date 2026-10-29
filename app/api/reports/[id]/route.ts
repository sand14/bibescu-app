import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  interface ReportRow {
    id: string;
    user_id: string;
    filename: string;
    file_path: string;
  }

  const report = db
    .prepare('SELECT id, user_id, filename, file_path FROM reports WHERE id = ? AND user_id = ?')
    .get(id, user.id) as unknown as ReportRow | undefined;

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  if (!existsSync(report.file_path)) {
    return NextResponse.json({ error: 'Report file missing on disk' }, { status: 404 });
  }

  const fileBuffer = await fs.readFile(report.file_path);

  const url = new URL(request.url);
  const download = url.searchParams.get('download') === 'true';

  const disposition = download ? `attachment; filename="${report.filename}"` : `inline; filename="${report.filename}"`;

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  interface ReportRow {
    id: string;
    user_id: string;
    file_path: string;
  }

  const report = db
    .prepare('SELECT id, user_id, file_path FROM reports WHERE id = ? AND user_id = ?')
    .get(id, user.id) as unknown as ReportRow | undefined;

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Delete file from disk if it exists
  try {
    if (existsSync(report.file_path)) {
      await fs.unlink(report.file_path);
    }
  } catch (err) {
    console.error('Failed to remove file from disk:', err);
  }

  // Delete from database
  db.prepare('DELETE FROM reports WHERE id = ? AND user_id = ?').run(id, user.id);

  return NextResponse.json({ ok: true });
}
