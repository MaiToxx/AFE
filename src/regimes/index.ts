import { getLang, type Lang } from '../i18n';
import at from './presets/at';
import be from './presets/be';
import ca from './presets/ca';
import ch from './presets/ch';
import de from './presets/de';
import es from './presets/es';
import fr from './presets/fr';
import frEi from './presets/fr-ei';
import frEurl from './presets/fr-eurl';
import frSasu from './presets/fr-sasu';
import gb from './presets/gb';
import ie from './presets/ie';
import it from './presets/it';
import lu from './presets/lu';
import ma from './presets/ma';
import nl from './presets/nl';
import pt from './presets/pt';
import { SOCIETES } from './presets/societe';
import us from './presets/us';
import xx from './presets/xx';
import type { LText, Regime } from './types';

/** Un régime par pays : le statut par défaut (indépendant / micro-entrepreneur). */
export const PAYS: Regime[] = [fr, be, ch, lu, de, at, nl, es, it, pt, ie, gb, ca, us, ma, xx];

const EXTRAS: Record<string, Regime[]> = { FR: [frEi, frEurl, frSasu] };

/** Tous les régimes, groupés par pays ; le premier de chaque pays est le défaut. */
export const REGIMES: Regime[] = PAYS.flatMap((p) => [p, ...(EXTRAS[p.pays] ?? []), ...SOCIETES.filter((s) => s.pays === p.pays)]);

/** Statuts disponibles dans un pays (le premier est le défaut). */
export function statutsDe(pays: string): Regime[] {
  const list = REGIMES.filter((r) => r.pays === pays);
  return list.length ? list : [fr];
}

/** Régime d'un pays et d'un statut ; statut inconnu → défaut du pays ; pays inconnu → France. */
export function getRegime(pays: string, statut?: string): Regime {
  const list = statutsDe(pays);
  return list.find((r) => r.statutId === statut) ?? list[0];
}

/** Identifiants consommés par la mention de pied (`{forme}`, `{capital}`, `{registre}`…). */
export function identifiantsPied(regime: Regime): Set<string> {
  const tpl = regime.mentions.pied?.fr ?? '';
  return new Set([...tpl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

/** Identifiant principal à afficher (SIRET, numéro d'entreprise…) : le premier hors mention de pied et hors taxe. */
export function identifiantPrincipal(regime: Regime): Regime['identifiants'][number] | undefined {
  const pied = identifiantsPied(regime);
  return regime.identifiants.find((i) => !pied.has(i.id) && !i.pourTva) ?? regime.identifiants[0];
}

/** Régime par son code unique (surcharges de paramètres). */
export function regimeParCode(code: string): Regime | undefined {
  return REGIMES.find((r) => r.code === code);
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
