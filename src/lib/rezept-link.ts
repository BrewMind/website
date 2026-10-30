/**
 * Rezept-Link, Version 1: das Muster hinter den QR-Codes von /qr/ und die
 * Regeln der Seite /r/, die sie liest. Gedruckte Codes lassen sich nicht
 * zurückrufen, deshalb ist das hier ein Vertrag: Parameter nie umdeuten,
 * neue nur hinzufügen, bei einem Bruch `v` hochzählen.
 *
 *   https://brewmind.app/r/?v=1&n=VRN%2080%2F20&r=Schvarz%20Kaffee&d=19&y=47&t=28-32
 *
 *   v   Musterversion, genau 1 (Pflicht)
 *   n   Name der Bohne, 1 bis 60 Zeichen (Pflicht)
 *   r   Rösterei, bis 60 Zeichen
 *   d   Dosis in g, 0 < d <= 50, höchstens eine Nachkommastelle
 *   y   Ertrag in g, Zahl oder Spanne 36-40, 0 < y <= 200
 *   t   Zeit in s, ganze Zahl oder Spanne 25-30, 0 < t <= 120
 *   rd  Röstdatum JJJJ-MM-TT, echtes Datum, nicht in der Zukunft
 *   rg  Röstgrad: hell, mittel oder dunkel
 *
 * Ein ungültiger optionaler Parameter fällt für sich weg, der Rest bleibt
 * gültig. Unbekannte Parameter werden überlesen (Vorwärtskompatibilität).
 *
 * Reines Modul ohne DOM: Generator und Leseseite teilen sich dieselben Regeln,
 * vitest prüft sie ohne Browser.
 *
 * Die App liest denselben Link mit einem Port dieser Leseregeln. Beide Seiten
 * prüfen sie gegen `rezept-link-faelle.json` (Läufer `rezept-link-faelle.test.ts`);
 * die App hat eine byte-gleiche Kopie, `scripts/check-rezept-link-faelle.sh`
 * im App-Repo (BrewMind/brewmind-core#763) vergleicht beide. Eine Regel hier zu
 * ändern heißt: die Fall-Datei hier und in der App im selben Zug ändern.
 */

export type Spanne = { min: number; max: number };

/** Röstgrad wie im Link (`rg`): genau diese drei Werte, kleingeschrieben. */
export type Roestgrad = 'hell' | 'mittel' | 'dunkel';

/** Die Werte von `rg` in der Reihenfolge von hell nach dunkel (so auch im Formular). */
export const ROESTGRADE: readonly Roestgrad[] = ['hell', 'mittel', 'dunkel'];

export type Rezept = {
  name: string;
  roesterei?: string;
  dosisG?: number;
  ertragG?: Spanne;
  zeitS?: Spanne;
  /** JJJJ-MM-TT */
  roestdatum?: string;
  roestgrad?: Roestgrad;
};

export type ParseErgebnis =
  | { ok: true; rezept: Rezept }
  | { ok: false; grund: 'leer' | 'version' };

/** Mit Slash vor dem `?`, das spart die 301-Weiterleitung von GitHub Pages. */
export const LINK_BASIS = 'https://brewmind.app/r/?';

export const GRENZEN = {
  /** Zeichen, für Name und Rösterei. Das Formular erlaubt weniger (Luft nach oben). */
  textMax: 60,
  dosisMaxG: 50,
  ertragMaxG: 200,
  zeitMaxS: 120,
} as const;

const NBSP = '\u00A0';

