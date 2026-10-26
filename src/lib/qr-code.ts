/**
 * QR-Code für /qr/: dünne Hülle um `qrcode-generator` (keine Abhängigkeiten,
 * läuft im Browser) und alles, was daraus ein Bild macht. Ohne DOM, damit
 * vitest Matrix, Pfad und Rastermaße prüfen kann. Gezeichnet wird in
 * qr.astro.
 */
import qrcode from 'qrcode-generator';

/** `matrix[zeile][spalte]` ist `true` für ein dunkles Modul. */
export type QrMatrix = boolean[][];

/** Vier helle Module rundherum, so verlangt es die QR-Norm. */
export const RUHEZONE = 4;

/**
 * Typnummer 0 (die kleinste Größe, die passt), Fehlerkorrektur M, Byte-Modus.
 * Der Link besteht nur aus ASCII (encodeURIComponent), und genau das braucht
 * die Hülle: sie schneidet jedes Zeichen auf ein Byte ab. Alles andere wäre
 * ein Fehler im Aufrufer, kein Fall für stilles Verstümmeln.
 */
export function baueQrMatrix(text: string): QrMatrix {
  if (/[^\x20-\x7E]/.test(text)) throw new Error('Der QR-Text darf nur ASCII enthalten.');
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const kante = qr.getModuleCount();
  return Array.from({ length: kante }, (_, zeile) =>
    Array.from({ length: kante }, (_, spalte) => qr.isDark(zeile, spalte)),
  );
}

/** Kantenlänge in Modulen samt Ruhezone. */
export function qrKante(matrix: QrMatrix, ruhezone = RUHEZONE): number {
  return matrix.length + 2 * ruhezone;
}

/**
 * Alle dunklen Module als ein SVG-Pfad, nebeneinanderliegende zu einem
 * Rechteck zusammengefasst (viel kürzer als je Modul eins). Koordinaten in
 * Modulen, verschoben um die Ruhezone.
 */
export function qrPfad(matrix: QrMatrix, ruhezone = RUHEZONE): string {
  const teile: string[] = [];
  matrix.forEach((zeile, y) => {
    let x = 0;
    while (x < zeile.length) {
      if (!zeile[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < zeile.length && zeile[x]) x += 1;
      teile.push(`M${start + ruhezone} ${y + ruhezone}h${x - start}v1h-${x - start}z`);
    }
  });
  return teile.join('');
}

/** Eigenständige SVG-Datei: dunkle Module auf weißem Grund, unabhängig vom Hintergrund der Umgebung. */
export function qrSvgText(matrix: QrMatrix, pixel = 1024, ruhezone = RUHEZONE): string {
  const kante = qrKante(matrix, ruhezone);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${kante} ${kante}" width="${pixel}" height="${pixel}" shape-rendering="crispEdges">` +
    `<rect width="${kante}" height="${kante}" fill="#fff"/>` +
    `<path d="${qrPfad(matrix, ruhezone)}" fill="#000"/>` +
    '</svg>'
  );
}

/**
 * Rastermaße für das PNG: ganze Pixel je Modul, damit keine Kante verwäscht.
 * Der Rest bis zur Kantenlänge wird weißer Rand, der Code sitzt mittig.
 */
export function rasterMasse(matrix: QrMatrix, kante = 1024, ruhezone = RUHEZONE): { zelle: number; versatz: number } {
  const zelle = Math.max(1, Math.floor(kante / qrKante(matrix, ruhezone)));
  return { zelle, versatz: Math.floor((kante - zelle * matrix.length) / 2) };
}

/** Dateinamenteil aus dem Bohnennamen: "VRN 80/20" wird vrn-80-20, Umlaute als ae, oe, ue, ss. */
export function dateiSlug(name: string): string {
  const slug = name
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug === '' ? 'rezept' : slug;
}
