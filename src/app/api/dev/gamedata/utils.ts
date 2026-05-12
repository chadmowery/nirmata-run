import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export function sanitizeName(name: string): string | null {
  if (!name || name.length < 2 || name.length > 64) return null;
  if (!NAME_PATTERN.test(name)) return null;
  return name;
}

export async function atomicWrite(filePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + '\n';
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
}

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function resolveFilePath(dir: string, name: string): string | null {
  const safe = sanitizeName(name);
  if (!safe) return null;
  const filePath = path.join(dir, `${safe}.json`);
  // Double-check resolved path is within the expected directory
  if (!filePath.startsWith(path.resolve(dir))) return null;
  return filePath;
}
