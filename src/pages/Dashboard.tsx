import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart, Meter, StatTile } from '../components/charts';
import { Badge, Icon, PageHeader, Seg } from '../components/ui';
import { useBaremes, useClients, useDocuments, usePaiements, useProfile } from '../db/hooks';
import { ACTIVITES, isTVAVente, isVente, type ActivityKind, type Doc } from '../db/types';
import { pickBareme } from '../lib/bareme';
import { monthOf, todayISO, yearOf } from '../lib/dates';
import { montantPaye, statutInfo } from '../lib/documents';
import { loadDemo } from '../lib/demo';
import { MOIS_COURT, fmtCompact, fmtDate, fmtEUR, fmtEUR0 } from '../lib/format';
import { caParActivite, declarations, encaissementsParMois, factureParMois, sum } from '../lib/stats';

// Lien de démonstration : `#/?demo=1` charge le jeu de démo sur une base vide (une seule fois).
let demoRequested = false;

export default function Dashboard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile, loaded, exists } = useProfile();
  const docs = useDocuments();
  const paiements = usePaiements();
  const baremes = useBaremes();
  const clients = useClients();

  useEffect(() => {
    if (params.get('demo') === '1' && loaded && !exists && docs.length === 0 && !demoRequested) {
      demoRequested = true;
      void loadDemo();
    }
  }, [params, loaded, exists, docs.length]);
  const today = todayISO();
  const curY = yearOf(today);
  const curM = monthOf(today);
  const [year, setYear] = useState(curY);
  const [mode, setMode] = useState<'encaisse' | 'facture'>('encaisse');

  const years = useMemo(() => {
    const s = new Set<number>([curY]);
    docs.forEach((d) => s.add(yearOf(d.dateEmission)));
    paiements.forEach((p) => s.add(yearOf(p.date)));
    return [...s].sort((a, b) => b - a);
  }, [docs, paiements, curY]);

  const docsById = useMemo(() => new Map(docs.filter((d) => d.id).map((d) => [d.id!, d])), [docs]);
  const serie = (y: number) => (mode === 'encaisse' ? encaissementsParMois(paiements, docsById, y) : factureParMois(docs, y));
  const cur = serie(year);
  const prev = serie(year - 1);
  const total = sum(cur);
  const upto = year === curY ? curM : 12;
  const prevToDate = sum(prev.slice(0, upto));
  const delta = prevToDate > 0 ? ((sum(cur.slice(0, upto)) - prevToDate) / prevToDate) * 100 : null;

  const rows = useMemo(() => declarations(year, paiements, docsById, profile, baremes, today), [year, paiements, docsById, profile, baremes, today]);
  const cotisAnnee = rows.reduce((s, r) => s + r.calcul.total, 0);
  const next = rows.find((r) => r.etat === 'a_declarer') ?? rows.find((r) => r.etat === 'en_cours');

  const factures = docs.filter((d) => d.type === 'facture');
  const attente = factures.filter((d) => d.statut === 'envoyee');
  const attenteTotal = attente.reduce((s, d) => s + d.totalTTC - montantPaye(d, paiements), 0);
  const retard = attente.filter((d) => d.dateEcheance < today);
  const devisEnCours = docs.filter((d) => d.type === 'devis' && d.statut === 'envoye');

  const bareme = pickBareme(baremes, year);
  const parActivite = caParActivite(paiements, docsById, year);
  const caVente = sum((Object.keys(parActivite) as ActivityKind[]).filter(isVente).map((a) => parActivite[a] ?? 0));
  const caServices = sum((Object.keys(parActivite) as ActivityKind[]).filter((a) => !isVente(a)).map((a) => parActivite[a] ?? 0));
  const caTVAVente = sum((Object.keys(parActivite) as ActivityKind[]).filter(isTVAVente).map((a) => parActivite[a] ?? 0));
  const caTVAServices = sum((Object.keys(parActivite) as ActivityKind[]).filter((a) => !isTVAVente(a)).map((a) => parActivite[a] ?? 0));
  const mainVente = isVente(profile.activite);
  const mainTVAVente = isTVAVente(profile.activite);

  const recentes = [...factures]
    .filter((d) => d.statut !== 'brouillon')
    .sort((a, b) => b.dateEmission.localeCompare(a.dateEmission) || b.numeroSeq - a.numeroSeq)
    .slice(0, 6);

  const clientName = (d: Doc) => d.client?.nom ?? clients.find((c) => c.id === d.clientId)?.nom ?? '—';
  const chartSeries = [{ name: String(year), color: 'var(--series-1)', values: cur }];
  if (sum(prev) > 0) chartSeries.push({ name: String(year - 1), color: 'var(--series-2)', values: prev });

  const vide = loaded && docs.length === 0 && paiements.length === 0;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={profile.denomination || `${profile.prenom} ${profile.nom}`.trim() || 'Votre activité en un coup d’œil'}
        actions={
          <>
            <button type="button" className="btn" onClick={() => navigate('/documents/nouveau?type=devis')}>
              <Icon name="plus" /> Devis
            </button>
            <button type="button" className="btn primary" onClick={() => navigate('/documents/nouveau?type=facture')}>
              <Icon name="plus" /> Facture
            </button>
          </>
        }
      />

      {vide && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>Bienvenue 👋</h2>
          <p className="text-2" style={{ margin: '6px 0 14px' }}>
            Tout se passe sur cet appareil, sans compte ni connexion. Trois étapes pour démarrer :
          </p>
          <div className="actions">
            {!exists && (
              <Link to="/parametres" className="btn primary">
                <Icon name="settings" /> 1. Renseigner mon profil
              </Link>
            )}
            <Link to="/clients" className="btn">
              <Icon name="users" /> 2. Ajouter un client
            </Link>
            <Link to="/documents/nouveau?type=facture" className="btn">
              <Icon name="file" /> 3. Créer une facture
            </Link>
            <span className="spacer" style={{ flex: 1 }} />
            <button type="button" className="btn ghost" onClick={() => void loadDemo()}>
              <Icon name="eye" /> Voir avec des données de démonstration
            </button>
          </div>
        </div>
      )}

      <div className="filters">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Année">
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { value: 'encaisse', label: 'Encaissé' },
            { value: 'facture', label: 'Facturé' },
          ]}
        />
        <span className="small muted">{mode === 'encaisse' ? 'Chiffre d’affaires HT réellement encaissé (base des cotisations).' : 'Montants HT des factures émises, payées ou non.'}</span>
      </div>

      <div className="dash-top">
        <div className="card hero">
          <span className="label muted">CA {mode === 'encaisse' ? 'encaissé' : 'facturé'} en {year}</span>
          <span className="value">{fmtEUR0(total)}</span>
          <span className="delta">
            {delta === null ? (
              <span className="muted">Pas de comparaison disponible avec {year - 1}</span>
            ) : (
              <>
                <span className={delta >= 0 ? 'good' : 'critical'} style={{ fontWeight: 600 }}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))} %
                </span>
                <span>vs {year - 1}{year === curY ? ' à la même date' : ''} ({fmtCompact(prevToDate)})</span>
              </>
            )}
          </span>
        </div>
          <StatTile
            label={`Cotisations ${year}`}
            value={fmtCompact(cotisAnnee)}
            sub={<Link to="/cotisations">estimation URSSAF →</Link>}
          />
          <StatTile
            label="Prochaine déclaration"
            value={next ? fmtCompact(next.calcul.total) : '—'}
            sub={
              next ? (
                <>
                  {next.etat === 'a_declarer' ? <Badge tone="warning">avant le {fmtDate(next.period.echeance)}</Badge> : <span>{next.period.label} · échéance {fmtDate(next.period.echeance)}</span>}
                </>
              ) : (
                'Aucune période'
              )
            }
          />
          <StatTile
            label="En attente de paiement"
            value={fmtCompact(attenteTotal)}
            sub={
              attente.length ? (
                <>
                  {attente.length} facture{attente.length > 1 ? 's' : ''}
                  {retard.length > 0 && <Badge tone="critical">{retard.length} en retard</Badge>}
                </>
              ) : (
                'Tout est encaissé'
              )
            }
          />
          <StatTile
            label="Devis en cours"
            value={fmtCompact(devisEnCours.reduce((s, d) => s + d.totalTTC, 0))}
            sub={devisEnCours.length ? `${devisEnCours.length} devis envoyé${devisEnCours.length > 1 ? 's' : ''}` : 'Aucun devis en attente'}
          />
      </div>

      <div className="dash-main">
        <div className="card">
          <div className="card-head">
            <h2>Chiffre d'affaires mensuel</h2>
            <span className="small muted">HT · {mode === 'encaisse' ? 'par date d’encaissement' : 'par date de facture'}</span>
          </div>
          <BarChart
            categories={MOIS_COURT}
            series={chartSeries}
            format={fmtEUR}
            formatTick={(n) => fmtCompact(n).replace(/\s€$/, ' €')}
            highlightIndex={year === curY ? curM - 1 : undefined}
            ariaLabel={`Chiffre d'affaires mensuel ${year}`}
            categoryLabel="Mois"
          />
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>Seuils {year}</h2>
              <span className="small muted">sur le CA encaissé</span>
            </div>
            <div className="stack" style={{ gap: 18 }}>
              {caVente > 0 && caServices > 0 ? (
                <>
                  <Meter label="Plafond micro — global" value={caVente + caServices} max={bareme.plafondCA.vente} format={fmtEUR0} />
                  <Meter label="Plafond micro — services" value={caServices} max={bareme.plafondCA.services} format={fmtEUR0} />
                </>
              ) : (
                <Meter
                  label={`Plafond micro-entreprise (${mainVente || caVente > 0 ? 'vente' : 'services'})`}
                  value={caVente > 0 ? caVente : caServices}
                  max={mainVente || caVente > 0 ? bareme.plafondCA.vente : bareme.plafondCA.services}
                  format={fmtEUR0}
                />
              )}
              {profile.assujettiTVA ? (
                <p className="small muted">Vous êtes assujetti à la TVA : le seuil de franchise ne s'applique pas.</p>
              ) : caTVAVente > 0 && caTVAServices > 0 ? (
                <>
                  <Meter label="Franchise TVA — global" value={caTVAVente + caTVAServices} max={bareme.franchiseTVA.venteBase} format={fmtEUR0} marker={{ value: bareme.franchiseTVA.venteMajore, label: 'Seuil majoré' }} />
                  <Meter label="Franchise TVA — services" value={caTVAServices} max={bareme.franchiseTVA.servicesBase} format={fmtEUR0} />
                </>
              ) : (
                <Meter
                  label={`Franchise de TVA (${mainTVAVente || caTVAVente > 0 ? 'vente / hébergement' : 'services'})`}
                  value={caTVAVente > 0 ? caTVAVente : caTVAServices}
                  max={mainTVAVente || caTVAVente > 0 ? bareme.franchiseTVA.venteBase : bareme.franchiseTVA.servicesBase}
                  format={fmtEUR0}
                  note={`Seuil majoré : ${fmtEUR0(mainTVAVente || caTVAVente > 0 ? bareme.franchiseTVA.venteMajore : bareme.franchiseTVA.servicesMajore)}`}
                />
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Dernières factures</h2>
              <Link to="/documents" className="small">Tout voir</Link>
            </div>
            {recentes.length === 0 ? (
              <p className="small text-2">Aucune facture finalisée pour l'instant.</p>
            ) : (
              <table className="table">
                <tbody>
                  {recentes.map((d) => {
                    const st = statutInfo(d, montantPaye(d, paiements), today);
                    return (
                      <tr key={d.id} className="clickable" onClick={() => navigate(`/documents/${d.id}`)}>
                        <td className="tnum small"><b>{d.numero}</b></td>
                        <td className="small">{clientName(d)}</td>
                        <td className="num small">{fmtEUR(d.totalTTC)}</td>
                        <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {Object.keys(parActivite).length > 1 && (
        <p className="small muted" style={{ marginTop: 14 }}>
          Répartition {year} : {(Object.entries(parActivite) as [ActivityKind, number][]).map(([a, v]) => `${ACTIVITES.find((x) => x.value === a)?.court} ${fmtEUR0(v)}`).join(' · ')}
        </p>
      )}
    </>
  );
}
