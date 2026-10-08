import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/ui';
import { db } from '../db/db';
import { useClients, usePaiements, useProfile } from '../db/hooks';
import type { ClientSnapshot } from '../db/types';
import { ligneTotalHT, montantPaye } from '../lib/documents';
import { fmtDate, fmtEUR, fmtNum } from '../lib/format';

export default function DocumentPrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const doc = useLiveQuery(() => db.documents.get(Number(id)), [id]);
  const { profile, loaded } = useProfile();
  const clients = useClients();
  const paiements = usePaiements();
  const printed = useRef(false);

  const liveClient = doc?.clientId ? clients.find((c) => c.id === doc.clientId) : undefined;
  const client: ClientSnapshot | null = doc?.client ?? (liveClient ? { ...liveClient } : null);

  useEffect(() => {
    if (doc && loaded && params.get('print') === '1' && !printed.current) {
      printed.current = true;
      const t = setTimeout(() => window.print(), 450);
      return () => clearTimeout(t);
    }
  }, [doc, loaded, params]);

  useEffect(() => {
    if (!doc) return;
    const prev = document.title;
    const base = doc.numero || (doc.type === 'facture' ? 'Facture' : 'Devis');
    document.title = client?.nom ? `${base} - ${client.nom}` : base;
    return () => {
      document.title = prev;
    };
  }, [doc, client?.nom]);

  if (!loaded || doc === undefined) return <div className="print-stage"><p className="muted">Chargement…</p></div>;
  if (!doc) return <div className="print-stage"><p>Document introuvable.</p></div>;

  const isFacture = doc.type === 'facture';
  const titre = isFacture ? 'FACTURE' : 'DEVIS';
  const paye = montantPaye(doc, paiements);
  const dernierPaiement = paiements.filter((p) => p.factureId === doc.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const brut = doc.lignes.reduce((s, l) => s + ligneTotalHT(l), 0);
  const remise = Math.min(doc.remise || 0, brut);
  const emetteur = profile.denomination || `${profile.prenom} ${profile.nom}`.trim() || 'Votre nom';
  const proClient = client?.type === 'pro';

  return (
    <div className="print-stage">
      <div className="print-toolbar no-print" style={{ margin: '-28px -16px 24px' }}>
        <button type="button" className="btn ghost" onClick={() => navigate(`/documents/${doc.id}`)}>
          <Icon name="back" /> Retour au document
        </button>
        <span className="spacer" style={{ flex: 1 }} />
        <span className="small text-2">Choisissez « Enregistrer au format PDF » comme imprimante.</span>
        <button type="button" className="btn primary" onClick={() => window.print()}>
          <Icon name="print" /> Imprimer / PDF
        </button>
      </div>

      <article className="sheet" style={{ ['--doc-accent' as string]: profile.couleur || '#2a78d6' }}>
        <header className="sheet-head">
          <div className="sheet-emitter">
            {profile.logo && <img className="sheet-logo" src={profile.logo} alt="" style={{ display: 'block', marginBottom: 10 }} />}
            <strong>{emetteur}</strong>
            {profile.denomination && (profile.prenom || profile.nom) && <div>{`${profile.prenom} ${profile.nom}`.trim()}</div>}
            {profile.activiteLibelle && <div>{profile.activiteLibelle}</div>}
            {profile.adresse && <div>{profile.adresse}</div>}
            {(profile.codePostal || profile.ville) && <div>{profile.codePostal} {profile.ville}</div>}
            {profile.email && <div>{profile.email}</div>}
            {profile.telephone && <div>{profile.telephone}</div>}
            {profile.siteWeb && <div>{profile.siteWeb}</div>}
          </div>
          <div className="sheet-title">
            <h1>{titre}</h1>
            <div className="num">{doc.numero || 'PROVISOIRE — brouillon'}</div>
            <div className="dates">
              <div>Date : {fmtDate(doc.dateEmission)}</div>
              <div>{isFacture ? 'Échéance' : 'Valable jusqu’au'} : {fmtDate(doc.dateEcheance)}</div>
            </div>
          </div>
        </header>

        <section className="sheet-parties">
          <div className="sheet-box">
            <div className="lbl">Émetteur</div>
            <strong>{emetteur}</strong>
            {profile.siret && <div>SIRET : {profile.siret}</div>}
            {profile.assujettiTVA && profile.numeroTVA && <div>N° TVA : {profile.numeroTVA}</div>}
          </div>
          <div className="sheet-box">
            <div className="lbl">{isFacture ? 'Facturé à' : 'Adressé à'}</div>
            {client ? (
              <>
                <strong>{client.nom}</strong>
                {client.adresse && <div>{client.adresse}</div>}
                {(client.codePostal || client.ville) && <div>{client.codePostal} {client.ville}</div>}
                {client.email && <div>{client.email}</div>}
                {client.siret && <div>SIRET : {client.siret}</div>}
              </>
            ) : (
              <em style={{ color: '#999' }}>Aucun client sélectionné</em>
            )}
          </div>
        </section>

        {doc.objet && (
          <p className="sheet-objet">
            <b>Objet :</b> {doc.objet}
          </p>
        )}

        <table className="lines">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qté</th>
              <th className="num">Prix unit. HT</th>
              {profile.assujettiTVA && <th className="num">TVA</th>}
              <th className="num">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {doc.lignes.filter((l) => l.description.trim() || l.prixUnitaire).map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: 'pre-wrap' }}>{l.description}</td>
                <td className="num">{fmtNum(l.quantite)}{l.unite ? ` ${l.unite}` : ''}</td>
                <td className="num">{fmtEUR(l.prixUnitaire)}</td>
                {profile.assujettiTVA && <td className="num">{fmtNum(l.tauxTVA)} %</td>}
                <td className="num">{fmtEUR(ligneTotalHT(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-block">
          <table>
            <tbody>
              {remise > 0 && (
                <>
                  <tr><td>Sous-total HT</td><td>{fmtEUR(brut)}</td></tr>
                  <tr><td>Remise</td><td>− {fmtEUR(remise)}</td></tr>
                </>
              )}
              <tr><td>Total HT</td><td>{fmtEUR(doc.totalHT)}</td></tr>
              {profile.assujettiTVA && <tr><td>TVA</td><td>{fmtEUR(doc.totalTVA)}</td></tr>}
              <tr className="grand"><td>{profile.assujettiTVA ? 'Total TTC' : 'Total à payer'}</td><td>{fmtEUR(doc.totalTTC)}</td></tr>
              {isFacture && paye > 0 && paye < doc.totalTTC && (
                <>
                  <tr><td>Déjà réglé</td><td>− {fmtEUR(paye)}</td></tr>
                  <tr><td><b>Reste à payer</b></td><td><b>{fmtEUR(doc.totalTTC - paye)}</b></td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {isFacture && doc.statut === 'payee' && dernierPaiement && (
          <p style={{ marginBottom: 14, fontWeight: 600, color: '#2a7a2a' }}>Facture acquittée le {fmtDate(dernierPaiement.date)}.</p>
        )}

        <section className="mentions">
          {doc.notes && (
            <div>
              <h4>Notes</h4>
              <div style={{ whiteSpace: 'pre-wrap' }}>{doc.notes}</div>
            </div>
          )}
          {!profile.assujettiTVA && <div>TVA non applicable, art. 293 B du CGI.</div>}
          {isFacture && (
            <div>
              <h4>Conditions de règlement</h4>
              <div>{profile.conditionsPaiement || `Paiement à réception, au plus tard le ${fmtDate(doc.dateEcheance)}.`}</div>
              {(profile.iban || profile.bic) && (
                <div>
                  {profile.iban && <>IBAN : {profile.iban}</>}
                  {profile.iban && profile.bic && ' · '}
                  {profile.bic && <>BIC : {profile.bic}</>}
                </div>
              )}
              {proClient && (
                <div>
                  Pénalités de retard : trois fois le taux d'intérêt légal en vigueur, exigibles sans rappel dès le lendemain de la date d'échéance.
                  Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 et D441-5 du Code de commerce). Pas d'escompte pour paiement anticipé.
                </div>
              )}
            </div>
          )}
          {!isFacture && (
            <div>
              <div>Devis valable jusqu'au {fmtDate(doc.dateEcheance)}. {profile.conditionsPaiement}</div>
              <div className="signature">
                <div>Bon pour accord — date et signature du client :</div>
              </div>
            </div>
          )}
          {profile.mentionsPied && <div style={{ whiteSpace: 'pre-wrap' }}>{profile.mentionsPied}</div>}
        </section>

        <footer className="sheet-foot">
          <div>
            {[emetteur, profile.adresse && `${profile.adresse}, ${profile.codePostal} ${profile.ville}`.trim(), profile.siret && `SIRET ${profile.siret}`, profile.email, profile.telephone]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {profile.nature === 'liberal' && <div className="pays">Entrepreneur individuel — dispensé d'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM).</div>}
        </footer>
      </article>
    </div>
  );
}
