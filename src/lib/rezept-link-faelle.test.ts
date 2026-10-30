import { describe, expect, it } from 'vitest';
import faelleDatei from './rezept-link-faelle.json';
import { parseRezept, saeubereText, startertragG, startzeitS, type Rezept, type Spanne } from './rezept-link';

// Die Fall-Datei, die Website und App gemeinsam lesen (BrewMind/brewmind-core#763).
// Der Link ist ein Vertrag (Muster v1): Ein gedruckter Code muss auf /r/ und nach
// dem Scan in der App dasselbe ergeben. `rezept-link-faelle.json` hat im App-Repo
// eine byte-gleiche Kopie (apps/mobile/src/__tests__/fixtures/), `scripts/check-rezept-link-faelle.sh`
// im App-Repo vergleicht beide. Die Läufer hier und dort sind bis auf den Import
// gleich. Eine Regel ändert sich nur, wenn beide Seiten ihre Datei gleich ändern.

type Fall = {
  titel: string;
  query: string | Record<string, string> | [string, string][];
  /** JJJJ-MM-TT, sonst das oberste `heute` der Datei */
  heute?: string;
  erwartet: Rezept | null;
  grund?: 'leer' | 'version';
};
type Spannenfall = { spanne: Spanne; erwartet: number };
type Faelledatei = {
  heute: string;
  faelle: Fall[];
  saeubern: { titel: string; roh: string; erwartet: string }[];
  startzeitS: Spannenfall[];
  startertragG: Spannenfall[];
};

const datei = faelleDatei as unknown as Faelledatei;

/** JJJJ-MM-TT als Ortszeit, mittags: so vergleicht parseRezept, unabhängig von der Zeitzone des Läufers. */
function mittags(iso: string): Date {
  const [jahr, monat, tag] = iso.split('-').map(Number);
  return new Date(jahr, monat - 1, tag, 12, 0, 0);
}

describe('Fall-Datei: Aufbau', () => {
  it('trägt viele Fälle, damit eine geleerte Datei nicht still grün bleibt', () => {
    expect(datei.faelle.length).toBeGreaterThanOrEqual(100);
    expect(datei.saeubern.length).toBeGreaterThan(0);
    expect(datei.startzeitS.length).toBeGreaterThan(0);
    expect(datei.startertragG.length).toBeGreaterThan(0);
  });

  it('Titel sind eindeutig', () => {
    const titel = datei.faelle.map((fall) => fall.titel);
    expect(titel.filter((t, i) => titel.indexOf(t) !== i)).toEqual([]);
  });

  it('der Grund steht bei genau den Fällen ohne Rezept', () => {
    const falsch = datei.faelle.filter((fall) => (fall.erwartet === null) !== (fall.grund !== undefined));
    expect(falsch.map((fall) => fall.titel)).toEqual([]);
  });
});

describe('Fall-Datei: parseRezept', () => {
  it.each(datei.faelle.map((fall): [string, Fall] => [fall.titel, fall]))('%s', (_titel, fall) => {
    const ergebnis = parseRezept(new URLSearchParams(fall.query), mittags(fall.heute ?? datei.heute));
    expect(ergebnis).toStrictEqual(
      fall.erwartet === null ? { grund: fall.grund, ok: false } : { ok: true, rezept: fall.erwartet },
    );
  });
});

describe('Fall-Datei: saeubereText', () => {
  it.each(datei.saeubern.map((fall): [string, string, string] => [fall.titel, fall.roh, fall.erwartet]))(
    '%s',
    (_titel, roh, erwartet) => {
      expect(saeubereText(roh)).toBe(erwartet);
    },
  );
});

describe('Fall-Datei: Startwerte', () => {
  it.each(datei.startzeitS.map((fall): [Spanne, number] => [fall.spanne, fall.erwartet]))(
    'startzeitS %j ergibt %s',
    (spanne, erwartet) => {
      expect(startzeitS(spanne)).toBe(erwartet);
    },
  );

  it.each(datei.startertragG.map((fall): [Spanne, number] => [fall.spanne, fall.erwartet]))(
    'startertragG %j ergibt %s',
    (spanne, erwartet) => {
      expect(startertragG(spanne)).toBe(erwartet);
    },
  );
});