/** Steuerzeichen, Zeilen- und Absatztrenner, Bidi-Steuerung (Umlenkung der Leserichtung). */
const STEUERZEICHEN = /[\p{Cc}\u2028\u2029\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

/** Nur Leerraum und Formatzeichen (Zero-Width, weiches Trennzeichen): f\u00FCr das Auge leer. */
const NUR_UNSICHTBAR = /^[\s\p{Cf}]*$/u;

const DEZIMALZAHL = /^\d{1,3}(\.\d)?$/;
const GANZZAHL = /^\d{1,3}$/;

export type Zahlenart = 'dezimal' | 'ganz';

/**
 * Einzelne Surrogathälften (kaputtes UTF-16) raus: encodeURIComponent würde
 * daran werfen. `for...of` liefert ein gültiges Paar als ein Zeichen (Codepoint
 * ab 0x10000) und eine lose Hälfte einzeln (0xD800 bis 0xDFFF). Bewusst keine
 * Regex mit Lookbehind: Safari vor 16.4 wirft schon beim Parsen des Moduls.
 */
function ohneLoseSurrogate(text: string): string {
  let ergebnis = '';
  for (const zeichen of text) {
    const codepoint = zeichen.codePointAt(0) ?? 0;
    if (codepoint < 0xd800 || codepoint > 0xdfff) ergebnis += zeichen;
  }
  return ergebnis;
}

/**
 * Text für n und r: Steuerzeichen und kaputte Zeichen raus, dann getrimmt.
 * Text ohne sichtbares Zeichen zählt als leer.
 */
export function saeubereText(roh: string): string {
  const text = ohneLoseSurrogate(roh.replace(STEUERZEICHEN, '')).trim();
  return NUR_UNSICHTBAR.test(text) ? '' : text;
}

/** Länge in Zeichen (Codepoints), ein Emoji zählt als eins. */
export function textLaenge(text: string): number {
  return Array.from(text).length;
}

/** Eine Zahl: nur Ziffern und höchstens ein Dezimalpunkt, über 0, bis zur Obergrenze. */
export function liesZahl(roh: string, art: Zahlenart, obergrenze: number): number | undefined {
  if (!(art === 'ganz' ? GANZZAHL : DEZIMALZAHL).test(roh)) return undefined;
  const zahl = Number(roh);
  return zahl > 0 && zahl <= obergrenze ? zahl : undefined;
}

/**
 * Eine Zahl oder eine Spanne `36-40`, kleiner Wert zuerst. Gleiche Werte sind
 * erlaubt (ein Einzelwert), jeder andere Fehler macht den ganzen Wert ungültig.
 */
export function liesSpanne(roh: string, art: Zahlenart, obergrenze: number): Spanne | undefined {
  const teile = roh.split('-');
  if (teile.length > 2) return undefined;
  const min = liesZahl(teile[0], art, obergrenze);
  if (min === undefined) return undefined;
  if (teile.length === 1) return { min, max: min };
  const max = liesZahl(teile[1], art, obergrenze);
  if (max === undefined || min > max) return undefined;
  return { min, max };
}

/**
 * Der Röstgrad aus einem `rg`-Wert, `undefined` bei allem anderen. Exakter
 * Vergleich: kein Trim, keine Großschreibung (`Hell`, ` mittel`, `light` fallen weg).
 */
export function liesRoestgrad(roh: string): Roestgrad | undefined {
  return ROESTGRADE.find((grad) => grad === roh);
}

/** JJJJ-MM-TT als Datum (UTC, Mitternacht), `null` bei falschem Format oder 2026-02-30. */
function kalenderdatum(iso: string): Date | null {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!treffer) return null;
  const [jahr, monat, tag] = [Number(treffer[1]), Number(treffer[2]), Number(treffer[3])];
  // setUTCFullYear statt Date.UTC: Letzteres macht aus den Jahren 0 bis 99 ein 19xx
  const datum = new Date(0);
  datum.setUTCFullYear(jahr, monat - 1, tag);
  const echt =
    datum.getUTCFullYear() === jahr && datum.getUTCMonth() === monat - 1 && datum.getUTCDate() === tag;
  return echt ? datum : null;
}

