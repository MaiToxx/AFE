import { useEffect, useState } from 'react';
import type { CanalRelance, Doc, Profile, Relance } from '../db/types';
import { todayISO } from '../lib/dates';
import { openExternal } from '../lib/desktop';
import { fmtDate, fmtEUR } from '../lib/format';
import { enregistrerRelance, relanceMailto } from '../lib/relances';
import { Field, Icon, Modal } from './ui';

export const CANAUX: { value: CanalRelance; label: string }[] = [
  { value: 'email', label: 'E-mail' },
  { value: 'telephone', label: 'Téléphone' },
  { value: 'courrier', label: 'Courrier' },
  { value: 'autre', label: 'Autre' },
];

/** Relance d'une facture impayée : e-mail pré-rempli + historique des relances. */
export default function RelanceModal({ open, onClose, doc, profile, reste, relances }: {
  open: boolean;
  onClose: () => void;
  doc: Doc;
  profile: Profile;
  reste: number;
  relances: Relance[];
}) {
  const [canal, setCanal] = useState<CanalRelance>('email');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  useEffect(() => {
    if (open) {
      setCanal(doc.client?.email ? 'email' : 'telephone');
      setNote('');
      setDate(todayISO());
    }
  }, [open, doc.client?.email]);

  const derniere = relances[relances.length - 1];
  const mailto = relanceMailto(doc, profile, reste, relances.length);

  async function enregistrer(ouvrirMail: boolean) {
    if (ouvrirMail) await openExternal(mailto);
    await enregistrerRelance({ factureId: doc.id!, date, canal, note });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Relancer ${doc.numero}`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="button" className="btn" onClick={() => enregistrer(false)}>Enregistrer la relance</button>
          {canal === 'email' && (
            <button type="button" className="btn primary" onClick={() => enregistrer(true)} disabled={!doc.client?.email}>
              <Icon name="file" /> Ouvrir l'e-mail et enregistrer
            </button>
          )}
        </>
      }
    >
      <p className="small text-2">
        Reste dû : <b>{fmtEUR(reste)}</b> · échéance le {fmtDate(doc.dateEcheance)}.
        {relances.length > 0 && derniere ? ` ${relances.length} relance${relances.length > 1 ? 's' : ''} déjà enregistrée${relances.length > 1 ? 's' : ''}, la dernière le ${fmtDate(derniere.date)}.` : ' Aucune relance pour l’instant.'}
      </p>
      <div className="form-row">
        <Field label="Canal">
          <select value={canal} onChange={(e) => setCanal(e.target.value as CanalRelance)}>
            {CANAUX.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      {canal === 'email' && !doc.client?.email && <div className="notice warning">Ce client n'a pas d'adresse e-mail enregistrée : renseignez-la dans sa fiche, ou choisissez un autre canal.</div>}
      {canal === 'email' && doc.client?.email && (
        <p className="small muted">Un e-mail pré-rempli (montant, échéance, retard, pénalités pour les professionnels) s'ouvrira dans votre messagerie à l'adresse {doc.client.email}. Pensez à y joindre le PDF de la facture.</p>
      )}
      <Field label="Note (optionnel)">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ex. Promesse de règlement sous 8 jours." />
      </Field>
    </Modal>
  );
}
