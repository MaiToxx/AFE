import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import BuyLicenceButton from '../components/BuyLicenceButton';
import { BarChart, Meter, StatTile } from '../components/charts';
import { Badge, Icon, Notice, PageHeader, Seg } from '../components/ui';
import { useClients, useDocuments, useLicense, usePaiements, useProfile, useRegime, useRegimeOverrides } from '../db/hooks';
import type { Doc } from '../db/types';
import { colon, useI18n } from '../i18n';
import { monthOf, parseISO, todayISO, yearOf } from '../lib/dates';
import { loadDemo } from '../lib/demo';
import { montantDu, montantPaye, statutInfo } from '../lib/documents';
import { fmtCompact, fmtDate, fmtMoney, fmtMoney0, moisCourts } from '../lib/format';
import { caHT, caParActivite, declarations, encaissementsParMois, factureParMois, sum } from '../lib/stats';
import { L } from '../regimes';
import { activiteOf, paramsFor, seuilsApplicables } from '../regimes/engine';

// Lien de démonstration : `#/?demo=1` charge le jeu de démo sur une base vide (une seule fois).
let demoRequested = false;

export default function Dashboard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t, tn, lang, locale } = useI18n();
  const { profile, loaded } = useProfile();
  const regime = useRegime();
  const overrides = useRegimeOverrides(profile.pays);
  const docs = useDocuments();
  const paiements = usePaiements();
  const clients = useClients();
  const licence = useLicense();
  const today = todayISO();
  const curY = yearOf(today);
  const curM = monthOf(today);
  const [year, setYear] = useState(curY);
  const [mode, setMode] = useState<'encaisse' | 'facture'>('encaisse');

  useEffect(() => {
    if (params.get('demo') === '1' && loaded && docs.length === 0 && !demoRequested) {
      demoRequested = true;
      void loadDemo();
    }
  }, [params, loaded, docs.length]);

  const years = useMemo(() => {
    const s = new Set<number>([curY]);
    docs.forEach((d) => s.add(yearOf(d.dateEmission)));
    paiements.forEach((p) => s.add(yearOf(p.date)));
    return [...s].sort((a, b) => b - a);
  }, [docs, paiements, curY]);

  const docsById = useMemo(() => new Map(docs.filter((d) => d.id).map((d) => [d.id!, d])), [docs]);
  const serie = (y: number) => (mode === 'encaisse' ? encaissementsParMois(paiements, docsById, y) : factureParMois(docs, y));
  const cur = serie(year);
  const prev = serie(year - 1);
  const total = sum(cur);
  const upto = year === curY ? curM : 12;
  const prevToDate = sum(prev.slice(0, upto));
  const delta = prevToDate > 0 ? ((sum(cur.slice(0, upto)) - prevToDate) / prevToDate) * 100 : null;

  const rows = useMemo(() => declarations(year, paiements, docsById, profile, regime, overrides, today), [year, paiements, docsById, profile, regime, overrides, today]);
  const prelevements = rows.reduce((s, r) => s + r.calcul.total, 0);
  const next = rows.find((r) => r.etat === 'a_declarer') ?? rows.find((r) => r.etat === 'en_cours');

  const factures = docs.filter((d) => d.type === 'facture');
  const attente = factures.filter((d) => d.statut === 'envoyee');
  const attenteTotal = attente.reduce((s, d) => s + montantDu(d) - montantPaye(d, paiements), 0);
  const retard = attente.filter((d) => d.dateEcheance < today);
  const devisEnCours = docs.filter((d) => d.type === 'devis' && d.statut === 'envoye');

  const { params: regimeParams } = paramsFor(regime, overrides, year);
  const parActivite = caParActivite(paiements, docsById, year);
  const caTotal = sum(Object.values(parActivite));
  const seuils = seuilsApplicables(regime, regimeParams, profile, parActivite).filter((s) => s.seuil.valeur > 0);

  const recentes = [...factures]
    .filter((d) => d.statut !== 'brouillon')
    .sort((a, b) => b.dateEmission.localeCompare(a.dateEmission) || b.numeroSeq - a.numeroSeq)
    .slice(0, 6);

  const clientName = (d: Doc) => d.client?.nom ?? clients.find((c) => c.id === d.clientId)?.nom ?? '—';
  const chartSeries = [{ name: String(year), color: 'var(--series-1)', values: cur }];
  if (sum(prev) > 0) chartSeries.push({ name: String(year - 1), color: 'var(--series-2)', values: prev });

  const vide = loaded && docs.length === 0 && paiements.length === 0;
  const recDrafts = docs.filter((d) => d.recurrenceId && d.statut === 'brouillon');

  // Projection de fin d'année au rythme actuel (année en cours, après un mois d'activité).
  const projection = (() => {
    if (year !== curY || total <= 0) return null;
    const start = new Date(curY, 0, 1).getTime();
    const dayOfYear = Math.floor((parseISO(today).getTime() - start) / 86_400_000) + 1;
    if (dayOfYear < 30) return null;
    const daysInYear = Math.round((new Date(curY, 11, 31).getTime() - start) / 86_400_000) + 1;
    return (total / dayOfYear) * daysInYear;
  })();

  const topClients = useMemo(() => {
    const map = new Map<number, number>();
    if (mode === 'encaisse') {
      for (const p of paiements) {
        if (yearOf(p.date) !== year) continue;
        const d = p.factureId ? docsById.get(p.factureId) : undefined;
        const cid = d?.clientId ?? 0;
        map.set(cid, (map.get(cid) ?? 0) + caHT(p, docsById));
      }
    } else {
      for (const d of docs) {
        if (d.type === 'devis' || d.statut === 'brouillon' || d.statut === 'annulee' || yearOf(d.dateEmission) !== year) continue;
        const cid = d.clientId ?? 0;
        map.set(cid, (map.get(cid) ?? 0) + (d.type === 'avoir' ? -d.totalHT : d.totalHT));
      }
    }
    const arr = [...map.entries()]
      .map(([cid, ca]) => ({ nom: cid ? clients.find((c) => c.id === cid)?.nom ?? t('dash.deletedClient') : t('dash.noClient'), ca }))
      .filter((x) => x.ca > 0)
      .sort((a, b) => b.ca - a.ca);
    const top = arr.slice(0, 5);
    if (arr.length > 5) top.push({ nom: t('dash.others', { n: arr.length - 5 }), ca: arr.slice(5).reduce((s, x) => s + x.ca, 0) });
    return top;
  }, [mode, paiements, docs, docsById, clients, year, t]);

  const blocked = licence.status === 'trial_over' || licence.status === 'expired' || licence.status === 'unsupported' || licence.status === 'invalid';

  return (
    <>
      <PageHeader
        title={t('dash.title')}
        subtitle={profile.denomination || `${profile.prenom} ${profile.nom}`.trim() || t('dash.subtitleDefault')}
        actions={
          <>
            <button type="button" className="btn" onClick={() => navigate('/documents/nouveau?type=devis')}>
              <Icon name="plus" /> {t('doc.quote')}
            </button>
            <button type="button" className="btn primary" onClick={() => navigate('/documents/nouveau?type=facture')}>
              <Icon name="plus" /> {t('doc.invoice')}
            </button>
          </>
        }
      />

      {blocked && (
        <div style={{ marginBottom: 18 }}>
          <Notice tone="critical">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>
                {licence.status === 'trial_over' ? t('licence.trialOverNotice') : t('licence.invalidNotice')} <Link to="/parametres?tab=licence">{t('licence.activateLink')}</Link>
              </span>
              <BuyLicenceButton small />
            </div>
          </Notice>
        </div>
      )}

      {recDrafts.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Notice>
            {tn('dash.recurrenceDrafts', recDrafts.length)} <Link to="/documents?type=facture">{t('dash.recurrenceDraftsLink')}</Link>
          </Notice>
        </div>
      )}

      {vide && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>{t('dash.welcome')}</h2>
          <p className="text-2" style={{ margin: '6px 0 14px' }}>{t('dash.welcomeText')}</p>
          <div className="actions">
            <Link to="/parametres" className="btn primary">
              <Icon name="settings" /> {t('dash.step1')}
            </Link>
            <Link to="/clients" className="btn">
              <Icon name="users" /> {t('dash.step2')}
            </Link>
            <Link to="/documents/nouveau?type=facture" className="btn">
              <Icon name="file" /> {t('dash.step3')}
            </Link>
            <span className="spacer" style={{ flex: 1 }} />
            <button type="button" className="btn ghost" onClick={() => void loadDemo()}>
              <Icon name="eye" /> {t('dash.loadDemo')}
            </button>
          </div>
        </div>
      )}

      <div className="filters">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('common.year')}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { value: 'encaisse', label: t('dash.received') },
            { value: 'facture', label: t('dash.invoiced') },
          ]}
        />
        <span className="small muted">{mode === 'encaisse' ? t('dash.receivedHelp') : t('dash.invoicedHelp')}</span>
      </div>

      <div className="dash-top">
        <div className="card hero">
          <span className="label muted">{mode === 'encaisse' ? t('dash.heroReceived', { year }) : t('dash.heroInvoiced', { year })}</span>
          <span className="value">{fmtMoney0(total)}</span>
          <span className="delta">
            {delta === null ? (
              <span className="muted">{t('dash.noComparison', { year: year - 1 })}</span>
            ) : (
              <>
                <span className={delta >= 0 ? 'good' : 'critical'} style={{ fontWeight: 600 }}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))} %
                </span>
                <span>{t(year === curY ? 'dash.vsToDate' : 'dash.vs', { year: year - 1, montant: fmtCompact(prevToDate) })}</span>
              </>
            )}
          </span>
        </div>
        <StatTile label={t('dash.tileContrib', { year })} value={fmtCompact(prelevements)} sub={<Link to="/cotisations">{t('dash.tileContribLink')}</Link>} />
        <StatTile
          label={t('dash.tileNext')}
          value={next ? fmtCompact(next.calcul.total) : '—'}
          sub={
            next ? (
              next.etat === 'a_declarer' ? <Badge tone="warning">{t('dash.before', { date: fmtDate(next.period.echeance) })}</Badge> : <span>{next.period.label} · {t('dash.due', { date: fmtDate(next.period.echeance) })}</span>
            ) : (
              t('dash.noPeriod')
            )
          }
        />
        <StatTile
          label={t('dash.tileAwaiting')}
          value={fmtCompact(attenteTotal)}
          sub={
            attente.length ? (
              <>
                {tn('dash.invoicesCount', attente.length)}
                {retard.length > 0 && <Badge tone="critical">{tn('dash.lateCount', retard.length)}</Badge>}
              </>
            ) : (
              t('dash.allPaid')
            )
          }
        />
        <StatTile
          label={t('dash.tileQuotes')}
          value={fmtCompact(devisEnCours.reduce((s, d) => s + d.totalTTC, 0))}
          sub={devisEnCours.length ? tn('dash.quotesCount', devisEnCours.length) : t('dash.noQuotes')}
        />
      </div>

      <div className="dash-main">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>{t('dash.chartTitle')}</h2>
              <span className="small muted">{mode === 'encaisse' ? t('dash.chartByReceipt') : t('dash.chartByInvoice')}</span>
            </div>
            <BarChart
              categories={moisCourts(locale)}
              series={chartSeries}
              format={fmtMoney}
              formatTick={fmtCompact}
              highlightIndex={year === curY ? curM - 1 : undefined}
              ariaLabel={t('dash.chartTitle')}
              categoryLabel={t('common.month')}
            />
          </div>
          <div className="card">
            <div className="card-head">
              <h2>{t('dash.topClients', { year })}</h2>
              <span className="small muted">{mode === 'encaisse' ? t('dash.topReceived') : t('dash.topInvoiced')}</span>
            </div>
            {topClients.length === 0 ? (
              <p className="small text-2">{t('chart.noData')}</p>
            ) : (
              <div className="barlist">
                {topClients.map((c) => (
                  <div key={c.nom} className="barlist-row">
                    <span className="barlist-name" title={c.nom}>{c.nom}</span>
                    <span className="barlist-bar" aria-hidden="true"><i style={{ width: `${(c.ca / topClients[0].ca) * 100}%` }} /></span>
                    <span className="barlist-val">{fmtMoney0(c.ca)} <span className="muted">· {total > 0 ? Math.round((c.ca / total) * 100) : 0} %</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>{profile.objectifCA > 0 ? t('dash.goalAndThresholds', { year }) : t('dash.thresholds', { year })}</h2>
              <span className="small muted">{t('dash.onReceived')}</span>
            </div>
            <div className="stack" style={{ gap: 18 }}>
              {profile.objectifCA > 0 && (
                <Meter goal label={t('dash.goal', { year })} value={caTotal} max={profile.objectifCA} format={fmtMoney0} note={projection && mode === 'encaisse' ? t('dash.projection', { montant: fmtMoney0(projection) }) : undefined} />
              )}
              {seuils.map(({ seuil, valeur }) => (
                <Meter
                  key={seuil.id}
                  label={L(seuil.label, lang)}
                  value={valeur}
                  max={seuil.valeur}
                  format={fmtMoney0}
                  marker={seuil.majore ? { value: seuil.majore, label: t('dash.majore', { montant: fmtMoney0(seuil.majore) }) } : undefined}
                  note={seuil.majore ? t('dash.majore', { montant: fmtMoney0(seuil.majore) }) : L(seuil.note, lang) || undefined}
                />
              ))}
              {profile.assujettiTVA && regime.tva.franchisePossible && <p className="small muted">{t('dash.vatRegistered', { tva: regime.tva.nom })}</p>}
              {seuils.length === 0 && profile.objectifCA <= 0 && <p className="small muted">{t('dash.noThreshold')}</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>{t('dash.recentInvoices')}</h2>
              <Link to="/documents" className="small">{t('common.seeAll')}</Link>
            </div>
            {recentes.length === 0 ? (
              <p className="small text-2">{t('dash.noInvoiceYet')}</p>
            ) : (
              <table className="table">
                <tbody>
                  {recentes.map((d) => {
                    const st = statutInfo(d, montantPaye(d, paiements), today);
                    return (
                      <tr key={d.id} className="clickable" onClick={() => navigate(`/documents/${d.id}`)}>
                        <td className="tnum small"><b>{d.numero}</b></td>
                        <td className="small">{clientName(d)}</td>
                        <td className="num small">{fmtMoney(d.totalTTC)}</td>
                        <td><Badge tone={st.tone}>{t(st.key)}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {Object.keys(parActivite).length > 1 && (
        <p className="small muted" style={{ marginTop: 14 }}>
          {t('dash.split', { year })}{colon(lang)}{Object.entries(parActivite).map(([a, v]) => `${L(activiteOf(regime, a).court, lang)} ${fmtMoney0(v)}`).join(' · ')}
        </p>
      )}
    </>
  );
}
