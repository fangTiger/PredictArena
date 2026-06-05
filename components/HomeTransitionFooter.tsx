import React from 'react';
import Link from 'next/link';

export function HomeTransitionFooter() {
  return (
    <section
      className="home-transition-footer glass-card"
      data-component="home-transition-footer"
    >
      <div className="home-transition-rail" aria-hidden="true" />
      <p className="home-transition-note">
        Live proof continues into the arena. The same signals, bonds, and receipts stay visible
        under glass.
      </p>
      <Link className="home-transition-cta" href="/arena">
        <span>Enter Arena</span>
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
