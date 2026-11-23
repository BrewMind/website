/**
 * Einladungslink von BrewMind: https://brewmind.app/e#BREW4K7Q
 *
 * Der Code steht im Fragment der Adresse (hinter #). Ein Fragment schickt der
 * Browser nie an den Server, die Seite /e/ liest es nur im Browser. Der Code
 * wirkt 48 Stunden wie ein Passwort für einen Haushalt, deshalb steht er
 * nirgends sonst: nicht in einer Query, nicht in einem Protokoll.
 *
 * Alphabet und Länge legt das App-Repo fest
 * (`apps/mobile/src/backend/einladung-regel.ts` in BrewMind/brewmind-core,
 * Issue #1192): 8 Zeichen, Großbuchstaben ohne O und I, dazu Ziffern. Wer die
 * Regel dort ändert, zieht sie hier nach.
 */

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
export const CODE_LAENGE = 8;

/** Schema der App (`scheme` in der `app.json` von BrewMind), wie in `rezept-link.ts`. */
export const APP_LINK_BASIS = 'brewmindcore://e#';

const TRENNER = /[\s -]/g;

/**
 * Liest den Code aus dem Fragment (`location.hash`). Verzeiht Kleinbuchstaben,
 * Leerzeichen und Bindestriche, weil Messenger Links umbrechen und Menschen
 * Codes abtippen. Alles andere ergibt `undefined`: die Seite zeigt dann
 * nichts aus der Adresse an.
 */
export function liesCode(fragment: string): string | undefined {
  let roh = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  try {
    roh = decodeURIComponent(roh);
  } catch {
    return undefined;
  }
  const code = roh.replace(TRENNER, '').toUpperCase();
  if (code.length !== CODE_LAENGE) return undefined;
  for (const zeichen of code) {
    if (!CODE_ALPHABET.includes(zeichen)) return undefined;
  }
  return code;
}

/** Zwei Vierergruppen, wie die App den Code zeigt: „BREW 4K7Q“. */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

/**
 * Derselbe Link mit dem Schema der App, für den Knopf „In BrewMind öffnen“.
 * Der https-Link öffnet die App nicht, wenn brewmind.app schon im Browser
 * offen ist oder ein In-App-Browser ihn abfängt. Gebaut aus dem geprüften
 * Code, damit nur Bekanntes in die App geht.
 */
export function baueAppLink(code: string): string {
  return APP_LINK_BASIS + code;
}
