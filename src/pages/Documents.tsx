import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import RecurrencesList from '../components/RecurrencesList';
import { Badge, Empty, Icon, PageHeader } from '../components/ui';
import { useClients, useDocuments, usePaiements, useRelances } from '../db/hooks';
import type { Doc, DocType } from '../db/types';
import { useI18n } from '../i18n';
import { todayISO } from '../lib/dates';
import { statutInfo, supprimerDoc } from '../lib/documents';
import { fmtDate, fmtMoney, round2 } from '../lib/format';
import { encaisseParFacture } from '../lib/stats';

const STATUTS: Record<DocType, { value: string; key: string }[]> = {
  facture: [
    { value: 'tous', key: 'docs.allStatuses' },
    { value: 'brouillon', key: 'docs.f.drafts' },
    { value: 'envoyee', key: 'docs.f.awaiting' },
    { value: 'retard', key: 'docs.f.late' },
    { value: 'payee', key: 'docs.f.paid' },
    { value: 'annulee', key: 'docs.f.cancelled' },
  ],
  devis: [
    { value: 'tous', key: 'docs.allStatuses' },
    { value: 'brouillon', key: 'docs.f.drafts' },
    { value: 'envoye', key: 'docs.q.sent' },
    { value: 'accepte', key: 'docs.q.accepted' },
    { value: 'refuse', key: 'docs.q.refused' },
  ],
  avoir: [
    { value: 'tous', key: 'docs.allStatuses' },
    { value: 'brouillon', key: 'docs.f.drafts' },
    { value: 'envoye', key: 'docs.c.issued' },
  ],
};

const TABS: Record<DocType, { onglet: string; vide: string; nouveau: string; date: string }> = {
  facture: { onglet: 'docs.tabInvoices', vide: 'docs.noInvoice', nouveau: 'docs.newInvoice', date: 'docs.dueDate' },
  devis: { onglet: 'docs.tabQuotes', vide: 'docs.noQuote', nouveau: 'docs.newQuote', date: 'docs.validity' },
  avoir: { onglet: 'docs.tabCredits', vide: 'docs.noCredit', nouveau: '', date: 'common.date' },
};

