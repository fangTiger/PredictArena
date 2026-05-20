import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_DATABASE_PATH = path.join(process.cwd(), 'data', 'runtime', 'predictarena.db');

export function resolvePredictArenaDatabaseUrl(
  databaseUrl: string | undefined = process.env.DATABASE_URL
): string {
  const trimmed = databaseUrl?.trim();
  if (trimmed) {
    return trimmed;
  }

  return `file:${DEFAULT_DATABASE_PATH}`;
}

export function resolveSqliteDatabasePath(databaseUrl: string): string | undefined {
  if (!databaseUrl.startsWith('file:')) {
    return undefined;
  }

  const rawPath = databaseUrl.slice('file:'.length).split('?')[0];
  if (!rawPath) {
    return undefined;
  }

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

export async function ensurePredictArenaDatabaseFile(
  databaseUrl: string | undefined = process.env.DATABASE_URL
): Promise<string> {
  const resolvedUrl = resolvePredictArenaDatabaseUrl(databaseUrl);
  const filePath = resolveSqliteDatabasePath(resolvedUrl);

  if (filePath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  process.env.DATABASE_URL = resolvedUrl;
  return resolvedUrl;
}
