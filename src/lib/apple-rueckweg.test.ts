import { describe, expect, it } from 'vitest';
import { leseRueckweg, RUECKWEG_ZIELE, starteRueckweg } from './apple-rueckweg';

const STATE_DEV = 'dev.Zx3kQ9_abc-12345';
const STATE_PROD = 'prod.Zx3kQ9_abc-12345';
const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIwMDEyMzQifQ.c2lnbmF0dXJfLTEyMw';
const HINWEIS = { art: 'hinweis' };

function ziel(fragment: string): string {
  const ergebnis = leseRueckweg(fragment);
  if (ergebnis.art !== 'weiter') throw new Error(`kein Ziel für ${fragment}`);
  return ergebnis.ziel;
}

describe('leseRueckweg: Ziel', () => {
  it('dev-state geht an die Dev-App, mit state und id_token', () => {
    expect(ziel(`#state=${STATE_DEV}&id_token=${TOKEN}`)).toBe(
      `brewmindcoredev://konto/apple-rueckweg?state=${STATE_DEV}&id_token=${TOKEN}`,
    );
  });

  it('prod-state geht an die Prod-App', () => {
    expect(ziel(`#state=${STATE_PROD}&id_token=${TOKEN}`)).toBe(
      `brewmindcore://konto/apple-rueckweg?state=${STATE_PROD}&id_token=${TOKEN}`,
    );
  });

  it('code und unbekannte Parameter fallen weg', () => {
    const link = ziel(`#state=${STATE_PROD}&code=c1234.0.abcd&id_token=${TOKEN}&user=%7B%7D&x=1`);
    expect(link).toBe(`${RUECKWEG_ZIELE.prod}?state=${STATE_PROD}&id_token=${TOKEN}`);
  });

  it('die Reihenfolge im Fragment ist egal, das # auch', () => {
    expect(ziel(`id_token=${TOKEN}&state=${STATE_DEV}`)).toBe(
      `${RUECKWEG_ZIELE.dev}?state=${STATE_DEV}&id_token=${TOKEN}`,
    );
  });

  it('error geht statt id_token weiter', () => {
    expect(ziel(`#state=${STATE_PROD}&error=user_cancelled_authorize`)).toBe(
      `${RUECKWEG_ZIELE.prod}?state=${STATE_PROD}&error=user_cancelled_authorize`,
    );
  });

  it('error gewinnt, wenn auch ein id_token da ist', () => {
    expect(ziel(`#state=${STATE_DEV}&id_token=${TOKEN}&error=invalid_request`)).toBe(
      `${RUECKWEG_ZIELE.dev}?state=${STATE_DEV}&error=invalid_request`,
    );
  });

  it('ohne id_token und error geht error=leer weiter', () => {
    expect(ziel(`#state=${STATE_DEV}`)).toBe(`${RUECKWEG_ZIELE.dev}?state=${STATE_DEV}&error=leer`);
    expect(ziel(`#state=${STATE_PROD}&code=abc`)).toBe(`${RUECKWEG_ZIELE.prod}?state=${STATE_PROD}&error=leer`);
  });

  it('bei doppeltem Parameter gilt der erste', () => {
    expect(ziel(`#state=${STATE_DEV}&state=${STATE_PROD}&id_token=${TOKEN}`)).toBe(
      `${RUECKWEG_ZIELE.dev}?state=${STATE_DEV}&id_token=${TOKEN}`,
    );
  });
});

