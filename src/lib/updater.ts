// Mises à jour automatiques (version bureau) : vérifie l'existence d'une nouvelle version,
// propose de l'installer, puis relance l'application.
import { isTauri } from './desktop';

export type UpdateResult = { status: 'indisponible' } | { status: 'a_jour' } | { status: 'installee'; version: string } | { status: 'refusee'; version: string } | { status: 'erreur'; message: string };

export async function verifierMiseAJour(silencieux = false): Promise<UpdateResult> {
  if (!isTauri) return { status: 'indisponible' };
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) return { status: 'a_jour' };
    const { ask } = await import('@tauri-apps/plugin-dialog');
    const ok = await ask(
      `La version ${update.version} d'AFE est disponible (vous utilisez la ${update.currentVersion}).${update.body ? `\n\n${update.body}` : ''}\n\nInstaller maintenant ? L'application redémarrera.`,
      { title: 'Mise à jour disponible', kind: 'info', okLabel: 'Installer', cancelLabel: 'Plus tard' },
    );
    if (!ok) return { status: 'refusee', version: update.version };
    await update.downloadAndInstall();
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
    return { status: 'installee', version: update.version };
  } catch (e) {
    if (!silencieux) console.warn('Vérification des mises à jour :', e);
    return { status: 'erreur', message: e instanceof Error ? e.message : String(e) };
  }
}
