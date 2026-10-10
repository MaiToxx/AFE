import { useEffect, useRef } from 'react';
import { useProfile } from '../db/hooks';
import { sauvegardeAutomatique } from '../lib/autoBackup';
import { isTauri } from '../lib/desktop';
import { restaurerCleDepuisFichier } from '../lib/licenseStore';
import { genererRecurrences } from '../lib/recurrences';
import { refreshRevocationsIfLicensed } from '../lib/revocationsStore';
import { verifierMiseAJour } from '../lib/updater';

const INTERVALLE_SAUVEGARDE = 10 * 60 * 1000;
/** Vérification de la licence en cours de session (sans effet si la dernière réussie est récente). */
const INTERVALLE_REVOCATIONS = 10 * 60 * 1000;

/**
 * Tâches de fond : au lancement (restauration de la licence, vérification des révocations, factures
 * récurrentes échues, sauvegarde, recherche de mise à jour) puis, tant que l'application est ouverte,
 * sauvegarde périodique et vérification régulière des révocations.
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
      // Toujours consultée à l'ouverture : une révocation s'applique dès le lancement suivant.
      void refreshRevocationsIfLicensed(true);
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
  useEffect(() => {
    // Liste des licences révoquées : revérifiée régulièrement et dès le retour de la connexion.
    const verifier = () => void refreshRevocationsIfLicensed();
    const id = setInterval(verifier, INTERVALLE_REVOCATIONS);
    window.addEventListener('online', verifier);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', verifier);
    };
  }, []);
  return null;
}
