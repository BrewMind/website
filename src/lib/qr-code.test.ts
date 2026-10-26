import { describe, expect, it } from 'vitest';
import { baueRezeptLink } from './rezept-link';
import { baueQrMatrix, dateiSlug, qrKante, qrPfad, qrSvgText, rasterMasse, RUHEZONE, type QrMatrix } from './qr-code';

const VRN_LINK = baueRezeptLink({
  name: 'VRN 80/20',
  roesterei: 'Schvarz Kaffee',
  dosisG: 19,
  ertragG: { min: 47, max: 47 },
  zeitS: { min: 28, max: 32 },
});

/** Liest einen Pfad aus qrPfad zurück in eine Matrix, ohne Ruhezone. */
function matrixAusPfad(pfad: string, kante: number): QrMatrix {
  const matrix: QrMatrix = Array.from({ length: kante }, () => Array<boolean>(kante).fill(false));
  for (const treffer of pfad.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
    const [x, y, laenge] = [Number(treffer[1]) - RUHEZONE, Number(treffer[2]) - RUHEZONE, Number(treffer[3])];
    expect(Number(treffer[4])).toBe(laenge);
    for (let i = 0; i < laenge; i += 1) matrix[y][x + i] = true;
  }
  return matrix;
}

describe('baueQrMatrix', () => {
  const matrix = baueQrMatrix(VRN_LINK);

  it('quadratisch, Größe nach QR-Norm (17 + 4 mal Version)', () => {
    expect(matrix.every((zeile) => zeile.length === matrix.length)).toBe(true);
    expect((matrix.length - 17) % 4).toBe(0);
  });

  it('Fehlerkorrektur M: 80 Zeichen brauchen Version 5, 37 Module', () => {
    expect(VRN_LINK.length).toBe(80);
    expect(matrix.length).toBe(37);
  });

  it('die drei Suchmuster sitzen in den Ecken: 7 mal 7, Rand dunkel, Ring hell, Kern dunkel', () => {
    const n = matrix.length;
    for (const [zeile0, spalte0] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ]) {
      for (let z = 0; z < 7; z += 1) {
        for (let s = 0; s < 7; s += 1) {
          const rand = z === 0 || z === 6 || s === 0 || s === 6;
          const kern = z >= 2 && z <= 4 && s >= 2 && s <= 4;
          expect(matrix[zeile0 + z][spalte0 + s], `${zeile0 + z}/${spalte0 + s}`).toBe(rand || kern);
        }
      }
    }
  });

  it('derselbe Text ergibt dieselbe Matrix, ein anderer nicht', () => {
    expect(baueQrMatrix(VRN_LINK)).toEqual(matrix);
    expect(baueQrMatrix(`${VRN_LINK}x`)).not.toEqual(matrix);
  });

  it('lehnt Nicht-ASCII ab, statt es zu verstümmeln', () => {
    expect(() => baueQrMatrix('Röstung')).toThrow();
  });

  it('wächst mit dem Text und bleibt für das längste Formular baubar', () => {
    const lang = baueRezeptLink({
      name: '漢'.repeat(40),
      roesterei: '漢'.repeat(40),
      dosisG: 18.5,
      ertragG: { min: 36.5, max: 40.5 },
      zeitS: { min: 25, max: 30 },
      roestdatum: '2026-10-12',
    });
    expect(baueQrMatrix(lang).length).toBeGreaterThan(matrix.length);
  });
});

describe('qrPfad und qrSvgText', () => {
  const matrix = baueQrMatrix(VRN_LINK);

  it('der Pfad zeichnet genau die dunklen Module nach', () => {
    expect(matrixAusPfad(qrPfad(matrix), matrix.length)).toEqual(matrix);
  });

  it('die Ruhezone verschiebt alles um vier Module', () => {
    expect(qrPfad(matrix)).toMatch(/^M4 4h7/);
    expect(qrKante(matrix)).toBe(37 + 8);
  });

  it('die SVG-Datei hat weißen Grund, dunkle Module und die Kante als viewBox', () => {
    const svg = qrSvgText(matrix);
    expect(svg).toContain('viewBox="0 0 45 45"');
    expect(svg).toContain('<rect width="45" height="45" fill="#fff"/>');
    expect(svg).toContain(`<path d="${qrPfad(matrix)}" fill="#000"/>`);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});

describe('rasterMasse', () => {
  const matrix = baueQrMatrix(VRN_LINK);

  it('ganze Pixel je Modul, Code mittig, nichts ragt über die 1024', () => {
    const { zelle, versatz } = rasterMasse(matrix);
    expect(zelle).toBe(Math.floor(1024 / 45));
    expect(Number.isInteger(versatz)).toBe(true);
    expect(versatz).toBeGreaterThanOrEqual(zelle * RUHEZONE);
    expect(versatz + zelle * matrix.length).toBeLessThanOrEqual(1024);
    expect(1024 - versatz - zelle * matrix.length).toBeGreaterThanOrEqual(zelle * RUHEZONE);
  });
});

describe('dateiSlug', () => {
  it.each([
    ['VRN 80/20', 'vrn-80-20'],
    ['Äthiopien Süß & Röstung', 'aethiopien-suess-roestung'],
    ['Straße', 'strasse'],
    ['Café Crème', 'cafe-creme'],
    ['  --Test--  ', 'test'],
    ['Blend + Co & Söhne', 'blend-co-soehne'],
    ['漢字', 'rezept'],
    ['', 'rezept'],
    ['A'.repeat(80), 'a'.repeat(40)],
    ['Ö'.normalize('NFD'), 'oe'],
  ])('%j wird %j', (name, erwartet) => {
    expect(dateiSlug(name)).toBe(erwartet);
  });

  it('endet nach dem Kürzen nicht auf einem Bindestrich', () => {
    expect(dateiSlug(`${'a'.repeat(39)} b`)).toBe('a'.repeat(39));
  });
});