/** Das Datum von `heute` in der Zeitzone des Geräts als JJJJ-MM-TT. */
export function heuteAlsIso(heute: Date): string {
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${String(heute.getFullYear()).padStart(4, '0')}-${zwei(heute.getMonth() + 1)}-${zwei(heute.getDate())}`;
}

/** Heute zählt noch, ab morgen ist es Zukunft. Beide Seiten haben dasselbe feste Format, der Textvergleich reicht. */
export function pruefeRoestdatum(roh: string, heute: Date): 'ok' | 'ungueltig' | 'zukunft' {
  if (kalenderdatum(roh) === null) return 'ungueltig';
  return roh > heuteAlsIso(heute) ? 'zukunft' : 'ok';
}

/** Liest die Query einer geöffneten /r/-Seite. `heute` kommt von außen, damit Tests das Datum festlegen. */
export function parseRezept(params: URLSearchParams, heute: Date): ParseErgebnis {
  const version = params.get('v');
  if (version === null) return { ok: false, grund: 'leer' };
  if (version !== '1') return { ok: false, grund: 'version' };

  const name = saeubereText(params.get('n') ?? '');
  if (name === '' || textLaenge(name) > GRENZEN.textMax) return { ok: false, grund: 'leer' };
  const rezept: Rezept = { name };

  const roesterei = saeubereText(params.get('r') ?? '');
  if (roesterei !== '' && textLaenge(roesterei) <= GRENZEN.textMax) rezept.roesterei = roesterei;

  const dosis = liesZahl(params.get('d') ?? '', 'dezimal', GRENZEN.dosisMaxG);
  if (dosis !== undefined) rezept.dosisG = dosis;

  const ertrag = liesSpanne(params.get('y') ?? '', 'dezimal', GRENZEN.ertragMaxG);
  if (ertrag !== undefined) rezept.ertragG = ertrag;

  const zeit = liesSpanne(params.get('t') ?? '', 'ganz', GRENZEN.zeitMaxS);
  if (zeit !== undefined) rezept.zeitS = zeit;

  const roestdatum = params.get('rd') ?? '';
  if (pruefeRoestdatum(roestdatum, heute) === 'ok') rezept.roestdatum = roestdatum;

  // Bei doppeltem rg gilt der erste Wert (URLSearchParams.get)
  const roestgrad = liesRoestgrad(params.get('rg') ?? '');
  if (roestgrad !== undefined) rezept.roestgrad = roestgrad;

  return { ok: true, rezept };
}

/** Eine Zahl ohne Nachkommanull: 18, 18.5. */
function zahlFuerLink(zahl: number): string {
  return String(Math.round(zahl * 10) / 10);
}

function spanneFuerLink(spanne: Spanne): string {
  return spanne.min === spanne.max
    ? zahlFuerLink(spanne.min)
    : `${zahlFuerLink(spanne.min)}-${zahlFuerLink(spanne.max)}`;
}

/** Baut den Link in der Reihenfolge v, n, r, d, y, t, rd, rg. Ungesetzte Felder fehlen. */
export function baueRezeptLink(rezept: Rezept): string {
  const teile: [string, string][] = [
    ['v', '1'],
    ['n', saeubereText(rezept.name)],
  ];
  const roesterei = saeubereText(rezept.roesterei ?? '');
  if (roesterei !== '') teile.push(['r', roesterei]);
  if (rezept.dosisG !== undefined) teile.push(['d', zahlFuerLink(rezept.dosisG)]);
  if (rezept.ertragG !== undefined) teile.push(['y', spanneFuerLink(rezept.ertragG)]);
  if (rezept.zeitS !== undefined) teile.push(['t', spanneFuerLink(rezept.zeitS)]);
  if (rezept.roestdatum !== undefined) teile.push(['rd', rezept.roestdatum]);
  if (rezept.roestgrad !== undefined) teile.push(['rg', rezept.roestgrad]);
  return LINK_BASIS + teile.map(([schluessel, wert]) => `${schluessel}=${encodeURIComponent(wert)}`).join('&');
}

/** Schema der App (`scheme` in der `app.json` von BrewMind). */
export const APP_LINK_BASIS = 'brewmindcore://r?';

/**
 * Derselbe Link mit dem Schema der App, für den Knopf „In BrewMind öffnen“ auf
 * /r/. Der Code selbst öffnet die App über den https-Link, aber nicht, wenn
 * schon brewmind.app im Browser offen ist (etwa direkt nach der Installation)
 * oder ein In-App-Browser den Link abfängt. Gebaut aus dem geprüften Rezept,
 * damit nur Bekanntes in die App geht.
 */
export function baueAppLink(rezept: Rezept): string {
  return APP_LINK_BASIS + baueRezeptLink(rezept).slice(LINK_BASIS.length);
}

// Anzeige auf /r/

/** Deutsche Zahl mit Komma: 18,5. */
export function formatZahl(zahl: number): string {
  return String(zahl).replace('.', ',');
}

/** Zahl und Einheit, getrennt durch ein geschütztes Leerzeichen: 18,5 g. */
export function formatMitEinheit(zahl: number, einheit: string): string {
  return `${formatZahl(zahl)}${NBSP}${einheit}`;
}

/** So formuliert es die App: 28 bis 32 s. Ein Einzelwert (min gleich max) steht ohne "bis". */
export function formatSpanne(spanne: Spanne, einheit: string): string {
  if (spanne.min === spanne.max) return formatMitEinheit(spanne.min, einheit);
  return `${formatZahl(spanne.min)} bis ${formatMitEinheit(spanne.max, einheit)}`;
}

/**
 * Startwert einer Zeitspanne: die Mitte, auf ganze Sekunden gerundet, genau wie
 * die App sie beim Übernehmen eines Rezepts nimmt (Math.round, .5 rundet auf).
 */
export function startzeitS(spanne: Spanne): number {
  return Math.round((spanne.min + spanne.max) / 2);
}

/**
 * Startwert einer Ertragsspanne: die Mitte auf eine Nachkommastelle, wie die
 * App sie übernimmt, halbe Zehntel runden auf. Gerechnet in ganzen Zehnteln:
 * in Gleitkomma liegt etwa 4,7 mal 5 knapp unter 23,5 und rundete ab.
 */
export function startertragG(spanne: Spanne): number {
  const zehntel = Math.round(spanne.min * 10) + Math.round(spanne.max * 10);
  return Math.round(zehntel / 2) / 10;
}

const ROESTGRAD_ANZEIGE: Record<Roestgrad, string> = { hell: 'Hell', mittel: 'Mittel', dunkel: 'Dunkel' };

/** hell wird Hell, mittel wird Mittel, dunkel wird Dunkel. Für die Kachel auf /r/ und die Auswahl auf /qr/. */
export function formatRoestgrad(roestgrad: Roestgrad): string {
  return ROESTGRAD_ANZEIGE[roestgrad];
}

const DATUMSFORMAT = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** 2026-10-12 wird 12. Oktober 2026. Erwartet ein geprüftes Datum. */
export function formatDatum(iso: string): string {
  return DATUMSFORMAT.format(new Date(`${iso}T00:00:00Z`));
}

// Eingabeprüfung für das Formular auf /qr/

/** Rohtext aus den Feldern des Formulars, genau wie getippt. */
export type FormularEingabe = {
  name: string;
  roesterei: string;
  dosis: string;
  ertragVon: string;
  ertragBis: string;
  zeitVon: string;
  zeitBis: string;
  roestdatum: string;
  /** Wert der Auswahl: leer (keine Angabe), `hell`, `mittel` oder `dunkel`. */
  roestgrad: string;
};

export type FormularFeld = keyof FormularEingabe;

export type FormularErgebnis = {
  /** `null`, solange irgendein Feld nicht stimmt. */
  rezept: Rezept | null;
  /** Je Feld höchstens eine Meldung, in der Reihenfolge des Formulars. */
  fehler: Partial<Record<FormularFeld, string>>;
};

/** Im Formular zählt Komma wie Punkt, im Link steht immer der Punkt. */
function mitPunkt(roh: string): string {
  return roh.trim().replace(',', '.');
}

/** Meldung für eine ungültige Zahl, z. B. "Die Dosis muss eine Zahl von 0,1 bis 50 sein (höchstens eine Nachkommastelle)." */
function zahlFehler(subjekt: string, art: Zahlenart, obergrenze: number): string {
  return art === 'ganz'
    ? `${subjekt} muss eine ganze Zahl von 1 bis ${obergrenze} sein.`
    : `${subjekt} muss eine Zahl von 0,1 bis ${formatZahl(obergrenze)} sein (höchstens eine Nachkommastelle).`;
}

export function pruefeFormular(eingabe: FormularEingabe, heute: Date): FormularErgebnis {
  const fehler: FormularErgebnis['fehler'] = {};
  const rezept: Rezept = { name: '' };

  const name = saeubereText(eingabe.name);
  if (name === '') fehler.name = 'Der Name der Bohne fehlt.';
  else if (textLaenge(name) > GRENZEN.textMax) {
    fehler.name = `Der Name der Bohne ist zu lang (höchstens ${GRENZEN.textMax} Zeichen).`;
  } else rezept.name = name;

  const roesterei = saeubereText(eingabe.roesterei);
  if (textLaenge(roesterei) > GRENZEN.textMax) {
    fehler.roesterei = `Der Name der Rösterei ist zu lang (höchstens ${GRENZEN.textMax} Zeichen).`;
  } else if (roesterei !== '') rezept.roesterei = roesterei;

  const dosisRoh = mitPunkt(eingabe.dosis);
  if (dosisRoh !== '') {
    const dosis = liesZahl(dosisRoh, 'dezimal', GRENZEN.dosisMaxG);
    if (dosis === undefined) {
      fehler.dosis = zahlFehler('Die Dosis', 'dezimal', GRENZEN.dosisMaxG);
    } else rezept.dosisG = dosis;
  }

  const ertrag = pruefeBereich(
    { von: eingabe.ertragVon, bis: eingabe.ertragBis },
    { art: 'dezimal', obergrenze: GRENZEN.ertragMaxG, feldname: 'Der Ertrag', feldVon: 'ertragVon', feldBis: 'ertragBis' },
    fehler,
  );
  if (ertrag) rezept.ertragG = ertrag;

  const zeit = pruefeBereich(
    { von: eingabe.zeitVon, bis: eingabe.zeitBis },
    { art: 'ganz', obergrenze: GRENZEN.zeitMaxS, feldname: 'Die Zeit', feldVon: 'zeitVon', feldBis: 'zeitBis' },
    fehler,
  );
  if (zeit) rezept.zeitS = zeit;

  const datum = eingabe.roestdatum.trim();
  if (datum !== '') {
    const urteil = pruefeRoestdatum(datum, heute);
    if (urteil === 'ungueltig') fehler.roestdatum = 'Das Röstdatum ist kein gültiges Datum.';
    else if (urteil === 'zukunft') fehler.roestdatum = 'Das Röstdatum liegt in der Zukunft.';
    else rezept.roestdatum = datum;
  }

  // Auswahlfeld, kein Freitext: genau wie im Link, ohne Trim und ohne Umdeuten
  if (eingabe.roestgrad !== '') {
    const roestgrad = liesRoestgrad(eingabe.roestgrad);
    if (roestgrad === undefined) fehler.roestgrad = 'Der Röstgrad muss Hell, Mittel oder Dunkel sein.';
    else rezept.roestgrad = roestgrad;
  }

  return { rezept: Object.keys(fehler).length === 0 ? rezept : null, fehler };
}

/**
 * Zwei Felder "von" und "bis" zu einer Spanne. "bis" allein und von > bis sind
 * Fehler am Feld, nichts wird still vertauscht. Gleiche Werte ergeben einen
 * Einzelwert.
 */
function pruefeBereich(
  roh: { von: string; bis: string },
  regel: {
    art: Zahlenart;
    obergrenze: number;
    feldname: string;
    feldVon: FormularFeld;
    feldBis: FormularFeld;
  },
  fehler: FormularErgebnis['fehler'],
): Spanne | undefined {
  const vonRoh = mitPunkt(roh.von);
  const bisRoh = mitPunkt(roh.bis);
  if (vonRoh === '' && bisRoh === '') return undefined;

  if (vonRoh === '') {
    fehler[regel.feldBis] = `${regel.feldname}: „von“ fehlt, „bis“ gibt es nur mit „von“.`;
    return undefined;
  }
  const von = liesZahl(vonRoh, regel.art, regel.obergrenze);
  if (von === undefined) fehler[regel.feldVon] = zahlFehler(`${regel.feldname} (von)`, regel.art, regel.obergrenze);
  if (bisRoh === '') return von === undefined ? undefined : { min: von, max: von };

  const bis = liesZahl(bisRoh, regel.art, regel.obergrenze);
  if (bis === undefined) fehler[regel.feldBis] = zahlFehler(`${regel.feldname} (bis)`, regel.art, regel.obergrenze);
  if (von === undefined || bis === undefined) return undefined;
  if (von > bis) {
    fehler[regel.feldBis] = `${regel.feldname}: „bis“ darf nicht kleiner sein als „von“.`;
    return undefined;
  }
  return { min: von, max: bis };
}
