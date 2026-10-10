import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { useProfile, useRegime, useRegimeOverrides } from '../db/hooks';
import { CATEGORIES_DEPENSE, MOYENS, type CategorieDepense, type Depense, type MoyenPaiement } from '../db/types';
import { useI18n } from '../i18n';
import { isValidISO, todayISO, yearOf } from '../lib/dates';
import { ventiler } from '../lib/depenses';
import { fmtMoney } from '../lib/format';
import { paramsFor } from '../regimes/engine';
import { Check, Field, Icon, Modal, NumInput } from './ui';

interface Props {
  open: boolean;
  depense: Depense | null;
  onClose: () => void;
}

/** Saisie d'une dépense : montant TTC et taux de taxe, le HT et la taxe sont déduits. */
export default function DepenseForm({ open, depense, onClose }: Props) {
  const { t } = useI18n();
  const { profile } = useProfile();
  const regime = useRegime();
  const overrides = useRegimeOverrides(regime.code);
  const { params } = paramsFor(regime, overrides, yearOf(todayISO()));
  const tauxDispo = [...new Set([...params.tvaTaux, 0])].sort((a, b) => b - a);

  const vierge = (): Depense => ({
    date: todayISO(),
    libelle: '',
    fournisseur: '',
    categorie: 'fournitures',
    montantHT: 0,
    tauxTVA: params.tvaDefaut,
    montantTVA: 0,
    montantTTC: 0,
    tvaDeductible: profile.assujettiTVA,
    deductible: true,
    moyen: 'cb',
    reference: '',
    notes: '',
    createdAt: new Date().toISOString(),
  });

  const [form, setForm] = useState<Depense>(vierge);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(depense ? { ...depense } : vierge());
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, depense]);

  const set = (patch: Partial<Depense>) => setForm((f) => ({ ...f, ...patch }));
  const setMontant = (ttc: number, taux = form.tauxTVA) => set({ tauxTVA: taux, ...ventiler(ttc, taux) });
  const setCategorie = (categorie: CategorieDepense) => {
    const cat = CATEGORIES_DEPENSE.find((c) => c.value === categorie);
    set({ categorie, deductible: cat ? cat.deductible : true });
  };

  async function save() {
    if (!form.libelle.trim()) {
      setError(t('exp.labelRequired'));
      return;
    }
    if (!isValidISO(form.date)) {
      setError(t('exp.dateInvalid'));
      return;
    }
    if (form.montantTTC <= 0) {
      setError(t('exp.amountRequired'));
      return;
    }
    await db.depenses.put({ ...form, libelle: form.libelle.trim(), fournisseur: form.fournisseur.trim() });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={depense ? t('exp.editTitle') : t('exp.newTitle')}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn primary" onClick={save}>
            <Icon name="check" /> {t('common.save')}
          </button>
        </>
      }
    >
      {error && <div className="notice critical" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-row">
        <Field label={t('exp.label')}>
          <input type="text" value={form.libelle} autoFocus onChange={(e) => set({ libelle: e.target.value })} placeholder={t('exp.labelPlaceholder')} />
        </Field>
        <Field label={t('exp.supplier')}>
          <input type="text" value={form.fournisseur} onChange={(e) => set({ fournisseur: e.target.value })} />
        </Field>
      </div>
      <div className="form-row">
        <Field label={t('common.date')}>
          <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label={t('exp.category')}>
          <select value={form.categorie} onChange={(e) => setCategorie(e.target.value as CategorieDepense)}>
            {CATEGORIES_DEPENSE.map((c) => (
              <option key={c.value} value={c.value}>{t(c.key)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('editor.paymentMethod')}>
          <select value={form.moyen} onChange={(e) => set({ moyen: e.target.value as MoyenPaiement })}>
            {MOYENS.map((m) => (
              <option key={m.value} value={m.value}>{t(m.key)}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="form-row">
        <Field label={t('exp.amountIncl')}>
          <NumInput value={form.montantTTC} onChange={(n) => setMontant(n)} min={0} />
        </Field>
        <Field label={t('exp.taxRate', { tva: regime.tva.nom })}>
          <select value={form.tauxTVA} onChange={(e) => setMontant(form.montantTTC, Number(e.target.value))}>
            {tauxDispo.map((x) => (
              <option key={x} value={x}>{x} %</option>
            ))}
          </select>
        </Field>
        <Field label={t('exp.breakdown')}>
          <span className="tnum" style={{ display: 'block', paddingTop: 8 }}>
            {t('exp.excl')} {fmtMoney(form.montantHT)} · {regime.tva.nom} {fmtMoney(form.montantTVA)}
          </span>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <Check label={t('exp.deductible')} help={t('exp.deductibleHelp')} checked={form.deductible} onChange={(v) => set({ deductible: v })} />
        <Check label={t('exp.taxDeductible', { tva: regime.tva.nom })} help={profile.assujettiTVA ? t('exp.taxDeductibleHelp') : t('exp.taxDeductibleOff')} checked={form.tvaDeductible} onChange={(v) => set({ tvaDeductible: v })} />
      </div>
      <div className="form-row" style={{ marginTop: 10 }}>
        <Field label={t('exp.reference')}>
          <input type="text" value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder={t('exp.referencePlaceholder')} />
        </Field>
        <Field label={t('clients.form.notes')}>
          <input type="text" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
