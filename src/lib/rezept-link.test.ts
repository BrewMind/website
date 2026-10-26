import { describe, expect, it } from 'vitest';
import {
  baueAppLink,
  baueRezeptLink,
  formatDatum,
  formatMitEinheit,
  formatSpanne,
  formatZahl,
  parseRezept,
  pruefeFormular,
  saeubereText,
  startertragG,
  startzeitS,
  type FormularEingabe,
  type Rezept,
} from './rezept-link';

const NBSP = '\u00A0';

// Ortszeit, wie parseRezept sie vergleicht. 26. Oktober 2026, mittags.
const HEUTE = new Date(2026, 9, 26, 12, 0, 0);

/** Query mit gültigem v und n, dazu das, was der Test prüft. */
function params(extra: Record<string, string> = {}, basis: Record<string, string> = { v: '1', n: 'Test' }) {
  return new URLSearchParams({ ...basis, ...extra });
}

function lies(extra: Record<string, string> = {}, basis?: Record<string, string>) {
  return parseRezept(params(extra, basis), HEUTE);
}

/** Das Rezept, wenn die Query eines ergibt, sonst ein Fehlschlag mit Grund. */
function rezeptAus(extra: Record<string, string> = {}, basis?: Record<string, string>): Rezept {
  const ergebnis = lies(extra, basis);
  if (!ergebnis.ok) throw new Error(`kein Rezept: ${ergebnis.grund}`);
  return ergebnis.rezept;
}

function rundlauf(rezept: Rezept) {
  return parseRezept(new URL(baueRezeptLink(rezept)).searchParams, HEUTE);
}

describe('Rundlauf bauen und lesen', () => {
  const faelle: [string, Rezept][] = [
    [
      'volles Rezept',
      {
        name: 'VRN 80/20',
        roesterei: 'Schvarz Kaffee',
        dosisG: 18.5,
        ertragG: { min: 36, max: 40 },
        zeitS: { min: 25, max: 30 },
        roestdatum: '2026-10-12',
      },
    ],
    ['nur der Name', { name: 'Hausmischung' }],
    ['Umlaute und ß', { name: 'Äthiopien Yirgacheffe Röstung süß', roesterei: 'Röstgut Weiß' }],
    ['Schrägstrich', { name: 'Brasil 80/20' }],
    ['Plus und kaufmännisches Und', { name: 'Blend + Co & Söhne' }],
    ['Gleichheitszeichen, Fragezeichen, Raute', { name: 'a=b?c#d%e' }],
    ['Emoji', { name: 'Kaffee ☕ 🇩🇪' }],
    ['Einzelwerte statt Spannen', { name: 'Test', ertragG: { min: 40, max: 40 }, zeitS: { min: 28, max: 28 } }],
    ['Dosis mit Nachkommastelle', { name: 'Test', dosisG: 0.1 }],
    ['Obergrenzen', { name: 'Test', dosisG: 50, ertragG: { min: 199.5, max: 200 }, zeitS: { min: 1, max: 120 } }],
    ['Name mit 60 Zeichen', { name: 'x'.repeat(60) }],
  ];

  it.each(faelle)('%s', (_titel, rezept) => {
    expect(rundlauf(rezept)).toStrictEqual({ ok: true, rezept });
  });

  it('das VRN-Beispiel entspricht dem Vertrag und bleibt unter 100 Zeichen', () => {
    const link = baueRezeptLink({
      name: 'VRN 80/20',
      roesterei: 'Schvarz Kaffee',
      dosisG: 19,
      ertragG: { min: 47, max: 47 },
      zeitS: { min: 28, max: 32 },
    });
    expect(link).toBe('https://brewmind.app/r/?v=1&n=VRN%2080%2F20&r=Schvarz%20Kaffee&d=19&y=47&t=28-32');
    expect(link.length).toBeLessThanOrEqual(100);
  });

  it('Reihenfolge v, n, r, d, y, t, rd und Leerzeichen als %20', () => {
    const link = baueRezeptLink({
      roestdatum: '2026-10-12',
      zeitS: { min: 25, max: 30 },
      ertragG: { min: 36, max: 40 },
      dosisG: 18,
      roesterei: 'A B',
      name: 'C D',
    });
    expect(link).toBe('https://brewmind.app/r/?v=1&n=C%20D&r=A%20B&d=18&y=36-40&t=25-30&rd=2026-10-12');
  });

  it('ungesetzte Felder fehlen im Link', () => {
    expect(baueRezeptLink({ name: 'Test' })).toBe('https://brewmind.app/r/?v=1&n=Test');
  });

  it('Name und Rösterei werden beim Bauen wie beim Lesen gesäubert', () => {
    const link = baueRezeptLink({ name: '  Test\u0007 ', roesterei: '   ' });
    expect(link).toBe('https://brewmind.app/r/?v=1&n=Test');
  });

  it('ein einzelnes kaputtes Zeichen lässt das Bauen nicht abstürzen', () => {
    expect(() => baueRezeptLink({ name: 'Test\uD800' })).not.toThrow();
    expect(rundlauf({ name: 'Test\uD800' })).toStrictEqual({ ok: true, rezept: { name: 'Test' } });
  });
});

