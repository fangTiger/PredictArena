import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('wallet-funded follow UI wiring', () => {
  it('assembles the arena signal glass home via dedicated components while rewiring arena around showdowns', async () => {
    const [rootPage, arenaPage, arenaDashboard, pageShell, adminShell, walletButton, displayControls, globalsCss] = await Promise.all([
      fs.readFile(path.join(root, 'app/page.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'app/arena/page.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/arena-dashboard.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/PageShell.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/AdminShell.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/WalletConnectButton.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/DisplayControls.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'app/globals.css'), 'utf8')
    ]);

    expect(rootPage).toContain('TopNav');
    expect(rootPage).toContain('variant="glass"');
    expect(rootPage).toContain('data-page-surface="arena-signal-glass"');
    expect(rootPage).toContain('HomeHero');
    expect(rootPage).toContain('HomeDataStrip');
    expect(rootPage).toContain('HomeNarrative');
    expect(rootPage).toContain('HomeTransitionFooter');
    expect(rootPage).toContain('getHomeStripData');
    expect(rootPage).not.toContain("redirect('/arena')");
    expect(rootPage).not.toContain('Showcase landing placeholder');
    expect(globalsCss).toContain('.home-protocol-main');
    expect(globalsCss).toContain('.home-protocol-shell .topnav');
    expect(globalsCss).toContain('@keyframes homeSignalSweep');
    expect(globalsCss).toContain('@keyframes homeSignalPulse');
    expect(globalsCss).not.toContain('rgba(245, 255, 251, 0.88)');
    expect(globalsCss).not.toContain('linear-gradient(145deg, #01130f 0%, #061c21 42%, #080712 100%)');
    expect(arenaPage).toContain('return <ArenaDashboard />');
    expect(arenaPage).not.toContain('getRuntimeStore');
    expect(arenaPage).not.toContain('fetchCandidateMarkets');
    expect(arenaDashboard).toContain('ShowdownGrid');
    expect(arenaDashboard).toContain('PendingFollowsRow');
    expect(arenaDashboard).toContain('useSWR');
    expect(arenaDashboard).toContain('/api/showdowns?status=all&limit=50');
    expect(arenaDashboard).toContain('refreshInterval: 30000');
    expect(arenaDashboard).toContain('getWalletFollowStep');
    expect(arenaDashboard).toContain('selectWalletFundableSignal');
    expect(arenaDashboard).toContain('runAgentsAndFollowSignal');
    expect(pageShell).toContain('WalletConnectButton');
    expect(pageShell).toContain('DisplayControls');
    expect(pageShell).toContain('href="/agents"');
    expect(pageShell).not.toContain('href="/intelligence"');
    expect(adminShell).toContain('/admin/resolution');
    expect(adminShell).toContain('/admin/proof');
    expect(walletButton).toContain('Disconnect');
    expect(walletButton).toContain('/api/autonomy');
    expect(walletButton).toContain('Wallet readiness');
    expect(walletButton).toContain('Arc chain');
    expect(displayControls).toContain('Toggle theme');
    expect(displayControls).toContain('中文');
    expect(arenaDashboard).toContain('/api/wallet/follows');
    expect(arenaDashboard).not.toContain('Wallet readiness');
    expect(arenaDashboard).not.toContain('Arc status');
    expect(arenaDashboard).not.toContain('WalletConnectButton');
    expect(arenaDashboard).not.toContain('topbar-wallet-slot');
    expect(arenaDashboard).not.toContain('Market Radar');
    expect(arenaDashboard).not.toContain('Signal Board');
    expect(arenaDashboard).not.toContain('Watchlist');
    expect(arenaDashboard).not.toContain('Saved Filter');
    expect(arenaDashboard).not.toContain('Alert');
    expect(arenaDashboard).not.toContain('Daily Queue');
    expect(arenaDashboard).not.toContain('/intelligence');
    expect(arenaDashboard).not.toContain('/autonomy/runs/');
    expect(arenaDashboard).not.toContain('/signals/');
    expect(arenaDashboard).not.toContain('/admin/');
  });

  it('hydrates wallet follow summaries before filtering or submitting another wallet follow', async () => {
    const arenaDashboard = await fs.readFile(path.join(root, 'components/arena-dashboard.tsx'), 'utf8');

    expect(arenaDashboard).toContain('/api/wallet/${address}/summary');
    expect(arenaDashboard).toContain('refreshWalletFollowSummary');
    expect(arenaDashboard).toContain('wallet_follow_duplicate');

    const duplicateGuardIndex = arenaDashboard.indexOf('wallet_follow_duplicate');
    const commitIndex = arenaDashboard.indexOf('await commitArenaSignal({');
    expect(duplicateGuardIndex).toBeGreaterThanOrEqual(0);
    expect(commitIndex).toBeGreaterThan(duplicateGuardIndex);

    const summaryRefreshIndex = arenaDashboard.indexOf('await refreshWalletFollowSummary(address');
    expect(summaryRefreshIndex).toBeGreaterThanOrEqual(0);
    expect(commitIndex).toBeGreaterThan(summaryRefreshIndex);
  });
});
