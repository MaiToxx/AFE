import { getLang, type Lang } from '../i18n';
import at from './presets/at';
import be from './presets/be';
import ca from './presets/ca';
import ch from './presets/ch';
import de from './presets/de';
import es from './presets/es';
import fr from './presets/fr';
import gb from './presets/gb';
import ie from './presets/ie';
import it from './presets/it';
import lu from './presets/lu';
import ma from './presets/ma';
import nl from './presets/nl';
import pt from './presets/pt';
import us from './presets/us';
import xx from './presets/xx';
import type { LText, Regime } from './types';

export const REGIMES: Regime[] = [fr, be, ch, lu, de, at, nl, es, it, pt, ie, gb, ca, us, ma, xx];

export function getRegime(code: string): Regime {
  return REGIMES.find((r) => r.code === code) ?? fr;
}

/** Texte localisé : langue demandée, puis anglais, puis français. */
export function L(text: LText | undefined, lang: Lang = getLang()): string {
  if (!text) return '';
  return text[lang] ?? text.en ?? text.fr;
}

// Seules des locales aux conventions cohérentes sont utilisées : les variantes « en-BE », « en-FR »…
// de l'ICU mélangent séparateurs décimaux européens et format monétaire américain. L'anglais hors
// Amérique du Nord est donc formaté comme en-GB (20.5, €3,600.00, 20/04/2026).
const LOCALES: Record<string, string[]> = {
  FR: ['fr-FR', 'en-GB'],
  BE: ['fr-BE', 'nl-BE', 'de-BE', 'en-GB'],
  CH: ['fr-CH', 'de-CH', 'it-CH', 'en-GB'],
  LU: ['fr-LU', 'de-LU', 'en-GB'],
  DE: ['de-DE', 'en-GB'],
  AT: ['de-AT', 'en-GB'],
  NL: ['nl-NL', 'en-GB'],
  ES: ['es-ES', 'en-GB'],
  IT: ['it-IT', 'en-GB'],
  PT: ['pt-PT', 'en-GB'],
  IE: ['en-IE'],
  GB: ['en-GB'],
  CA: ['fr-CA', 'en-CA'],
  US: ['en-US', 'es-US'],
  MA: ['fr-MA', 'en-GB'],
};

/** Locale de formatage : langue de l'interface + pays d'imposition (fr-BE, de-CH, en-US…). */
export function localeFor(lang: Lang, pays: string): string {
  const list = LOCALES[pays];
  if (list) {
    const exact = list.find((l) => l.startsWith(`${lang}-`));
    if (exact) return exact;
  }
  return lang;
}

export const DEVISES = ['EUR', 'CHF', 'GBP', 'USD', 'CAD', 'MAD', 'XOF', 'XAF', 'TND', 'DZD', 'PLN', 'SEK', 'NOK', 'DKK', 'CZK', 'JPY', 'AUD', 'NZD', 'BRL', 'MXN'];
