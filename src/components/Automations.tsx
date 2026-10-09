import { useEffect, useRef } from 'react';
import { useProfile } from '../db/hooks';
import { genererRecurrences } from '../lib/recurrences';

/** Tâches exécutées une fois par session, après chargement du profil : factures récurrentes échues. */
export default function Automations() {
  const { profile, loaded } = useProfile();
  const done = useRef(false);
  useEffect(() => {
    if (!loaded || done.current) return;
    done.current = true;
    genererRecurrences(profile).catch((e) => console.error('Récurrences :', e));
  }, [loaded, profile]);
  return null;
}
