import Link from 'next/link';
import type { ReactNode } from 'react';

type HeroSize = 'standard' | 'compact';
type PillTone = 'neutral' | 'mint' | 'sky';

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="arena-shell page-shell">
      <nav className="arena-topbar" aria-label="PredictArena navigation">
        <Link href="/arena" className="brand-lockup" aria-label="PredictArena arena">
          <span className="brand-mark">PA</span>
          <span>PredictArena</span>
        </Link>
        <div className="topbar-actions">
          <Link href="/arena" className="icon-link">
            Arena
          </Link>
          <Link href="/leaderboard" className="icon-link">
            Leaderboard
          </Link>
        </div>
      </nav>
      {children}
    </main>
  );
}

export function HeroPill({
  children,
  tone = 'neutral'
}: {
  children: ReactNode;
  tone?: PillTone;
}) {
  const toneClass = {
    neutral: 'status-chip',
    mint: 'status-chip status-ready',
    sky: 'status-chip status-live'
  }[tone];

  return <span className={toneClass}>{children}</span>;
}

export function NavPill({
  children,
  href,
  tone = 'neutral'
}: {
  children: ReactNode;
  href: string;
  tone?: PillTone;
}) {
  const toneClass = {
    neutral: 'icon-link',
    mint: 'icon-link status-ready',
    sky: 'icon-link status-live'
  }[tone];

  return (
    <Link href={href} className={toneClass}>
      {children}
    </Link>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  side,
  size = 'standard'
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  side?: ReactNode;
  size?: HeroSize;
}) {
  return (
    <header className="command-deck page-hero">
      <div
        className={cx(
          'page-hero-grid',
          side ? 'lg:grid-cols-[1.3fr,0.9fr]' : 'lg:grid-cols-[1fr]'
        )}
      >
        <div className="page-hero-copy">
          <div className="deck-status-row">{eyebrow}</div>
          <div>
            <h1
              className={cx(
                'page-hero-title',
                size === 'compact' ? 'page-hero-title-compact' : undefined
              )}
            >
              {title}
            </h1>
            {description ? <p className="deck-summary">{description}</p> : null}
          </div>
          {actions ? <div className="deck-status-row">{actions}</div> : null}
        </div>
        {side ? <div className="page-hero-side">{side}</div> : null}
      </div>
    </header>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="panel-kicker">{children}</p>;
}