const HINWEIS_FAELLE: [string, string][] = [
    ['leeres Fragment', ''],
    ['nur #', '#'],
    ['state fehlt', `#id_token=${TOKEN}`],
    ['state ohne Variante', `#state=Zx3kQ9_abc-12345&id_token=${TOKEN}`],
    ['unbekannte Variante', `#state=staging.Zx3kQ9_abc-12345&id_token=${TOKEN}`],
    ['Variante groß geschrieben', `#state=PROD.Zx3kQ9_abc-12345&id_token=${TOKEN}`],
    ['Zufallsteil zu kurz', `#state=dev.abc&id_token=${TOKEN}`],
    ['Zufallsteil zu lang', `#state=dev.${'a'.repeat(129)}&id_token=${TOKEN}`],
    ['fremdes Schema im state', `#state=${encodeURIComponent('evil://x/?a=dev.aaaaaaaaaaaa')}&id_token=${TOKEN}`],
    ['Adresse hinter gültigem Anfang', `#state=${encodeURIComponent('dev.aaaaaaaa://evil.example/')}&id_token=${TOKEN}`],
    ['Query-Zeichen im state', `#state=${encodeURIComponent('prod.aaaaaaaa&x=1')}&id_token=${TOKEN}`],
    ['Leerzeichen im state', `#state=dev.aaaa+aaaa&id_token=${TOKEN}`],
    ['Zeilenumbruch im state', `#state=dev.aaaaaaaa%0Aprod.bbbbbbbb&id_token=${TOKEN}`],
    ['id_token mit zwei Teilen', `#state=${STATE_DEV}&id_token=abc.def`],
    ['id_token mit vier Teilen', `#state=${STATE_DEV}&id_token=a.b.c.d`],
    ['id_token mit leerem Teil', `#state=${STATE_DEV}&id_token=abc..def`],
    ['id_token leer', `#state=${STATE_DEV}&id_token=`],
    ['id_token mit fremden Zeichen', `#state=${STATE_DEV}&id_token=${encodeURIComponent('a.b.c&next=https://evil.example')}`],
    ['id_token mit Base64-Zeichen statt Base64url', `#state=${STATE_DEV}&id_token=ab%2Bc.de%2Ff.gh%3D`],
    ['id_token zu lang', `#state=${STATE_DEV}&id_token=${'a'.repeat(4095)}.b.c`],
    ['error mit Großbuchstaben', `#state=${STATE_DEV}&error=Invalid`],
    ['error mit fremden Zeichen', `#state=${STATE_DEV}&error=${encodeURIComponent('<script>')}`],
    ['error zu lang', `#state=${STATE_DEV}&error=${'a'.repeat(41)}`],
    ['error leer', `#state=${STATE_DEV}&error=`],
    ['gültiges Token, kaputter error', `#state=${STATE_DEV}&id_token=${TOKEN}&error=A`],
    ['gültiger error, kaputtes Token', `#state=${STATE_DEV}&id_token=x&error=access_denied`],
];

describe('leseRueckweg: nur Hinweis', () => {
  it.each(HINWEIS_FAELLE)('%s', (_name, fragment) => {
    expect(leseRueckweg(fragment)).toEqual(HINWEIS);
  });
});

describe('leseRueckweg: Kanten', () => {
  const mitZufall = (laenge: number) => `#state=dev.${'a'.repeat(laenge)}&id_token=${TOKEN}`;
  /** Ein Token mit genau `laenge` Zeichen, die zwei Punkte eingerechnet. */
  const tokenMitLaenge = (laenge: number) => `${'a'.repeat(laenge - 4)}.b.c`;

  it('Zufallsteil: 7 Zeichen sind zu wenig, 8 reichen', () => {
    expect(leseRueckweg(mitZufall(7))).toEqual(HINWEIS);
    expect(leseRueckweg(mitZufall(8)).art).toBe('weiter');
  });

  it('Zufallsteil: 128 Zeichen gehen noch, 129 nicht mehr', () => {
    expect(leseRueckweg(mitZufall(128)).art).toBe('weiter');
    expect(leseRueckweg(mitZufall(129))).toEqual(HINWEIS);
  });

  it('id_token: 4096 Zeichen gehen noch, 4097 nicht mehr', () => {
    expect(tokenMitLaenge(4096)).toHaveLength(4096);
    expect(leseRueckweg(`#state=${STATE_DEV}&id_token=${tokenMitLaenge(4096)}`).art).toBe('weiter');
    expect(leseRueckweg(`#state=${STATE_DEV}&id_token=${tokenMitLaenge(4097)}`)).toEqual(HINWEIS);
  });

  it('error: 40 Zeichen gehen noch, 41 nicht mehr', () => {
    expect(leseRueckweg(`#state=${STATE_DEV}&error=${'a'.repeat(40)}`).art).toBe('weiter');
    expect(leseRueckweg(`#state=${STATE_DEV}&error=${'a'.repeat(41)}`)).toEqual(HINWEIS);
  });
});

