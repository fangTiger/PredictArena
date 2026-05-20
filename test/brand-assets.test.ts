import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function fileSize(relativePath: string): Promise<number> {
  const stats = await fs.stat(path.join(root, relativePath));
  return stats.size;
}

async function fileHash(relativePath: string): Promise<string> {
  const bytes = await fs.readFile(path.join(root, relativePath));
  return createHash('sha256').update(bytes).digest('hex');
}

describe('PredictArena brand assets', () => {
  it('ships logo and favicon assets from public', async () => {
    await expect(fileSize('public/predictarena-logo.svg')).resolves.toBeGreaterThan(1_000);
    await expect(fileSize('public/predictarena-logo.png')).resolves.toBeGreaterThan(10_000);
    await expect(fileSize('public/favicon.ico')).resolves.toBeGreaterThan(1_000);
    await expect(fileSize('public/apple-touch-icon.png')).resolves.toBeGreaterThan(1_000);
    await expect(fileSize('app/favicon.ico')).resolves.toBeGreaterThan(1_000);
    await expect(fileHash('app/favicon.ico')).resolves.toBe(await fileHash('public/favicon.ico'));
  });

  it('wires favicon metadata and uses the logo mark in navigation', async () => {
    const [layout, pageShell, arenaDashboard] = await Promise.all([
      fs.readFile(path.join(root, 'app/layout.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/PageShell.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/arena-dashboard.tsx'), 'utf8')
    ]);

    expect(layout).toContain('/favicon.ico?v=predictarena-logo');
    expect(layout).toContain('/predictarena-logo.png');
    expect(layout).toContain('/apple-touch-icon.png');
    expect(pageShell).toContain('aria-hidden="true"');
    expect(arenaDashboard).toContain('aria-hidden="true"');
    expect(pageShell).not.toContain('brand-mark">PA</span>');
    expect(arenaDashboard).not.toContain('brand-mark">PA</span>');
  });
});
