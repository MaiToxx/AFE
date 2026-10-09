import { useEffect, useRef } from 'react';
import { useProfile } from '../db/hooks';
import { sauvegardeAutomatique } from '../lib/autoBackup';
import { isTauri } from '../lib/desktop';
import { genererRecurrences } from '../lib/recurrences';
import { verifierMiseAJour } from '../lib/updater';

/**
 * Tâches exécutées une fois par session, après chargement du profil :
 * factures récurrentes échues, sauvegarde automatique et recherche de mise à jour (bureau).
 */
export default function Automations() {
  const { profile, loaded } = useProfile();
  const done = useRef(false);
  useEffect(() => {
    if (!loaded || done.current) return;
    done.current = true;
    (async () => {
      await genererRecurrences(profile).catch((e) => console.error('Récurrences :', e));
      await sauvegardeAutomatique(profile).catch((e) => console.error('Sauvegarde automatique :', e));
      if (isTauri) setTimeout(() => void verifierMiseAJour(true), 4000);
    })();
  }, [loaded, profile]);
  return null;
}
