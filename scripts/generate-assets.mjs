/**
 * Generates website assets from a single source: logo-mark.svg
 *   - og-image.png (1200x630)
 *
 * Favicon = logo-mark.svg directly (referenced in Layout.astro).
 * Uses sharp (already an Astro dependency).
 *
 * Usage: node scripts/generate-assets.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// ─── Brand Constants ───
const BRAND_GOLD = '#E8A838';
const BG_DARK = '#111216';
const TEXT_PRIMARY = '#F0EDE8';
const TEXT_SECONDARY = '#B8B0A8';
const ACCENT_TEAL = '#5AB3A0';

// ─── Single Source: logo-mark.svg ───
const logoSvgPath = join(publicDir, 'logo-mark.svg');
const logoSvgRaw = readFileSync(logoSvgPath, 'utf-8');

/**
 * Extract the inner content of the logo SVG (everything between <svg> tags)
 * and prefix gradient IDs to avoid conflicts with the outer SVG.
 */
function getLogoContent(prefix = 'og') {
  return logoSvgRaw
    .replace(/<\?xml[^?]*\?>/, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '')
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/<desc>[^<]*<\/desc>/, '')
    .replace(/id="brewmind-/g, `id="${prefix}-brewmind-`)
    .replace(/url\(#brewmind-/g, `url(#${prefix}-brewmind-`);
}

// ─── OG Image (1200×630) ───
async function generateOgImage() {
  const width = 1200;
  const height = 630;
  const markSize = 200;
  const markX = (width / 2) - (markSize / 2);
  const markY = 60;

  const logoContent = getLogoContent('og');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${BG_DARK}"/>

  <!-- Subtle radial glow behind mark -->
  <defs>
    <radialGradient id="glow" cx="50%" cy="35%" r="30%">
      <stop offset="0%" stop-color="${BRAND_GOLD}" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="${BRAND_GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>

  <!-- BrewMind Logo (viewBox 0 0 100 100, scaled to ${markSize}px) -->
  <g transform="translate(${markX}, ${markY}) scale(${markSize / 100})">
    ${logoContent}
  </g>

  <!-- App Name -->
  <text x="${width / 2}" y="${markY + markSize + 55}"
        font-family="Inter, system-ui, -apple-system, sans-serif"
        font-size="64" font-weight="700" fill="${TEXT_PRIMARY}"
        text-anchor="middle">BrewMind</text>

  <!-- Tagline -->
  <text x="${width / 2}" y="${markY + markSize + 105}"
        font-family="Inter, system-ui, -apple-system, sans-serif"
        font-size="26" font-weight="400" fill="${TEXT_SECONDARY}"
        text-anchor="middle">Jede Tasse. Perfekt begleitet.</text>

  <!-- Accent line -->
  <rect x="${(width / 2) - 40}" y="${markY + markSize + 125}"
        width="80" height="3" rx="1.5" fill="${ACCENT_TEAL}" opacity="0.6"/>

  <!-- Footer hint -->
  <text x="${width / 2}" y="${height - 40}"
        font-family="Inter, system-ui, -apple-system, sans-serif"
        font-size="18" font-weight="500" fill="${TEXT_SECONDARY}" opacity="0.5"
        text-anchor="middle">www.brewmind.app</text>
</svg>`;

  const outputPath = join(publicDir, 'og-image.png');
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  console.log(`OG image generated: ${outputPath}`);
}

// ─── Run ───
async function main() {
  await generateOgImage();
  console.log('\nAll assets generated from logo-mark.svg');
}

main().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
