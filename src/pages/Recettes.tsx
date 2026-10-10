import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, PageHeader } from '../components/ui';
import { useClients, useDocuments, usePaiements, useProfile, useRegime } from '../db/hooks';
import { useI18n } from '../i18n';
import { todayISO, yearOf } from '../lib/dates';
import { saveTextFile } from '../lib/desktop';
import { fmtDate, fmtMoney, moisLong } from '../lib/format';
import { livreRecettes, recettesCSV, type LigneRecette } from '../lib/recettes';
import { L } from '../regimes';
import { activiteOf } from '../regimes/engine';

export default function Recettes() {
  const { t, lang, locale } = useI18n();
  const { profile } = useProfile();
  const regime = useRegime();
  const docs = useDocuments();
  const paiements = usePaiements();
  const clients = useClients();
  const curY = yearOf(todayISO());
  const [year, setYear] = useState(curY);

  const years = useMemo(() => {
    const s = new Set<number>([curY]);
    paiements.forEach((p) => s.add(yearOf(p.date)));
    return [...s].sort((a, b) => b - a);
  }, [paiements, curY]);

  const docsById = useMemo(() => new Map(docs.filter((d) => d.id).map((d) => [d.id!, d])), [docs]);
  const rows = useMemo(() => livreRecettes(year, paiements, docsById, clients, regime), [year, paiements, docsById, clients, regime]);
  const total = rows.reduce((s, r) => s + r.montant, 0);

  const parMois = useMemo(() => {
    const groups: { mois: number; rows: LigneRecette[]; total: number }[] = [];
    for (const r of rows) {
      const mois = Number(r.date.slice(5, 7));
      let g = groups.find((x) => x.mois === mois);
      if (!g) {
        g = { mois, rows: [], total: 0 };
        groups.push(g);
      }
      g.rows.push(r);
      g.total += r.montant;
    }
    return groups;
  }, [rows]);

  const nom = profile.denomination || `${profile.prenom} ${profile.nom}`.trim();
  const idPrincipal = regime.identifiants[0] ? profile.identifiants[regime.identifiants[0].id] : '';
  const titre = L(regime.livreRecettes, lang);

  async function exporter() {
    await saveTextFile(`${titre.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${year}.csv`, recettesCSV(rows, regime));
  }

  return (
    <>
      <PageHeader
        title={titre}
        subtitle={`${t('ledger.subtitle', { year })}${nom ? ` — ${nom}` : ''}${idPrincipal ? ` — ${L(regime.identifiants[0].label, lang)} ${idPrincipal}` : ''}`}
        actions={
          <>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('common.year')} className="no-print">
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button type="button" className="btn no-print" onClick={exporter} disabled={!rows.length}>
              <Icon name="download" /> {t('ledger.exportCsv')}
            </button>
            <button type="button" className="btn primary no-print" onClick={() => window.print()} disabled={!rows.length}>
              <Icon name="print" /> {t('common.printPdf')}
            </button>
          </>
        }
      />
      <div className="card">
        {rows.length === 0 ? (
          <p className="text-2">
            {t('ledger.empty', { year })} <Link to="/documents">{t('docs.tabInvoices')}</Link>
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('ledger.date')}</th>
                  <th>{t('ledger.reference')}</th>
                  <th>{t('ledger.client')}</th>
                  <th>{t('ledger.nature')}</th>
                  <th>{t('ledger.activity')}</th>
                  <th>{t('ledger.method')}</th>
                  <th className="num">{t('ledger.amount')}</th>
                </tr>
              </thead>
              {parMois.map((g) => (
                <tbody key={g.mois}>
                  <tr>
                    <td colSpan={7} style={{ background: 'var(--surface-2)', fontWeight: 600, textTransform: 'capitalize' }}>
                      {moisLong(g.mois, locale)} {year}
                    </td>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="tnum">{fmtDate(r.date)}</td>
                      <td className="tnum">{r.reference}</td>
                      <td>{r.client}</td>
                      <td className="text-2 ellipsis" title={r.nature}>{r.nature}</td>
                      <td className="text-2 small">{L(activiteOf(regime, r.activite).court, lang)}</td>
                      <td className="text-2 small">{r.moyen}</td>
                      <td className={`num${r.montant < 0 ? ' critical' : ''}`}>{fmtMoney(r.montant)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={6} className="text-2" style={{ textAlign: 'right' }}>{t('ledger.subtotal', { mois: moisLong(g.mois, locale) })}</td>
                    <td className="num"><b>{fmtMoney(g.total)}</b></td>
                  </tr>
                </tbody>
              ))}
              <tfoot>
                <tr>
                  <td colSpan={6}>{t('ledger.total', { year })}</td>
                  <td className="num">{fmtMoney(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 12 }}>{t('ledger.note')}</p>
      </div>
    </>
  );
}
