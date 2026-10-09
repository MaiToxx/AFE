import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { useClients, useProfile, useRecurrences } from '../db/hooks';
import type { Recurrence } from '../db/types';
import { computeTotals, ligneTotalHT } from '../lib/documents';
import { fmtDate, fmtEUR } from '../lib/format';
import { FREQUENCES, genererOccurrence } from '../lib/recurrences';
import { Badge, Empty, Icon } from './ui';

/** Gestion des modèles de factures récurrentes. */
export default function RecurrencesList() {
  const recurrences = useRecurrences();
  const clients = useClients();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const clientName = (id: number | null) => clients.find((c) => c.id === id)?.nom ?? '—';

  async function generer(r: Recurrence) {
    const id = await genererOccurrence(r, profile);
    navigate(`/documents/${id}`);
  }

  async function supprimer(r: Recurrence) {
    if (confirm(`Supprimer le modèle « ${r.libelle} » ? Les factures déjà générées sont conservées.`)) await db.recurrences.delete(r.id!);
  }

  if (recurrences.length === 0) {
    return (
      <Empty
        title="Aucune facture récurrente"
        text="Ouvrez une facture (maintenance, abonnement, loyer…) et cliquez sur « Rendre récurrente » : une nouvelle facture sera créée à chaque échéance."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Modèle</th>
            <th>Client</th>
            <th>Fréquence</th>
            <th>Prochaine facture</th>
            <th className="num">Montant HT</th>
            <th>Mode</th>
            <th>État</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {recurrences.map((r) => {
            const ht = computeTotals({ lignes: r.lignes, remise: r.remise }, false).totalHT || r.lignes.reduce((s, l) => s + ligneTotalHT(l), 0);
            return (
              <tr key={r.id}>
                <td><b>{r.libelle}</b>{r.objet && r.objet !== r.libelle && <div className="small text-2">{r.objet}</div>}</td>
                <td>{clientName(r.clientId)}</td>
                <td>
                  <select value={r.frequence} onChange={(e) => db.recurrences.update(r.id!, { frequence: e.target.value as Recurrence['frequence'] })} aria-label="Fréquence">
                    {FREQUENCES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="date" value={r.prochaine} onChange={(e) => e.target.value && db.recurrences.update(r.id!, { prochaine: e.target.value })} aria-label="Prochaine facture" />
                </td>
                <td className="num">{fmtEUR(ht)}</td>
                <td className="small text-2">{r.finaliserAuto ? 'Finalisée auto.' : 'Brouillon'}</td>
                <td>
                  <button type="button" className="btn ghost sm" onClick={() => db.recurrences.update(r.id!, { actif: !r.actif })} title={r.actif ? 'Mettre en pause' : 'Réactiver'}>
                    <Badge tone={r.actif ? 'good' : 'neutral'}>{r.actif ? 'Active' : 'En pause'}</Badge>
                  </button>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn ghost sm" onClick={() => generer(r)} title={`Générer maintenant la facture du ${fmtDate(r.prochaine)}`}>
                      <Icon name="plus" size={15} /> Générer
                    </button>
                    <button type="button" className="btn danger sm icon" onClick={() => supprimer(r)} aria-label="Supprimer le modèle"><Icon name="trash" size={15} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
