// Sauvegarde automatique (version bureau) : export JSON silencieux dans le dossier de
// données de l'application, une fois par jour, en conservant les 10 plus récentes.
import Dexie from 'dexie';
import { exportBackup, getSetting, setSetting } from '../db/db';
import type { Profile } from '../db/types';
import { todayISO } from './dates';
import { isTauri } from './desktop';

const DIR = 'sauvegardes';
const KEEP = 10;
const FICHIER = /^afe-auto-(\d{4}-\d{2}-\d{2})\.json$/;

// Les données ont-elles changé depuis la dernière sauvegarde écrite ? La sauvegarde périodique ne
// réécrit le fichier que dans ce cas. Les réglages (date de dernière sauvegarde, vérification de la
// licence…) ne comptent pas : ils changent tout seuls.
const DONNEES = /^idb:\/\/afe\/(profile|clients|documents|paiements|regimeParams|catalogue|relances|recurrences|depenses)\//;
let modifie = true;
if (typeof indexedDB !== 'undefined') {
  Dexie.on('storagemutated', (parts) => {
    if (!modifie && Object.keys(parts).some((k) => DONNEES.test(k))) modifie = true;
  });
}

/**
 * Écrit la sauvegarde du jour (un fichier par jour, réécrit à chaque appel).
 * Sans `force`, ne s'exécute qu'une fois par jour (premier lancement). Avec `siModifie`, rien n'est
 * écrit tant qu'aucune donnée n'a changé depuis la sauvegarde précédente.
 */
export async function sauvegardeAutomatique(profile: Profile, force = false, siModifie = false): Promise<string | null> {
  if (!isTauri || !profile.sauvegardeAuto) return null;
  if (siModifie && !modifie) return null;
  const today = todayISO();
  if (!force && (await getSetting('lastAutoBackup')) === today) return null;
  // Remis à zéro avant l'export : une modification faite pendant l'écriture repartira au tour suivant.
  modifie = false;
  try {
    const fs = await import('@tauri-apps/plugin-fs');
    const opts = { baseDir: fs.BaseDirectory.AppData };
    await fs.mkdir(DIR, { ...opts, recursive: true });
    const data = await exportBackup();
    const name = `${DIR}/afe-auto-${today}.json`;
    await fs.writeTextFile(name, JSON.stringify(data), opts);
    const entries = await fs.readDir(DIR, opts);
    const files = entries
      .filter((e) => e.isFile && FICHIER.test(e.name))
      .map((e) => e.name)
      .sort();
    for (const old of files.slice(0, Math.max(0, files.length - KEEP))) {
      await fs.remove(`${DIR}/${old}`, opts);
    }
    await setSetting('lastAutoBackup', today);
    return name;
  } catch (e) {
    modifie = true;
    throw e;
  }
}

/**
 * Dernière sauvegarde automatique présente sur cet ordinateur (version bureau), ou null. Sert à
 * proposer de retrouver ses données quand la base de l'application est vide alors que des sauvegardes
 * existent (profil du navigateur intégré perdu ou réinitialisé).
 */
export async function derniereSauvegarde(): Promise<{ nom: string; date: string } | null> {
  if (!isTauri) return null;
  try {
    const fs = await import('@tauri-apps/plugin-fs');
    const opts = { baseDir: fs.BaseDirectory.AppData };
    if (!(await fs.exists(DIR, opts))) return null;
    const nom = (await fs.readDir(DIR, opts))
      .filter((e) => e.isFile && FICHIER.test(e.name))
      .map((e) => e.name)
      .sort()
      .at(-1);
    return nom ? { nom, date: FICHIER.exec(nom)![1] } : null;
  } catch {
    return null;
  }
}

/** Contenu d'une sauvegarde automatique (nom renvoyé par `derniereSauvegarde`). */
export async function lireSauvegarde(nom: string): Promise<string> {
  if (!FICHIER.test(nom)) throw new Error('backup.invalid');
  const fs = await import('@tauri-apps/plugin-fs');
  return fs.readTextFile(`${DIR}/${nom}`, { baseDir: fs.BaseDirectory.AppData });
}

export async function dossierSauvegardes(): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  return join(await appDataDir(), DIR);
}

export async function ouvrirDossierSauvegardes(): Promise<void> {
  const { openPath } = await import('@tauri-apps/plugin-opener');
  await openPath(await dossierSauvegardes());
}
