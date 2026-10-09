// Sauvegarde automatique (version bureau) : export JSON silencieux dans le dossier de
// données de l'application, une fois par jour, en conservant les 10 plus récentes.
import { exportBackup, getSetting, setSetting } from '../db/db';
import type { Profile } from '../db/types';
import { todayISO } from './dates';
import { isTauri } from './desktop';

const DIR = 'sauvegardes';
const KEEP = 10;

export async function sauvegardeAutomatique(profile: Profile): Promise<string | null> {
  if (!isTauri || !profile.sauvegardeAuto) return null;
  const today = todayISO();
  if ((await getSetting('lastAutoBackup')) === today) return null;
  const fs = await import('@tauri-apps/plugin-fs');
  const opts = { baseDir: fs.BaseDirectory.AppData };
  await fs.mkdir(DIR, { ...opts, recursive: true });
  const data = await exportBackup();
  const name = `${DIR}/afe-auto-${today}.json`;
  await fs.writeTextFile(name, JSON.stringify(data), opts);
  const entries = await fs.readDir(DIR, opts);
  const files = entries
    .filter((e) => e.isFile && /^afe-auto-\d{4}-\d{2}-\d{2}\.json$/.test(e.name))
    .map((e) => e.name)
    .sort();
  for (const old of files.slice(0, Math.max(0, files.length - KEEP))) {
    await fs.remove(`${DIR}/${old}`, opts);
  }
  await setSetting('lastAutoBackup', today);
  return name;
}

export async function dossierSauvegardes(): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  return join(await appDataDir(), DIR);
}

export async function ouvrirDossierSauvegardes(): Promise<void> {
  const { openPath } = await import('@tauri-apps/plugin-opener');
  await openPath(await dossierSauvegardes());
}
