import { useProfile } from '../db/hooks';
import { openExternal } from '../lib/desktop';
import { purchaseTarget } from '../lib/license';
import { Icon } from './ui';

/** Bouton « Acheter une licence » (ou « Demander une licence » tant qu'aucune page de vente n'est configurée). */
export default function BuyLicenceButton({ primary = true, small = false }: { primary?: boolean; small?: boolean }) {
  const { profile } = useProfile();
  const target = purchaseTarget({ name: `${profile.prenom} ${profile.nom}`.trim(), email: profile.email });
  return (
    <button
      type="button"
      className={`btn${primary ? ' primary' : ''}${small ? ' sm' : ''}`}
      onClick={() => void openExternal(target.url)}
      title={target.url.startsWith('mailto:') ? 'Ouvre un e-mail pré-rempli' : 'Ouvre la page d’achat dans le navigateur'}
    >
      <Icon name="wallet" size={small ? 15 : 18} /> {target.label}
    </button>
  );
}
