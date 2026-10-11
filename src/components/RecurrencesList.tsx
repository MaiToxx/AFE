import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { useClients, useProfile, useRecurrences } from '../db/hooks';
import type { Recurrence } from '../db/types';
import { useI18n } from '../i18n';
import { computeTotals } from '../lib/documents';
import { fmtDate, fmtMoney } from '../lib/format';
import { FREQUENCES, genererOccurrence } from '../lib/recurrences';
import { useGuard } from '../lib/useGuard';
import { Badge, Empty, Icon } from './ui';

/** Gestion des modèles de factures récurrentes. */
export default function RecurrencesList() {
  const { t } = useI18n();
  const recurrences = useRecurrences();
  const clients = useClients();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [busy, guard] = useGuard();
  const clientName = (id: number | null) => clients.find((c) => c.id === id)?.nom ?? '—';

  async function generer(r: Recurrence) {
    // null : cette occurrence vient d'être générée ailleurs (autre fenêtre) ; la liste se met à jour seule.
    const id = await genererOccurrence(r, profile);
    if (id !== null) navigate(`/documents/${id}`);
  }

  async function supprimer(r: Recurrence) {
    if (confirm(t('recurrence.confirmDelete', { name: r.libelle }))) await db.recurrences.delete(r.id!);
  }

  if (recurrences.length === 0) {
    return <Empty title={t('recurrence.emptyTitle')} text={t('recurrence.emptyText')} />;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t('recurrence.model')}</th>
            <th>{t('common.client')}</th>
            <th>{t('recurrence.frequency')}</th>
            <th>{t('recurrence.nextInvoice')}</th>
            <th className="num">{t('editor.totalExcl')}</th>
            <th>{t('recurrence.mode')}</th>
            <th>{t('common.state')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {recurrences.map((r) => {
            const ht = computeTotals({ lignes: r.lignes, remise: r.remise, remiseType: r.remiseType, retenue: 0 }, false, false).totalHT;
            return (
              <tr key={r.id}>
                <td><b>{r.libelle}</b>{r.objet && r.objet !== r.libelle && <div className="small text-2">{r.objet}</div>}</td>
                <td>{clientName(r.clientId)}</td>
                <td>
                  <select value={r.frequence} onChange={(e) => db.recurrences.update(r.id!, { frequence: e.target.value as Recurrence['frequence'] })} aria-label={t('recurrence.frequency')}>
                    {FREQUENCES.map((f) => (
                      <option key={f.value} value={f.value}>{t(f.key)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="date" value={r.prochaine} onChange={(e) => e.target.value && db.recurrences.update(r.id!, { prochaine: e.target.value })} aria-label={t('recurrence.nextInvoice')} />
                </td>
                <td className="num">{fmtMoney(ht)}</td>
                <td className="small text-2">{r.finaliserAuto ? t('recurrence.modeAuto') : t('status.draft')}</td>
                <td>
                  <button type="button" className="btn ghost sm" onClick={() => db.recurrences.update(r.id!, { actif: !r.actif })} title={r.actif ? t('recurrence.pause') : t('recurrence.resume')}>
                    <Badge tone={r.actif ? 'good' : 'neutral'}>{r.actif ? t('recurrence.active') : t('recurrence.paused')}</Badge>
                  </button>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn ghost sm" onClick={() => void guard(() => generer(r))} disabled={busy} title={t('recurrence.generateTitle', { date: fmtDate(r.prochaine) })}>
                      <Icon name="plus" size={15} /> {t('recurrence.generate')}
                    </button>
                    <button type="button" className="btn danger sm icon" onClick={() => supprimer(r)} aria-label={t('common.delete')}><Icon name="trash" size={15} /></button>
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
