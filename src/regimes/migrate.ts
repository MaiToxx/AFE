// Conversion des anciens barèmes français (table `baremes`, versions ≤ 0.2.x) vers le modèle générique.
import type { LegacyBareme } from '../db/types';
import fr from './presets/fr';
import type { RegimeParams } from './types';

export function convertBaremeFR(b: LegacyBareme): RegimeParams {
  const base = structuredClone(fr.params[2026]);
  const seuil = (id: string, valeur: number, majore?: number) => {
    const s = base.seuils.find((x) => x.id === id);
    if (s) {
      s.valeur = valeur;
      if (majore !== undefined) s.majore = majore;
    }
  };
  seuil('plafond_vente', b.plafondCA.vente);
  seuil('plafond_services', b.plafondCA.services);
  seuil('tva_vente', b.franchiseTVA.venteBase, b.franchiseTVA.venteMajore);
  seuil('tva_services', b.franchiseTVA.servicesBase, b.franchiseTVA.servicesMajore);
  base.coefficientNet = Object.fromEntries(Object.entries(b.abattement).map(([k, v]) => [k, Math.round((1 - v / 100) * 1000) / 1000]));
  const comp = (id: string) => base.composantes.find((c) => c.id === id);
  const cot = comp('cotisations');
  if (cot) {
    cot.tauxParActivite = { ...b.cotisations };
    cot.reductionDebut = { facteur: 1 - b.acreReduction / 100, mois: 12, alignTrimestre: true };
  }
  const cfp = comp('cfp');
  if (cfp) cfp.tauxParNature = { ...b.cfp };
  const cci = comp('chambre_cci');
  if (cci) cci.tauxParGroupeTva = { vente: b.chambre.cciVente, services: b.chambre.cciServices };
  const cma = comp('chambre_cma');
  if (cma) cma.tauxParGroupeTva = { vente: b.chambre.cmaVente, services: b.chambre.cmaServices };
  const dbl = comp('chambre_double');
  if (dbl) dbl.taux = b.chambre.doubleImmatriculation;
  const vl = comp('vl');
  if (vl) vl.tauxParActivite = { ...b.versementLiberatoire };
  return base;
}
