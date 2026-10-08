/**
 * Erzeugt public/favicon.ico (32x32, PNG im ICO-Container) aus favicon.svg.
 * Browser und Crawler fragen /favicon.ico ungefragt an; ohne Datei gibt es 404.
 * Nutzt sharp (steckt schon in Astro), keine eigene Dependency.
 *
 * Usage: node scripts/generate-favicon.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const size = 32;

const png = await sharp(readFileSync(join(publicDir, 'favicon.svg')), { density: 384 })
  .resize(size, size)
  .png()
  .toBuffer();

// ICO: 6 Byte Header + 16 Byte Verzeichniseintrag + PNG-Daten
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserviert
header.writeUInt16LE(1, 2); // Typ 1 = Icon
header.writeUInt16LE(1, 4); // ein Bild
header.writeUInt8(size, 6); // Breite
header.writeUInt8(size, 7); // Hoehe
header.writeUInt8(0, 8); // keine Palette
header.writeUInt8(0, 9); // reserviert
header.writeUInt16LE(1, 10); // Farbebenen
header.writeUInt16LE(32, 12); // Bit pro Pixel
header.writeUInt32LE(png.length, 14); // Groesse der Bilddaten
header.writeUInt32LE(22, 18); // Offset der Bilddaten

const out = join(publicDir, 'favicon.ico');
writeFileSync(out, Buffer.concat([header, png]));
console.log(`Favicon generated: ${out} (${22 + png.length} bytes)`);
