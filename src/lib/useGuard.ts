import { useCallback, useRef, useState } from 'react';

/**
 * Empêche qu'une action soit lancée deux fois de suite (double clic sur « Enregistrer », touche
 * Entrée répétée) : tant que la première n'a pas abouti, les suivantes sont ignorées. Sans cela, un
 * paiement, un client ou une dépense peuvent être enregistrés en double.
 *
 * Renvoie `[busy, run]` : `busy` sert à désactiver le bouton, `run` enveloppe l'action.
 */
export function useGuard(): [boolean, <T>(action: () => Promise<T> | T) => Promise<T | undefined>] {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const run = useCallback(async <T,>(action: () => Promise<T> | T): Promise<T | undefined> => {
    if (locked.current) return undefined;
    locked.current = true;
    setBusy(true);
    try {
      return await action();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run];
}
