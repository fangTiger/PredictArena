import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../public/predictarena-war-room.png');

const svg = String.raw`
<svg width="1600" height="900" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="800" y1="0" x2="800" y2="900" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0F172A"/>
      <stop offset="0.55" stop-color="#080A0F"/>
      <stop offset="1" stop-color="#05070B"/>
    </linearGradient>
    <radialGradient id="glowGreen" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(360 120) rotate(30) scale(600 320)">
      <stop stop-color="#5BFFB0" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#5BFFB0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBlue" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1250 180) rotate(140) scale(480 300)">
      <stop stop-color="#2F80FF" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#2F80FF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="column" x1="1172" y1="190" x2="1172" y2="720" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFD166"/>
      <stop offset="0.45" stop-color="#5BFFB0"/>
      <stop offset="1" stop-color="#2F80FF"/>
    </linearGradient>
  </defs>

  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect width="1600" height="900" fill="url(#glowGreen)"/>
  <rect width="1600" height="900" fill="url(#glowBlue)"/>

  <g opacity="0.18">
    <path d="M96 126H1504" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M96 246H1504" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M96 366H1504" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M96 486H1504" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M96 606H1504" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M96 726H1504" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M196 86V804" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M436 86V804" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M676 86V804" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M916 86V804" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M1156 86V804" stroke="#D9E2F5" stroke-width="1"/>
    <path d="M1396 86V804" stroke="#D9E2F5" stroke-width="1"/>
  </g>

  <rect x="100" y="88" width="700" height="260" rx="18" fill="#0F172A" fill-opacity="0.72" stroke="#5BFFB0" stroke-opacity="0.18"/>
  <text x="148" y="160" fill="#FFD166" font-size="24" font-family="Arial, sans-serif" letter-spacing="5">ARC TRADING WAR ROOM</text>
  <text x="148" y="232" fill="#EEF4FF" font-size="78" font-family="Arial, sans-serif" font-weight="700">PredictArena</text>
  <text x="148" y="286" fill="#C7D2EA" font-size="26" font-family="Arial, sans-serif">
    Autonomous scan, signal synthesis, and Arc settlement telemetry.
  </text>

  <g>
    <rect x="104" y="404" width="304" height="156" rx="16" fill="#101927" stroke="#2F80FF" stroke-opacity="0.18"/>
    <text x="136" y="454" fill="#5BFFB0" font-size="20" font-family="Arial, sans-serif" letter-spacing="4">BTC ARENA</text>
    <text x="136" y="506" fill="#EEF4FF" font-size="34" font-family="Arial, sans-serif" font-weight="700">BUY_YES 64.20%</text>
    <path d="M134 532C188 516 222 482 274 474C328 468 350 492 378 448" stroke="#5BFFB0" stroke-width="6" stroke-linecap="round"/>
    <text x="136" y="548" fill="#C7D2EA" font-size="18" font-family="Arial, sans-serif">Liquidity stable | Arc ready</text>
  </g>

  <g>
    <rect x="432" y="404" width="304" height="156" rx="16" fill="#101927" stroke="#FFD166" stroke-opacity="0.18"/>
    <text x="464" y="454" fill="#FFD166" font-size="20" font-family="Arial, sans-serif" letter-spacing="4">ETH ARENA</text>
    <text x="464" y="506" fill="#EEF4FF" font-size="34" font-family="Arial, sans-serif" font-weight="700">BUY_NO 57.80%</text>
    <path d="M462 534C508 526 556 558 602 536C648 514 664 462 706 446" stroke="#FFD166" stroke-width="6" stroke-linecap="round"/>
    <text x="464" y="548" fill="#C7D2EA" font-size="18" font-family="Arial, sans-serif">Momentum inversion detected</text>
  </g>

  <g>
    <rect x="760" y="404" width="304" height="156" rx="16" fill="#101927" stroke="#FF5F6D" stroke-opacity="0.18"/>
    <text x="792" y="454" fill="#2F80FF" font-size="20" font-family="Arial, sans-serif" letter-spacing="4">SOL ARENA</text>
    <text x="792" y="506" fill="#EEF4FF" font-size="34" font-family="Arial, sans-serif" font-weight="700">AVOID 49.90%</text>
    <path d="M790 534C824 520 860 500 906 504C952 508 992 542 1028 520" stroke="#FF5F6D" stroke-width="6" stroke-linecap="round"/>
    <text x="792" y="548" fill="#C7D2EA" font-size="18" font-family="Arial, sans-serif">Risk filters holding position</text>
  </g>

  <g>
    <rect x="1100" y="162" width="144" height="572" rx="24" fill="#0B111B" stroke="#FFD166" stroke-opacity="0.22"/>
    <rect x="1144" y="236" width="56" height="432" rx="28" fill="url(#column)"/>
    <circle cx="1172" cy="242" r="58" fill="#FFD166" fill-opacity="0.18"/>
    <circle cx="1172" cy="452" r="88" fill="#5BFFB0" fill-opacity="0.12"/>
    <circle cx="1172" cy="664" r="74" fill="#2F80FF" fill-opacity="0.14"/>
    <text x="1092" y="118" fill="#EEF4FF" font-size="24" font-family="Arial, sans-serif" letter-spacing="6">ARC / USDC</text>
    <text x="1278" y="316" fill="#5BFFB0" font-size="22" font-family="Arial, sans-serif" letter-spacing="4">COMMIT</text>
    <text x="1278" y="384" fill="#EEF4FF" font-size="52" font-family="Arial, sans-serif" font-weight="700">$12.50</text>
    <text x="1278" y="432" fill="#C7D2EA" font-size="20" font-family="Arial, sans-serif">Signal bonds armed</text>
    <text x="1278" y="560" fill="#2F80FF" font-size="22" font-family="Arial, sans-serif" letter-spacing="4">LEADERBOARD</text>
    <text x="1278" y="612" fill="#EEF4FF" font-size="28" font-family="Arial, sans-serif">BTC 78.40%</text>
    <text x="1278" y="652" fill="#EEF4FF" font-size="28" font-family="Arial, sans-serif">ETH 71.25%</text>
    <text x="1278" y="692" fill="#EEF4FF" font-size="28" font-family="Arial, sans-serif">SOL 58.10%</text>
  </g>

  <g opacity="0.75">
    <path d="M170 726C298 694 366 672 496 688C620 702 686 742 820 736C970 730 1104 646 1244 654C1326 660 1372 700 1440 696" stroke="#2F80FF" stroke-width="8" stroke-linecap="round"/>
    <path d="M160 758C298 788 382 776 518 748C632 724 724 686 842 692C980 700 1108 770 1244 760C1320 754 1384 724 1450 728" stroke="#5BFFB0" stroke-width="8" stroke-linecap="round"/>
  </g>
</svg>
`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(outputPath);

console.log(`Generated ${outputPath}`);
