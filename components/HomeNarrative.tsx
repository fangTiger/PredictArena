import React from 'react';
import { HOME_COPY } from '@/lib/config/homeCopy';

// Copy comes from lib/config/homeCopy.ts (compile-time controlled, never user input).
// dangerouslySetInnerHTML is only used to render the locked <em> tags in the editorial copy.
export function HomeNarrative() {
  return (
    <section className="home-narrative" data-component="home-narrative">
      <div className="home-narrative-column glass-card">
        <h2 className="home-narrative-heading">{HOME_COPY.premise.title}</h2>
        {HOME_COPY.premise.paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="home-narrative-copy"
            dangerouslySetInnerHTML={{ __html: paragraph }}
          />
        ))}
      </div>
      <div className="home-narrative-column glass-card">
        <h2 className="home-narrative-heading">{HOME_COPY.howToWatch.title}</h2>
        {HOME_COPY.howToWatch.items.map((item) => (
          <p
            key={item}
            className="home-narrative-copy home-watch-item"
            data-watch-item
            dangerouslySetInnerHTML={{ __html: `→ ${item}` }}
          />
        ))}
        <p className="home-narrative-copy">{HOME_COPY.howToWatch.closing}</p>
      </div>
    </section>
  );
}
