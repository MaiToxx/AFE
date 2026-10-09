import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, PageHeader } from '../components/ui';
import { useClients, useDocuments, usePaiements, useProfile } from '../db/hooks';
import { ACTIVITES } from '../db/types';
import { todayISO, yearOf } from '../lib/dates';
import { saveTextFile } from '../lib/desktop';
import { MOIS_LONG, fmtDate, fmtEUR } from '../lib/format';
import { livreRecettes, recettesCSV, type LigneRecette } from '../lib/recettes';

export default function Recettes() {
  const { profile } = useProfile();
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
  const rows = useMemo(() => livreRecettes(year, paiements, docsById, clients), [year, paiements, docsById, clients]);
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

  async function exporter() {
    await saveTextFile(`livre-des-recettes-${year}.csv`, recettesCSV(rows));
  }

  return (
    <>
      <PageHeader
        title="Livre des recettes"
        subtitle={`Registre chronologique des encaissements ${year}${nom ? ` — ${nom}` : ''}${profile.siret ? ` — SIRET ${profile.siret}` : ''}`}
        actions={
          <>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Année" className="no-print">
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button type="button" className="btn no-print" onClick={exporter} disabled={!rows.length}>
              <Icon name="download" /> Exporter CSV
            </button>
            <button type="button" className="btn primary no-print" onClick={() => window.print()} disabled={!rows.length}>
              <Icon name="print" /> Imprimer / PDF
            </button>
          </>
        }
      />
      <div className="card">
        {rows.length === 0 ? (
          <p className="text-2">
            Aucun encaissement en {year}. Le livre se remplit automatiquement à chaque encaissement enregistré sur une facture (<Link to="/documents">Factures</Link>).
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Référence</th>
                  <th>Client</th>
                  <th>Nature</th>
                  <th>Activité</th>
                  <th>Règlement</th>
                  <th className="num">Montant encaissé</th>
                </tr>
              </thead>
              {parMois.map((g) => (
                <tbody key={g.mois}>
                  <tr>
                    <td colSpan={7} style={{ background: 'var(--surface-2)', fontWeight: 600, textTransform: 'capitalize' }}>
                      {MOIS_LONG[g.mois - 1]} {year}
                    </td>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="tnum">{fmtDate(r.date)}</td>
                      <td className="tnum">{r.reference}</td>
                      <td>{r.client}</td>
                      <td className="text-2 ellipsis" title={r.nature}>{r.nature}</td>
                      <td className="text-2 small">{ACTIVITES.find((a) => a.value === r.activite)?.court}</td>
                      <td className="text-2 small">{r.moyen}</td>
                      <td className={`num${r.montant < 0 ? ' critical' : ''}`}>{fmtEUR(r.montant)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={6} className="text-2" style={{ textAlign: 'right' }}>Sous-total {MOIS_LONG[g.mois - 1]}</td>
                    <td className="num"><b>{fmtEUR(g.total)}</b></td>
                  </tr>
                </tbody>
              ))}
              <tfoot>
                <tr>
                  <td colSpan={6}>Total des recettes {year}</td>
                  <td className="num">{fmtEUR(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 12 }}>
          Montants tels qu’encaissés{profile.assujettiTVA ? ' (TTC)' : ''} ; les remboursements d’avoirs apparaissent en négatif. Ce registre doit être conservé 10 ans.
        </p>
      </div>
    </>
  );
}
