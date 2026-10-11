// Contrôle des dictionnaires d'interface : clés utilisées dans le code mais absentes du français,
// clés françaises inutilisées, clés manquantes dans les autres langues, variables {x} incohérentes.
// Usage : node scripts/i18n-check.mjs   (code de sortie 1 en cas d'anomalie bloquante)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const src = path.join(root, 'src');
const read = (f) => fs.readFileSync(f, 'utf8');

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !p.includes(`${path.sep}i18n${path.sep}`)) files.push(p);
  }
})(src);

// Clés référencées : littéraux 'prefixe.suite' aux préfixes connus (appels t(), tables key: '…', ternaires).
const PREFIXES = 'common|nav|onb|dash|docs|doc|editor|print|clients|cotis|sim|bareme|ledger|settings|licence|update|relance|recurrence|catalogue|chart|meter|status|moyen|freq|period|demo|backup|exp|cat|tva';
const literal = new RegExp(`'((?:${PREFIXES})\\.[a-zA-Z0-9_.]+)'`, 'g');
const used = new Set();
for (const f of files) for (const m of read(f).matchAll(literal)) used.add(m[1]);
// Clés construites dynamiquement (t(`freq.${x}`), period.quarter.${q}, bareme.type.${c.type}…).
['freq.mensuelle', 'freq.trimestrielle', 'freq.annuelle', 'period.quarter.1', 'period.quarter.2', 'period.quarter.3', 'period.quarter.4',
  'bareme.type.pct_ca', 'bareme.type.pct_net', 'bareme.type.fixe_mois', 'bareme.type.tranches_mois', 'bareme.type.tranches_annuel',
  'bareme.cat.social', 'bareme.cat.impot', 'bareme.cat.autre', 'bareme.group.vente', 'bareme.group.services', 'cotis.base.ca', 'cotis.base.net', 'cotis.base.remuneration', 'cotis.base.resultat'].forEach((k) => used.add(k));
// Faux positifs : noms de fichiers, de réglages ou codes d'erreur internes qui ressemblent à des clés.
['licence.key', 'licence.required', 'backup.newer'].forEach((k) => used.delete(k));

const entries = (lang) => Object.fromEntries([...read(path.join(src, 'i18n', `${lang}.ts`)).matchAll(/^\s*'([^']+)':\s'((?:[^'\\]|\\.)*)'/gm)].map((m) => [m[1], m[2]]));
const langs = [...read(path.join(src, 'i18n', 'index.tsx')).matchAll(/^import (\w+) from '\.\/(\w+)';/gm)].map((m) => m[2]);
const fr = entries('fr');
const frKeys = new Set(Object.keys(fr));
const plural = (k) => frKeys.has(`${k}.one`) && frKeys.has(`${k}.other`);
const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

let blocking = 0;
const missingFr = [...used].filter((k) => !frKeys.has(k) && !plural(k)).sort();
if (missingFr.length) {
  blocking++;
  console.log(`Clés utilisées absentes de fr.ts (${missingFr.length}) :\n  ${missingFr.join('\n  ')}`);
}
const unused = [...frKeys].filter((k) => !used.has(k) && !used.has(k.replace(/\.(one|other)$/, ''))).sort();
if (unused.length) console.log(`Clés de fr.ts non référencées (${unused.length}) : ${unused.join(', ')}`);

for (const lang of langs.filter((l) => l !== 'fr')) {
  const d = entries(lang);
  const missing = [...frKeys].filter((k) => d[k] === undefined);
  const extra = Object.keys(d).filter((k) => !frKeys.has(k));
  const bad = [...frKeys].filter((k) => d[k] !== undefined && vars(fr[k]) !== vars(d[k]));
  if (bad.length) blocking++;
  console.log(`${lang}: ${Object.keys(d).length} clés${missing.length ? `, manquantes (${missing.length}) : ${missing.join(', ')}` : ', complet'}${extra.length ? ` | en trop : ${extra.join(', ')}` : ''}${bad.length ? ` | variables incohérentes : ${bad.join(', ')}` : ''}`);
}
console.log(blocking ? '\nAnomalies bloquantes détectées.' : '\nDictionnaires cohérents.');
process.exit(blocking ? 1 : 0);