describe('Link für die App', () => {
  const vrn: Rezept = {
    name: 'VRN 80/20',
    roesterei: 'Schvarz Kaffee',
    dosisG: 19,
    ertragG: { min: 47, max: 47 },
    zeitS: { min: 28, max: 32 },
  };

  it('trägt dieselbe Query wie der Code, nur mit dem Schema der App', () => {
    expect(baueAppLink(vrn)).toBe('brewmindcore://r?v=1&n=VRN%2080%2F20&r=Schvarz%20Kaffee&d=19&y=47&t=28-32');
  });

  it('liest sich zum selben Rezept zurück', () => {
    const rezept: Rezept = { ...vrn, roestdatum: '2026-10-12' };
    expect(parseRezept(new URL(baueAppLink(rezept)).searchParams, HEUTE)).toStrictEqual({ ok: true, rezept });
  });

  it('nimmt nur das geprüfte Rezept mit, Unbekanntes aus der Query fällt weg', () => {
    const rezept = rezeptAus({ d: '19', x: 'fremd', y: '999' });
    expect(baueAppLink(rezept)).toBe('brewmindcore://r?v=1&n=Test&d=19');
  });
});

describe('Pflichtfelder v und n', () => {
  it('v fehlt: leer', () => {
    expect(parseRezept(new URLSearchParams('n=Test'), HEUTE)).toEqual({ ok: false, grund: 'leer' });
  });

  it('ohne jede Query: leer', () => {
    expect(parseRezept(new URLSearchParams(''), HEUTE)).toEqual({ ok: false, grund: 'leer' });
  });

  it.each(['2', '0', '', '01', '1.0', 'abc', ' 1'])('v=%j: eigener Grund Version', (v) => {
    expect(lies({ v })).toEqual({ ok: false, grund: 'version' });
  });

  it('v=2 gilt auch ohne n als Version, nicht als leer', () => {
    expect(parseRezept(new URLSearchParams('v=2'), HEUTE)).toEqual({ ok: false, grund: 'version' });
  });

  it('n fehlt: leer', () => {
    expect(parseRezept(new URLSearchParams('v=1'), HEUTE)).toEqual({ ok: false, grund: 'leer' });
  });

  it.each(['', '   ', '\t\n', '\u0007\u0000'])('n=%j (nach dem Trimmen leer): leer', (n) => {
    expect(lies({ n })).toEqual({ ok: false, grund: 'leer' });
  });

  it.each(['\u200B', '\u200D', '\u2060', '\uFEFF', '\u00AD', ' \u200B\u200C\u200D '])(
    'n=%j (nur unsichtbare Zeichen): leer',
    (n) => {
      expect(lies({ n })).toEqual({ ok: false, grund: 'leer' });
    },
  );

  it('Rösterei nur aus unsichtbaren Zeichen fällt weg, das Rezept bleibt', () => {
    expect(rezeptAus({ r: '\u200B\u2060' }).roesterei).toBeUndefined();
  });

  it('sichtbarer Name mit Zero-Width-Joiner bleibt unverändert (Emoji-Folge)', () => {
    const familie = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
    expect(rezeptAus({ n: `Bohne ${familie}` }).name).toBe(`Bohne ${familie}`);
  });

  it('n mit 61 Zeichen: leer, mit 60 Zeichen: gültig', () => {
    expect(lies({ n: 'x'.repeat(61) })).toEqual({ ok: false, grund: 'leer' });
    expect(rezeptAus({ n: 'x'.repeat(60) }).name).toBe('x'.repeat(60));
  });

  it('Leerzeichen am Rand zählen nicht mit', () => {
    expect(rezeptAus({ n: `  ${'x'.repeat(60)}  ` }).name).toBe('x'.repeat(60));
  });

  it('ein Emoji zählt als ein Zeichen', () => {
    expect(rezeptAus({ n: '☕'.repeat(30) + '🇩🇪'.repeat(15) }).name).toHaveLength(30 + 60);
    expect(lies({ n: '😀'.repeat(61) })).toEqual({ ok: false, grund: 'leer' });
    expect(lies({ n: '😀'.repeat(60) }).ok).toBe(true);
  });

  it('Steuerzeichen werden entfernt', () => {
    expect(rezeptAus({ n: 'Bo\u0000hne\u0007\n\t\u202E!' }).name).toBe('Bohne!');
  });

  it('Rösterei: getrimmt, leer oder zu lang wird ignoriert, Rest bleibt gültig', () => {
    expect(rezeptAus({ r: '  Rösterei  ' }).roesterei).toBe('Rösterei');
    expect(rezeptAus({ r: '   ' })).toStrictEqual({ name: 'Test' });
    expect(rezeptAus({ r: 'x'.repeat(61) })).toStrictEqual({ name: 'Test' });
    expect(rezeptAus({ r: 'x'.repeat(60) }).roesterei).toBe('x'.repeat(60));
  });
});

