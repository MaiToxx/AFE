import { useProfile } from '../db/hooks';
import { useI18n } from '../i18n';
import { openExternal } from '../lib/desktop';
import { purchaseTarget } from '../lib/license';
import { Icon } from './ui';

/** Bouton « Acheter une licence » (ou « Demander une licence » tant qu'aucune page de vente n'est configurée). */
export default function BuyLicenceButton({ primary = true, small = false }: { primary?: boolean; small?: boolean }) {
  const { profile } = useProfile();
  const { t } = useI18n();
  const target = purchaseTarget({
    subject: t('licence.mailSubject'),
    body: t('licence.mailBody', { name: `${profile.prenom} ${profile.nom}`.trim(), email: profile.email, version: __APP_VERSION__ }),
  });
  return (
    <button
      type="button"
      className={`btn${primary ? ' primary' : ''}${small ? ' sm' : ''}`}
      onClick={() => void openExternal(target.url)}
      title={target.url.startsWith('mailto:') ? t('licence.opensMail') : t('licence.opensShop')}
    >
      <Icon name="wallet" size={small ? 15 : 18} /> {t(target.labelKey)}
    </button>
  );
}
