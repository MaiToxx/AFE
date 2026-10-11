import { useMemo, useRef, useState } from 'react';
import ClientForm from '../components/ClientForm';
import { Empty, Icon, Notice, PageHeader } from '../components/ui';
import { db } from '../db/db';
import { useClients, useDocuments, useRegime } from '../db/hooks';
import type { Client } from '../db/types';
import { useI18n } from '../i18n';
import { lireTexte, parseCSV } from '../lib/csv';
import { todayISO } from '../lib/dates';
import { saveTextFile } from '../lib/desktop';
import { clientsCSV, clientsDepuisCSV } from '../lib/exports';
import { fmtMoney } from '../lib/format';
import { L } from '../regimes';

export default function Clients() {
  const { t, tn, lang } = useI18n();
  const regime = useRegime();
  const clients = useClients();
  const docs = useDocuments();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Client | null | undefined>(undefined); // undefined = fermé, null = nouveau
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone?: 'warning' | 'critical'; text: string } | null>(null);

  const stats = useMemo(() => {
    const m = new Map<number, { n: number; total: number; impaye: number }>();
    for (const d of docs) {
      if (d.type !== 'facture' || !d.clientId || d.statut === 'brouillon' || d.statut === 'annulee') continue;
      const s = m.get(d.clientId) ?? { n: 0, total: 0, impaye: 0 };
      s.n += 1;
      s.total += d.totalTTC;
      if (d.statut === 'envoyee') s.impaye += d.netAPayer ?? d.totalTTC;
      m.set(d.clientId, s);
    }
    return m;
  }, [docs]);

  const list = clients.filter((c) => {
    const s = q.trim().toLowerCase();
    return !s || [c.nom, c.ville, c.email].some((v) => v.toLowerCase().includes(s));
  });

  async function remove(c: Client) {
    if (docs.some((d) => d.clientId === c.id)) {
      alert(t('clients.cannotDelete'));
      return;
    }
    // Un modèle récurrent continuerait de générer des factures pour un client qui n'existe plus.
    if ((await db.recurrences.toArray()).some((r) => r.clientId === c.id)) {
      alert(t('clients.usedByRecurrence'));
      return;
    }
    if (confirm(t('clients.confirmDelete', { name: c.nom }))) await db.clients.delete(c.id!);
  }

  async function exporter() {
    await saveTextFile(`afe-${t('clients.file')}-${todayISO()}.csv`, clientsCSV(clients));
  }

  /** Import depuis le fichier CSV d'un tableur ou d'un autre logiciel : les clients déjà présents sont ignorés. */
  async function importer(fichier: File | undefined) {
    if (fileRef.current) fileRef.current.value = '';
    if (!fichier) return;
    setMsg(null);
    try {
      const lu = clientsDepuisCSV(parseCSV(await lireTexte(fichier)), await db.clients.toArray());
      if (!lu) return setMsg({ tone: 'critical', text: t('clients.importNoName') });
      if (lu.nouveaux.length === 0) return setMsg({ tone: 'warning', text: t('clients.importNone') });
      if (!confirm(t('clients.importConfirm', { n: lu.nouveaux.length, doublons: lu.doublons }))) return;
      await db.clients.bulkAdd(lu.nouveaux);
      setMsg({ text: t('clients.importDone', { n: lu.nouveaux.length }) });
    } catch {
      setMsg({ tone: 'critical', text: t('clients.importFailed') });
    }
  }

  return (
    <>
      <PageHeader
        title={t('clients.title')}
        subtitle={tn('clients.count', clients.length)}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => void importer(e.target.files?.[0])} />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()} title={t('clients.importHelp')}>
              <Icon name="upload" /> {t('common.import')}
            </button>
            <button type="button" className="btn" onClick={exporter} disabled={!clients.length}>
              <Icon name="download" /> {t('ledger.exportCsv')}
            </button>
            <button type="button" className="btn primary" onClick={() => setEditing(null)}>
              <Icon name="plus" /> {t('clients.new')}
            </button>
          </>
        }
      />
      {msg && <div style={{ marginBottom: 14 }}><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <div className="card">
        <div className="toolbar">
          <input type="text" placeholder={t('common.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
        </div>
        {list.length === 0 ? (
          <Empty
            title={clients.length ? t('common.noMatch') : t('clients.emptyTitle')}
            text={clients.length ? t('common.tryOther') : t('clients.emptyText')}
            action={!clients.length && (
              <button type="button" className="btn primary" onClick={() => setEditing(null)}>
                <Icon name="plus" /> {t('clients.add')}
              </button>
            )}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('clients.form.name')}</th>
                  <th>{t('clients.form.type')}</th>
                  <th>{t('clients.form.city')}</th>
                  <th>{t('clients.contact')}</th>
                  <th>{L(regime.identifiantClient, lang)}</th>
                  <th className="num">{t('docs.tabInvoices')}</th>
                  <th className="num">{t('clients.invoicedIncl')}</th>
                  <th className="num">{t('clients.outstanding')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const s = stats.get(c.id!) ?? { n: 0, total: 0, impaye: 0 };
                  return (
                    <tr key={c.id} className="clickable" onClick={() => setEditing(c)}>
                      <td><b>{c.nom}</b></td>
                      <td className="text-2">{c.type === 'pro' ? t('clients.pro') : t('clients.individual')}</td>
                      <td className="text-2">{c.ville}{c.pays ? `, ${c.pays}` : ''}</td>
                      <td className="text-2 small">{c.email || c.telephone}</td>
                      <td className="text-2 small tnum">{c.siret || '—'}</td>
                      <td className="num">{s.n}</td>
                      <td className="num">{fmtMoney(s.total)}</td>
                      <td className={`num${s.impaye > 0 ? ' warning' : ''}`}>{s.impaye > 0 ? fmtMoney(s.impaye) : '—'}</td>
                      <td>
                        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="btn ghost sm icon" onClick={() => setEditing(c)} aria-label={t('common.edit')}><Icon name="pen" size={15} /></button>
                          <button type="button" className="btn danger sm icon" onClick={() => remove(c)} aria-label={t('common.delete')}><Icon name="trash" size={15} /></button>
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
