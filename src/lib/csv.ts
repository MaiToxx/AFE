// Fichiers CSV : écriture des exports (séparateur « ; », lisibles par Excel et LibreOffice) et lecture
// des fichiers venus d'un tableur ou d'un autre logiciel.

const BOM = String.fromCharCode(0xfeff);

/**
 * Cellule de texte. Un tableur exécute comme une formule tout contenu qui commence par = + - ou @ :
 * un nom de client ou un libellé saisi ainsi (ou venu d'une sauvegarde importée) est donc précédé
 * d'une apostrophe, qui le fait lire comme du texte.
 */
export function csvText(value: string | number | null | undefined): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Cellule numérique : décimale à virgule, signe conservé (un montant négatif reste un nombre). */
export function csvNumber(n: number, digits = 2): string {
  return `"${(Number.isFinite(n) ? n : 0).toFixed(digits).replace('.', ',')}"`;
}

/** Fichier CSV complet : BOM UTF-8 (accents sous Excel) et fins de ligne Windows. */
export function csvFile(rows: string[][]): string {
  return BOM + rows.map((r) => r.join(';')).join('\r\n') + '\r\n';
}

/**
 * Lit un fichier CSV : séparateur deviné sur la première ligne (point-virgule, virgule ou tabulation),
 * champs entre guillemets (avec guillemets doublés et retours à la ligne), lignes vides ignorées.
 */
export function parseCSV(texte: string): string[][] {
  const src = texte.startsWith(BOM) ? texte.slice(1) : texte;
  const premiere = src.split(/\r?\n/, 1)[0] ?? '';
  const compte = (c: string) => premiere.split(c).length - 1;
  const sep = compte(';') >= compte(',') && compte(';') >= compte('\t') ? ';' : compte('\t') > compte(',') ? '\t' : ',';
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = '';
  let guillemets = false;
  const finChamp = () => {
    ligne.push(champ);
    champ = '';
  };
  const finLigne = () => {
    finChamp();
    if (ligne.some((c) => c.trim() !== '')) lignes.push(ligne);
    ligne = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (guillemets) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          champ += '"';
          i++;
        } else guillemets = false;
      } else champ += c;
    } else if (c === '"' && champ === '') guillemets = true;
    else if (c === sep) finChamp();
    else if (c === '\n') finLigne();
    else if (c !== '\r') champ += c;
  }
  if (champ !== '' || ligne.length) finLigne();
  return lignes;
}

/**
 * Texte d'un fichier choisi par l'utilisateur. Les tableurs enregistrent souvent en Windows-1252 :
 * si le contenu n'est pas de l'UTF-8 valide, il est relu dans cet encodage pour garder les accents.
 */
export async function lireTexte(fichier: Blob): Promise<string> {
  const octets = await fichier.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder('windows-1252').decode(octets);
  }
}
