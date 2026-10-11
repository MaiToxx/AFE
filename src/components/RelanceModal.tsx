import { useEffect, useState } from 'react';
import { useRegime } from '../db/hooks';
import type { CanalRelance, Doc, Profile, Relance } from '../db/types';
import { useI18n } from '../i18n';
import { todayISO } from '../lib/dates';
import { openExternal } from '../lib/desktop';
import { fmtDate, fmtMoney } from '../lib/format';
import { enregistrerRelance, relanceMailto } from '../lib/relances';
import { useGuard } from '../lib/useGuard';
import { Field, Icon, Modal } from './ui';

export const CANAUX: { value: CanalRelance; key: string }[] = [
  { value: 'email', key: 'relance.canal.email' },
  { value: 'telephone', key: 'relance.canal.phone' },
  { value: 'courrier', key: 'relance.canal.mail' },
  { value: 'autre', key: 'relance.canal.other' },
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
  const { t, tn } = useI18n();
  const regime = useRegime();
  const [canal, setCanal] = useState<CanalRelance>('email');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, guard] = useGuard();
  useEffect(() => {
    if (open) {
      setCanal(doc.client?.email ? 'email' : 'telephone');
      setNote('');
      setDate(todayISO());
    }
  }, [open, doc.client?.email]);

  const derniere = relances[relances.length - 1];
  const mailto = relanceMailto(doc, profile, regime, reste, relances.length);

  async function enregistrer(ouvrirMail: boolean) {
    if (ouvrirMail) await openExternal(mailto);
    await enregistrerRelance({ factureId: doc.id!, date, canal, note });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('relance.title', { numero: doc.numero })}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn" onClick={() => void guard(() => enregistrer(false))} disabled={busy}>{t('relance.save')}</button>
          {canal === 'email' && (
            <button type="button" className="btn primary" onClick={() => void guard(() => enregistrer(true))} disabled={busy || !doc.client?.email}>
              <Icon name="file" /> {t('relance.openAndSave')}
            </button>
          )}
        </>
      }
    >
      <p className="small text-2">
        {t('relance.remaining', { montant: fmtMoney(reste), date: fmtDate(doc.dateEcheance) })}{' '}
        {relances.length > 0 && derniere ? tn('relance.history', relances.length, { date: fmtDate(derniere.date) }) : t('relance.none')}
      </p>
      <div className="form-row">
        <Field label={t('relance.channel')}>
          <select value={canal} onChange={(e) => setCanal(e.target.value as CanalRelance)}>
            {CANAUX.map((c) => (
              <option key={c.value} value={c.value}>{t(c.key)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('common.date')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      {canal === 'email' && !doc.client?.email && <div className="notice warning">{t('relance.noEmail')}</div>}
      {canal === 'email' && doc.client?.email && <p className="small muted">{t('relance.mailHelp', { email: doc.client.email })}</p>}
      <Field label={t('relance.note')}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('relance.notePlaceholder')} />
      </Field>
    </Modal>
  );
}
