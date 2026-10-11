// Virement SEPA : contrôle d'un IBAN et QR code de paiement à la norme européenne EPC069-12
// (« GiroCode »). Scanné par l'application bancaire du client, il préremplit le virement : bénéficiaire,
// IBAN, montant et référence. Tout est produit sur l'appareil, sans aucun service en ligne.
import qrcode from 'qrcode-generator';

export function normaliserIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/** Contrôle de forme et de clé (modulo 97) d'un IBAN. */
export function ibanValide(iban: string): boolean {
  const s = normaliserIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  let reste = 0;
  for (const ch of s.slice(4) + s.slice(0, 4)) {
    // Les lettres valent 10 à 35 et s'écrivent sur deux chiffres.
    const chiffres = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const c of chiffres) reste = (reste * 10 + Number(c)) % 97;
  }
  return reste === 1;
}

const uneLigne = (s: string, max: number) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, max);

/**
 * Contenu du QR code de virement, ou null si les informations ne permettent pas d'en produire un
 * (bénéficiaire absent, IBAN invalide, montant hors bornes). La norme ne prévoit que l'euro.
 */
export function epcPayload(p: { nom: string; iban: string; bic?: string; montant: number; reference: string }): string | null {
  const iban = normaliserIban(p.iban);
  const nom = uneLigne(p.nom, 70);
  const montant = Math.round(p.montant * 100) / 100;
  if (!nom || !ibanValide(iban) || !(montant >= 0.01 && montant <= 999_999_999.99)) return null;
  const bic = (p.bic ?? '').replace(/\s+/g, '').toUpperCase();
  const contenu = (reference: string) =>
    [
      'BCD', // étiquette de service
      '002', // version : le BIC y est facultatif
      '1', // jeu de caractères UTF-8
      'SCT', // virement SEPA
      /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic) ? bic : '',
      nom,
      iban,
      `EUR${montant.toFixed(2)}`,
      '', // code de motif
      '', // référence structurée
      reference, // libellé libre du virement
    ].join('\n');
  // La norme borne le contenu à 331 octets : les lettres accentuées en comptent deux, le libellé s'ajuste.
  let reference = uneLigne(p.reference, 140);
  while (reference && new TextEncoder().encode(contenu(reference)).length > 331) reference = reference.slice(0, -1);
  return contenu(reference);
}

/** Matrice d'un QR code (true = module sombre), avec le niveau de correction d'erreur exigé par la norme (M). */
export function qrMatrix(texte: string): boolean[][] {
  const qr = qrcode(0, 'M');
  // Le texte est encodé en UTF-8 ici, puis transmis octet par octet.
  qr.addData(String.fromCharCode(...new TextEncoder().encode(texte)), 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
