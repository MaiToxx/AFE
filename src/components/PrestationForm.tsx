import { useEffect, useState } from 'react';
import { db } from '../db/db';
import type { Prestation } from '../db/types';
import { Field, Modal, NumInput } from './ui';

const EMPTY: Omit<Prestation, 'id'> = { libelle: '', description: '', unite: '', prixUnitaire: 0, tauxTVA: 20 };

/** Formulaire d'ajout / modification d'une prestation du catalogue. */
export default function PrestationForm({ open, prestation, tauxTVA, onClose }: {
  open: boolean;
  prestation?: Prestation | null;
  tauxTVA: number;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Prestation, 'id'>>(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(prestation ? { ...EMPTY, ...prestation } : { ...EMPTY, tauxTVA });
      setError('');
    }
  }, [open, prestation, tauxTVA]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.libelle.trim()) {
      setError('Le libellé est obligatoire.');
      return;
    }
    if (prestation?.id) await db.catalogue.update(prestation.id, { ...form });
    else await db.catalogue.add({ ...form });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={prestation ? 'Modifier la prestation' : 'Nouvelle prestation'}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="button" className="btn primary" onClick={save}>Enregistrer</button>
        </>
      }
    >
      {error && <div className="notice critical">{error}</div>}
      <Field label="Libellé (nom court dans le catalogue)">
        <input type="text" value={form.libelle} onChange={(e) => set({ libelle: e.target.value })} autoFocus placeholder="Ex. Journée de développement" />
      </Field>
      <Field label="Description sur le document" help="Laissez vide pour utiliser le libellé.">
        <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} />
      </Field>
      <div className="form-row">
        <Field label="Prix unitaire HT"><NumInput value={form.prixUnitaire} onChange={(prixUnitaire) => set({ prixUnitaire })} /></Field>
        <Field label="Unité"><input type="text" value={form.unite} onChange={(e) => set({ unite: e.target.value })} placeholder="jour, heure, forfait…" /></Field>
        <Field label="TVA (%)"><NumInput value={form.tauxTVA} onChange={(tauxTVA) => set({ tauxTVA })} min={0} /></Field>
      </div>
    </Modal>
  );
}
