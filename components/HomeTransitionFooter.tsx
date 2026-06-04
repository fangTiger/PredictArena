import React from 'react';
import Link from 'next/link';

export function HomeTransitionFooter() {
  return (
    <section className="home-transition-footer" data-component="home-transition-footer">
      <div className="home-transition-rail" aria-hidden="true" />
      <p className="home-transition-note">
        Editorial proof gives way to the live arena. The same signals, bonds, and receipts continue
        under the glass.
      </p>
      <Link className="home-transition-cta" href="/arena">
        <span>Enter Arena</span>
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
