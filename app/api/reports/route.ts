import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getUserReportsDir } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  interface ReportRow {
    id: string;
    user_id: string;
    title: string;
    report_type: 'standard' | 'a3' | 'crs';
    filename: string;
    file_path: string;
    file_size: number;
    metadata: string | null;
    created_at: number;
  }

  const rows = db.prepare(`
    SELECT id, user_id, title, report_type, filename, file_size, metadata, created_at
    FROM reports
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(user.id) as unknown as ReportRow[];

  const reports = rows.map((r) => {
    let parsedMeta = null;
    if (r.metadata) {
      try {
        parsedMeta = JSON.parse(r.metadata);
      } catch {
        parsedMeta = null;
      }
    }
    return {
      id: r.id,
      title: r.title,
      reportType: r.report_type,
      filename: r.filename,
      fileSize: r.file_size,
      metadata: parsedMeta,
      createdAt: r.created_at,
    };
  });

  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || 'Flight File';
    const reportType = ((formData.get('reportType') as string) || 'standard') as 'standard' | 'a3' | 'crs';
    const metadataStr = (formData.get('metadata') as string) || '{}';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const reportId = crypto.randomUUID();
    const timestamp = Date.now();
    const defaultExt = reportType === 'crs' ? 'crs' : 'pdf';
    const safeBaseName = file.name ? path.basename(file.name).replace(/[^a-zA-Z0-9_.-]/g, '_') : `file_${timestamp}.${defaultExt}`;
    const storedFilename = `${timestamp}_${safeBaseName}`;

    const userDir = getUserReportsDir(user.id);
    const targetFilePath = path.join(userDir, storedFilename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetFilePath, buffer);

    db.prepare(`
      INSERT INTO reports (id, user_id, title, report_type, filename, file_path, file_size, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      user.id,
      title,
      reportType,
      safeBaseName,
      targetFilePath,
      buffer.length,
      metadataStr,
      timestamp
    );

    let parsedMeta = null;
    try {
      parsedMeta = JSON.parse(metadataStr);
    } catch {
      parsedMeta = null;
    }

    return NextResponse.json({
      report: {
        id: reportId,
        title,
        reportType,
        filename: safeBaseName,
        fileSize: buffer.length,
        metadata: parsedMeta,
        createdAt: timestamp,
      },
    });
  } catch (err: any) {
    console.error('Error uploading report:', err);
    return NextResponse.json(
      { error: 'Failed to save report' },
      { status: 500 }
    );
  }
}
