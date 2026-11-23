import { describe, expect, it } from 'vitest';
import { baueAppLink, CODE_ALPHABET, CODE_LAENGE, formatCode, liesCode } from './einladung-link';

describe('liesCode', () => {
  it('liest den Code aus dem Fragment', () => {
    expect(liesCode('#BREW4K7Q')).toBe('BREW4K7Q');
  });

  it.each([
    ['ohne Raute', 'BREW4K7Q'],
    ['klein geschrieben', '#brew4k7q'],
    ['mit Leerzeichen', '#BREW 4K7Q'],
    ['mit kodiertem Leerzeichen', '#BREW%204K7Q'],
    ['mit Bindestrich', '#BREW-4K7Q'],
    ['mit geschütztem Leerzeichen', '#BREW 4K7Q'],
    ['mit Rand', '# BREW4K7Q '],
  ])('verzeiht %s', (_name, fragment) => {
    expect(liesCode(fragment)).toBe('BREW4K7Q');
  });

  it.each([
    ['leer', ''],
    ['nur Raute', '#'],
    ['zu kurz', '#BREW4K7'],
    ['zu lang', '#BREW4K7QX'],
    ['mit O', '#BROW4K7Q'],
    ['mit I', '#BRIW4K7Q'],
    ['mit Umlaut', '#BRÄW4K7Q'],
    ['mit Markup', '#<b>4K7Q'],
    ['kaputte Kodierung', '#BREW%4K7Q'],
    ['mit Query dahinter', '#BREW4K7Q?x=1'],
  ])('lehnt ab: %s', (_name, fragment) => {
    expect(liesCode(fragment)).toBeUndefined();
  });

  it('nimmt jedes Zeichen des Alphabets an', () => {
    for (const zeichen of CODE_ALPHABET) {
      expect(liesCode(`#${zeichen.repeat(CODE_LAENGE)}`)).toBe(zeichen.repeat(CODE_LAENGE));
    }
  });

  it('Alphabet: 34 Zeichen, ohne O und I', () => {
    expect(CODE_ALPHABET).toHaveLength(34);
    expect(CODE_ALPHABET).not.toMatch(/[OI]/);
    expect(new Set(CODE_ALPHABET).size).toBe(34);
  });
});

describe('formatCode', () => {
  it('zeigt zwei Vierergruppen mit geschütztem Leerzeichen', () => {
    expect(formatCode('BREW4K7Q')).toBe('BREW 4K7Q');
  });
});

describe('baueAppLink', () => {
  it('setzt den Code hinter das Schema der App', () => {
    expect(baueAppLink('BREW4K7Q')).toBe('brewmindcore://e#BREW4K7Q');
  });
});
