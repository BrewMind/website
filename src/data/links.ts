/**
 * Der TestFlight-Link der Website. Jeder Kanal hat einen eigenen Link, damit
 * App Store Connect zählen kann, woher die Tester kommen; dieser hier gehört
 * der Website und darf nirgends sonst auftauchen. Liste aller Links:
 * brewmind-core/socials/beta-links.md
 *
 * Ein Ort für alle Stellen, die ihn zeigen (Hero, Header, Beta-Abschnitt),
 * damit ein Linkwechsel nicht eine davon vergisst.
 */
export const TESTFLIGHT_URL = 'https://testflight.apple.com/join/9VptC31s';

/**
 * Android laeuft als geschlossener Test in Google Play. Zugelassen ist, wer
 * der Google-Gruppe beitritt (Beitritt offen fuer alle); erst danach zeigt der
 * Teilnahme-Link die Seite "Tester werden", sonst kommt dort ein 404.
 */
export const ANDROID_GROUP_URL = 'https://groups.google.com/g/brewmind-beta';
export const ANDROID_TESTING_URL = 'https://play.google.com/apps/testing/app.brewmind.core';
