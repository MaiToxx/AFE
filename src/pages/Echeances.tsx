import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Empty, Icon, PageHeader } from '../components/ui';
import { useClients, useDepenses, useDocuments, usePaiements, useProfile, useRecurrences, useRegime, useRegimeOverrides } from '../db/hooks';
import { useI18n } from '../i18n';
import { todayISO, yearOf } from '../lib/dates';
import { saveTextFile } from '../lib/desktop';
import { echeances, echeancesICS, type Echeance, type TypeEcheance } from '../lib/echeances';
import { fmtDate, fmtMoney, moisLong } from '../lib/format';
import { declarations, encaisseParFacture } from '../lib/stats';
import { tvaParPeriode } from '../lib/tva';

const HORIZONS = [30, 90, 180, 365];
const TONS: Record<TypeEcheance, string> = { declaration: 'info', taxe: 'info', facture: 'warning', devis: 'neutral', recurrence: 'good' };

/** Échéancier : déclarations, factures à encaisser, devis sans réponse et factures récurrentes à venir. */
export default function Echeances() {
  const { t, tn, locale } = useI18n();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const regime = useRegime();
  const overrides = useRegimeOverrides(regime.code);
  const docs = useDocuments();
  const paiements = usePaiements();
  const depenses = useDepenses();
  const clients = useClients();
  const recurrences = useRecurrences();
  const today = todayISO();
  const [horizon, setHorizon] = useState(90);

  const liste = useMemo(() => {
    const annee = yearOf(today);
    // L'année précédente (dernière période, à déclarer en janvier) et la suivante (horizon à cheval sur deux années).
    const annees = [annee - 1, annee, annee + 1];
    const docsById = new Map(docs.filter((d) => d.id).map((d) => [d.id!, d]));
    const noms = new Map(clients.map((c) => [c.id, c.nom]));
    return echeances({
      docs,
      encaisse: encaisseParFacture(paiements),
      recurrences,
      nomClient: (d) => d.client?.nom ?? noms.get(d.clientId ?? undefined) ?? '',
      declarations: annees.flatMap((y) => declarations(y, paiements, docsById, profile, regime, overrides, today, depenses)),
      taxe: profile.assujettiTVA ? annees.flatMap((y) => tvaParPeriode(y, docs, paiements, depenses, profile, regime, today)) : [],
      today,
      horizon,
    });
  }, [docs, paiements, depenses, clients, recurrences, profile, regime, overrides, today, horizon]);

  const libelle = (e: Echeance) => (e.type === 'taxe' ? t('dl.type.taxe', { taxe: regime.tva.nom }) : t(`dl.type.${e.type}`));
  const quand = (e: Echeance) => (e.retard > 0 ? tn('dl.lateDays', e.retard) : e.retard === 0 ? t('dl.today') : tn('dl.inDays', -e.retard));
  const enRetard = liste.filter((e) => e.retard > 0);
  const aVenir = liste.filter((e) => e.retard <= 0);
  const parMois = useMemo(() => {
    const groupes: { cle: string; titre: string; lignes: Echeance[] }[] = [];
    for (const e of aVenir) {
      const cle = e.date.slice(0, 7);
      let g = groupes.find((x) => x.cle === cle);
      if (!g) {
        g = { cle, titre: `${moisLong(Number(cle.slice(5, 7)), locale)} ${cle.slice(0, 4)}`, lignes: [] };
        groupes.push(g);
      }
      g.lignes.push(e);
    }
    return groupes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liste, locale]);

  async function exporter() {
    const texte = (e: Echeance) => ({
      titre: `${libelle(e)}${e.reference ? ` ${e.reference}` : ''}${e.detail ? ` — ${e.detail}` : ''}`,
      description: e.montant !== null && e.montant > 0 ? `${t('common.amount')} : ${fmtMoney(e.montant)}${e.estimation ? ` (${t('dl.estimate')})` : ''}` : '',
    });
    await saveTextFile(`afe-${t('dl.file')}.ics`, echeancesICS(liste, texte));
  }

  const ligne = (e: Echeance) => (
    <tr key={e.cle} className="clickable" onClick={() => navigate(e.lien)}>
      <td className="tnum nowrap">
        {fmtDate(e.date)}
        <div className={`small ${e.retard > 0 ? 'critical' : 'muted'}`}>{quand(e)}</div>
      </td>
      <td><Badge tone={e.retard > 0 && e.type === 'facture' ? 'critical' : TONS[e.type]}>{libelle(e)}</Badge></td>
      <td>
        <b>{e.reference}</b>
        {e.detail && <span className="text-2"> · {e.detail}</span>}
      </td>
      <td className="num">
        {e.montant !== null && e.montant > 0 ? fmtMoney(e.montant) : '—'}
        {e.estimation && e.montant !== null && e.montant > 0 && <div className="small muted">{t('dl.estimate')}</div>}
      </td>
    </tr>
  );

  // Mêmes largeurs de colonnes dans tous les tableaux de la page.
  const colonnes = (
    <colgroup>
      <col style={{ width: 150 }} />
      <col style={{ width: 210 }} />
      <col />
      <col style={{ width: 140 }} />
    </colgroup>
  );

  return (
    <>
      <PageHeader
        title={t('dl.title')}
        subtitle={t('dl.subtitle')}
        actions={
          <>
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} aria-label={t('dl.horizon')} style={{ width: 'auto' }}>
              {HORIZONS.map((n) => (
                <option key={n} value={n}>{t('dl.days', { n })}</option>
              ))}
            </select>
            <button type="button" className="btn" onClick={exporter} disabled={!liste.length}>
              <Icon name="download" /> {t('dl.export')}
            </button>
          </>
        }
      />
      {liste.length === 0 ? (
        <div className="card"><Empty title={t('dl.empty')} /></div>
      ) : (
        <div className="stack">
          {enRetard.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2>{t('dl.overdue')}</h2>
                <span className="small critical">{fmtMoney(enRetard.reduce((s, e) => s + (e.type === 'facture' ? e.montant ?? 0 : 0), 0))}</span>
              </div>
              <div className="table-wrap"><table className="table" style={{ tableLayout: 'fixed' }}>{colonnes}<tbody>{enRetard.map(ligne)}</tbody></table></div>
            </div>
          )}
          {parMois.map((g) => (
            <div className="card" key={g.cle}>
              <div className="card-head"><h2 style={{ textTransform: 'capitalize' }}>{g.titre}</h2></div>
              <div className="table-wrap"><table className="table" style={{ tableLayout: 'fixed' }}>{colonnes}<tbody>{g.lignes.map(ligne)}</tbody></table></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
