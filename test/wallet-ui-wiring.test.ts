import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('wallet-funded follow UI wiring', () => {
  it('assembles the editorial home via dedicated components while preserving wallet-follow wiring elsewhere', async () => {
    const [rootPage, arenaDashboard, pageShell, adminShell, walletButton, displayControls, globalsCss] = await Promise.all([
      fs.readFile(path.join(root, 'app/page.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/arena-dashboard.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/PageShell.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/AdminShell.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/WalletConnectButton.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/DisplayControls.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'app/globals.css'), 'utf8')
    ]);

    expect(rootPage).toContain('TopNav');
    expect(rootPage).toContain('variant="editorial"');
    expect(rootPage).toContain('HomeHero');
    expect(rootPage).toContain('HomeDataStrip');
    expect(rootPage).toContain('HomeNarrative');
    expect(rootPage).toContain('HomeTransitionFooter');
    expect(rootPage).toContain('getHomeStripData');
    expect(rootPage).not.toContain("redirect('/arena')");
    expect(rootPage).not.toContain('Showcase landing placeholder');
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*?\.home-hero-subtitle\s*\{[\s\S]*?text-wrap:\s*balance;/m
    );
    expect(arenaDashboard).toContain('getWalletFollowStep');
    expect(arenaDashboard).toContain('selectWalletFundableSignal');
    expect(arenaDashboard).toContain('runAgentsAndFollowSignal');
    expect(arenaDashboard).toContain('topbar-wallet-slot');
    expect(pageShell).toContain('WalletConnectButton');
    expect(pageShell).toContain('DisplayControls');
    expect(pageShell).toContain('href="/agents"');
    expect(pageShell).not.toContain('href="/intelligence"');
    expect(adminShell).toContain('/admin/resolution');
    expect(adminShell).toContain('/admin/proof');
    expect(walletButton).toContain('Disconnect');
    expect(displayControls).toContain('Toggle theme');
    expect(displayControls).toContain('中文');
    expect(arenaDashboard).toContain('/api/wallet/follows');
    expect(arenaDashboard).toContain('Follow with Wallet');
    expect(arenaDashboard).toContain('Wallet Funding');
    expect(arenaDashboard).toContain('Current Wallet');
    expect(arenaDashboard).toContain('walletFollows');
    expect(arenaDashboard).not.toContain('Agent Control Room');
    expect(arenaDashboard).not.toContain('Agent custody');
    expect(arenaDashboard).not.toContain('Wallet Readiness');
    expect(arenaDashboard).not.toContain('Batch Commit');
    expect(arenaDashboard).not.toContain('Commit Eligible Signals');
  });
});
