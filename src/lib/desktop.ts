// Pont entre la version web (PWA) et la version bureau (Tauri).
// Les modules Tauri sont importés dynamiquement : la version web n'en a jamais besoin.

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Téléchargement classique via le navigateur. */
export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Enregistre un fichier texte : boîte « Enregistrer sous » native sous Tauri,
 * téléchargement navigateur sinon. Renvoie false si l'utilisateur annule.
 */
export async function saveTextFile(filename: string, text: string): Promise<boolean> {
  if (!isTauri) {
    downloadText(filename, text);
    return true;
  }
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const path = await save({
    defaultPath: filename,
    filters: [{ name: 'Sauvegarde AFE (JSON)', extensions: ['json'] }],
  });
  if (!path) return false;
  await writeTextFile(path, text);
  return true;
}

/**
 * Ouvre une URL externe (page d'achat, e-mail) dans le navigateur ou le client par défaut.
 * Sous Tauri, la webview ne sait pas ouvrir une fenêtre externe seule : on passe par le plugin opener.
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }
  // mailto: dans l'onglet courant (déclenche le client mail sans quitter la page) ; http(s) dans un nouvel onglet.
  window.open(url, url.startsWith('mailto:') ? '_self' : '_blank', 'noopener,noreferrer');
}
