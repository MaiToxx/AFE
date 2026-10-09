// Version bureau : la clé de licence est aussi conservée dans un fichier du dossier de
// l'application (%APPDATA%\fr.afe.desktop\licence.key). Si le stockage WebView2 (IndexedDB)
// est perdu ou réinitialisé, la licence est restaurée automatiquement au lancement.
import { getSetting, setSetting } from '../db/db';
import { isTauri } from './desktop';
import { verifyKey } from './license';

const FILE = 'licence.key';

async function fsAppData() {
  const fs = await import('@tauri-apps/plugin-fs');
  const opts = { baseDir: fs.BaseDirectory.AppData };
  // Garantit l'existence du dossier de l'application (créé avec celui des sauvegardes).
  await fs.mkdir('sauvegardes', { ...opts, recursive: true }).catch(() => undefined);
  return { fs, opts };
}

export async function sauvegarderCleFichier(key: string): Promise<void> {
  if (!isTauri) return;
  try {
    const { fs, opts } = await fsAppData();
    await fs.writeTextFile(FILE, key.trim(), opts);
  } catch (e) {
    console.warn('Copie de la licence impossible :', e);
  }
}

export async function supprimerCleFichier(): Promise<void> {
  if (!isTauri) return;
  try {
    const { fs, opts } = await fsAppData();
    if (await fs.exists(FILE, opts)) await fs.remove(FILE, opts);
  } catch (e) {
    console.warn('Suppression de la copie de licence impossible :', e);
  }
}

/**
 * Synchronise base et fichier au lancement : si la base a une licence, le fichier est créé s'il
 * manque ; sinon la licence est restaurée depuis le fichier. Renvoie true si restaurée.
 */
export async function restaurerCleDepuisFichier(): Promise<boolean> {
  if (!isTauri) return false;
  try {
    const { fs, opts } = await fsAppData();
    const enBase = await getSetting('licenseKey');
    if (enBase) {
      if (!(await fs.exists(FILE, opts))) await fs.writeTextFile(FILE, enBase, opts);
      return false;
    }
    if (!(await fs.exists(FILE, opts))) return false;
    const key = (await fs.readTextFile(FILE, opts)).trim();
    if (!key) return false;
    const r = await verifyKey(key);
    if (!r.ok) return false;
    await setSetting('licenseKey', key);
    return true;
  } catch (e) {
    console.warn('Restauration de la licence impossible :', e);
    return false;
  }
}