describe('Dosis d', () => {
  it.each(['18', '18.5', '0.1', '50', '50.0', '007', '1'])('d=%j gilt', (d) => {
    expect(rezeptAus({ d }).dosisG).toBe(Number(d));
  });

  it.each([
    ['0'],
    ['0.0'],
    ['-1'],
    ['+18'],
    ['1e3'],
    ['18,5'],
    ['18.55'],
    ['Infinity'],
    ['NaN'],
    [''],
    [' 18'],
    ['18 '],
    ['51'],
    ['50.1'],
    ['1000'],
    ['.5'],
    ['18.'],
    ['0x10'],
    ['１８'],
  ])('d=%j wird ignoriert, der Rest bleibt gültig', (d) => {
    expect(rezeptAus({ d })).toStrictEqual({ name: 'Test' });
  });
});

describe('Ertrag y', () => {
  it.each([
    ['36', 36, 36],
    ['36.5', 36.5, 36.5],
    ['36-40', 36, 40],
    ['36.5-40.5', 36.5, 40.5],
    ['40-40', 40, 40],
    ['0.5-200', 0.5, 200],
    ['200', 200, 200],
  ])('y=%j gilt', (y, min, max) => {
    expect(rezeptAus({ y }).ertragG).toEqual({ min, max });
  });

  it.each([
    ['40-36'],
    ['36-'],
    ['-40'],
    ['36-40-44'],
    ['36--40'],
    ['-'],
    ['0'],
    ['0-40'],
    ['36-0'],
    ['201'],
    ['36-201'],
    ['36,5'],
    ['36,5-40'],
    ['36 - 40'],
    ['36-40 '],
    ['36.55-40'],
    ['1e2'],
    ['36-Infinity'],
    ['36-NaN'],
    ['−36'],
    [''],
  ])('y=%j wird ganz ignoriert', (y) => {
    expect(rezeptAus({ y })).toStrictEqual({ name: 'Test' });
  });

  it('ein ungültiges y lässt Dosis und Zeit stehen', () => {
    expect(rezeptAus({ d: '18', y: '40-36', t: '28' })).toStrictEqual({
      name: 'Test',
      dosisG: 18,
      zeitS: { min: 28, max: 28 },
    });
  });
});

