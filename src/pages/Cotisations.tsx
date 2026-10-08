import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Check, Field, Icon, NumInput, PageHeader } from '../components/ui';
import { useBaremes, useDocuments, usePaiements, useProfile } from '../db/hooks';
import { ACTIVITES, type ActivityKind } from '../db/types';
import { pickBareme } from '../lib/bareme';
import { acreActive, acreEnd, calculer, plafondFor, tauxChambre, tauxCotisations, type CalcOptions } from '../lib/cotisations';
import { todayISO, yearOf } from '../lib/dates';
import { fmtDate, fmtEUR, fmtEUR0, fmtPct } from '../lib/format';
import { declarations, type EtatDeclaration } from '../lib/stats';

const ETAT: Record<EtatDeclaration, { label: string; tone: string }> = {
  passee: { label: 'Échéance passée', tone: 'neutral' },
  a_declarer: { label: 'À déclarer', tone: 'warning' },
  en_cours: { label: 'En cours', tone: 'info' },
  a_venir: { label: 'À venir', tone: 'neutral' },
};

export default function Cotisations() {
  const { profile } = useProfile();
  const docs = useDocuments();
  const paiements = usePaiements();
  const baremes = useBaremes();
  const today = todayISO();
  const curY = yearOf(today);
  const [year, setYear] = useState(curY);

  const years = useMemo(() => {
    const s = new Set<number>([curY]);
    paiements.forEach((p) => s.add(yearOf(p.date)));
    return [...s].sort((a, b) => b - a);
  }, [paiements, curY]);

  const docsById = useMemo(() => new Map(docs.filter((d) => d.id).map((d) => [d.id!, d])), [docs]);
  const rows = useMemo(
    () => declarations(year, paiements, docsById, profile, baremes, today),
    [year, paiements, docsById, profile, baremes, today],
  );
  const bareme = pickBareme(baremes, year);
  const tot = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const hasChambre = profile.nature !== 'liberal';
  const acreNow = acreActive(profile, today);

  return (
    <>
      <PageHeader
        title="Cotisations sociales"
        subtitle={
          <>
            Estimation sur les encaissements · déclaration {profile.frequence} · barème {bareme.annee}
            {profile.acre && profile.dateDebutActivite && <> · ACRE jusqu'au {fmtDate(acreEnd(profile.dateDebutActivite))}</>}
            {' · '}
            <Link to="/parametres">modifier</Link>
          </>
        }
        actions={
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Année">
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        }
      />

      <div className="stack">
        <div className="card">
          <div className="card-head">
            <h2>Déclarations {year}</h2>
            <span className="small text-2">Calculé sur le CA réellement encaissé (HT) dans chaque période.</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Période</th>
                  <th className="num">CA encaissé</th>
                  <th className="num">Cotisations</th>
                  <th className="num">CFP</th>
                  {hasChambre && <th className="num">Taxe chambre</th>}
                  {profile.versementLiberatoire && <th className="num">Impôt (VL)</th>}
                  <th className="num">Total à payer</th>
                  <th>Échéance</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.period.key} className={r.etat === 'en_cours' ? 'current' : ''}>
                    <td>
                      {r.period.label}
                      {r.calcul.acre && r.calcul.ca > 0 && (
                        <>
                          {' '}
                          <span className="badge info" title="Taux réduit ACRE appliqué">ACRE</span>
                        </>
                      )}
                    </td>
                    <td className="num">{fmtEUR(r.calcul.ca)}</td>
                    <td className="num">{fmtEUR(r.calcul.cotisations)}</td>
                    <td className="num">{fmtEUR(r.calcul.cfp)}</td>
                    {hasChambre && <td className="num">{fmtEUR(r.calcul.chambre)}</td>}
                    {profile.versementLiberatoire && <td className="num">{fmtEUR(r.calcul.vl)}</td>}
                    <td className="num"><b>{fmtEUR(r.calcul.total)}</b></td>
                    <td className="tnum text-2">{fmtDate(r.period.echeance)}</td>
                    <td><Badge tone={ETAT[r.etat].tone}>{ETAT[r.etat].label}</Badge></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total {year}</td>
                  <td className="num">{fmtEUR(tot((r) => r.calcul.ca))}</td>
                  <td className="num">{fmtEUR(tot((r) => r.calcul.cotisations))}</td>
                  <td className="num">{fmtEUR(tot((r) => r.calcul.cfp))}</td>
                  {hasChambre && <td className="num">{fmtEUR(tot((r) => r.calcul.chambre))}</td>}
                  {profile.versementLiberatoire && <td className="num">{fmtEUR(tot((r) => r.calcul.vl))}</td>}
                  <td className="num">{fmtEUR(tot((r) => r.calcul.total))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <Icon name="info" size={14} />
            <span>Estimation à reporter sur autoentrepreneur.urssaf.fr : l'application ne se connecte pas à l'URSSAF et ne sait pas si une déclaration a été effectivement transmise.</span>
          </p>
        </div>

        <div className="grid grid-2">
          <Simulateur
            defaults={{ activite: profile.activite, acre: acreNow, vl: profile.versementLiberatoire }}
            options={{
              bareme: pickBareme(baremes, curY),
              nature: profile.nature,
              doubleImmatriculation: profile.doubleImmatriculation,
            }}
          />
          <div className="card">
            <div className="card-head">
              <h2>Taux appliqués en {bareme.annee}</h2>
              <Link to="/parametres" className="small">Modifier le barème</Link>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Activité</th>
                    <th className="num">Cotisations</th>
                    <th className="num">Avec ACRE</th>
                    <th className="num">CFP</th>
                    {hasChambre && <th className="num">Chambre</th>}
                    <th className="num">VL (impôt)</th>
                  </tr>
                </thead>
                <tbody>
                  {ACTIVITES.map((a) => {
                    const o = { bareme, nature: profile.nature, doubleImmatriculation: profile.doubleImmatriculation };
                    return (
                      <tr key={a.value} className={a.value === profile.activite ? 'current' : ''}>
                        <td>{a.court}</td>
                        <td className="num">{fmtPct(bareme.cotisations[a.value])}</td>
                        <td className="num">{fmtPct(tauxCotisations(a.value, { bareme, acre: true }))}</td>
                        <td className="num">{fmtPct(bareme.cfp[profile.nature])}</td>
                        {hasChambre && <td className="num">{fmtPct(tauxChambre(a.value, o), 3)}</td>}
                        <td className="num">{fmtPct(bareme.versementLiberatoire[a.value])}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              Plafonds de CA {bareme.annee} : {fmtEUR0(bareme.plafondCA.vente)} (vente) · {fmtEUR0(bareme.plafondCA.services)} (services).
              Franchise de TVA : {fmtEUR0(bareme.franchiseTVA.venteBase)} / {fmtEUR0(bareme.franchiseTVA.servicesBase)} (seuils majorés {fmtEUR0(bareme.franchiseTVA.venteMajore)} / {fmtEUR0(bareme.franchiseTVA.servicesMajore)}).
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function Simulateur({ defaults, options }: {
  defaults: { activite: ActivityKind; acre: boolean; vl: boolean };
  options: Omit<CalcOptions, 'acre' | 'versementLiberatoire'>;
}) {
  const [ca, setCa] = useState(3000);
  const [activite, setActivite] = useState<ActivityKind>(defaults.activite);
  const [acre, setAcre] = useState(defaults.acre);
  const [vl, setVl] = useState(defaults.vl);
  const [periode, setPeriode] = useState<'mois' | 'an'>('mois');
  const o: CalcOptions = { ...options, acre, versementLiberatoire: vl };
  const c = calculer({ [activite]: ca }, o);
  const plafond = plafondFor(activite, options.bareme);
  const max = periode === 'an' ? plafond : Math.round(plafond / 12 / 100) * 100;
  const abattement = options.bareme.abattement[activite];
  const hasChambre = options.nature !== 'liberal';
  return (
    <div className="card">
      <div className="card-head">
        <h2>Simulateur</h2>
        <div className="seg sm" role="group">
          <button type="button" className={periode === 'mois' ? 'active' : ''} onClick={() => setPeriode('mois')}>Par mois</button>
          <button type="button" className={periode === 'an' ? 'active' : ''} onClick={() => setPeriode('an')}>Par an</button>
        </div>
      </div>
      <div className="form-section">
        <div className="form-row">
          <Field label={`CA encaissé ${periode === 'mois' ? 'mensuel' : 'annuel'} (HT)`}>
            <NumInput value={ca} onChange={setCa} min={0} />
          </Field>
          <Field label="Activité">
            <select value={activite} onChange={(e) => setActivite(e.target.value as ActivityKind)}>
              {ACTIVITES.map((a) => (
                <option key={a.value} value={a.value}>{a.court}</option>
              ))}
            </select>
          </Field>
        </div>
        <input
          className="range"
          type="range"
          min={0}
          max={max}
          step={periode === 'an' ? 500 : 50}
          value={Math.min(ca, max)}
          onChange={(e) => setCa(Number(e.target.value))}
          aria-label="Chiffre d'affaires"
        />
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <Check label="ACRE (première année)" checked={acre} onChange={setAcre} />
          <Check label="Versement libératoire de l'impôt" checked={vl} onChange={setVl} />
        </div>
      </div>
      <div className="sim-result" style={{ marginTop: 18 }}>
        <div className="row"><span className="k">Cotisations sociales ({fmtPct(tauxCotisations(activite, o))})</span><span className="tnum">{fmtEUR(c.cotisations)}</span></div>
        <div className="row"><span className="k">Formation professionnelle ({fmtPct(options.bareme.cfp[options.nature])})</span><span className="tnum">{fmtEUR(c.cfp)}</span></div>
        {hasChambre && <div className="row"><span className="k">Taxe pour frais de chambre ({fmtPct(tauxChambre(activite, options), 3)})</span><span className="tnum">{fmtEUR(c.chambre)}</span></div>}
        {vl && <div className="row"><span className="k">Impôt sur le revenu — VL ({fmtPct(options.bareme.versementLiberatoire[activite])})</span><span className="tnum">{fmtEUR(c.vl)}</span></div>}
        <div className="row total">
          <span>Total prélevé par l'URSSAF</span>
          <span className="tnum">{fmtEUR(c.total)} <span className="small text-2">({fmtPct(c.tauxEffectif, 1)})</span></span>
        </div>
        <div className="row net"><span>Net {periode === 'mois' ? 'mensuel' : 'annuel'}</span><span className="tnum">{fmtEUR(c.net)}</span></div>
        {!vl && (
          <p className="small muted">
            Sans versement libératoire, l'impôt sur le revenu porte sur {fmtEUR(ca * (1 - abattement / 100))} (CA après abattement forfaitaire de {abattement} %), ajoutés aux autres revenus du foyer.
          </p>
        )}
      </div>
    </div>
  );
}
