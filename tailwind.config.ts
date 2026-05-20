import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#081120',
        panel: '#0f1b31',
        line: 'rgba(160, 179, 210, 0.18)',
        mint: '#8ef6c1',
        coral: '#ff8d73',
        sand: '#ffd39a',
        sky: '#6bc6ff'
      },
      boxShadow: {
        panel: '0 24px 70px rgba(0, 0, 0, 0.28)'
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Avenir Next"', 'sans-serif'],
        body: ['"IBM Plex Sans"', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"SFMono-Regular"', 'monospace']
      }
    }
  },
  plugins: []
};

export default config;
