/**
 * Generates OG image (1200x630) and favicon.ico (32x32) from SVG templates.
 * Uses sharp (already an Astro dependency).
 *
 * Usage: node scripts/generate-assets.mjs
 */
import sharp from 'sharp';
import { writeFileSync } from 'fs';
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

// ─── BrewMind Mark (same paths as favicon.svg) ───
const markPaths = `
  <path d="m12 3.5 6.4 3.7v9.6L12 20.5l-6.4-3.7V7.2z"/>
  <path d="M12 7.3c2.7 0 4.6 2 4.6 4.7s-1.9 4.7-4.6 4.7-4.6-2-4.6-4.7S9.3 7.3 12 7.3"/>
  <path d="M10.9 8.1c1.6 1.8 1.6 6.1 0 7.8"/>
`;

// ─── 1. OG Image (1200×630) ───
async function generateOgImage() {
  const width = 1200;
  const height = 630;
  const markSize = 120;
  const markX = (width / 2) - (markSize / 2);
  const markY = 100;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${BG_DARK}"/>

  <!-- Subtle radial glow behind mark -->
  <defs>
    <radialGradient id="glow" cx="50%" cy="38%" r="35%">
      <stop offset="0%" stop-color="${BRAND_GOLD}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${BRAND_GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>

  <!-- BrewMind Mark -->
  <g transform="translate(${markX}, ${markY}) scale(${markSize / 24})"
     fill="none" stroke="${BRAND_GOLD}" stroke-width="1.9"
     stroke-linecap="round" stroke-linejoin="round">
    ${markPaths}
  </g>

  <!-- App Name -->
  <text x="${width / 2}" y="${markY + markSize + 70}"
        font-family="Inter, system-ui, -apple-system, sans-serif"
        font-size="64" font-weight="700" fill="${TEXT_PRIMARY}"
        text-anchor="middle">BrewMind</text>

  <!-- Tagline -->
  <text x="${width / 2}" y="${markY + markSize + 120}"
        font-family="Inter, system-ui, -apple-system, sans-serif"
        font-size="26" font-weight="400" fill="${TEXT_SECONDARY}"
        text-anchor="middle">Jede Tasse. Perfekt begleitet.</text>

  <!-- Accent line -->
  <rect x="${(width / 2) - 40}" y="${markY + markSize + 140}"
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

// ─── 2. Favicon ICO (32×32 PNG in ICO container) ───
async function generateFaviconIco() {
  // Create a 32x32 version with slightly thicker strokes for readability
  const size = 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="${BRAND_GOLD}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4">
    ${markPaths}
  </svg>`;

  // Generate 32x32 PNG
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer();

  // Create minimal ICO file wrapping the PNG
  // ICO format: 6-byte header + 16-byte directory entry + PNG data
  const ico = createIco(pngBuffer, size);
  const outputPath = join(publicDir, 'favicon.ico');
  writeFileSync(outputPath, ico);
  console.log(`Favicon ICO generated: ${outputPath}`);
}

/**
 * Creates a minimal ICO file containing a single PNG image.
 */
function createIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // Reserved
  header.writeUInt16LE(1, 2);     // ICO type
  header.writeUInt16LE(1, 4);     // 1 image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);      // Width
  entry.writeUInt8(size, 1);      // Height
  entry.writeUInt8(0, 2);         // Color palette
  entry.writeUInt8(0, 3);         // Reserved
  entry.writeUInt16LE(1, 4);      // Color planes
  entry.writeUInt16LE(32, 6);     // Bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);   // Image size
  entry.writeUInt32LE(6 + 16, 12);            // Offset to image data

  return Buffer.concat([header, entry, pngBuffer]);
}

// ─── Run ───
async function main() {
  await generateOgImage();
  await generateFaviconIco();
  console.log('\nAll assets generated successfully.');
}

main().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
