import { useMemo, useState } from 'react';
import ClientForm from '../components/ClientForm';
import { Empty, Icon, PageHeader } from '../components/ui';
import { db } from '../db/db';
import { useClients, useDocuments } from '../db/hooks';
import type { Client } from '../db/types';
import { fmtEUR } from '../lib/format';

export default function Clients() {
  const clients = useClients();
  const docs = useDocuments();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Client | null | undefined>(undefined); // undefined = fermé, null = nouveau

  const stats = useMemo(() => {
    const m = new Map<number, { n: number; total: number; impaye: number }>();
    for (const d of docs) {
      if (d.type !== 'facture' || !d.clientId || d.statut === 'brouillon' || d.statut === 'annulee') continue;
      const s = m.get(d.clientId) ?? { n: 0, total: 0, impaye: 0 };
      s.n += 1;
      s.total += d.totalTTC;
      if (d.statut === 'envoyee') s.impaye += d.totalTTC;
      m.set(d.clientId, s);
    }
    return m;
  }, [docs]);

  const list = clients.filter((c) => {
    const s = q.trim().toLowerCase();
    return !s || [c.nom, c.ville, c.email].some((v) => v.toLowerCase().includes(s));
  });

  async function remove(c: Client) {
    const used = docs.some((d) => d.clientId === c.id);
    if (used) {
      alert('Ce client est lié à des documents : il ne peut pas être supprimé.');
      return;
    }
    if (confirm(`Supprimer le client « ${c.nom} » ?`)) await db.clients.delete(c.id!);
  }

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length > 1 ? 's' : ''}`}
        actions={
          <button type="button" className="btn primary" onClick={() => setEditing(null)}>
            <Icon name="plus" /> Nouveau client
          </button>
        }
      />
      <div className="card">
        <div className="toolbar">
          <input type="text" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un client" />
        </div>
        {list.length === 0 ? (
          <Empty
            title={clients.length ? 'Aucun résultat' : 'Aucun client pour le moment'}
            text={clients.length ? 'Essayez un autre terme de recherche.' : 'Ajoutez vos clients pour les retrouver en un clic dans vos devis et factures.'}
            action={!clients.length && (
              <button type="button" className="btn primary" onClick={() => setEditing(null)}>
                <Icon name="plus" /> Ajouter un client
              </button>
            )}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Ville</th>
                  <th>Contact</th>
                  <th className="num">Factures</th>
                  <th className="num">Facturé TTC</th>
                  <th className="num">En attente</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const s = stats.get(c.id!) ?? { n: 0, total: 0, impaye: 0 };
                  return (
                    <tr key={c.id} className="clickable" onClick={() => setEditing(c)}>
                      <td><b>{c.nom}</b></td>
                      <td className="text-2">{c.type === 'pro' ? 'Professionnel' : 'Particulier'}</td>
                      <td className="text-2">{c.ville}</td>
                      <td className="text-2 small">{c.email || c.telephone}</td>
                      <td className="num">{s.n}</td>
                      <td className="num">{fmtEUR(s.total)}</td>
                      <td className={`num${s.impaye > 0 ? ' warning' : ''}`}>{s.impaye > 0 ? fmtEUR(s.impaye) : '—'}</td>
                      <td>
                        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="btn ghost sm icon" onClick={() => setEditing(c)} aria-label="Modifier"><Icon name="pen" size={15} /></button>
                          <button type="button" className="btn danger sm icon" onClick={() => remove(c)} aria-label="Supprimer"><Icon name="trash" size={15} /></button>
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
      <ClientForm open={editing !== undefined} client={editing ?? null} onClose={() => setEditing(undefined)} />
    </>
  );
}
