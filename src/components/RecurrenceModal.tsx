import { useEffect, useState } from 'react';
import type { Doc, FrequenceRecurrence } from '../db/types';
import { creerRecurrence, FREQUENCES, prochaineDate } from '../lib/recurrences';
import { Check, Field, Icon, Modal } from './ui';

/** Transforme une facture en modèle récurrent. */
export default function RecurrenceModal({ open, onClose, doc, onCreated }: {
  open: boolean;
  onClose: () => void;
  doc: Doc;
  onCreated: (id: number) => void;
}) {
  const [libelle, setLibelle] = useState('');
  const [frequence, setFrequence] = useState<FrequenceRecurrence>('mensuelle');
  const [prochaine, setProchaine] = useState('');
  const [finaliserAuto, setFinaliserAuto] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setLibelle(doc.objet || doc.lignes[0]?.description || 'Facture récurrente');
      setFrequence('mensuelle');
      setProchaine(prochaineDate(doc.dateEmission, 'mensuelle'));
      setFinaliserAuto(false);
      setError('');
    }
  }, [open, doc]);

  async function creer() {
    if (!doc.clientId) {
      setError('La facture doit avoir un client.');
      return;
    }
    if (!prochaine) {
      setError('Indiquez la date de la prochaine facture.');
      return;
    }
    const id = await creerRecurrence(doc, { libelle: libelle.trim() || 'Facture récurrente', frequence, prochaine, finaliserAuto });
    onClose();
    onCreated(id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rendre cette facture récurrente"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="button" className="btn primary" onClick={creer}><Icon name="check" /> Créer le modèle</button>
        </>
      }
    >
      {error && <div className="notice critical">{error}</div>}
      <p className="small text-2">À chaque échéance, une nouvelle facture reprenant ces lignes est créée automatiquement au lancement de l'application.</p>
      <Field label="Nom du modèle"><input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)} /></Field>
      <div className="form-row">
        <Field label="Fréquence">
          <select
            value={frequence}
            onChange={(e) => {
              const f = e.target.value as FrequenceRecurrence;
              setFrequence(f);
              setProchaine(prochaineDate(doc.dateEmission, f));
            }}
          >
            {FREQUENCES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Prochaine facture le"><input type="date" value={prochaine} onChange={(e) => setProchaine(e.target.value)} /></Field>
      </div>
      <Check
        label="Finaliser automatiquement (numéro attribué, statut « envoyée »)"
        help="Sinon, la facture est créée en brouillon : vous la vérifiez puis la finalisez."
        checked={finaliserAuto}
        onChange={setFinaliserAuto}
      />
    </Modal>
  );
}
