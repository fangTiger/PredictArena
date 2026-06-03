import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('arena route cleanup', () => {
  it('does not keep public links to removed showcase routes in the arena dashboard', async () => {
    const arenaDashboard = await fs.readFile(
      path.join(root, 'components/arena-dashboard.tsx'),
      'utf8'
    );

    expect(arenaDashboard).not.toContain('/intelligence');
    expect(arenaDashboard).not.toContain('/autonomy/runs/');
    expect(arenaDashboard).not.toContain('/signals/');
    expect(arenaDashboard).not.toContain('/admin/');
  });
});
