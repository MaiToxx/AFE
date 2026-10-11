// Statut de licence lu directement dans le stockage, hors de React. La finalisation est contrôlée ici,
// à l'endroit où le numéro du document est attribué, et pas seulement par les écrans.
import { ensureTrialStart, getSetting } from '../db/db';
import { todayISO } from './dates';
import { canFinalize, evaluate, latestDate, soundToday, trialStatus, verifyKey, type LicenseStatus } from './license';
import { SETTING_REVOCATIONS, SETTING_REVOCATIONS_CHECKED } from './revocations';
import { refreshRevocations, revocationView } from './revocationsStore';
import { SETTING_TRIAL_SEEN } from './trial';

/**
 * Statut courant. Avec `wait`, les réponses provisoires sont résolues avant de répondre : début
 * d'essai pas encore enregistré, vérification en ligne en retard (elle est alors tentée).
 */
export async function licenseStatusNow({ wait = true }: { wait?: boolean } = {}): Promise<LicenseStatus> {
  const [key, start, seen] = await Promise.all([getSetting('licenseKey'), getSetting('trialStart'), getSetting(SETTING_TRIAL_SEEN)]);
  if (!key) {
    if (start) return trialStatus(start, latestDate(todayISO(), seen));
    if (!wait) return { status: 'loading' };
    await ensureTrialStart();
    return licenseStatusNow({ wait: false });
  }
  const check = await verifyKey(key);
  if (!check.ok) return { status: 'invalid', reasonKey: check.reasonKey };
  const evaluer = async (): Promise<LicenseStatus> => {
    // Liste et date de vérification sont relues à chaque fois : elles viennent peut-être de changer.
    const view = await revocationView((await getSetting(SETTING_REVOCATIONS)) ?? '', (await getSetting(SETTING_REVOCATIONS_CHECKED)) ?? '');
    return evaluate(check.payload, soundToday(view.listIssued), undefined, view);
  };
  let status = await evaluer();
  if (status.status === 'unverified' && wait) {
    await refreshRevocations();
    status = await evaluer();
  }
  return status;
}

/** La finalisation d'un document est-elle permise (essai en cours ou licence valide) ? */
export async function finalizationAllowed(): Promise<boolean> {
  return canFinalize(await licenseStatusNow());
}