describe('Zeit t', () => {
  it.each([
    ['28', 28, 28],
    ['25-30', 25, 30],
    ['30-30', 30, 30],
    ['1', 1, 1],
    ['120', 120, 120],
    ['1-120', 1, 120],
  ])('t=%j gilt', (t, min, max) => {
    expect(rezeptAus({ t }).zeitS).toEqual({ min, max });
  });

  it.each([
    ['30-25'],
    ['25-'],
    ['-30'],
    ['25-30-35'],
    ['0'],
    ['121'],
    ['25-121'],
    ['28.5'],
    ['25-30.5'],
    ['28,5'],
    ['-1'],
    ['1e2'],
    ['1000'],
    [' 28'],
    ['Infinity'],
    ['NaN'],
    [''],
  ])('t=%j wird ganz ignoriert', (t) => {
    expect(rezeptAus({ t })).toStrictEqual({ name: 'Test' });
  });
});

describe('Röstdatum rd', () => {
  it('ein echtes Datum aus der Vergangenheit gilt', () => {
    expect(rezeptAus({ rd: '2026-10-12' }).roestdatum).toBe('2026-10-12');
    expect(rezeptAus({ rd: '2024-02-29' }).roestdatum).toBe('2024-02-29');
  });

  it('heute gilt, morgen ist Zukunft', () => {
    expect(rezeptAus({ rd: '2026-10-26' }).roestdatum).toBe('2026-10-26');
    expect(rezeptAus({ rd: '2026-10-27' })).toStrictEqual({ name: 'Test' });
  });

  it('die Grenze folgt dem übergebenen Datum, auch kurz nach Mitternacht', () => {
    const frueh = new Date(2026, 9, 26, 0, 5, 0);
    const spaet = new Date(2026, 9, 26, 23, 55, 0);
    for (const heute of [frueh, spaet]) {
      const query = new URLSearchParams({ v: '1', n: 'Test', rd: '2026-10-26' });
      expect(parseRezept(query, heute)).toEqual({ ok: true, rezept: { name: 'Test', roestdatum: '2026-10-26' } });
    }
    const gestern = new URLSearchParams({ v: '1', n: 'Test', rd: '2026-10-26' });
    expect(parseRezept(gestern, new Date(2026, 9, 25, 23, 55, 0))).toEqual({ ok: true, rezept: { name: 'Test' } });
  });

  it.each([
    ['2026-02-30'],
    ['2026-02-29'],
    ['2026-13-01'],
    ['2026-00-10'],
    ['2026-10-00'],
    ['2026-10-32'],
    ['2026-04-31'],
    ['2027-01-01'],
    ['9999-12-31'],
    ['12.10.2026'],
    ['2026/10/12'],
    ['26-10-12'],
    ['2026-1-2'],
    ['20261012'],
    ['2026-10-12T00:00:00Z'],
    [' 2026-10-12'],
    ['2026-10-12 '],
    [''],
    ['heute'],
  ])('rd=%j wird ignoriert, der Rest bleibt gültig', (rd) => {
    expect(rezeptAus({ rd, d: '18' })).toStrictEqual({ name: 'Test', dosisG: 18 });
  });
});

