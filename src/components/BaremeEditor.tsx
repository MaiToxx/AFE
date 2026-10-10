import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { useRegimeOverrides } from '../db/hooks';
import { colon, useI18n } from '../i18n';
import { L } from '../regimes';
import { paramsFor } from '../regimes/engine';
import type { Composante, Groupe, Nature, Regime, RegimeParams, Tranche } from '../regimes/types';
import { Field, Icon, Notice, NumInput } from './ui';

/** Éditeur générique des paramètres d'un régime (seuils, TVA, coefficient, composantes). */
export default function BaremeEditor({ regime, anneeInitiale }: { regime: Regime; anneeInitiale: number }) {
  const { t, lang } = useI18n();
  const overrides = useRegimeOverrides(regime.code);
  const annuel = !(0 in regime.params);
  const years = annuel ? [...new Set([...Object.keys(regime.params).map(Number), ...Object.keys(overrides).map(Number), anneeInitiale])].sort((a, b) => b - a) : [0];
  const [year, setYear] = useState(annuel ? anneeInitiale : 0);
  const resolved = paramsFor(regime, overrides, year);
  const [form, setForm] = useState<RegimeParams>(() => structuredClone(resolved.params));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(structuredClone(paramsFor(regime, overrides, year).params));
    setDirty(false);
  }, [regime, overrides, year]);

  const upd = (fn: (p: RegimeParams) => void) => {
    setForm((p) => {
      const c = structuredClone(p);
      fn(c);
      return c;
    });
    setDirty(true);
  };

  async function save() {
    const cle = `${regime.code}:${annuel ? year : 0}`;
    await db.regimeParams.put({ cle, pays: regime.code, annee: annuel ? year : 0, params: form });
    setDirty(false);
  }
  async function reset() {
    if (!confirm(t('bareme.confirmReset'))) return;
    await db.regimeParams.delete(`${regime.code}:${annuel ? year : 0}`);
  }
  async function addYear() {
    const latest = Math.max(...years);
    const src = paramsFor(regime, overrides, latest).params;
    await db.regimeParams.put({ cle: `${regime.code}:${latest + 1}`, pays: regime.code, annee: latest + 1, params: structuredClone(src) });
    setYear(latest + 1);
  }

  const num = (value: number, onChange: (n: number) => void) => <NumInput value={value} onChange={onChange} className="inline-num" />;
  const groupes: Groupe[] = ['vente', 'services'];
  const natures: Nature[] = ['commercant', 'artisan', 'liberal'];

  return (
    <div className="card">
      <div className="toolbar">
        {annuel ? (
          <>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('common.year')}>
              {years.map((y) => (
                <option key={y} value={y}>{t('bareme.yearLabel', { year: y })}</option>
              ))}
            </select>
            <button type="button" className="btn sm" onClick={addYear}><Icon name="plus" size={15} /> {t('bareme.addYear', { year: Math.max(...years) + 1 })}</button>
          </>
        ) : (
          <span className="text-2">{t('bareme.single')}</span>
        )}
        <span className="spacer" />
        {resolved.surcharge && <button type="button" className="btn ghost sm" onClick={reset}>{t('bareme.reset')}</button>}
        <button type="button" className="btn primary sm" onClick={save} disabled={!dirty}><Icon name="check" size={15} /> {t('common.save')}</button>
      </div>
      <Notice>
        {L(regime.avertissement, lang)}
        {regime.sources.length > 0 && (
          <div className="small" style={{ marginTop: 6 }}>
            {t('bareme.sources')}{colon(lang)}{regime.sources.map((s) => <a key={s} href={s} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>{s.replace(/^https?:\/\//, '').split('/')[0]}</a>)}
          </div>
        )}
      </Notice>

      {form.seuils.length > 0 && (
        <div className="form-section" style={{ marginTop: 18 }}>
          <h3>{t('bareme.thresholds')}</h3>
          <div className="form-row">
            {form.seuils.map((s, i) => (
              <div key={s.id} className="field">
                <span className="label">{L(s.label, lang)}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {num(s.valeur, (n) => upd((p) => { p.seuils[i].valeur = n; }))}
                  {s.majore !== undefined && <>{t('bareme.majore')} {num(s.majore, (n) => upd((p) => { p.seuils[i].majore = n; }))}</>}
                </div>
                {s.note && <span className="help">{L(s.note, lang)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="form-section">
        <h3>{t('bareme.vat', { tva: regime.tva.nom })}</h3>
        <div className="form-row">
          <Field label={t('bareme.vatRates')} help={t('bareme.vatRatesHelp')}>
            <input
              type="text"
              value={form.tvaTaux.join(', ')}
              onChange={(e) => upd((p) => { p.tvaTaux = e.target.value.split(/[;,]/).map((x) => Number(x.trim().replace(',', '.'))).filter((x) => Number.isFinite(x)); })}
            />
          </Field>
          <Field label={t('bareme.vatDefault')}>{num(form.tvaDefaut, (n) => upd((p) => { p.tvaDefaut = n; }))}</Field>
        </div>
      </div>

      <div className="form-section">
        <h3>{t('bareme.netCoef')}</h3>
        <p className="small text-2">{t('bareme.netCoefHelp')}</p>
        <div className="form-row">
          {typeof form.coefficientNet === 'number' ? (
            <Field label={t('bareme.allActivities')}>{num(form.coefficientNet, (n) => upd((p) => { p.coefficientNet = n; }))}</Field>
          ) : (
            regime.activites.map((a) => (
              <Field key={a.id} label={L(a.court, lang)}>
                {num((form.coefficientNet as Record<string, number>)[a.id] ?? 1, (n) => upd((p) => { (p.coefficientNet as Record<string, number>)[a.id] = n; }))}
              </Field>
            ))
          )}
        </div>
      </div>

      <div className="form-section">
        <h3>{t('bareme.components')}</h3>
        <div className="stack">
          {form.composantes.map((c, ci) => (
            <div key={c.id} className="comp-card">
              <h4>
                {L(c.label, lang)}
                <span className="tag">{t(`bareme.type.${c.type}`)}</span>
                <span className="tag">{t(`bareme.cat.${c.categorie}`)}</span>
                {c.optionnel && <span className="tag">{t('bareme.optional')}</span>}
              </h4>
              {c.note && <p className="small muted">{L(c.note, lang)}</p>}
              <ComposanteFields c={c} ci={ci} regime={regime} upd={upd} num={num} groupes={groupes} natures={natures} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComposanteFields({ c, ci, regime, upd, num, groupes, natures }: {
  c: Composante;
  ci: number;
  regime: Regime;
  upd: (fn: (p: RegimeParams) => void) => void;
  num: (value: number, onChange: (n: number) => void) => React.ReactNode;
  groupes: Groupe[];
  natures: Nature[];
}) {
  const { t, lang } = useI18n();
  const set = (fn: (comp: Composante) => void) => upd((p) => fn(p.composantes[ci]));
  const trancheCol = c.type === 'tranches_mois' ? 'montant' : 'taux';
  return (
    <div className="form-row">
      {(c.type === 'pct_ca' || c.type === 'pct_net') && !c.tauxParActivite && !c.tauxParGroupeTva && !c.tauxParNature && (
        <Field label={t('bareme.rate')}>{num(c.taux ?? 0, (n) => set((x) => { x.taux = n; }))}</Field>
      )}
      {c.tauxParActivite &&
        regime.activites.map((a) => (
          <Field key={a.id} label={`${t('bareme.rate')} — ${L(a.court, lang)}`}>
            {num(c.tauxParActivite?.[a.id] ?? 0, (n) => set((x) => { x.tauxParActivite = { ...(x.tauxParActivite ?? {}), [a.id]: n }; }))}
          </Field>
        ))}
      {c.tauxParGroupeTva &&
        groupes.map((g) => (
          <Field key={g} label={`${t('bareme.rate')} — ${t(`bareme.group.${g}`)}`}>
            {num(c.tauxParGroupeTva?.[g] ?? 0, (n) => set((x) => { x.tauxParGroupeTva = { ...(x.tauxParGroupeTva ?? {}), [g]: n }; }))}
          </Field>
        ))}
      {c.tauxParNature &&
        natures.map((n0) => (
          <Field key={n0} label={`${t('bareme.rate')} — ${L(regime.natures?.find((x) => x.id === n0)?.label, lang) || n0}`}>
            {num(c.tauxParNature?.[n0] ?? 0, (n) => set((x) => { x.tauxParNature = { ...(x.tauxParNature ?? {}), [n0]: n }; }))}
          </Field>
        ))}
      {c.type === 'fixe_mois' && <Field label={t('bareme.monthlyAmount')}>{num(c.montant ?? 0, (n) => set((x) => { x.montant = n; }))}</Field>}
      {(c.type === 'tranches_mois' || c.type === 'tranches_annuel') && (
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="label">{c.type === 'tranches_mois' ? t('bareme.bracketsMonth') : t('bareme.bracketsYear')}</span>
          <table className="table">
            <thead>
              <tr>
                <th>{t('bareme.upTo')}</th>
                <th>{trancheCol === 'taux' ? t('bareme.marginalRate') : t('bareme.monthlyAmount')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(c.tranches ?? []).map((tr, ti) => (
                <tr key={ti}>
                  <td>
                    {tr.jusqua === null ? (
                      <span className="muted">{t('bareme.noLimit')}</span>
                    ) : (
                      num(tr.jusqua, (n) => set((x) => { (x.tranches ?? [])[ti].jusqua = n; }))
                    )}
                  </td>
                  <td>{num(tr[trancheCol] ?? 0, (n) => set((x) => { ((x.tranches ?? [])[ti] as Tranche)[trancheCol] = n; }))}</td>
                  <td>
                    <button type="button" className="btn danger sm icon" aria-label={t('common.delete')} onClick={() => set((x) => { x.tranches = (x.tranches ?? []).filter((_, i) => i !== ti); })}>
                      <Icon name="x" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <button
              type="button"
              className="btn sm"
              onClick={() => set((x) => {
                const list = x.tranches ?? [];
                const last = list[list.length - 1];
                const nouveau: Tranche = { jusqua: last && last.jusqua !== null ? last.jusqua * 2 : 10_000, [trancheCol]: 0 };
                if (last && last.jusqua === null) list.splice(list.length - 1, 0, nouveau);
                else list.push(nouveau);
                x.tranches = list;
              })}
            >
              <Icon name="plus" size={14} /> {t('bareme.addBracket')}
            </button>
          </div>
        </div>
      )}
      {(c.type === 'pct_net' || c.type === 'tranches_annuel' || c.type === 'tranches_mois') && (
        <>
          <Field label={t('bareme.minYear')}>{num(c.min ?? 0, (n) => set((x) => { x.min = n || undefined; }))}</Field>
          <Field label={t('bareme.maxYear')}>{num(c.max ?? 0, (n) => set((x) => { x.max = n || undefined; }))}</Field>
        </>
      )}
      {c.type === 'pct_net' && <Field label={t('bareme.baseMax')}>{num(c.baseMax ?? 0, (n) => set((x) => { x.baseMax = n || undefined; }))}</Field>}
      {c.reductionDebut && (
        <>
          <Field label={t('bareme.reductionFactor')} help={t('bareme.reductionFactorHelp')}>
            {num(Math.round((1 - c.reductionDebut.facteur) * 10000) / 100, (n) => set((x) => { x.reductionDebut = { ...x.reductionDebut!, facteur: 1 - n / 100 }; }))}
          </Field>
          <Field label={t('bareme.reductionMonths')}>{num(c.reductionDebut.mois, (n) => set((x) => { x.reductionDebut = { ...x.reductionDebut!, mois: n }; }))}</Field>
        </>
      )}
    </div>
  );
}
