/**
 * Läuft nach `astro build` (siehe `build` in package.json) und prüft die
 * gebaute Rückweg-Seite der Apple-Anmeldung (`src/pages/auth/apple.astro`):
 *
 *   - Die Seite liegt unter dist/auth/apple/index.html.
 *   - Die Hashes in der Content-Security-Policy passen zu genau dem Skript und
 *     dem Stil, die in der Seite stehen. Weicht einer ab, blockt der Browser
 *     das Skript ohne sichtbaren Fehler und die Seite zeigt nur das Signet.
 *   - Skript und Stil stehen in der Seite, nichts wird als Datei nachgeladen.
 *
 * Bricht den Build mit Exit-Code 1 ab, damit so eine Seite nie veröffentlicht wird.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const DATEI = process.argv[2] ?? 'dist/auth/apple/index.html';
const fehler = [];

let html = '';
try {
  html = readFileSync(DATEI, 'utf8');
} catch {
  console.error(`pruefe-auth-apple: ${DATEI} fehlt. Die Seite muss unter /auth/apple/ liegen.`);
  process.exit(1);
}

const hash = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
const entschluesselt = (text) => text.replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');

const csp = entschluesselt(
  /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? '',
);
if (csp === '') fehler.push('Die Content-Security-Policy fehlt.');
const regel = (name) => csp.split(';').map((teil) => teil.trim()).find((teil) => teil.startsWith(`${name} `)) ?? '';
if (regel('default-src') !== "default-src 'none'") fehler.push("default-src ist nicht 'none'.");

const skripte = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const stile = [...html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/g)];

if (skripte.length !== 1) fehler.push(`Erwartet ist genau ein Skript, gefunden: ${skripte.length}.`);
if (stile.length !== 1) fehler.push(`Erwartet ist genau ein Stilblock, gefunden: ${stile.length}.`);
if (skripte.some(([, attribute]) => /\bsrc=/.test(attribute))) fehler.push('Ein Skript wird als Datei nachgeladen.');
if (/<link\b[^>]*rel="stylesheet"/.test(html)) fehler.push('Ein Stylesheet wird als Datei nachgeladen.');

if (skripte.length === 1 && regel('script-src') !== `script-src ${hash(skripte[0][2])}`) {
  fehler.push(`script-src passt nicht zum Skript. In der Seite: ${regel('script-src')}, gerechnet: ${hash(skripte[0][2])}.`);
}
if (stile.length === 1 && regel('style-src') !== `style-src ${hash(stile[0][2])}`) {
  fehler.push(`style-src passt nicht zum Stil. In der Seite: ${regel('style-src')}, gerechnet: ${hash(stile[0][2])}.`);
}

if (fehler.length > 0) {
  console.error(`pruefe-auth-apple: ${DATEI} ist nicht in Ordnung:\n  - ${fehler.join('\n  - ')}`);
  process.exit(1);
}
console.log(`pruefe-auth-apple: ${DATEI} in Ordnung (CSP-Hashes passen zu Skript und Stil).`);
