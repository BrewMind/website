import { describe, expect, it } from 'vitest';
import { leseRueckweg, RUECKWEG_ZIELE } from './apple-rueckweg';

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

  it('das Ziel beginnt immer mit einer der zwei festen Adressen', () => {
    for (const state of [STATE_DEV, STATE_PROD]) {
      const link = ziel(`#state=${state}&id_token=${TOKEN}`);
      expect([`${RUECKWEG_ZIELE.dev}?`, `${RUECKWEG_ZIELE.prod}?`].some((basis) => link.startsWith(basis))).toBe(true);
    }
  });
});

describe('leseRueckweg: nur Hinweis', () => {
  const faelle: [string, string][] = [
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

  it.each(faelle)('%s', (_name, fragment) => {
    expect(leseRueckweg(fragment)).toEqual(HINWEIS);
  });
});