describe('leseRueckweg: Hinweis oder feste Basis, nichts Drittes', () => {
  const gueltig: [string, string][] = [
    ['dev mit Token', `#state=${STATE_DEV}&id_token=${TOKEN}`],
    ['prod mit Token', `#state=${STATE_PROD}&id_token=${TOKEN}`],
    ['prod mit error', `#state=${STATE_PROD}&error=access_denied`],
    ['dev ohne beides', `#state=${STATE_DEV}`],
    ['Token und error', `#state=${STATE_DEV}&id_token=${TOKEN}&error=invalid_request`],
    ['mit code und Fremdem', `#state=${STATE_PROD}&code=x&id_token=${TOKEN}&next=${encodeURIComponent('https://evil.example')}`],
  ];
  const basen = [`${RUECKWEG_ZIELE.dev}?state=dev.`, `${RUECKWEG_ZIELE.prod}?state=prod.`];

  it.each([...gueltig, ...HINWEIS_FAELLE])('%s', (_name, fragment) => {
    const ergebnis = leseRueckweg(fragment);
    if (ergebnis.art === 'weiter') {
      expect(basen.some((basis) => ergebnis.ziel.startsWith(basis))).toBe(true);
      // Hinter der festen Basis nur noch die geprüften Zeichen, also kein zweites Schema und kein dritter Parameter
      expect(ergebnis.ziel).toMatch(/^brewmindcore(dev)?:\/\/konto\/apple-rueckweg\?state=[A-Za-z0-9._-]+&(id_token|error)=[A-Za-z0-9._-]+$/);
    } else {
      expect(ergebnis).toEqual(HINWEIS);
    }
  });

  it('die gültigen Fälle leiten wirklich weiter', () => {
    for (const [, fragment] of gueltig) expect(leseRueckweg(fragment).art).toBe('weiter');
  });
});

describe('starteRueckweg', () => {
  /** Attrappe für Browser und Seite. Schreibt mit, was in welcher Reihenfolge passiert. */
  function attrappe(hash: string) {
    const protokoll: string[] = [];
    let aktuellerHash = hash;
    let oeffne: (() => void) | undefined;
    const umgebung = {
      location: {
        get hash() {
          protokoll.push('hash gelesen');
          return aktuellerHash;
        },
        pathname: '/auth/apple/',
        replace: (ziel: string) => void protokoll.push(`replace ${ziel}`),
      },
      history: {
        replaceState: (daten: unknown, titel: string, adresse: string) => {
          aktuellerHash = '';
          protokoll.push(`replaceState ${JSON.stringify([daten, titel, adresse])}`);
        },
      },
      zeigeWeiter: (rueckruf: () => void) => {
        oeffne = rueckruf;
        protokoll.push('zeigeWeiter');
      },
      zeigeHinweis: () => void protokoll.push('zeigeHinweis'),
    };
    return { umgebung, protokoll, klick: () => oeffne?.() };
  }

  const fragment = `#state=${STATE_PROD}&code=c1&id_token=${TOKEN}`;
  const erwartetesZiel = `${RUECKWEG_ZIELE.prod}?state=${STATE_PROD}&id_token=${TOKEN}`;
  const adresseBereinigt = 'replaceState [null,"","/auth/apple/"]';

  it('liest das Fragment, entfernt es, zeigt den Knopf und geht dann erst zur App', () => {
    const { umgebung, protokoll } = attrappe(fragment);
    starteRueckweg(umgebung);
    expect(protokoll).toEqual(['hash gelesen', adresseBereinigt, 'zeigeWeiter', `replace ${erwartetesZiel}`]);
  });

  it('die neue Adresse ist nur der Pfad, ohne Fragment und ohne Query', () => {
    const { umgebung, protokoll } = attrappe(fragment);
    starteRueckweg(umgebung);
    const eintrag = protokoll.find((zeile) => zeile.startsWith('replaceState')) ?? '';
    expect(eintrag).toBe(adresseBereinigt);
    expect(eintrag).not.toContain(TOKEN);
  });

  it('der Knopf schickt genau denselben Link noch einmal', () => {
    const { umgebung, protokoll, klick } = attrappe(fragment);
    starteRueckweg(umgebung);
    klick();
    klick();
    expect(protokoll.filter((zeile) => zeile.startsWith('replace '))).toEqual(
      Array(3).fill(`replace ${erwartetesZiel}`),
    );
    // Das Fragment wird dafür nicht noch einmal gelesen
    expect(protokoll.filter((zeile) => zeile === 'hash gelesen')).toHaveLength(1);
  });

  it('im Hinweis-Fall: Fragment trotzdem entfernen, kein replace, kein Knopf', () => {
    for (const hash of ['', `#state=prod.abc&id_token=${TOKEN}`, `#state=${STATE_DEV}&id_token=abc.def`]) {
      const { umgebung, protokoll } = attrappe(hash);
      starteRueckweg(umgebung);
      expect(protokoll).toEqual(['hash gelesen', adresseBereinigt, 'zeigeHinweis']);
    }
  });
});
