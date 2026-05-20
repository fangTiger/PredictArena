import Link from 'next/link';
import type { ReactNode } from 'react';

type HeroSize = 'standard' | 'compact';
type PillTone = 'neutral' | 'mint' | 'sky';

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-8 text-slate-100 sm:px-8 lg:px-10">
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
    neutral: 'border-white/10 bg-white/5 text-slate-300',
    mint: 'border-mint/30 bg-mint/10 text-mint',
    sky: 'border-sky/30 bg-sky/10 text-sky'
  }[tone];

  return (
    <span
      className={cx(
        'inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.28em]',
        toneClass
      )}
    >
      {children}
    </span>
  );
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
    neutral: 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:text-white',
    mint: 'border-mint/40 bg-mint/15 text-mint hover:bg-mint/20',
    sky: 'border-sky/40 bg-sky/15 text-sky hover:bg-sky/20'
  }[tone];

  return (
    <Link
      href={href}
      className={cx(
        'inline-flex rounded-full border px-5 py-3 text-sm font-medium transition',
        toneClass
      )}
    >
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
    <header className="overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/70 shadow-panel backdrop-blur">
      <div
        className={cx(
          'grid gap-8 p-6 lg:p-8',
          side ? 'lg:grid-cols-[1.3fr,0.9fr]' : 'lg:grid-cols-[1fr]'
        )}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">{eyebrow}</div>
          <div className="space-y-4">
            <h1
              className={cx(
                'font-display leading-none text-white',
                size === 'compact' ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-6xl'
              )}
            >
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {side ? (
          <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(107,198,255,0.32),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(142,246,193,0.18),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.95),_rgba(2,6,23,0.95))] p-6">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.04),transparent)]" />
            <div className="relative">{side}</div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{children}</p>;
}
