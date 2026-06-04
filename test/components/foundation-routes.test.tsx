import React from 'react';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const routeState = vi.hoisted(() => ({
  pathname: '/',
  adminCookie: null as string | null,
  cookieSet: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
  stripData: {
    activeSignals: 12,
    activeSignalsDelta: 3,
    usdcBondedMicro: 24_580_000_000n,
    usdcBondedDelta24hMicro: 1_200_000_000n,
    accuracyBps: 6840,
    accuracyDeltaPp: 2.1,
    showdownsWon: 0,
    showdownsLeaderName: '—',
    blockNumber: 8_412_390
  }
}));

vi.mock('next/navigation', () => ({
  usePathname: () => routeState.pathname,
  redirect: routeState.redirect
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get(name: string) {
      if (name === 'pa_admin' && routeState.adminCookie) {
        return { value: routeState.adminCookie };
      }

      return undefined;
    },
    set(...args: unknown[]) {
      routeState.cookieSet(...args);
    }
  })
}));

vi.mock('@/components/WalletConnectButton', () => ({
  WalletConnectButton: ({ className }: { className?: string }) => (
    <button className={className} data-testid="wallet-stub">
      Connect Wallet
    </button>
  )
}));

vi.mock('@/lib/services/homeData', () => ({
  getHomeStripData: vi.fn(async () => routeState.stripData)
}));

import HomePage from '@/app/page';
import ArenaLayout from '@/app/arena/layout';
import AgentsLayout from '@/app/agents/layout';
import MyLayout from '@/app/my/layout';
import MyPage from '@/app/my/page';
import AdminLayout from '@/app/admin/layout';
import AdminLoginPage from '@/app/admin-login/page';
import { submitAdminLogin } from '@/app/admin-login/actions';

const root = process.cwd();

describe('foundation routes', () => {
  const originalAccessToken = process.env.ADMIN_ACCESS_TOKEN;

  beforeEach(() => {
    routeState.pathname = '/';
    routeState.adminCookie = null;
    routeState.cookieSet.mockReset();
    routeState.redirect.mockClear();
    process.env.ADMIN_ACCESS_TOKEN = 'showcase-token';
  });

  afterEach(() => {
    process.env.ADMIN_ACCESS_TOKEN = originalAccessToken;
  });

  it('renders the editorial home instead of redirecting to /arena', async () => {
    routeState.pathname = '/';

    render(await HomePage());

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /ai agents, betting with proof\./i
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/live on arc testnet/i)).toBeInTheDocument();
    expect(screen.getByText(/block 8,412,390/i)).toBeInTheDocument();
    expect(screen.getByText('ACTIVE SIGNALS')).toBeInTheDocument();
    expect(screen.getByText('USDC BONDED')).toBeInTheDocument();
    expect(screen.getByText('AGENT ACCURACY')).toBeInTheDocument();
    expect(screen.getByText('SHOWDOWNS WON')).toBeInTheDocument();
    expect(screen.getByText('The Premise')).toBeInTheDocument();
    expect(screen.getByText('How to Watch')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /enter arena/i })).toHaveAttribute('href', '/arena');
    expect(routeState.redirect).not.toHaveBeenCalled();
  });

  it('wraps /arena with the glass layout shell and top nav', () => {
    routeState.pathname = '/arena';

    const { container } = render(
      <ArenaLayout>
        <div>arena child</div>
      </ArenaLayout>
    );

    expect(container.firstChild).toHaveClass('glass-page');
    expect(screen.getByText('ARENA')).toBeInTheDocument();
    expect(screen.getByText('arena child')).toBeInTheDocument();
  });

  it('wraps /agents and /my routes inside the glass layout', async () => {
    routeState.pathname = '/agents';
    const { rerender, container } = render(
      <AgentsLayout>
        <div>agents child</div>
      </AgentsLayout>
    );

    expect(container.firstChild).toHaveClass('glass-page');
    expect(screen.getByText('agents child')).toBeInTheDocument();

    routeState.pathname = '/my';
    rerender(<MyLayout>{await MyPage()}</MyLayout>);

    expect(screen.getByRole('heading', { level: 1, name: /connect to enter my/i })).toBeInTheDocument();
    expect(screen.getByText(/wallet-bound record/i)).toBeInTheDocument();
  });

  it('redirects unauthenticated /admin requests to /admin/login', async () => {
    await expect(
      AdminLayout({
        children: <div>secret room</div>
      })
    ).rejects.toThrow('REDIRECT:/admin/login');

    expect(routeState.redirect).toHaveBeenCalledWith('/admin/login');
  });

  it('renders admin children when the pa_admin cookie matches the configured token', async () => {
    routeState.adminCookie = 'showcase-token';

    render(
      await AdminLayout({
        children: <div>secret room</div>
      })
    );

    expect(screen.getByText('secret room')).toBeInTheDocument();
    expect(routeState.redirect).not.toHaveBeenCalled();
  });

  it('shows an inline invalid-token error on the admin login page', async () => {
    render(
      await AdminLoginPage({
        searchParams: Promise.resolve({ error: '1' })
      })
    );

    expect(screen.getByText('Invalid token')).toBeInTheDocument();
    expect(screen.getByLabelText(/access token/i)).toBeInTheDocument();
  });

  it('sets the pa_admin cookie and redirects to /admin on successful admin login', async () => {
    const formData = new FormData();
    formData.set('token', 'showcase-token');

    await expect(submitAdminLogin(formData)).rejects.toThrow('REDIRECT:/admin');

    expect(routeState.cookieSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'pa_admin',
        value: 'showcase-token',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 43_200
      })
    );
  });

  it('redirects back to /admin/login?error=1 and does not set cookie on invalid token', async () => {
    const formData = new FormData();
    formData.set('token', 'wrong-token');

    await expect(submitAdminLogin(formData)).rejects.toThrow(
      'REDIRECT:/admin/login?error=1'
    );

    expect(routeState.cookieSet).not.toHaveBeenCalled();
  });

  it('keeps legacy public showcase routes removed while admin replacements exist', async () => {
    const shouldExist = [
      'app/admin/resolution/page.tsx',
      'app/admin/resolution/DemoResolutionConsole.tsx',
      'app/admin/proof/page.tsx',
      'app/admin/proof/ProofSmokeConsole.tsx'
    ];
    const shouldBeGone = [
      'app/demo-resolution',
      'app/proof',
      'app/intelligence',
      'app/autonomy',
      'app/leaderboard',
      'app/signals',
      'app/agents/[agentName]'
    ];

    await Promise.all(
      shouldExist.map(async (entry) => {
        await expect(access(path.join(root, entry))).resolves.toBeUndefined();
      })
    );

    await Promise.all(
      shouldBeGone.map(async (entry) => {
        await expect(access(path.join(root, entry))).rejects.toThrow();
      })
    );
  });
});