describe('Vorwärtskompatibilität und Kodierung', () => {
  it('ein unbekannter Parameter stört nicht', () => {
    expect(rezeptAus({ zukunft: 'x', z: '1', d: '18' })).toStrictEqual({ name: 'Test', dosisG: 18 });
  });

  it('ein Plus in der Query ist ein Leerzeichen', () => {
    const ergebnis = parseRezept(new URLSearchParams('v=1&n=VRN+80%2F20&r=Schvarz+Kaffee'), HEUTE);
    expect(ergebnis).toEqual({ ok: true, rezept: { name: 'VRN 80/20', roesterei: 'Schvarz Kaffee' } });
  });

  it('ein kodiertes Plus bleibt ein Plus', () => {
    const ergebnis = parseRezept(new URLSearchParams('v=1&n=A%2BB'), HEUTE);
    expect(ergebnis).toEqual({ ok: true, rezept: { name: 'A+B' } });
  });

  it('kaputte Prozentkodierung wirft nicht', () => {
    expect(() => parseRezept(new URLSearchParams('v=1&n=%E0%A4%A&d=%'), HEUTE)).not.toThrow();
  });

  it('ein HTML-Fragment im Namen bleibt reiner Text', () => {
    const rezept = rezeptAus({ n: '<img src=x onerror=alert(1)>' });
    expect(rezept.name).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('saeubereText', () => {
  it('trimmt, entfernt Steuerzeichen und lässt Umlaute stehen', () => {
    expect(saeubereText('  Röstung\u0000\u0009 Süß\u200E ')).toBe('Röstung Süß');
  });

  it.each([
    ['hohe Hälfte am Ende', 'Test\uD800', 'Test'],
    ['hohe Hälfte mitten im Text', 'Te\uD83Dst', 'Test'],
    ['tiefe Hälfte allein', 'Te\uDE00st', 'Test'],
    ['tiefe vor hoher Hälfte (verdreht): beide raus', 'A\uDE00\uD83DB', 'AB'],
    ['zwei hohe Hälften hintereinander', 'A\uD83D\uD83DB', 'AB'],
    ['gültiges Paar bleibt (Emoji)', 'Kaffee \uD83D\uDE00', 'Kaffee \uD83D\uDE00'],
    ['gültiges Paar plus lose Hälfte dahinter', '\uD83D\uDE00\uD83D', '\uD83D\uDE00'],
    ['lose Hälfte vor gültigem Paar', '\uDE00\uD83D\uDE00', '\uD83D\uDE00'],
    ['Randwerte U+D7FF und U+E000 bleiben', 'A\uD7FF\uE000B', 'A\uD7FF\uE000B'],
  ])('%s', (_name, roh, erwartet) => {
    expect(saeubereText(roh)).toBe(erwartet);
  });
});

describe('Anzeige', () => {
  it('Zahl deutsch mit Komma', () => {
    expect(formatZahl(18.5)).toBe('18,5');
    expect(formatZahl(18)).toBe('18');
    expect(formatZahl(0.1)).toBe('0,1');
  });

  it('Einheit mit geschütztem Leerzeichen davor', () => {
    expect(formatMitEinheit(18.5, 'g')).toBe(`18,5${NBSP}g`);
    expect(formatMitEinheit(19, 'g')).toBe(`19${NBSP}g`);
  });

  it('Spanne wie in der App: 28 bis 32 s', () => {
    expect(formatSpanne({ min: 28, max: 32 }, 's')).toBe(`28 bis 32${NBSP}s`);
    expect(formatSpanne({ min: 36.5, max: 40 }, 'g')).toBe(`36,5 bis 40${NBSP}g`);
  });

  it('min gleich max wird als Einzelwert gezeigt', () => {
    expect(formatSpanne({ min: 47, max: 47 }, 'g')).toBe(`47${NBSP}g`);
  });

  it('Startzeit ist die gerundete Mitte, wie in der App', () => {
    expect(startzeitS({ min: 28, max: 32 })).toBe(30);
    expect(startzeitS({ min: 27, max: 30 })).toBe(29);
    expect(startzeitS({ min: 25, max: 30 })).toBe(28);
    expect(startzeitS({ min: 30, max: 30 })).toBe(30);
    expect(startzeitS({ min: 1, max: 2 })).toBe(2);
  });

  it('Startertrag ist die Mitte auf eine Nachkommastelle', () => {
    expect(startertragG({ min: 36, max: 40 })).toBe(38);
    expect(startertragG({ min: 36, max: 41 })).toBe(38.5);
    expect(startertragG({ min: 36.5, max: 40 })).toBe(38.3);
    expect(startertragG({ min: 47, max: 47 })).toBe(47);
  });

  it('Startertrag: halbe Zehntel runden auf, auch wo Gleitkomma knapp darunter liegt', () => {
    expect(startertragG({ min: 30.4, max: 34.3 })).toBe(32.4);
    expect(startertragG({ min: 10.1, max: 10.2 })).toBe(10.2);
    expect(startertragG({ min: 0.1, max: 4.6 })).toBe(2.4);
  });

  it('Startertrag stimmt für jede Spanne in Zehnteln von 30 bis 50 g', () => {
    const falsch: string[] = [];
    for (let a = 300; a <= 500; a += 1) {
      for (let b = a; b <= 500; b += 1) {
        // Erwartung in ganzen Zehnteln, ohne die geprüfte Rechnung
        const erwartet = Math.floor((a + b + 1) / 2) / 10;
        const ist = startertragG({ min: Number((a / 10).toFixed(1)), max: Number((b / 10).toFixed(1)) });
        if (ist !== erwartet) falsch.push(`${a / 10}-${b / 10}: ${ist} statt ${erwartet}`);
      }
    }
    expect(falsch).toEqual([]);
  });

  it('Datum ausgeschrieben, unabhängig von der Zeitzone des Geräts', () => {
    expect(formatDatum('2026-10-12')).toBe('12. Oktober 2026');
    expect(formatDatum('2026-03-01')).toBe('1. März 2026');
    expect(formatDatum('2025-12-31')).toBe('31. Dezember 2025');
  });
});

describe('Formular', () => {
  const leer: FormularEingabe = {
    name: '',
    roesterei: '',
    dosis: '',
    ertragVon: '',
    ertragBis: '',
    zeitVon: '',
    zeitBis: '',
    roestdatum: '',
  };

  function pruefe(eingabe: Partial<FormularEingabe>) {
    return pruefeFormular({ ...leer, name: 'Test', ...eingabe }, HEUTE);
  }

  it('nur der Name genügt', () => {
    expect(pruefe({})).toEqual({ rezept: { name: 'Test' }, fehler: {} });
  });

  it('ohne Name kein Rezept, mit Meldung am Namen', () => {
    const ergebnis = pruefe({ name: '   ' });
    expect(ergebnis.rezept).toBeNull();
    expect(Object.keys(ergebnis.fehler)).toEqual(['name']);
  });

  it('ein Name nur aus unsichtbaren Zeichen zählt als fehlend', () => {
    const ergebnis = pruefe({ name: '\u200B\u200D' });
    expect(ergebnis.rezept).toBeNull();
    expect(ergebnis.fehler.name).toBe('Der Name der Bohne fehlt.');
  });

  it('ein zu langer Name wird gemeldet', () => {
    expect(pruefe({ name: 'x'.repeat(61) }).fehler.name).toMatch(/zu lang/);
    expect(pruefe({ name: 'x'.repeat(60) }).rezept).not.toBeNull();
  });

  it('volles Formular, Komma wie Punkt, Spannen und Rundlauf durch den Link', () => {
    const ergebnis = pruefe({
      name: ' VRN 80/20 ',
      roesterei: 'Schvarz Kaffee',
      dosis: '18,5',
      ertragVon: '36',
      ertragBis: '40,5',
      zeitVon: '28',
      zeitBis: '32',
      roestdatum: '2026-10-12',
    });
    expect(ergebnis.fehler).toEqual({});
    expect(ergebnis.rezept).toStrictEqual({
      name: 'VRN 80/20',
      roesterei: 'Schvarz Kaffee',
      dosisG: 18.5,
      ertragG: { min: 36, max: 40.5 },
      zeitS: { min: 28, max: 32 },
      roestdatum: '2026-10-12',
    });
    expect(baueRezeptLink(ergebnis.rezept!)).toContain('d=18.5&y=36-40.5&t=28-32&rd=2026-10-12');
    expect(rundlauf(ergebnis.rezept!)).toStrictEqual({ ok: true, rezept: ergebnis.rezept });
  });

  it('von gleich bis ergibt einen Einzelwert', () => {
    const ergebnis = pruefe({ ertragVon: '40', ertragBis: '40', zeitVon: '28', zeitBis: '28' });
    expect(ergebnis.rezept?.ertragG).toEqual({ min: 40, max: 40 });
    expect(baueRezeptLink(ergebnis.rezept!)).toContain('y=40&t=28');
  });

  it('nur "von" ist ein Einzelwert', () => {
    expect(pruefe({ ertragVon: '36' }).rezept?.ertragG).toEqual({ min: 36, max: 36 });
  });

  it('"bis" ohne "von" ist ein Fehler am Feld "bis"', () => {
    const ergebnis = pruefe({ ertragBis: '40', zeitBis: '30' });
    expect(ergebnis.rezept).toBeNull();
    expect(Object.keys(ergebnis.fehler).sort()).toEqual(['ertragBis', 'zeitBis']);
  });

  it('von größer als bis ist ein Fehler, nichts wird vertauscht', () => {
    const ergebnis = pruefe({ ertragVon: '40', ertragBis: '36' });
    expect(ergebnis.rezept).toBeNull();
    expect(ergebnis.fehler.ertragBis).toMatch(/nicht kleiner/);
    expect(ergebnis.fehler.ertragVon).toBeUndefined();
  });

  it('dieselben Grenzen wie der Parser', () => {
    const zuViel: Partial<FormularEingabe>[] = [
      { dosis: '51' },
      { dosis: '0' },
      { dosis: '18.55' },
      { dosis: '1e1' },
      { dosis: '-5' },
      { ertragVon: '201' },
      { ertragVon: '36', ertragBis: '201' },
      { zeitVon: '121' },
      { zeitVon: '28.5' },
      { zeitVon: '28', zeitBis: '30,5' },
      { roestdatum: '2026-02-30' },
      { roestdatum: '2026-10-27' },
    ];
    for (const eingabe of zuViel) {
      const ergebnis = pruefe(eingabe);
      expect(ergebnis.rezept, JSON.stringify(eingabe)).toBeNull();
      expect(Object.keys(ergebnis.fehler), JSON.stringify(eingabe)).toHaveLength(1);
    }
  });

  it('Leerzeichen um eine Zahl stören im Formular nicht', () => {
    expect(pruefe({ dosis: ' 18 ' }).rezept?.dosisG).toBe(18);
  });

  it('Fehler an mehreren Feldern kommen zusammen', () => {
    const ergebnis = pruefe({ name: '', dosis: 'abc', zeitVon: '999' });
    expect(Object.keys(ergebnis.fehler).sort()).toEqual(['dosis', 'name', 'zeitVon']);
    expect(ergebnis.rezept).toBeNull();
  });

  it('Röstdatum: Zukunft und ungültiges Datum haben eigene Meldungen', () => {
    expect(pruefe({ roestdatum: '2026-10-27' }).fehler.roestdatum).toMatch(/Zukunft/);
    expect(pruefe({ roestdatum: '2026-02-30' }).fehler.roestdatum).toMatch(/gültig/);
  });
});
