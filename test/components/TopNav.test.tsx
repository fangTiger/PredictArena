import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Use vi.hoisted to safely share mutable state with the hoisted vi.mock factory
const pathState = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathState.current
}));

// Mock WalletConnectButton to keep TopNav test isolated from window.ethereum / JSDOM quirks
vi.mock('@/components/WalletConnectButton', () => ({
  WalletConnectButton: ({ className }: { className?: string }) => (
    <button className={className} data-testid="wallet-stub">Connect Wallet</button>
  )
}));

import { TopNav } from '@/components/TopNav';

describe('TopNav', () => {
  it('renders the 4 public segments + Connect Wallet stub', () => {
    pathState.current = '/';
    render(<TopNav variant="editorial" />);
    expect(screen.getByText('HOME')).toBeInTheDocument();
    expect(screen.getByText('ARENA')).toBeInTheDocument();
    expect(screen.getByText('AGENTS')).toBeInTheDocument();
    expect(screen.getByText('MY')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-stub')).toBeInTheDocument();
  });

  it('marks the current path link as active', () => {
    pathState.current = '/arena';
    render(<TopNav variant="glass" />);
    const arena = screen.getByText('ARENA').closest('a');
    expect(arena).toHaveAttribute('data-active', 'true');
  });

  it('uses the right CSS class per variant', () => {
    pathState.current = '/';
    const { container, rerender } = render(<TopNav variant="editorial" />);
    expect((container.firstChild as HTMLElement).className).toContain('topnav-editorial');
    rerender(<TopNav variant="glass" />);
    expect((container.firstChild as HTMLElement).className).toContain('topnav-glass');
  });
});
