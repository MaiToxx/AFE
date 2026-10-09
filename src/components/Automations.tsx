import { useEffect, useRef } from 'react';
import { useProfile } from '../db/hooks';
import { sauvegardeAutomatique } from '../lib/autoBackup';
import { isTauri } from '../lib/desktop';
import { restaurerCleDepuisFichier } from '../lib/licenseStore';
import { genererRecurrences } from '../lib/recurrences';
import { verifierMiseAJour } from '../lib/updater';

const INTERVALLE_SAUVEGARDE = 10 * 60 * 1000;

/**
 * Tâches de fond : au lancement (restauration de la licence, factures récurrentes échues,
 * sauvegarde, recherche de mise à jour) puis sauvegarde périodique tant que l'application est ouverte.
 */
export default function Automations() {
  const { profile, loaded } = useProfile();
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const done = useRef(false);
  useEffect(() => {
    if (!loaded || done.current) return;
    done.current = true;
    (async () => {
      await restaurerCleDepuisFichier();
      await genererRecurrences(profile).catch((e) => console.error('Récurrences :', e));
      await sauvegardeAutomatique(profile, true).catch((e) => console.error('Sauvegarde automatique :', e));
      if (isTauri) setTimeout(() => void verifierMiseAJour(true), 4000);
    })();
  }, [loaded, profile]);
  useEffect(() => {
    if (!isTauri) return;
    const id = setInterval(() => {
      sauvegardeAutomatique(profileRef.current, true).catch((e) => console.error('Sauvegarde automatique :', e));
    }, INTERVALLE_SAUVEGARDE);
    return () => clearInterval(id);
  }, []);
  return null;
}
