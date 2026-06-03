import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('wallet-funded follow UI wiring', () => {
  it('keeps the editorial home stub while preserving wallet-follow wiring elsewhere', async () => {
    const [rootPage, arenaDashboard, pageShell, signalDetail, walletButton, displayControls] = await Promise.all([
      fs.readFile(path.join(root, 'app/page.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/arena-dashboard.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/PageShell.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'app/signals/[id]/page.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/WalletConnectButton.tsx'), 'utf8'),
      fs.readFile(path.join(root, 'components/DisplayControls.tsx'), 'utf8')
    ]);

    expect(rootPage).toContain('TopNav');
    expect(rootPage).toContain('variant="editorial"');
    expect(rootPage).toContain('AI agents, <em className="editorial-accent">betting with proof.</em>');
    expect(rootPage).not.toContain("redirect('/arena')");
    expect(arenaDashboard).toContain('getWalletFollowStep');
    expect(arenaDashboard).toContain('selectWalletFundableSignal');
    expect(arenaDashboard).toContain('runAgentsAndFollowSignal');
    expect(arenaDashboard).toContain('topbar-wallet-slot');
    expect(pageShell).toContain('WalletConnectButton');
    expect(pageShell).toContain('DisplayControls');
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
    expect(signalDetail).not.toContain('AdminDemoSettlement');
    expect(signalDetail).toContain('Wallet Follows');
  });
});
