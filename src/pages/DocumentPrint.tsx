import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/ui';
import { db } from '../db/db';
import { useClients, usePaiements, useProfile, useRegime } from '../db/hooks';
import type { ClientSnapshot } from '../db/types';
import { tIn, useI18n, type Lang } from '../i18n';
import { ligneTotalHT, montantPaye, normalizeDoc, profilDuDocument } from '../lib/documents';
import { fmtDate, fmtMoneyIn, fmtNum } from '../lib/format';
import { L, getRegime, identifiantPrincipal, identifiantsPied, localeFor } from '../regimes';
import { groupeOf } from '../regimes/engine';

export default function DocumentPrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const raw = useLiveQuery(() => db.documents.get(Number(id)), [id]);
  const doc = raw ? normalizeDoc(raw) : raw;
  const { profile: profilActuel, loaded } = useProfile();
  const regimeActuel = useRegime();
  // Un document émis s'imprime avec l'émetteur de sa finalisation : identité, adresse, identifiants,
  // régime de taxe et mentions ne suivent pas les changements ultérieurs du profil. Seule la mise en
  // forme (logo, couleur, thème) reste celle du profil courant.
  const profile = doc ? profilDuDocument(doc, profilActuel) : profilActuel;
  const regime = doc && doc.statut !== 'brouillon' && doc.emetteur ? getRegime(doc.emetteur.pays, doc.emetteur.statut) : regimeActuel;
  const clients = useClients();
  const paiements = usePaiements();
  const printed = useRef(false);
  const origine = useLiveQuery(async () => (doc?.avoirDe ? await db.documents.get(doc.avoirDe) : undefined), [doc?.avoirDe]);

  const liveClient = doc?.clientId ? clients.find((c) => c.id === doc.clientId) : undefined;
  const client: ClientSnapshot | null = doc?.client ?? (liveClient ? { ...liveClient } : null);

  useEffect(() => {
    if (doc && loaded && params.get('print') === '1' && !printed.current) {
      printed.current = true;
      const timer = setTimeout(() => window.print(), 450);
      return () => clearTimeout(timer);
    }
  }, [doc, loaded, params]);

  const lang: Lang = doc?.langue || profile.langueDocuments;
  const tl = (key: string, vars?: Record<string, string | number>) => tIn(lang, key, vars);
  // Deux-points : espace insécable avant en français, collé dans les autres langues.
  const c = lang === 'fr' ? ' : ' : ': ';

  useEffect(() => {
    if (!doc) return;
    const prev = document.title;
    const base = doc.numero || tl(doc.type === 'facture' ? 'doc.invoice' : doc.type === 'avoir' ? 'doc.creditNote' : 'doc.quote');
    document.title = client?.nom ? `${base} - ${client.nom}` : base;
    return () => {
      document.title = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, client?.nom, lang]);

  if (!loaded || doc === undefined) return <div className="print-stage"><p className="muted">{t('common.loading')}</p></div>;
  if (!doc) return <div className="print-stage"><p>{t('print.notFound')}</p></div>;

  const locale = localeFor(lang, profile.pays);
  const devise = doc.devise || profile.devise;
  const money = (n: number) => fmtMoneyIn(locale, devise, n);
  const date = (iso: string) => fmtDate(iso, locale);
  const isFacture = doc.type === 'facture';
  const isAvoir = doc.type === 'avoir';
  const titre = tl(isFacture ? 'print.invoice' : isAvoir ? 'print.creditNote' : 'print.quote');
  const paye = montantPaye(doc, paiements);
  const dernierPaiement = paiements.filter((p) => p.factureId === doc.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const brut = doc.lignes.reduce((s, l) => s + ligneTotalHT(l), 0);
  const remise = Math.min(doc.remise || 0, brut);
  const emetteur = profile.denomination || `${profile.prenom} ${profile.nom}`.trim() || tl('print.yourName');
  const proClient = client?.type === 'pro';
  const periode = doc.prestationDebut
    ? doc.prestationFin && doc.prestationFin !== doc.prestationDebut
      ? tl('print.period', { from: date(doc.prestationDebut), to: date(doc.prestationFin) })
      : tl(groupeOf(regime, doc.activite) === 'vente' ? 'print.deliveryDate' : 'print.serviceDate', { date: date(doc.prestationDebut) })
    : '';
  const categorie = groupeOf(regime, doc.activite) === 'vente' ? tl('print.catGoods') : tl('print.catServices');
  // Les identifiants repris dans la mention de pied (forme, capital, registre…) n'apparaissent qu'en pied.
  const pied = identifiantsPied(regime);
  const identifiants = regime.identifiants.filter((i) => !pied.has(i.id) && profile.identifiants[i.id] && (!i.pourTva || profile.assujettiTVA));
  const principal = identifiantPrincipal(regime);
  const mentionFranchise = L(regime.tva.mentionFranchise, lang);
  const mentionRetard = L(regime.mentions.retard, lang);
  // Mention de pied du régime ; les `{identifiant}` (forme, capital, registre…) sont remplis depuis le profil.
  const mentionPied = (() => {
    if (!regime.mentions.pied || (regime.mentions.piedNatures && !regime.mentions.piedNatures.includes(profile.nature))) return '';
    const tpl = L(regime.mentions.pied, lang);
    const ids = [...tpl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (ids.length && !ids.some((id) => profile.identifiants[id]?.trim())) return '';
    return tpl.replace(/\{(\w+)\}/g, (_, id: string) => profile.identifiants[id]?.trim() || '—');
  })();
  const mentionRetenue = L(regime.mentions.retenue, lang);
  const idFooter = principal && profile.identifiants[principal.id] ? `${L(principal.label, lang)} ${profile.identifiants[principal.id]}` : '';

  return (
    <div className="print-stage">
      <div className="print-toolbar no-print" style={{ margin: '-28px -16px 24px' }}>
        <button type="button" className="btn ghost" onClick={() => navigate(`/documents/${doc.id}`)}>
          <Icon name="back" /> {t('print.backToDoc')}
        </button>
        <span className="spacer" style={{ flex: 1 }} />
        <span className="small text-2">{t('print.hint')}</span>
        <button type="button" className="btn primary" onClick={() => window.print()}>
          <Icon name="print" /> {t('common.printPdf')}
        </button>
      </div>

      <article className={`sheet${profile.themeDocument === 'sombre' ? ' sheet-dark' : ''}`} style={{ ['--doc-accent' as string]: profile.couleur || '#2a78d6' }} lang={lang}>
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
            <div className="num">{doc.numero || tl('print.provisional')}</div>
            <div className="dates">
              <div>{tl('print.date')}{c}{date(doc.dateEmission)}</div>
              {!isAvoir && <div>{tl(isFacture ? 'print.dueDate' : 'print.validUntil')}{c}{date(doc.dateEcheance)}</div>}
            </div>
          </div>
        </header>

        <section className="sheet-parties">
          <div className="sheet-box">
            <div className="lbl">{tl('print.issuer')}</div>
            <strong>{emetteur}</strong>
            {identifiants.map((i) => (
              <div key={i.id}>{L(i.label, lang)}{c}{profile.identifiants[i.id]}</div>
            ))}
          </div>
          <div className="sheet-box">
            <div className="lbl">{tl(isFacture ? 'print.billedTo' : 'print.addressedTo')}</div>
            {client ? (
              <>
                <strong>{client.nom}</strong>
                {client.adresse && <div>{client.adresse}</div>}
                {(client.codePostal || client.ville) && <div>{client.codePostal} {client.ville}</div>}
                {client.pays && <div>{client.pays}</div>}
                {client.email && <div>{client.email}</div>}
                {client.siret && <div>{L(regime.identifiantClient, lang)}{c}{client.siret}</div>}
              </>
            ) : (
              <em className="vide">{tl('print.noClient')}</em>
            )}
          </div>
        </section>

        {isAvoir && (
          <p className="sheet-objet">
            <b>{tl('print.creditOn', { numero: origine?.numero ?? '' })}</b>
            {origine?.dateEmission && <> ({date(origine.dateEmission)})</>}
            {origine && <> — {tl('print.originalAmount', { montant: money(origine.totalTTC) })}</>}
          </p>
        )}
        {doc.objet && (
          <p className="sheet-objet">
            <b>{tl('print.subject')}{c.trimEnd()}</b> {doc.objet}
          </p>
        )}
        {(periode || doc.bonCommande || doc.adresseLivraison || isFacture || isAvoir) && (
          <p className="sheet-objet meta">
            {periode && <span>{periode}</span>}
            {periode && (isFacture || isAvoir) && ' · '}
            {(isFacture || isAvoir) && <span>{tl('print.category')}{c}{categorie}</span>}
            {doc.bonCommande && <span> · {tl('print.poNumber')}{c}{doc.bonCommande}</span>}
            {doc.adresseLivraison && <span> · {tl('print.deliveryAddress')}{c}{doc.adresseLivraison}</span>}
          </p>
        )}

        <table className="lines">
          <thead>
            <tr>
              <th>{tl('print.description')}</th>
              <th className="num">{tl('print.qty')}</th>
              <th className="num">{tl('print.unitPrice')}</th>
              {profile.assujettiTVA && <th className="num">{regime.tva.nom}</th>}
              <th className="num">{tl('print.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {doc.lignes.filter((l) => l.description.trim() || l.prixUnitaire).map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: 'pre-wrap' }}>{l.description}</td>
                <td className="num">{fmtNum(l.quantite)}{l.unite ? ` ${l.unite}` : ''}</td>
                <td className="num">{money(l.prixUnitaire)}</td>
                {profile.assujettiTVA && <td className="num">{fmtNum(l.tauxTVA)} %</td>}
                <td className="num">{money(ligneTotalHT(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-block">
          <table>
            <tbody>
              {remise > 0 && (
                <>
                  <tr><td>{tl('print.subtotal')}</td><td>{money(brut)}</td></tr>
                  <tr><td>{tl('print.discount')}</td><td>− {money(remise)}</td></tr>
                </>
              )}
              <tr><td>{tl('print.totalExcl')}</td><td>{money(doc.totalHT)}</td></tr>
              {profile.assujettiTVA && <tr><td>{regime.tva.nom}</td><td>{money(doc.totalTVA)}</td></tr>}
              <tr className="grand"><td>{isAvoir ? tl('print.creditAmount') : profile.assujettiTVA ? tl('print.totalIncl') : tl('print.totalDue')}</td><td>{money(doc.totalTTC)}</td></tr>
              {doc.montantRetenue > 0 && (
                <>
                  <tr><td>{tl('print.withholding', { pct: fmtNum(doc.retenue) })}</td><td>− {money(doc.montantRetenue)}</td></tr>
                  <tr className="grand"><td>{tl('print.netDue')}</td><td>{money(doc.netAPayer)}</td></tr>
                </>
              )}
              {isFacture && paye > 0 && paye < doc.netAPayer && (
                <>
                  <tr><td>{tl('print.alreadyPaid')}</td><td>− {money(paye)}</td></tr>
                  <tr><td><b>{tl('print.remaining')}</b></td><td><b>{money(doc.netAPayer - paye)}</b></td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {isFacture && doc.statut === 'payee' && dernierPaiement && <p className="acquittee">{tl('print.paidOn', { date: date(dernierPaiement.date) })}</p>}

        <section className="mentions">
          {doc.notes && (
            <div>
              <h4>{tl('print.notes')}</h4>
              <div style={{ whiteSpace: 'pre-wrap' }}>{doc.notes}</div>
            </div>
          )}
          {!profile.assujettiTVA && mentionFranchise && <div>{mentionFranchise}</div>}
          {doc.montantRetenue > 0 && mentionRetenue && <div>{mentionRetenue}</div>}
          {isAvoir && (
            <div>
              <h4>{tl('print.terms')}</h4>
              <div>{tl('print.creditTerms', { numero: origine?.numero ?? '', montant: money(doc.totalTTC) })}</div>
            </div>
          )}
          {isFacture && (
            <div>
              <h4>{tl('print.paymentTerms')}</h4>
              <div>{profile.conditionsPaiement || tl('print.defaultTerms', { date: date(doc.dateEcheance) })}</div>
              {(profile.iban || profile.bic) && (
                <div>
                  {profile.iban && <>IBAN{c}{profile.iban}</>}
                  {profile.iban && profile.bic && ' · '}
                  {profile.bic && <>BIC{c}{profile.bic}</>}
                </div>
              )}
              {proClient && mentionRetard && <div>{mentionRetard}</div>}
            </div>
          )}
          {doc.type === 'devis' && (
            <div>
              <div>{tl('print.quoteValid', { date: date(doc.dateEcheance) })} {profile.conditionsPaiement}</div>
              <div className="signature">
                <div>{tl('print.signature')}</div>
              </div>
            </div>
          )}
          {profile.mentionsPied && <div style={{ whiteSpace: 'pre-wrap' }}>{profile.mentionsPied}</div>}
        </section>

        <footer className="sheet-foot">
          <div>
            {[emetteur, profile.adresse && `${profile.adresse}, ${profile.codePostal} ${profile.ville}`.trim(), idFooter, profile.email, profile.telephone].filter(Boolean).join(' · ')}
          </div>
          {mentionPied && <div className="pays">{mentionPied}</div>}
        </footer>
      </article>
    </div>
  );
}
