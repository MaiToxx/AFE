import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { useRegime } from '../db/hooks';
import type { Client } from '../db/types';
import { LANGS, useI18n, type Lang } from '../i18n';
import { useGuard } from '../lib/useGuard';
import { L } from '../regimes';
import { Field, Modal, Seg } from './ui';

const EMPTY: Omit<Client, 'id' | 'createdAt'> = {
  nom: '',
  type: 'pro',
  adresse: '',
  codePostal: '',
  ville: '',
  pays: '',
  email: '',
  telephone: '',
  siret: '',
  notes: '',
  langue: '',
  delaiPaiementJours: null,
};

export default function ClientForm({ open, client, onClose, onSaved }: {
  open: boolean;
  client?: Client | null;
  onClose: () => void;
  onSaved?: (id: number) => void;
}) {
  const { t, lang } = useI18n();
  const regime = useRegime();
  const [form, setForm] = useState<Omit<Client, 'id' | 'createdAt'>>(EMPTY);
  const [error, setError] = useState('');
  const [busy, guard] = useGuard();

  useEffect(() => {
    if (open) {
      setForm(client ? { ...EMPTY, ...client } : EMPTY);
      setError('');
    }
  }, [open, client]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.nom.trim()) {
      setError(t('clients.form.nameRequired'));
      return;
    }
    let id: number;
    if (client?.id) {
      await db.clients.update(client.id, { ...form, nom: form.nom.trim() });
      id = client.id;
    } else {
      id = await db.clients.add({ ...form, nom: form.nom.trim(), createdAt: new Date().toISOString() });
    }
    onSaved?.(id);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? t('clients.form.editTitle') : t('clients.form.newTitle')}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn primary" onClick={() => void guard(save)} disabled={busy}>{t('common.save')}</button>
        </>
      }
    >
      {error && <div className="notice critical">{error}</div>}
      <div className="form-row">
        <Field label={t('clients.form.name')}>
          <input type="text" value={form.nom} onChange={(e) => set({ nom: e.target.value })} autoFocus />
        </Field>
        <div className="field">
          <span className="label">{t('clients.form.type')}</span>
          <Seg
            value={form.type}
            onChange={(type) => set({ type })}
            options={[
              { value: 'pro', label: t('clients.pro') },
              { value: 'particulier', label: t('clients.individual') },
            ]}
          />
        </div>
      </div>
      <Field label={t('clients.form.address')}>
        <input type="text" value={form.adresse} onChange={(e) => set({ adresse: e.target.value })} />
      </Field>
      <div className="form-row">
        <Field label={t('clients.form.zip')}>
          <input type="text" value={form.codePostal} onChange={(e) => set({ codePostal: e.target.value })} />
        </Field>
        <Field label={t('clients.form.city')}>
          <input type="text" value={form.ville} onChange={(e) => set({ ville: e.target.value })} />
        </Field>
        <Field label={t('clients.form.country')}>
          <input type="text" value={form.pays} onChange={(e) => set({ pays: e.target.value })} />
        </Field>
      </div>
      <div className="form-row">
        <Field label={t('clients.form.email')}>
          <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label={t('clients.form.phone')}>
          <input type="tel" value={form.telephone} onChange={(e) => set({ telephone: e.target.value })} />
        </Field>
      </div>
      {form.type === 'pro' && (
        <Field label={L(regime.identifiantClient, lang)} help={t('clients.form.idHelp')}>
          <input type="text" value={form.siret} onChange={(e) => set({ siret: e.target.value })} />
        </Field>
      )}
      <div className="form-row">
        <Field label={t('clients.form.language')}>
          <select value={form.langue ?? ''} onChange={(e) => set({ langue: e.target.value as Lang | '' })}>
            <option value="">{t('clients.form.languageDefault')}</option>
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </Field>
        <Field label={t('clients.form.paymentDelay')} help={t('clients.form.paymentDelayHelp')}>
          <input
            type="text"
            inputMode="numeric"
            value={form.delaiPaiementJours ?? ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 3);
              set({ delaiPaiementJours: v === '' ? null : Number(v) });
            }}
          />
        </Field>
      </div>
      <Field label={t('clients.form.notes')}>
        <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
      </Field>
    </Modal>
  );
}
