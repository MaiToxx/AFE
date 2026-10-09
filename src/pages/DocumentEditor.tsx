import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import BuyLicenceButton from '../components/BuyLicenceButton';
import ClientForm from '../components/ClientForm';
import { Badge, Field, Icon, Modal, Notice, NumInput, PageHeader } from '../components/ui';
import { db } from '../db/db';
import { useClients, useLicense, usePaiements, useProfile } from '../db/hooks';
import { canFinalize } from '../lib/license';
import { ACTIVITES, MOYENS, type ActivityKind, type Doc, type DocType, type Ligne, type MoyenPaiement } from '../db/types';
import { isValidISO, todayISO, yearOf } from '../lib/dates';
import {
  DOC_DEFAULTS, avoirDepuisFacture, computeTotals, docLabel, dupliquer, encaisser, factureDepuisDevis, finaliser, formatNumero, isLocked,
  ligneTotalHT, montantPaye, montantRembourse, newDoc, newLigne, nextSeq, prefixeFor, rembourser, saveDoc, setStatut, statutInfo, supprimerDoc, supprimerPaiement,
} from '../lib/documents';
import { fmtDate, fmtEUR, round2 } from '../lib/format';

export default function DocumentEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile, loaded } = useProfile();
  const clients = useClients();
  const paiements = usePaiements();
  const licence = useLicense();
  const isNew = !id;
  const newType: DocType = params.get('type') === 'devis' ? 'devis' : 'facture';

  const [doc, setDoc] = useState<Doc | null>(null);
  const docRef = useRef<Doc | null>(null);
  docRef.current = doc;
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ReactNode>(null);
  const [clientModal, setClientModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [refundModal, setRefundModal] = useState(false);
  const [linked, setLinked] = useState<Doc | null>(null);

  // Chargement (ou création en mémoire pour un nouveau document).
  useEffect(() => {
    if (!loaded) return;
    if (isNew) {
      setDoc((d) => d ?? newDoc(newType, profile, clients.length === 1 ? clients[0].id! : null));
      return;
    }
    const num = Number(id);
    if (docRef.current?.id === num) return;
    db.documents.get(num).then((d) => {
      if (d) setDoc({ ...DOC_DEFAULTS, ...d });
      else navigate('/documents', { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loaded, isNew, newType]);

  // Document lié (devis ↔ facture).
  useEffect(() => {
    const lid = doc?.avoirDe ?? doc?.avoirId ?? doc?.devisId ?? doc?.factureId ?? null;
    if (!lid) {
      setLinked(null);
      return;
    }
    db.documents.get(lid).then((d) => setLinked(d ? { ...DOC_DEFAULTS, ...d } : null));
  }, [doc?.devisId, doc?.factureId, doc?.avoirDe, doc?.avoirId]);

  // Enregistrement automatique des brouillons.
  useEffect(() => {
    if (!doc || !dirty) return;
    const t = setTimeout(async () => {
      setSaving(true);
      const newId = await saveDoc(doc, profile);
      setSaving(false);
      setDirty(false);
      if (!doc.id) {
        setDoc((d) => (d ? { ...d, id: newId } : d));
        navigate(`/documents/${newId}`, { replace: true });
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, dirty]);

  async function reload() {
    if (!doc?.id) return;
    const d = await db.documents.get(doc.id);
    if (d) setDoc({ ...DOC_DEFAULTS, ...d });
  }

  if (!loaded || !doc) return <div className="muted">Chargement…</div>;

  const locked = isLocked(doc);
  const isFacture = doc.type === 'facture';
  const isAvoir = doc.type === 'avoir';
  const totals = computeTotals(doc, profile.assujettiTVA);
  const paye = montantPaye(doc, paiements);
  // Avoir : encaissements bruts et remboursements déjà effectués sur la facture d'origine.
  const origineEncaisse = isAvoir && doc.avoirDe ? paiements.filter((p) => p.factureId === doc.avoirDe && p.montant > 0).reduce((s, p) => s + p.montant, 0) : 0;
  const rembourse = isAvoir ? montantRembourse(doc, paiements) : 0;
  const remboursable = isAvoir ? Math.max(0, round2(Math.min(doc.totalTTC, origineEncaisse) - rembourse)) : 0;
  const reste = round2(doc.totalTTC - paye);
  const st = statutInfo(doc, paye);
  const mesPaiements = paiements.filter((p) => p.factureId === doc.id).sort((a, b) => a.date.localeCompare(b.date));
  const today = todayISO();

  const update = (patch: Partial<Doc>) => {
    setDoc((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
    setError(null);
  };
  const updateLigne = (lid: string, patch: Partial<Ligne>) =>
    update({ lignes: doc.lignes.map((l) => (l.id === lid ? { ...l, ...patch } : l)) });
  const removeLigne = (lid: string) => update({ lignes: doc.lignes.filter((l) => l.id !== lid) });
  const addLigne = () => update({ lignes: [...doc.lignes, newLigne(profile.tauxTVA)] });

  function validate(): string {
    if (!doc!.clientId) return 'Choisissez un client.';
    if (!isValidISO(doc!.dateEmission)) return "La date d'émission est invalide.";
    const lignes = doc!.lignes.filter((l) => l.description.trim() || l.prixUnitaire);
    if (!lignes.length) return 'Ajoutez au moins une ligne avec une description et un prix.';
    if (lignes.some((l) => !l.description.trim())) return 'Chaque ligne doit avoir une description.';
    if (totals.totalTTC <= 0) return 'Le montant total doit être supérieur à zéro.';
    return '';
  }

  const bloque = licence.status !== 'loading' && !canFinalize(licence);

  async function onFinaliser() {
    if (!canFinalize(licence)) {
      setError(
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>
            {licence.status === 'trial_over' ? "La période d'essai est terminée" : 'Aucune licence valide'} : la finalisation des documents nécessite une licence.{' '}
            <Link to="/parametres?tab=licence">Activer une licence</Link>
          </span>
          <BuyLicenceButton small />
        </div>,
      );
      return;
    }
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    let d: Doc = { ...doc!, lignes: doc!.lignes.filter((l) => l.description.trim() || l.prixUnitaire) };
    const nid = await saveDoc(d, profile);
    d = { ...d, id: nid };
    setDirty(false);
    const annee = yearOf(d.dateEmission);
    const numero = d.numero || formatNumero(prefixeFor(d.type, profile), annee, await nextSeq(d.type, annee));
    const msg = isFacture
      ? `La facture recevra le numéro définitif ${numero}.\n\nUne fois finalisée, elle ne pourra plus être modifiée (seuls les encaissements et l'annulation restent possibles). Continuer ?`
      : isAvoir
        ? `L'avoir recevra le numéro définitif ${numero} et ne pourra plus être modifié. Continuer ?`
        : `Le devis recevra le numéro ${numero} et sera marqué comme envoyé. Continuer ?`;
    if (!confirm(msg)) {
      setDoc(d);
      return;
    }
    const updated = await finaliser(d, profile);
    setDoc(updated);
    if (!doc!.id) navigate(`/documents/${nid}`, { replace: true });
  }

  async function onSupprimer() {
    if (!confirm('Supprimer ce brouillon ?')) return;
    if (doc!.id) await supprimerDoc(doc!);
    navigate(`/documents?type=${doc!.type}`);
  }

  async function onDupliquer() {
    const nid = await dupliquer(doc!, profile);
    navigate(`/documents/${nid}`);
  }

  async function onConvertir() {
    const nid = await factureDepuisDevis(doc!, profile);
    navigate(`/documents/${nid}`);
  }

  async function onAnnuler() {
    if (!confirm("Annuler cette facture ? À réserver à une facture jamais transmise au client : une facture envoyée se corrige par un avoir.\n\nElle restera dans l'historique avec le statut « annulée ».")) return;
    await setStatut(doc!.id!, 'annulee');
    await reload();
  }

  async function onAvoir() {
    if (!confirm(`Créer un avoir reprenant les lignes de ${docLabel(doc!)} ? Vous pourrez ajuster les montants (avoir partiel) avant de le finaliser.`)) return;
    const nid = await avoirDepuisFacture(doc!, profile);
    navigate(`/documents/${nid}`);
  }

  async function onStatut(s: Doc['statut']) {
    await setStatut(doc!.id!, s);
    await reload();
  }

  const title = isNew && !doc.id ? (isFacture ? 'Nouvelle facture' : isAvoir ? 'Nouvel avoir' : 'Nouveau devis') : docLabel(doc);
  const lienLabel = isAvoir ? 'Avoir sur la ' : isFacture && doc.avoirId ? 'Corrigée par l’' : isFacture ? 'Issue du ' : 'Converti en ';

  return (
    <>
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {title} <Badge tone={st.tone}>{st.label}</Badge>
            {saving && <span className="small muted">Enregistrement…</span>}
          </span>
        }
        subtitle={
          linked && (
            <>
              {lienLabel}
              <Link to={`/documents/${linked.id}`}>{docLabel(linked)}</Link>
              {isAvoir && linked.dateEmission && <> du {fmtDate(linked.dateEmission)}</>}
            </>
          )
        }
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => navigate(`/documents?type=${doc.type}`)}>
              <Icon name="back" /> Retour
            </button>
            {doc.id && (
              <button type="button" className="btn" onClick={() => navigate(`/documents/${doc.id}/imprimer`)}>
                <Icon name="print" /> Aperçu / PDF
              </button>
            )}
            {!locked && (
              <button type="button" className="btn primary" onClick={onFinaliser}>
                <Icon name="check" /> Finaliser
              </button>
            )}
            {locked && isFacture && doc.statut === 'envoyee' && (
              <button type="button" className="btn primary" onClick={() => setPayModal(true)}>
                <Icon name="wallet" /> Encaisser
              </button>
            )}
            {locked && isAvoir && remboursable > 0 && (
              <button type="button" className="btn primary" onClick={() => setRefundModal(true)}>
                <Icon name="wallet" /> Enregistrer le remboursement
              </button>
            )}
            {locked && doc.type === 'devis' && doc.statut === 'envoye' && (
              <>
                <button type="button" className="btn" onClick={() => onStatut('refuse')}>Refusé</button>
                <button type="button" className="btn primary" onClick={onConvertir}>
                  <Icon name="convert" /> Accepté → facture
                </button>
              </>
            )}
            {locked && doc.type === 'devis' && doc.statut === 'accepte' && !doc.factureId && (
              <button type="button" className="btn primary" onClick={onConvertir}>
                <Icon name="convert" /> Convertir en facture
              </button>
            )}
          </>
        }
      />

      {error && <div style={{ marginBottom: 14 }}><Notice tone="critical">{error}</Notice></div>}
      {bloque && !locked && !error && (
        <div style={{ marginBottom: 14 }}>
          <Notice tone="warning">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>
                Vous pouvez préparer ce brouillon, mais sa finalisation (numéro définitif, envoi) nécessite une licence active.{' '}
                <Link to="/parametres?tab=licence">Activer une licence</Link>
              </span>
              <BuyLicenceButton small primary={false} />
            </div>
          </Notice>
        </div>
      )}
      {locked && (
        <div style={{ marginBottom: 14 }}>
          <Notice>
            {isFacture
              ? 'Facture finalisée : son contenu est verrouillé pour garantir une numérotation continue. Pour la corriger, créez un avoir.'
              : isAvoir
                ? 'Avoir émis : son contenu est verrouillé.'
                : 'Devis finalisé. Vous pouvez le repasser en brouillon pour le modifier tant qu\'il n\'a pas été converti.'}
          </Notice>
        </div>
      )}

      <div className="editor">
        <div className="stack">
          <div className="card">
            <div className="form-row">
              <div className="field">
                <span className="label">Client</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    value={doc.clientId ?? ''}
                    disabled={locked}
                    onChange={(e) => update({ clientId: e.target.value ? Number(e.target.value) : null })}
                    aria-label="Client"
                  >
                    <option value="">— Choisir un client —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                  {!locked && (
                    <button type="button" className="btn icon" onClick={() => setClientModal(true)} aria-label="Nouveau client" title="Nouveau client">
                      <Icon name="plus" />
                    </button>
                  )}
                </div>
              </div>
              <Field label="Objet">
                <input type="text" value={doc.objet} disabled={locked} placeholder={isFacture ? 'Ex. Refonte du site vitrine' : 'Ex. Création d’identité visuelle'} onChange={(e) => update({ objet: e.target.value })} />
              </Field>
            </div>
            <div className="form-row" style={{ marginTop: 14 }}>
              <Field label="Date d'émission">
                <input type="date" value={doc.dateEmission} disabled={locked} onChange={(e) => update({ dateEmission: e.target.value })} />
              </Field>
              <Field label={isFacture ? "Date d'échéance" : 'Valable jusqu’au'}>
                <input type="date" value={doc.dateEcheance} disabled={locked} onChange={(e) => update({ dateEcheance: e.target.value })} />
              </Field>
              <Field label="Activité (URSSAF)" help="Détermine le taux de cotisations appliqué à l'encaissement.">
                <select value={doc.activite} disabled={locked} onChange={(e) => update({ activite: e.target.value as ActivityKind })}>
                  {ACTIVITES.map((a) => (
                    <option key={a.value} value={a.value}>{a.court}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-row" style={{ marginTop: 14 }}>
              <Field label="Date de la prestation / livraison" help="Ou début de période. Mention attendue sur les factures depuis 2026.">
                <input type="date" value={doc.prestationDebut} disabled={locked} onChange={(e) => update({ prestationDebut: e.target.value })} />
              </Field>
              <Field label="Fin de période (optionnel)">
                <input type="date" value={doc.prestationFin} disabled={locked} onChange={(e) => update({ prestationFin: e.target.value })} />
              </Field>
              <Field label="N° de bon de commande client (optionnel)">
                <input type="text" value={doc.bonCommande} disabled={locked} onChange={(e) => update({ bonCommande: e.target.value })} />
              </Field>
              {doc.activite === 'vente' && (
                <Field label="Adresse de livraison (si différente)">
                  <input type="text" value={doc.adresseLivraison} disabled={locked} onChange={(e) => update({ adresseLivraison: e.target.value })} />
                </Field>
              )}
            </div>
          </div>

          <div className="card lines">
            <div className="card-head">
              <h2>Prestations</h2>
              {!locked && (
                <button type="button" className="btn sm" onClick={addLigne}>
                  <Icon name="plus" size={15} /> Ajouter une ligne
                </button>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '46%' }}>Description</th>
                    <th style={{ width: 70 }}>Qté</th>
                    <th style={{ width: 90 }}>Unité</th>
                    <th style={{ width: 110 }}>Prix unit. HT</th>
                    {profile.assujettiTVA && <th style={{ width: 70 }}>TVA %</th>}
                    <th className="right">Total HT</th>
                    {!locked && <th style={{ width: 36 }} />}
                  </tr>
                </thead>
                <tbody>
                  {doc.lignes.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <input type="text" value={l.description} disabled={locked} placeholder="Description de la prestation" onChange={(e) => updateLigne(l.id, { description: e.target.value })} aria-label="Description" />
                      </td>
                      <td className="num"><NumInput value={l.quantite} disabled={locked} onChange={(quantite) => updateLigne(l.id, { quantite })} ariaLabel="Quantité" min={0} /></td>
                      <td><input type="text" value={l.unite} disabled={locked} placeholder="jour, h…" onChange={(e) => updateLigne(l.id, { unite: e.target.value })} aria-label="Unité" /></td>
                      <td className="num"><NumInput value={l.prixUnitaire} disabled={locked} onChange={(prixUnitaire) => updateLigne(l.id, { prixUnitaire })} ariaLabel="Prix unitaire HT" /></td>
                      {profile.assujettiTVA && (
                        <td className="num"><NumInput value={l.tauxTVA} disabled={locked} onChange={(tauxTVA) => updateLigne(l.id, { tauxTVA })} ariaLabel="Taux de TVA" min={0} /></td>
                      )}
                      <td className="total">{fmtEUR(ligneTotalHT(l))}</td>
                      {!locked && (
                        <td>
                          <button type="button" className="btn danger sm icon" onClick={() => removeLigne(l.id)} aria-label="Supprimer la ligne" disabled={doc.lignes.length === 1}>
                            <Icon name="x" size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-row" style={{ marginTop: 16 }}>
              <Field label="Remise globale (€ HT)">
                <NumInput value={doc.remise} disabled={locked} onChange={(remise) => update({ remise })} min={0} className="inline-num" />
              </Field>
              <Field label="Notes (affichées sur le document)" className="span-2">
                <textarea value={doc.notes} disabled={locked} rows={2} onChange={(e) => update({ notes: e.target.value })} placeholder="Ex. Acompte de 30 % à la commande, solde à la livraison." />
              </Field>
            </div>
          </div>
        </div>

        <div className="stack sticky">
          <div className="card">
            <h2 style={{ marginBottom: 10 }}>Total</h2>
            <div className="totals">
              <div className="row"><span className="text-2">Sous-total HT</span><span className="tnum">{fmtEUR(totals.totalHT + Math.min(doc.remise || 0, totals.totalHT + (doc.remise || 0)))}</span></div>
              {doc.remise > 0 && <div className="row"><span className="text-2">Remise</span><span className="tnum">− {fmtEUR(Math.min(doc.remise, totals.totalHT + doc.remise))}</span></div>}
              <div className="row"><span className="text-2">Total HT</span><span className="tnum">{fmtEUR(totals.totalHT)}</span></div>
              {profile.assujettiTVA ? (
                <div className="row"><span className="text-2">TVA</span><span className="tnum">{fmtEUR(totals.totalTVA)}</span></div>
              ) : (
                <div className="row"><span className="muted small">TVA non applicable, art. 293 B du CGI</span></div>
              )}
              <div className="row big"><span>Total {profile.assujettiTVA ? 'TTC' : ''}</span><span className="tnum">{fmtEUR(totals.totalTTC)}</span></div>
            </div>
          </div>

          {isAvoir && locked && linked && (
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>Facture d'origine</h2>
              <dl className="kv">
                <dt>Facture</dt><dd><Link to={`/documents/${linked.id}`}>{linked.numero}</Link> du {fmtDate(linked.dateEmission)}</dd>
                <dt>Montant</dt><dd className="tnum">{fmtEUR(linked.totalTTC)}</dd>
                <dt>Encaissé</dt><dd className="tnum">{fmtEUR(origineEncaisse)}</dd>
                <dt>Remboursé</dt><dd className="tnum">{fmtEUR(rembourse)}</dd>
              </dl>
              <p className="small text-2" style={{ marginTop: 10 }}>
                {origineEncaisse <= 0
                  ? 'Facture non encaissée : l’avoir la corrige sans mouvement d’argent.'
                  : remboursable > 0
                    ? `Reste ${fmtEUR(remboursable)} à rembourser au client (ou à déduire de sa prochaine facture).`
                    : 'Remboursement enregistré : le CA encaissé de la période a été réduit d’autant.'}
              </p>
            </div>
          )}

          {isFacture && locked && doc.statut !== 'annulee' && (
            <div className="card">
              <div className="card-head">
                <h2>Encaissements</h2>
                {doc.statut === 'envoyee' && (
                  <button type="button" className="btn sm primary" onClick={() => setPayModal(true)}>
                    <Icon name="plus" size={15} /> Encaisser
                  </button>
                )}
              </div>
              {mesPaiements.length === 0 ? (
                <p className="small text-2">Aucun encaissement enregistré.{doc.dateEcheance < today && <> <b className="critical">Échéance dépassée le {fmtDate(doc.dateEcheance)}.</b></>}</p>
              ) : (
                <table className="table">
                  <tbody>
                    {mesPaiements.map((p) => (
                      <tr key={p.id}>
                        <td className="tnum">{fmtDate(p.date)}</td>
                        <td className="text-2 small">{MOYENS.find((m) => m.value === p.moyen)?.label}</td>
                        <td className="num">{fmtEUR(p.montant)}</td>
                        <td style={{ width: 32 }}>
                          <button type="button" className="btn danger sm icon" aria-label="Supprimer l'encaissement" onClick={async () => { if (confirm('Supprimer cet encaissement ?')) { await supprimerPaiement(p); await reload(); } }}>
                            <Icon name="x" size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="totals" style={{ marginTop: 10 }}>
                <div className="row"><span className="text-2">Encaissé</span><span className="tnum">{fmtEUR(paye)}</span></div>
                <div className="row big" style={{ fontSize: 15 }}><span>Reste à payer</span><span className={`tnum${reste > 0 ? '' : ' good'}`}>{fmtEUR(Math.max(0, reste))}</span></div>
              </div>
            </div>
          )}

          <div className="card tight">
            <div className="actions" style={{ justifyContent: 'flex-start' }}>
              {doc.id && !isAvoir && (
                <button type="button" className="btn ghost sm" onClick={onDupliquer}>
                  <Icon name="copy" size={15} /> Dupliquer
                </button>
              )}
              {locked && isFacture && (doc.statut === 'envoyee' || doc.statut === 'payee') && !doc.avoirId && (
                <button type="button" className="btn ghost sm" onClick={onAvoir} title="Corrige ou annule légalement une facture transmise">
                  <Icon name="convert" size={15} /> Créer un avoir
                </button>
              )}
              {locked && doc.type === 'devis' && !doc.factureId && doc.statut !== 'brouillon' && (
                <button type="button" className="btn ghost sm" onClick={() => onStatut('brouillon')}>
                  <Icon name="pen" size={15} /> Repasser en brouillon
                </button>
              )}
              {locked && doc.type === 'devis' && doc.statut === 'refuse' && (
                <button type="button" className="btn ghost sm" onClick={() => onStatut('envoye')}>Rouvrir</button>
              )}
              {locked && isFacture && doc.statut === 'envoyee' && mesPaiements.length === 0 && !doc.avoirId && (
                <button type="button" className="btn danger sm" onClick={onAnnuler} title="Uniquement si la facture n’a jamais été transmise">Annuler (non transmise)</button>
              )}
              {!locked && (
                <button type="button" className="btn danger sm" onClick={onSupprimer}>
                  <Icon name="trash" size={15} /> Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ClientForm open={clientModal} onClose={() => setClientModal(false)} onSaved={(cid) => update({ clientId: cid })} />
      {isFacture && (
        <PaiementModal
          open={payModal}
          onClose={() => setPayModal(false)}
          reste={Math.max(0, reste)}
          onSubmit={async (p) => {
            await encaisser(doc, p);
            setPayModal(false);
            await reload();
          }}
        />
      )}
      {isAvoir && (
        <PaiementModal
          open={refundModal}
          onClose={() => setRefundModal(false)}
          reste={remboursable}
          title="Enregistrer le remboursement"
          intro="Le remboursement est déduit du CA encaissé de sa période de déclaration URSSAF."
          montantLabel="Montant remboursé"
          onSubmit={async (p) => {
            await rembourser(doc, p);
            setRefundModal(false);
            await reload();
          }}
        />
      )}
    </>
  );
}

function PaiementModal({ open, onClose, reste, onSubmit, title = 'Enregistrer un encaissement', intro = "La date d'encaissement détermine la période de déclaration URSSAF.", montantLabel = 'Montant encaissé (TTC)' }: {
  open: boolean;
  onClose: () => void;
  reste: number;
  title?: string;
  intro?: string;
  montantLabel?: string;
  onSubmit: (p: { date: string; montant: number; moyen: MoyenPaiement; libelle: string }) => Promise<void>;
}) {
  const [date, setDate] = useState(todayISO());
  const [montant, setMontant] = useState(reste);
  const [moyen, setMoyen] = useState<MoyenPaiement>('virement');
  const [libelle, setLibelle] = useState('');
  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setMontant(reste);
      setMoyen('virement');
      setLibelle('');
    }
  }, [open, reste]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="button" className="btn primary" disabled={montant <= 0 || !isValidISO(date)} onClick={() => onSubmit({ date, montant, moyen, libelle })}>
            <Icon name="check" /> Enregistrer
          </button>
        </>
      }
    >
      <p className="small text-2">{intro}</p>
      <div className="form-row">
        <Field label="Date d'encaissement">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={montantLabel}>
          <NumInput value={montant} onChange={setMontant} min={0} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Moyen de paiement">
          <select value={moyen} onChange={(e) => setMoyen(e.target.value as MoyenPaiement)}>
            {MOYENS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Référence (optionnel)">
          <input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="N° de virement, chèque…" />
        </Field>
      </div>
    </Modal>
  );
}
