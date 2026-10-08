import { useEffect, useState } from 'react';
import { db } from '../db/db';
import type { Client } from '../db/types';
import { Field, Modal, Seg } from './ui';

const EMPTY: Omit<Client, 'id' | 'createdAt'> = {
  nom: '',
  type: 'pro',
  adresse: '',
  codePostal: '',
  ville: '',
  email: '',
  telephone: '',
  siret: '',
  notes: '',
};

export default function ClientForm({ open, client, onClose, onSaved }: {
  open: boolean;
  client?: Client | null;
  onClose: () => void;
  onSaved?: (id: number) => void;
}) {
  const [form, setForm] = useState<Omit<Client, 'id' | 'createdAt'>>(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(client ? { ...EMPTY, ...client } : EMPTY);
      setError('');
    }
  }, [open, client]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.nom.trim()) {
      setError('Le nom du client est obligatoire.');
      return;
    }
    let id: number;
    if (client?.id) {
      await db.clients.update(client.id, { ...form });
      id = client.id;
    } else {
      id = await db.clients.add({ ...form, createdAt: new Date().toISOString() });
    }
    onSaved?.(id);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Modifier le client' : 'Nouveau client'}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="button" className="btn primary" onClick={save}>Enregistrer</button>
        </>
      }
    >
      {error && <div className="notice critical">{error}</div>}
      <div className="form-row">
        <Field label="Nom ou raison sociale">
          <input type="text" value={form.nom} onChange={(e) => set({ nom: e.target.value })} autoFocus />
        </Field>
        <div className="field">
          <span className="label">Type</span>
          <Seg
            value={form.type}
            onChange={(type) => set({ type })}
            options={[
              { value: 'pro', label: 'Professionnel' },
              { value: 'particulier', label: 'Particulier' },
            ]}
          />
        </div>
      </div>
      <Field label="Adresse">
        <input type="text" value={form.adresse} onChange={(e) => set({ adresse: e.target.value })} />
      </Field>
      <div className="form-row">
        <Field label="Code postal">
          <input type="text" value={form.codePostal} onChange={(e) => set({ codePostal: e.target.value })} />
        </Field>
        <Field label="Ville">
          <input type="text" value={form.ville} onChange={(e) => set({ ville: e.target.value })} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="E-mail">
          <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Téléphone">
          <input type="tel" value={form.telephone} onChange={(e) => set({ telephone: e.target.value })} />
        </Field>
      </div>
      {form.type === 'pro' && (
        <Field label="SIRET" help="Obligatoire sur les factures aux professionnels à partir de septembre 2026 (facturation électronique).">
          <input type="text" value={form.siret} onChange={(e) => set({ siret: e.target.value })} />
        </Field>
      )}
      <Field label="Notes">
        <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
      </Field>
    </Modal>
  );
}
