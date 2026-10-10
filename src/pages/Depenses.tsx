import { useMemo, useState } from 'react';
import { StatTile } from '../components/charts';
import DepenseForm from '../components/DepenseForm';
import { Empty, Icon, PageHeader } from '../components/ui';
import { db } from '../db/db';
import { useDepenses, useProfile, useRegime } from '../db/hooks';
import { CATEGORIES_DEPENSE, type Depense } from '../db/types';
import { useI18n } from '../i18n';
import { todayISO, yearOf } from '../lib/dates';
import { categorieKey, depensesCSV, depensesParCategorie, totauxDepenses } from '../lib/depenses';
import { saveTextFile } from '../lib/desktop';
import { fmtDate, fmtMoney, fmtMoney0 } from '../lib/format';

export default function Depenses() {
  const { t, tn } = useI18n();
  const { profile } = useProfile();
  const regime = useRegime();
  const depenses = useDepenses();
  const curY = yearOf(todayISO());
  const [year, setYear] = useState(curY);
  const [categorie, setCategorie] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Depense | null | undefined>(undefined);

  const years = useMemo(() => {
    const s = new Set<number>([curY]);
    depenses.forEach((d) => s.add(yearOf(d.date)));
    return [...s].sort((a, b) => b - a);
  }, [depenses, curY]);

  const annee = useMemo(() => depenses.filter((d) => yearOf(d.date) === year).sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)), [depenses, year]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return annee.filter((d) => (!categorie || d.categorie === categorie) && (!needle || `${d.libelle} ${d.fournisseur} ${d.reference} ${d.notes}`.toLowerCase().includes(needle)));
  }, [annee, categorie, q]);
  const totaux = useMemo(() => totauxDepenses(annee, year, profile.assujettiTVA), [annee, year, profile.assujettiTVA]);
  const parCategorie = useMemo(() => depensesParCategorie(annee, year, profile.assujettiTVA).slice(0, 4), [annee, year, profile.assujettiTVA]);
  const sel = rows.reduce((s, d) => ({ ht: s.ht + d.montantHT, tva: s.tva + d.montantTVA, ttc: s.ttc + d.montantTTC }), { ht: 0, tva: 0, ttc: 0 });

  async function remove(d: Depense) {
    if (confirm(t('exp.confirmDelete', { name: d.libelle }))) await db.depenses.delete(d.id!);
  }
  async function exporter() {
    await saveTextFile(`${t('exp.file')}-${year}.csv`, depensesCSV([...rows].reverse()));
  }

  return (
    <>
      <PageHeader
        title={t('exp.title')}
        subtitle={t('exp.subtitle', { year })}
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
            <button type="button" className="btn no-print" onClick={() => window.print()} disabled={!rows.length}>
              <Icon name="print" /> {t('common.printPdf')}
            </button>
            <button type="button" className="btn primary no-print" onClick={() => setEditing(null)}>
              <Icon name="plus" /> {t('exp.new')}
            </button>
          </>
        }
      />

      <div className={`grid ${profile.assujettiTVA ? 'grid-4' : 'grid-3'}`} style={{ marginBottom: 16 }}>
        <StatTile label={t('exp.totalIncl', { year })} value={fmtMoney0(totaux.ttc)} sub={tn('exp.count', totaux.nb)} />
        <StatTile label={t('exp.deductibleTotal')} value={fmtMoney0(totaux.deductible)} sub={t('exp.deductibleTotalHelp')} />
        {profile.assujettiTVA && <StatTile label={t('exp.taxRecoverable', { tva: regime.tva.nom })} value={fmtMoney0(totaux.tvaDeductible)} sub={t('exp.taxRecoverableHelp')} />}
        <StatTile
          label={t('exp.topCategories')}
          value={parCategorie[0] ? t(categorieKey(parCategorie[0].categorie)) : '—'}
          sub={parCategorie.length ? parCategorie.map((c) => `${t(categorieKey(c.categorie))} ${fmtMoney0(c.montant)}`).join(' · ') : t('exp.none')}
        />
      </div>

      <div className="card">
        <div className="filters no-print" style={{ marginBottom: 12 }}>
          <input type="text" placeholder={t('exp.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} aria-label={t('exp.category')}>
            <option value="">{t('exp.allCategories')}</option>
            {CATEGORIES_DEPENSE.map((c) => (
              <option key={c.value} value={c.value}>{t(c.key)}</option>
            ))}
          </select>
          <span className="small text-2">{tn('exp.count', rows.length)} · {fmtMoney(sel.ttc)}</span>
        </div>
        {rows.length === 0 ? (
          <Empty
            title={annee.length ? t('common.noMatch') : t('exp.emptyTitle')}
            text={annee.length ? t('common.tryOther') : t('exp.emptyText')}
            action={!annee.length && (
              <button type="button" className="btn primary" onClick={() => setEditing(null)}>
                <Icon name="plus" /> {t('exp.new')}
              </button>
            )}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('exp.label')}</th>
                  <th>{t('exp.category')}</th>
                  <th className="num">{t('exp.excl')}</th>
                  <th className="num">{regime.tva.nom}</th>
                  <th className="num">{t('exp.incl')}</th>
                  <th>{t('exp.flags')}</th>
                  <th className="no-print" />
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="clickable" onClick={() => setEditing(d)}>
                    <td className="tnum">{fmtDate(d.date)}</td>
                    <td>
                      <b>{d.libelle}</b>
                      {(d.fournisseur || d.reference) && <div className="small text-2">{[d.fournisseur, d.reference].filter(Boolean).join(' · ')}</div>}
                    </td>
                    <td className="text-2 small">{t(categorieKey(d.categorie))}</td>
                    <td className="num">{fmtMoney(d.montantHT)}</td>
                    <td className="num text-2">{d.montantTVA ? fmtMoney(d.montantTVA) : '—'}</td>
                    <td className="num"><b>{fmtMoney(d.montantTTC)}</b></td>
                    <td className="small">
                      {!d.deductible && <span className="tag">{t('exp.notDeductible')}</span>}
                      {d.tvaDeductible && d.montantTVA > 0 && profile.assujettiTVA && <span className="tag">{t('exp.taxRecovered')}</span>}
                    </td>
                    <td className="no-print">
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="btn ghost sm icon" onClick={() => setEditing(d)} aria-label={t('common.edit')}><Icon name="pen" size={15} /></button>
                        <button type="button" className="btn danger sm icon" onClick={() => remove(d)} aria-label={t('common.delete')}><Icon name="trash" size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>{t('common.total')}</td>
                  <td className="num">{fmtMoney(sel.ht)}</td>
                  <td className="num">{fmtMoney(sel.tva)}</td>
                  <td className="num">{fmtMoney(sel.ttc)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 12 }}>{t('exp.note')}</p>
      </div>

      <DepenseForm open={editing !== undefined} depense={editing ?? null} onClose={() => setEditing(undefined)} />
    </>
  );
}
