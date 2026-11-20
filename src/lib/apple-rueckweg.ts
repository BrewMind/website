/**
 * Rückweg von „Mit Apple anmelden“ auf Android (BrewMind/brewmind-core#1020).
 *
 * Die Android-App öffnet Apples Anmeldung im Browser. Apple leitet danach auf
 * https://brewmind.app/auth/apple#state=…&id_token=…&code=… (bei Abbruch oder
 * Fehler #state=…&error=…). Die Seite /auth/apple/ reicht das Ergebnis an die
 * App weiter, mehr nicht. Hier steht die Regel dafür, als reine Funktion ohne
 * DOM, damit vitest sie ohne Browser prüft.
 *
 * Regeln:
 *   - Das Ziel ist eine von zwei festen Adressen, gewählt nur über den Anfang
 *     von `state` (dev. oder prod.). Nichts aus der Anfrage bestimmt Schema,
 *     Host oder Pfad.
 *   - Weitergegeben werden `state` und entweder `id_token` oder `error`.
 *     Neben einem `id_token` geht auch Apples `code` mit
 *     (BrewMind/brewmind-core#1014): Mit ihm trennt die App beim „Konto
 *     löschen“ die Verbindung zu Apple. Alles andere fällt weg.
 *   - `state`, `id_token` und `error` müssen ihr Format erfüllen, sonst geht
 *     nichts an die App. Ein `code` im falschen Format fällt allein weg: Die
 *     Anmeldung braucht ihn nicht und soll an ihm nicht scheitern.
 *   - Fehlen `id_token` und `error`, geht `error=leer` an die App.
 *   - Stehen beide da, gewinnt `error`: ein Fehler wird nie als Erfolg gemeldet.
 *
 * Die Sicherheit hängt nicht an dieser Seite: Die App prüft `state` und den
 * Nonce im Token selbst. Die Formatprüfung hält nur fremde Inhalte aus dem
 * App-Link heraus.
 *
 * Grenze der Seite: `history.replaceState` nimmt das Fragment nur aus der
 * Adresszeile und dem Verlauf des Tabs. Im Browserverlauf (und bei Sync im
 * Konto des Browsers) bleibt der Aufruf mit Fragment stehen. Das lässt sich
 * bei `response_mode=fragment` von hier aus nicht verhindern.
 *
 * Diese Datei wird als Text in die Seite eingebettet (siehe
 * `src/pages/auth/apple.astro`), deshalb ohne Importe bleiben.
 */

/** Feste Ziele in der App, je Variante eins. Route dort: `konto/apple-rueckweg`. */
export const RUECKWEG_ZIELE = {
  dev: 'brewmindcoredev://konto/apple-rueckweg',
  prod: 'brewmindcore://konto/apple-rueckweg',
} as const;

/** Was an die App geht, wenn Apple weder Token noch Fehler mitgibt. */
export const FEHLER_LEER = 'leer';

const STATE = /^(dev|prod)\.[A-Za-z0-9_-]{8,128}$/;
/** Drei Base64url-Teile mit Punkten (Kopf, Inhalt, Signatur eines JWT). */
const ID_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
/** Ein Token von Apple hat rund 1000 Zeichen. Die Grenze hält den App-Link kurz genug für jeden Browser. */
const ID_TOKEN_MAX = 4096;
const ERROR = /^[a-z_]{1,40}$/;
/** Apples Authorization Code: Buchstaben, Ziffern, Punkt, Binde- und Unterstrich; in der Praxis unter 100 Zeichen. */
const CODE = /^[A-Za-z0-9._-]{1,512}$/;

export type Rueckweg =
  | { art: 'weiter'; ziel: string }
  /** Kein gültiger Aufruf: nichts weiterleiten, nur den Hinweis zeigen. */
  | { art: 'hinweis' };

/**
 * Liest das Fragment der Adresse (`location.hash`, mit oder ohne `#`) und sagt,
 * wohin es weitergeht. Bei doppelten Parametern gilt der erste.
 */
export function leseRueckweg(fragment: string): Rueckweg {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));

  const state = params.get('state');
  if (state === null || !STATE.test(state)) return { art: 'hinweis' };
  const basis = state.startsWith('dev.') ? RUECKWEG_ZIELE.dev : RUECKWEG_ZIELE.prod;

  const idToken = params.get('id_token');
  const error = params.get('error');
  if (error !== null && !ERROR.test(error)) return { art: 'hinweis' };
  if (idToken !== null && (idToken.length > ID_TOKEN_MAX || !ID_TOKEN.test(idToken))) {
    return { art: 'hinweis' };
  }

  const code = params.get('code');
  const mitCode = code !== null && CODE.test(code) ? `&code=${encodeURIComponent(code)}` : '';

  const ergebnis =
    error !== null
      ? `error=${encodeURIComponent(error)}`
      : idToken !== null
        ? `id_token=${encodeURIComponent(idToken)}${mitCode}`
        : `error=${FEHLER_LEER}`;

  return { art: 'weiter', ziel: `${basis}?state=${encodeURIComponent(state)}&${ergebnis}` };
}

/** Was der Ablauf vom Browser braucht. Die Seite reicht `location` und `history` herein, Tests reichen Attrappen. */
export type RueckwegUmgebung = {
  location: { readonly hash: string; readonly pathname: string; replace(ziel: string): void };
  history: { replaceState(daten: unknown, titel: string, adresse: string): void };
  /** Zeigt „Zurück zu BrewMind“. `oeffne` schickt denselben Link noch einmal an die App. */
  zeigeWeiter(oeffne: () => void): void;
  zeigeHinweis(): void;
};

/**
 * Der Ablauf der Seite, in dieser Reihenfolge: Fragment lesen, Fragment aus
 * Adresszeile und Tab-Verlauf nehmen, dann erst zur App. Das Ziel bleibt in
 * dieser Funktion (und im Knopf als Closure), es steht nie im DOM.
 */
export function starteRueckweg(umgebung: RueckwegUmgebung): void {
  const ergebnis = leseRueckweg(umgebung.location.hash);
  umgebung.history.replaceState(null, '', umgebung.location.pathname);
  if (ergebnis.art === 'hinweis') {
    umgebung.zeigeHinweis();
    return;
  }
  const ziel = ergebnis.ziel;
  umgebung.zeigeWeiter(() => umgebung.location.replace(ziel));
  umgebung.location.replace(ziel);
}