export default function Documents() {
  const { t, tn } = useI18n();
  const [params, setParams] = useSearchParams();
  const tp = params.get('type');
  const tab: DocType | 'recurrente' = tp === 'devis' || tp === 'avoir' || tp === 'recurrente' ? tp : 'facture';
  const type: DocType = tab === 'recurrente' ? 'facture' : tab;
  const navigate = useNavigate();
  const docs = useDocuments();
  const paiements = usePaiements();
  const clients = useClients();
  const relances = useRelances();
  const [q, setQ] = useState('');
  // La liste suit la saisie avec un léger différé : la frappe reste fluide même avec beaucoup de documents.
  const recherche = useDeferredValue(q);
  const [statut, setStatut] = useState('tous');
  const today = todayISO();

  const nomsClients = useMemo(() => new Map(clients.map((c) => [c.id, c.nom])), [clients]);
  const encaisse = useMemo(() => encaisseParFacture(paiements), [paiements]);
  const nbRelances = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of relances) m.set(r.factureId, (m.get(r.factureId) ?? 0) + 1);
    return m;
  }, [relances]);
  const clientName = (d: Doc) => d.client?.nom ?? nomsClients.get(d.clientId ?? undefined) ?? '—';

  const list = useMemo(() => {
    const s = recherche.trim().toLowerCase();
    return docs
      .filter((d) => d.type === type)
      .filter((d) => {
        if (statut === 'tous') return true;
        if (statut === 'retard') return d.statut === 'envoyee' && d.dateEcheance < today;
        return d.statut === statut;
      })
      .filter((d) => !s || [d.numero, d.objet, clientName(d)].some((v) => (v ?? '').toLowerCase().includes(s)))
      .sort((a, b) => b.dateEmission.localeCompare(a.dateEmission) || b.numeroSeq - a.numeroSeq || (b.id ?? 0) - (a.id ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, type, statut, recherche, nomsClients, today]);

  const total = list.reduce((s, d) => s + (d.statut === 'annulee' ? 0 : d.totalTTC), 0);

  function switchType(k: DocType | 'recurrente') {
    setParams({ type: k });
    setStatut('tous');
  }

  async function remove(d: Doc) {
    if (confirm(t('docs.confirmDeleteDraft'))) await supprimerDoc(d);
  }

  return (
    <>
      <PageHeader
        title={t('docs.title')}
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
      <div className="tabs" role="tablist">
        {(['facture', 'devis', 'avoir', 'recurrente'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => switchType(k)}>
            {k === 'recurrente' ? t('docs.tabRecurring') : t(TABS[k].onglet)}
          </button>
        ))}
      </div>
      <div className="card">
        {tab === 'recurrente' ? (
          <RecurrencesList />
        ) : (
          <>
            <div className="toolbar">
              <input type="text" placeholder={t('docs.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
              <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label={t('docs.filterStatus')}>
                {STATUTS[type].map((s) => (
                  <option key={s.value} value={s.value}>{t(s.key)}</option>
                ))}
              </select>
              <span className="spacer" />
              <span className="small text-2">{tn('docs.count', list.length)} · {fmtMoney(total)}</span>
            </div>
            {list.length === 0 ? (
              <Empty
                title={t(TABS[type].vide)}
                text={q || statut !== 'tous' ? t('common.noMatch') : type === 'avoir' ? t('docs.creditHint') : t('docs.createFirst')}
                action={!q && statut === 'tous' && type !== 'avoir' && (
                  <button type="button" className="btn primary" onClick={() => navigate(`/documents/nouveau?type=${type}`)}>
                    <Icon name="plus" /> {t(TABS[type].nouveau)}
                  </button>
                )}
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('docs.number')}</th>
                      <th>{t('common.date')}</th>
                      <th>{t('common.client')}</th>
                      <th>{t('editor.subject')}</th>
                      <th className="num">{t('docs.amountIncl')}</th>
                      <th>{t('common.status')}</th>
                      <th>{t(TABS[type].date)}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((d) => {
                      const paye = round2(encaisse.get(d.id ?? 0) ?? 0);
                      const st = statutInfo(d, paye, today);
                      const nbRel = nbRelances.get(d.id ?? 0) ?? 0;
                      return (
                        <tr key={d.id} className="clickable" onClick={() => navigate(`/documents/${d.id}`)}>
                          <td className="tnum"><b>{d.numero || <span className="muted">{t('status.draft')}</span>}</b></td>
                          <td className="tnum">{fmtDate(d.dateEmission)}</td>
                          <td>{clientName(d)}</td>
                          <td className="text-2 ellipsis" title={d.objet}>{d.objet || <span className="muted">—</span>}</td>
                          <td className="num">{type === 'avoir' ? `− ${fmtMoney(d.totalTTC)}` : fmtMoney(d.totalTTC)}</td>
                          <td>
                            <Badge tone={st.tone}>{t(st.key)}</Badge>
                            {nbRel > 0 && d.statut === 'envoyee' && <div className="small muted">{t('docs.reminded', { n: nbRel })}</div>}
                          </td>
                          <td className="tnum text-2">{fmtDate(d.dateEcheance)}</td>
                          <td>
                            <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                              <button type="button" className="btn ghost sm icon" title={t('docs.pdf')} aria-label={t('docs.pdf')} onClick={() => navigate(`/documents/${d.id}/imprimer?print=1`)}>
                                <Icon name="print" size={15} />
                              </button>
                              {d.statut === 'brouillon' && (
                                <button type="button" className="btn danger sm icon" title={t('common.delete')} aria-label={t('common.delete')} onClick={() => remove(d)}>
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
          </>
        )}
      </div>
    </>
  );
}
