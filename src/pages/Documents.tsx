import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Empty, Icon, PageHeader } from '../components/ui';
import { useClients, useDocuments, usePaiements } from '../db/hooks';
import type { Doc, DocType } from '../db/types';
import { todayISO } from '../lib/dates';
import { montantPaye, statutInfo, supprimerDoc } from '../lib/documents';
import { fmtDate, fmtEUR } from '../lib/format';

const STATUTS: Record<DocType, { value: string; label: string }[]> = {
  facture: [
    { value: 'tous', label: 'Tous les statuts' },
    { value: 'brouillon', label: 'Brouillons' },
    { value: 'envoyee', label: 'En attente de paiement' },
    { value: 'retard', label: 'En retard' },
    { value: 'payee', label: 'Payées' },
    { value: 'annulee', label: 'Annulées' },
  ],
  devis: [
    { value: 'tous', label: 'Tous les statuts' },
    { value: 'brouillon', label: 'Brouillons' },
    { value: 'envoye', label: 'Envoyés' },
    { value: 'accepte', label: 'Acceptés' },
    { value: 'refuse', label: 'Refusés' },
  ],
  avoir: [
    { value: 'tous', label: 'Tous les statuts' },
    { value: 'brouillon', label: 'Brouillons' },
    { value: 'envoye', label: 'Émis' },
  ],
};

const LABELS: Record<DocType, { onglet: string; vide: string; nouveau: string; date: string }> = {
  facture: { onglet: 'Factures', vide: 'Aucune facture', nouveau: 'Nouvelle facture', date: 'Échéance' },
  devis: { onglet: 'Devis', vide: 'Aucun devis', nouveau: 'Nouveau devis', date: 'Validité' },
  avoir: { onglet: 'Avoirs', vide: 'Aucun avoir', nouveau: '', date: 'Date' },
};

export default function Documents() {
  const [params, setParams] = useSearchParams();
  const t = params.get('type');
  const type: DocType = t === 'devis' || t === 'avoir' ? t : 'facture';
  const navigate = useNavigate();
  const docs = useDocuments();
  const paiements = usePaiements();
  const clients = useClients();
  const [q, setQ] = useState('');
  const [statut, setStatut] = useState('tous');
  const today = todayISO();

  const clientName = (d: Doc) => d.client?.nom ?? clients.find((c) => c.id === d.clientId)?.nom ?? '—';

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return docs
      .filter((d) => d.type === type)
      .filter((d) => {
        if (statut === 'tous') return true;
        if (statut === 'retard') return d.statut === 'envoyee' && d.dateEcheance < today;
        return d.statut === statut;
      })
      .filter((d) => !s || [d.numero, d.objet, clientName(d)].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.dateEmission.localeCompare(a.dateEmission) || b.numeroSeq - a.numeroSeq || (b.id ?? 0) - (a.id ?? 0));
  }, [docs, type, statut, q, clients, today]);

  const total = list.reduce((s, d) => s + (d.statut === 'annulee' ? 0 : d.totalTTC), 0);

  function switchType(t: DocType) {
    setParams({ type: t });
    setStatut('tous');
  }

  async function remove(d: Doc) {
    if (confirm('Supprimer ce brouillon ?')) await supprimerDoc(d);
  }

  const isFacture = type === 'facture';

  return (
    <>
      <PageHeader
        title="Factures & devis"
        actions={
          <>
            <button type="button" className="btn" onClick={() => navigate('/documents/nouveau?type=devis')}>
              <Icon name="plus" /> Devis
            </button>
            <button type="button" className="btn primary" onClick={() => navigate('/documents/nouveau?type=facture')}>
              <Icon name="plus" /> Facture
            </button>
          </>
        }
      />
      <div className="tabs" role="tablist">
        {(['facture', 'devis', 'avoir'] as DocType[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={type === k} className={type === k ? 'active' : ''} onClick={() => switchType(k)}>
            {LABELS[k].onglet}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="toolbar">
          <input type="text" placeholder="Numéro, client, objet…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
          <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut">
            {STATUTS[type].map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <span className="spacer" />
          <span className="small text-2">{list.length} document{list.length > 1 ? 's' : ''} · {fmtEUR(total)}</span>
        </div>
        {list.length === 0 ? (
          <Empty
            title={LABELS[type].vide}
            text={
              q || statut !== 'tous'
                ? 'Aucun document ne correspond à ces critères.'
                : type === 'avoir'
                  ? 'Un avoir se crée depuis une facture finalisée (bouton « Créer un avoir » dans la facture) : c’est la seule façon légale de corriger ou d’annuler une facture déjà transmise.'
                  : `Créez votre ${isFacture ? 'première facture' : 'premier devis'} en un clic.`
            }
            action={!q && statut === 'tous' && type !== 'avoir' && (
              <button type="button" className="btn primary" onClick={() => navigate(`/documents/nouveau?type=${type}`)}>
                <Icon name="plus" /> {LABELS[type].nouveau}
              </button>
            )}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Objet</th>
                  <th className="num">Montant TTC</th>
                  <th>Statut</th>
                  <th>{LABELS[type].date}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((d) => {
                  const paye = montantPaye(d, paiements);
                  const st = statutInfo(d, paye, today);
                  return (
                    <tr key={d.id} className="clickable" onClick={() => navigate(`/documents/${d.id}`)}>
                      <td className="tnum"><b>{d.numero || <span className="muted">Brouillon</span>}</b></td>
                      <td className="tnum">{fmtDate(d.dateEmission)}</td>
                      <td>{clientName(d)}</td>
                      <td className="text-2 ellipsis" title={d.objet}>{d.objet || <span className="muted">—</span>}</td>
                      <td className="num">{type === 'avoir' ? `− ${fmtEUR(d.totalTTC)}` : fmtEUR(d.totalTTC)}</td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="tnum text-2">{fmtDate(d.dateEcheance)}</td>
                      <td>
                        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="btn ghost sm icon" title="PDF / Imprimer" aria-label="PDF / Imprimer" onClick={() => navigate(`/documents/${d.id}/imprimer?print=1`)}>
                            <Icon name="print" size={15} />
                          </button>
                          {d.statut === 'brouillon' && (
                            <button type="button" className="btn danger sm icon" title="Supprimer" aria-label="Supprimer" onClick={() => remove(d)}>
                              <Icon name="trash" size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
