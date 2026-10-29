import path from 'node:path';
import fs from 'node:fs';
import { dataDir } from '@/lib/db';

export function getUserReportsDir(userId: string): string {
  const dir = path.join(dataDir, 'reports', userId);
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  }
  return dir;
}

export interface ReportItem {
  id: string;
  user_id: string;
  title: string;
  report_type: 'standard' | 'a3';
  filename: string;
  file_path: string;
  file_size: number;
  metadata: any;
  created_at: number;
}
