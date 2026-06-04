import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function fileSize(relativePath: string): Promise<number> {
  const stats = await fs.stat(path.join(root, relativePath));
  return stats.size;
}

async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

describe('PredictArena brand assets', () => {
  it('ships logo assets from public and a single app-router favicon source', async () => {
    await expect(fileSize('public/predictarena-logo.svg')).resolves.toBeGreaterThan(1_000);
    await expect(fileSize('public/predictarena-logo.png')).resolves.toBeGreaterThan(10_000);
    await expect(fileSize('public/apple-touch-icon.png')).resolves.toBeGreaterThan(1_000);
    await expect(fileSize('app/favicon.ico')).resolves.toBeGreaterThan(1_000);
    await expect(fileExists('public/favicon.ico')).resolves.toBe(false);
  });

  it('wires favicon metadata and keeps brand marks in navigation shells', async () => {
    const [layout, arenaLayout, pageShell, arenaDashboard] = await Promise.all([
      fs.readFile(path.join(root, 'app/layout.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'app/arena/layout.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/PageShell.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/arena-dashboard.tsx'), 'utf8')
    ]);

    expect(layout).toContain('/favicon.ico?v=predictarena-logo');
    expect(layout).toContain('/predictarena-logo.png');
    expect(layout).toContain('/apple-touch-icon.png');
    expect(arenaLayout).toContain('TopNav');
    expect(arenaLayout).toContain('variant="glass"');
    expect(pageShell).toContain('aria-hidden="true"');
    expect(pageShell).not.toContain('brand-mark">PA</span>');
    expect(arenaDashboard).not.toContain('brand-mark">PA</span>');
  });
});
