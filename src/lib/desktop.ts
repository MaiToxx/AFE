// Pont entre la version web (PWA) et la version bureau (Tauri).
// Les modules Tauri sont importés dynamiquement : la version web n'en a jamais besoin.

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const FORMATS: Record<string, { nom: string; mime: string }> = {
  json: { nom: 'JSON', mime: 'application/json' },
  csv: { nom: 'CSV', mime: 'text/csv;charset=utf-8' },
  ics: { nom: 'iCalendar', mime: 'text/calendar;charset=utf-8' },
};

/** Format d'un fichier d'après son extension (JSON par défaut). */
function formatDe(filename: string): { extension: string; nom: string; mime: string } {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return FORMATS[extension] ? { extension, ...FORMATS[extension] } : { extension: 'json', ...FORMATS.json };
}

/** Téléchargement classique via le navigateur. */
export function downloadText(filename: string, text: string, type = formatDe(filename).mime) {
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
  // Le filtre suit l'extension : un export CSV n'est pas proposé comme un fichier JSON.
  const format = formatDe(filename);
  const path = await save({
    defaultPath: filename,
    filters: [{ name: format.nom, extensions: [format.extension] }],
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
