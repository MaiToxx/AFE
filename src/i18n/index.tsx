// Internationalisation : dictionnaires plats (clé → texte), interpolation `{var}`,
// pluriels via les suffixes `.one` / `.other`, repli sur le français si une clé manque.
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import de from './de';
import en from './en';
import es from './es';
import fr from './fr';
import it from './it';
import nl from './nl';
import pt from './pt';

export type Lang = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl';
export type Dict = Record<string, string>;

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'nl', label: 'Nederlands' },
];

const DICTS: Record<Lang, Dict> = { fr, en, es, de, it, pt, nl };

let current: Lang = 'fr';

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && LANGS.some((l) => l.code === x);
}

export function getLang(): Lang {
  return current;
}

export function setLangGlobal(l: Lang): void {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

/** Langue du navigateur si elle est prise en charge, sinon français. */
export function detectLang(): Lang {
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'fr').slice(0, 2).toLowerCase();
  return isLang(nav) ? nav : 'fr';
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function tIn(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const s = DICTS[lang]?.[key] ?? DICTS.fr[key] ?? key;
  return interpolate(s, vars);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  return tIn(current, key, vars);
}

export function tnIn(lang: Lang, key: string, count: number, vars?: Record<string, string | number>): string {
  const k = `${key}.${count === 1 ? 'one' : 'other'}`;
  const exists = DICTS[lang]?.[k] !== undefined || DICTS.fr[k] !== undefined;
  return tIn(lang, exists ? k : key, { count, ...vars });
}

export function tn(key: string, count: number, vars?: Record<string, string | number>): string {
  return tnIn(current, key, count, vars);
}

/** Séparateur « libellé : valeur » : espace insécable avant les deux-points en français, collé ailleurs. */
export function colon(lang: Lang = current): string {
  return lang === 'fr' ? ' : ' : ': ';
}

/** Clés manquantes d'un dictionnaire par rapport au français (outil de contrôle). */
export function missingKeys(lang: Lang): string[] {
  return Object.keys(DICTS.fr).filter((k) => DICTS[lang][k] === undefined);
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  locale: string;
  currency: string;
}

const Ctx = createContext<I18nValue>({ lang: 'fr', setLang: () => undefined, locale: 'fr-FR', currency: 'EUR' });

export function I18nProvider({ lang, locale, currency, onChange, children }: {
  lang: Lang;
  locale: string;
  currency: string;
  onChange: (l: Lang) => void;
  children: ReactNode;
}) {
  // La langue globale est fixée pendant le rendu pour que les helpers hors React (t, formats)
  // soient cohérents dès ce rendu ; l'effet couvre l'attribut lang du document.
  if (current !== lang) current = lang;
  useEffect(() => {
    setLangGlobal(lang);
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang: onChange, locale, currency }), [lang, onChange, locale, currency]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const { lang, setLang, locale, currency } = useContext(Ctx);
  const tt = useCallback((key: string, vars?: Record<string, string | number>) => tIn(lang, key, vars), [lang]);
  const tnn = useCallback((key: string, count: number, vars?: Record<string, string | number>) => tnIn(lang, key, count, vars), [lang]);
  return { t: tt, tn: tnn, lang, setLang, locale, currency };
}
