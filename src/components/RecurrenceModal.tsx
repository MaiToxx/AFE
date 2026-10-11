import { useEffect, useState } from 'react';
import type { Doc, FrequenceRecurrence } from '../db/types';
import { useI18n } from '../i18n';
import { isValidISO } from '../lib/dates';
import { FREQUENCES, creerRecurrence, prochaineDate } from '../lib/recurrences';
import { useGuard } from '../lib/useGuard';
import { Check, Field, Icon, Modal } from './ui';

/** Transforme une facture en modèle récurrent. */
export default function RecurrenceModal({ open, onClose, doc, onCreated }: { open: boolean; onClose: () => void; doc: Doc; onCreated: (id: number) => void }) {
  const { t } = useI18n();
  const [libelle, setLibelle] = useState('');
  const [frequence, setFrequence] = useState<FrequenceRecurrence>('mensuelle');
  const [prochaine, setProchaine] = useState('');
  const [finaliserAuto, setFinaliserAuto] = useState(false);
  const [error, setError] = useState('');
  const [busy, guard] = useGuard();

  useEffect(() => {
    if (open) {
      setLibelle(doc.objet || doc.lignes[0]?.description || t('recurrence.defaultName'));
      setFrequence('mensuelle');
      setProchaine(prochaineDate(doc.dateEmission, 'mensuelle'));
      setFinaliserAuto(false);
      setError('');
    }
  }, [open, doc, t]);

  async function creer() {
    if (!doc.clientId) {
      setError(t('recurrence.needClient'));
      return;
    }
    if (!isValidISO(prochaine)) {
      setError(t('recurrence.needDate'));
      return;
    }
    const id = await creerRecurrence(doc, { libelle: libelle.trim() || t('recurrence.defaultName'), frequence, prochaine, finaliserAuto });
    onClose();
    onCreated(id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('recurrence.title')}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn primary" onClick={() => void guard(creer)} disabled={busy}><Icon name="check" /> {t('recurrence.create')}</button>
        </>
      }
    >
      {error && <div className="notice critical">{error}</div>}
      <p className="small text-2">{t('recurrence.intro')}</p>
      <Field label={t('recurrence.name')}><input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)} /></Field>
      <div className="form-row">
        <Field label={t('recurrence.frequency')}>
          <select
            value={frequence}
            onChange={(e) => {
              const f = e.target.value as FrequenceRecurrence;
              setFrequence(f);
              setProchaine(prochaineDate(doc.dateEmission, f));
            }}
          >
            {FREQUENCES.map((f) => (
              <option key={f.value} value={f.value}>{t(f.key)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('recurrence.nextOn')}><input type="date" value={prochaine} onChange={(e) => setProchaine(e.target.value)} /></Field>
      </div>
      <Check label={t('recurrence.autoFinalize')} help={t('recurrence.autoFinalizeHelp')} checked={finaliserAuto} onChange={setFinaliserAuto} />
    </Modal>
  );
}
