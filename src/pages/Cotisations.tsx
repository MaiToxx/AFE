import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Check, Field, Icon, NumInput, PageHeader } from '../components/ui';
import { useDepenses, useDocuments, usePaiements, useProfile, useRegime, useRegimeOverrides } from '../db/hooks';
import type { Profile } from '../db/types';
import { colon, useI18n } from '../i18n';
import { todayISO, yearOf } from '../lib/dates';
import { fmtDate, fmtMoney, fmtMoney0, fmtPct } from '../lib/format';
import { declarations, type EtatDeclaration } from '../lib/stats';
import { tvaParPeriode } from '../lib/tva';
import { L } from '../regimes';
import { baseDe, calculer, coefficientNet, composanteActive, finReduction, paramsFor, reductionActive, tvaFrequence } from '../regimes/engine';
import type { Composante, Regime, RegimeParams } from '../regimes/types';

const ETAT: Record<EtatDeclaration, { key: string; tone: string }> = {
  passee: { key: 'cotis.state.past', tone: 'neutral' },
  a_declarer: { key: 'cotis.state.due', tone: 'warning' },
  en_cours: { key: 'cotis.state.current', tone: 'info' },
  a_venir: { key: 'cotis.state.upcoming', tone: 'neutral' },
};

export default function Cotisations() {
  const { t, lang } = useI18n();
  const { profile } = useProfile();
  const regime = useRegime();
  const overrides = useRegimeOverrides(regime.code);
  const docs = useDocuments();
  const paiements = usePaiements();
  const depenses = useDepenses();
  const today = todayISO();
  const curY = yearOf(today);
  const [year, setYear] = useState(curY);

  const years = useMemo(() => {
    const s = new Set<number>([curY]);
    paiements.forEach((p) => s.add(yearOf(p.date)));
    depenses.forEach((d) => s.add(yearOf(d.date)));
    return [...s].sort((a, b) => b - a);
  }, [paiements, depenses, curY]);

  const docsById = useMemo(() => new Map(docs.filter((d) => d.id).map((d) => [d.id!, d])), [docs]);
  const rows = useMemo(() => declarations(year, paiements, docsById, profile, regime, overrides, today, depenses), [year, paiements, docsById, profile, regime, overrides, today, depenses]);
  const { params, annee: anneeParams, surcharge } = paramsFor(regime, overrides, year);
  const reel = params.baseRevenu === 'reel';
  const societe = !!regime.remuneration;
  // Colonnes : composantes applicables au profil, dans l'ordre du régime.
  const colonnes = params.composantes.filter((c) => composanteActive(c, profile));
  const tot = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const montantDe = (r: (typeof rows)[number], c: Composante) => r.calcul.lignes.find((l) => l.composante.id === c.id)?.montant ?? 0;
  const reductionComp = params.composantes.find((c) => c.reductionDebut);
  const finRed = reductionComp?.reductionDebut && profile.acre && profile.dateDebutActivite ? finReduction(profile.dateDebutActivite, reductionComp.reductionDebut) : '';
  const tva = useMemo(() => (profile.assujettiTVA ? tvaParPeriode(year, docs, paiements, depenses, profile, regime, today) : []), [profile, year, docs, paiements, depenses, regime, today]);
  const nbColonnes = 2 + (reel ? 2 : 0) + (societe ? 1 : 0) + colonnes.length + 3;

  return (
    <>
      <PageHeader
        title={t('cotis.title')}
        subtitle={
          <>
            {t('cotis.subtitle', { statut: L(regime.statut, lang), periodicite: t(`freq.${profile.frequence}`) })}
            {anneeParams ? ` · ${t('cotis.params', { annee: anneeParams })}` : ''}
            {surcharge ? ` (${t('cotis.customized')})` : ''}
            {finRed && <> · {t('cotis.reductionUntil', { date: fmtDate(finRed) })}</>}
            {' · '}
            <Link to="/parametres">{t('common.edit').toLowerCase()}</Link>
          </>
        }
        actions={
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('common.year')}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        }
      />

      <div className="stack">
        <div className="card">
          <div className="card-head">
            <h2>{t('cotis.declarations', { year })}</h2>
            <span className="small text-2">{reel ? t('cotis.basisReel') : t('cotis.basis')}</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.period')}</th>
                  <th className="num">{t('cotis.turnover')}</th>
                  {reel && <th className="num">{t('cotis.expenses')}</th>}
                  {reel && <th className="num">{t('cotis.profit')}</th>}
                  {societe && <th className="num">{t('cotis.remuneration')}</th>}
                  {colonnes.map((c) => (
                    <th key={c.id} className="num">{L(c.label, lang)}</th>
                  ))}
                  <th className="num">{t('cotis.totalDue')}</th>
                  <th>{t('cotis.deadline')}</th>
                  <th>{t('common.state')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.period.key} className={r.etat === 'en_cours' ? 'current' : ''}>
                    <td>
                      {r.period.label}
                      {r.calcul.reduit && r.calcul.ca > 0 && <> <span className="badge info" title={t('cotis.reducedTitle')}>{t('cotis.reduced')}</span></>}
                    </td>
                    <td className="num">{fmtMoney(r.calcul.ca)}</td>
                    {reel && <td className="num text-2">{fmtMoney(r.calcul.depenses)}</td>}
                    {reel && <td className="num">{fmtMoney(r.calcul.net)}</td>}
                    {societe && <td className="num text-2">{fmtMoney(r.calcul.remuneration)}</td>}
                    {colonnes.map((c) => (
                      <td key={c.id} className="num">{fmtMoney(montantDe(r, c))}</td>
                    ))}
                    <td className="num"><b>{fmtMoney(r.calcul.total)}</b></td>
                    <td className="tnum text-2">{fmtDate(r.period.echeance)}</td>
                    <td><Badge tone={ETAT[r.etat].tone}>{t(ETAT[r.etat].key)}</Badge></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t('cotis.totalYear', { year })}</td>
                  <td className="num">{fmtMoney(tot((r) => r.calcul.ca))}</td>
                  {reel && <td className="num">{fmtMoney(tot((r) => r.calcul.depenses))}</td>}
                  {reel && <td className="num">{fmtMoney(tot((r) => r.calcul.net))}</td>}
                  {societe && <td className="num">{fmtMoney(tot((r) => r.calcul.remuneration))}</td>}
                  {colonnes.map((c) => (
                    <td key={c.id} className="num">{fmtMoney(tot((r) => montantDe(r, c)))}</td>
                  ))}
                  <td className="num">{fmtMoney(tot((r) => r.calcul.total))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          {reel && depenses.length === 0 && (
            <p className="small muted" style={{ marginTop: 10 }}>
              {t('cotis.noExpenses')} <Link to="/depenses">{t('nav.expenses')}</Link>
            </p>
          )}
          <p className="small muted" style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <Icon name="info" size={14} />
            <span>{L(regime.avertissement, lang)} {t('cotis.noConnection')}</span>
          </p>
          {nbColonnes > 9 && <p className="small muted">{t('cotis.scrollHint')}</p>}
        </div>

        {profile.assujettiTVA && (
          <div className="card">
            <div className="card-head">
              <h2>{t('tva.title', { tva: regime.tva.nom, year })}</h2>
              <span className="small text-2">
                {t('tva.periodicity', { periodicite: t(`freq.${tvaFrequence(regime, profile)}`) })} · <Link to="/parametres">{t('common.edit').toLowerCase()}</Link>
              </span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.period')}</th>
                    <th className="num">{t('tva.collected')}</th>
                    <th className="num">{t('tva.deductible')}</th>
                    <th className="num">{t('tva.net')}</th>
                    <th className="num">{t('tva.toPay')}</th>
                    <th>{t('cotis.deadline')}</th>
                    <th>{t('common.state')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tva.map((r) => (
                    <tr key={r.period.key} className={r.etat === 'en_cours' ? 'current' : ''}>
                      <td>{r.period.label}</td>
                      <td className="num">{fmtMoney(r.collectee)}</td>
                      <td className="num text-2">{fmtMoney(r.deductible)}</td>
                      <td className={`num${r.nette < 0 ? ' good' : ''}`}>{fmtMoney(r.nette)}</td>
                      <td className="num">
                        <b>{fmtMoney(r.aPayer)}</b>
                        {r.credit > 0 && <div className="small text-2">{t('tva.credit', { montant: fmtMoney(r.credit) })}</div>}
                      </td>
                      <td className="tnum text-2">{fmtDate(r.period.echeance)}</td>
                      <td><Badge tone={ETAT[r.etat].tone}>{t(ETAT[r.etat].key)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{t('cotis.totalYear', { year })}</td>
                    <td className="num">{fmtMoney(tva.reduce((s, r) => s + r.collectee, 0))}</td>
                    <td className="num">{fmtMoney(tva.reduce((s, r) => s + r.deductible, 0))}</td>
                    <td className="num">{fmtMoney(tva.reduce((s, r) => s + r.nette, 0))}</td>
                    <td className="num">{fmtMoney(tva.reduce((s, r) => s + r.aPayer, 0))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>{t('tva.note', { tva: regime.tva.nom })}</p>
          </div>
        )}

        <div className="grid grid-2">
          <Simulateur key={`${regime.code}:${profile.remunerationMensuelle}`} regime={regime} params={paramsFor(regime, overrides, curY).params} profile={profile} />
          <div className="card">
            <div className="card-head">
              <h2>{t('cotis.ratesTitle')}</h2>
              <Link to="/parametres?tab=bareme" className="small">{t('cotis.editRates')}</Link>
            </div>
            <TableauTaux regime={regime} params={params} profile={profile} />
            {params.seuils.length > 0 && (
              <p className="small muted" style={{ marginTop: 10 }}>
                {params.seuils.filter((s) => s.valeur > 0).map((s) => `${L(s.label, lang)}${colon(lang)}${fmtMoney0(s.valeur)}${s.majore ? ` (${t('dash.majore', { montant: fmtMoney0(s.majore) })})` : ''}`).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TableauTaux({ regime, params, profile }: { regime: Regime; params: RegimeParams; profile: Profile }) {
  const { t, lang } = useI18n();
  const pctCa = params.composantes.filter((c) => c.type === 'pct_ca' && baseDe(c) === 'ca' && composanteActive(c, profile));
  const autres = params.composantes.filter((c) => !(c.type === 'pct_ca' && baseDe(c) === 'ca'));
  const tauxDe = (c: Composante, a: string) => {
    const g = regime.activites.find((x) => x.id === a);
    const gt = g?.groupeTva ?? g?.groupe ?? 'services';
    return c.tauxParActivite?.[a] ?? c.tauxParGroupeTva?.[gt] ?? c.tauxParNature?.[profile.nature] ?? c.taux ?? 0;
  };
  const baseLabel = (c: Composante) => t(`cotis.base.${baseDe(c)}`);
  const decrire = (c: Composante): string => {
    switch (c.type) {
      case 'pct_ca':
      case 'pct_net':
        return `${fmtPct(c.taux ?? 0)} ${baseLabel(c)}${c.min ? ` · ${t('cotis.min')} ${fmtMoney0(c.min)}` : ''}${c.max ? ` · ${t('cotis.max')} ${fmtMoney0(c.max)}` : ''}`;
      case 'fixe_mois':
        return `${fmtMoney0(c.montant ?? 0)} ${t('cotis.perMonth')}`;
      case 'tranches_mois':
        return (c.tranches ?? []).map((tr) => `${tr.jusqua === null ? '>' : '≤'} ${fmtMoney0(tr.jusqua ?? (c.tranches ?? [])[(c.tranches ?? []).length - 2]?.jusqua ?? 0)} : ${fmtMoney0(tr.montant ?? 0)}`).join(' · ');
      case 'tranches_annuel':
        return `${baseLabel(c)} — ${(c.tranches ?? []).map((tr) => `${tr.jusqua === null ? t('cotis.above') : `≤ ${fmtMoney0(tr.jusqua)}`} : ${fmtPct(tr.taux ?? 0)}`).join(' · ')}${c.min ? ` · ${t('cotis.min')} ${fmtMoney0(c.min)}` : ''}`;
      default:
        return '';
    }
  };
  const coefs = regime.activites.map((a) => coefficientNet(params, a.id));
  return (
    <>
      {pctCa.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.activity')}</th>
                {pctCa.map((c) => (
                  <th key={c.id} className="num">{L(c.label, lang)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regime.activites.map((a) => (
                <tr key={a.id} className={a.id === profile.activite ? 'current' : ''}>
                  <td>{L(a.court, lang)}</td>
                  {pctCa.map((c) => (
                    <td key={c.id} className="num">{fmtPct(tauxDe(c, a.id), 3)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {autres.length > 0 && (
        <dl className="kv" style={{ marginTop: 12 }}>
          {autres.map((c) => (
            <div key={c.id} style={{ display: 'contents' }}>
              <dt>{L(c.label, lang)}{c.optionnel && <span className="tag">{composanteActive(c, profile) ? t('cotis.enabled') : t('cotis.disabled')}</span>}</dt>
              <dd className="small">{decrire(c)}{c.note && <div className="muted">{L(c.note, lang)}</div>}</dd>
            </div>
          ))}
        </dl>
      )}
      {params.baseRevenu === 'reel' ? (
        <p className="small muted" style={{ marginTop: 10 }}>{t('cotis.reelNote')}</p>
      ) : (
        coefs.some((c) => c !== 1) && (
          <p className="small muted" style={{ marginTop: 10 }}>
            {t('cotis.netCoef')}{colon(lang)}{regime.activites.map((a, i) => `${L(a.court, lang)} ${Math.round(coefs[i] * 100)} %`).join(' · ')}
          </p>
        )
      )}
    </>
  );
}

function Simulateur({ regime, params, profile }: { regime: Regime; params: RegimeParams; profile: Profile }) {
  const { t, lang } = useI18n();
  const today = todayISO();
  const reel = params.baseRevenu === 'reel';
  const societe = !!regime.remuneration;
  const [ca, setCa] = useState(reel ? 5000 : 3000);
  const [depenses, setDepenses] = useState(reel ? 1000 : 0);
  const [remuneration, setRemuneration] = useState(profile.remunerationMensuelle || (societe ? 2000 : 0));
  const [activite, setActivite] = useState(profile.activite);
  const [acre, setAcre] = useState(() => !!params.composantes.find((c) => c.reductionDebut) && profile.acre && !!profile.dateDebutActivite && reductionActive(profile, params.composantes.find((c) => c.reductionDebut)!.reductionDebut, today));
  const [vl, setVl] = useState(profile.versementLiberatoire);
  const [periode, setPeriode] = useState<'mois' | 'an'>('mois');
  const simProfile: Profile = { ...profile, acre, versementLiberatoire: vl, dateDebutActivite: acre ? today : profile.dateDebutActivite };
  const mois = periode === 'an' ? 12 : 1;
  const c = calculer({ [activite]: ca }, { regime, params, profile: simProfile, periodEnd: today, mois, depenses, remuneration: remuneration * mois });
  const plafond = params.seuils.find((s) => s.kind === 'regime' && (s.groupe === 'tous' || s.groupe === regime.activites.find((a) => a.id === activite)?.groupe))?.valeur ?? 0;
  const max = plafond > 0 ? (periode === 'an' ? plafond : Math.round(plafond / 12 / 100) * 100) : periode === 'an' ? 120_000 : 10_000;
  const coef = coefficientNet(params, activite);
  const hasReduction = params.composantes.some((cc) => cc.reductionDebut) && !!regime.options.acre;
  const hasVl = params.composantes.some((cc) => cc.option === 'vl') && !!regime.options.vl;
  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('sim.title')}</h2>
        <div className="seg sm" role="group">
          <button type="button" className={periode === 'mois' ? 'active' : ''} onClick={() => setPeriode('mois')}>{t('sim.perMonth')}</button>
          <button type="button" className={periode === 'an' ? 'active' : ''} onClick={() => setPeriode('an')}>{t('sim.perYear')}</button>
        </div>
      </div>
      <div className="form-section">
        <div className="form-row">
          <Field label={periode === 'mois' ? t('sim.turnoverMonth') : t('sim.turnoverYear')}>
            <NumInput value={ca} onChange={setCa} min={0} />
          </Field>
          {reel && (
            <Field label={periode === 'mois' ? t('sim.expensesMonth') : t('sim.expensesYear')}>
              <NumInput value={depenses} onChange={setDepenses} min={0} />
            </Field>
          )}
          {societe && (
            <Field label={t('sim.remuneration')}>
              <NumInput value={remuneration} onChange={setRemuneration} min={0} />
            </Field>
          )}
          {regime.activites.length > 1 && (
            <Field label={t('common.activity')}>
              <select value={activite} onChange={(e) => setActivite(e.target.value)}>
                {regime.activites.map((a) => (
                  <option key={a.id} value={a.id}>{L(a.court, lang)}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <input className="range" type="range" min={0} max={Math.min(max, 250_000)} step={periode === 'an' ? 500 : 50} value={Math.min(ca, max)} onChange={(e) => setCa(Number(e.target.value))} aria-label={t('cotis.turnover')} />
        {(hasReduction || hasVl) && (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {hasReduction && <Check label={L(regime.options.acre!.label, lang)} checked={acre} onChange={setAcre} />}
            {hasVl && <Check label={L(regime.options.vl!.label, lang)} checked={vl} onChange={setVl} />}
          </div>
        )}
      </div>
      <div className="sim-result" style={{ marginTop: 18 }}>
        {reel && (
          <div className="row">
            <span className="k">{t('cotis.profit')}</span>
            <span className="tnum">{fmtMoney(c.net)}</span>
          </div>
        )}
        {societe && c.remuneration > 0 && (
          <div className="row">
            <span className="k">{t('cotis.remuneration')}</span>
            <span className="tnum">{fmtMoney(c.remuneration)}</span>
          </div>
        )}
        {c.lignes.map((l) => (
          <div className="row" key={l.composante.id}>
            <span className="k">
              {L(l.composante.label, lang)}
              {l.taux !== undefined && <> ({fmtPct(l.taux, 2)})</>}
              {l.reduit && <span className="tag">{t('cotis.reduced')}</span>}
            </span>
            <span className="tnum">{fmtMoney(l.montant)}</span>
          </div>
        ))}
        {c.lignes.length === 0 && <p className="small muted">{t('sim.nothing')}</p>}
        <div className="row total">
          <span>{t('sim.total')}</span>
          <span className="tnum">{fmtMoney(c.total)} <span className="small text-2">({fmtPct(c.tauxEffectif, 1)})</span></span>
        </div>
        <div className="row net">
          <span>{societe ? t('sim.leftInCompany') : periode === 'mois' ? t('sim.netMonth') : t('sim.netYear')}</span>
          <span className="tnum">{fmtMoney(societe ? c.reste - c.remuneration : c.reste)}</span>
        </div>
        {societe && <p className="small muted">{t('sim.societeNote', { remuneration: fmtMoney(c.remuneration), resultat: fmtMoney(c.resultat) })}</p>}
        {!reel && coef !== 1 && <p className="small muted">{t('sim.netNote', { montant: fmtMoney(c.net), pct: Math.round(coef * 100) })}</p>}
      </div>
    </div>
  );
}
