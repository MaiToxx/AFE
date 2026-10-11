import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import BuyLicenceButton from '../components/BuyLicenceButton';
import CatalogueModal from '../components/CatalogueModal';
import ClientForm from '../components/ClientForm';
import RecurrenceModal from '../components/RecurrenceModal';
import RelanceModal, { CANAUX } from '../components/RelanceModal';
import { Badge, Field, Icon, Modal, Notice, NumInput, PageHeader } from '../components/ui';
import { db } from '../db/db';
import { useClients, useLicense, usePaiements, useProfile, useRegime, useRelances } from '../db/hooks';
import { MOYENS, type Doc, type DocType, type Ligne, type MoyenPaiement, type Prestation } from '../db/types';
import { LANGS, useI18n, type Lang } from '../i18n';
import { isValidISO, todayISO, yearOf } from '../lib/dates';
import {
  avoirDepuisFacture, computeTotals, docLabel, dupliquer, encaisser, factureDepuisDevis, finaliser, formatNumero, isLocked,
  ligneTotalHT, montantDu, montantPaye, montantRembourse, montantRemise, newDoc, newLigne, nextSeq, normalizeDoc, prefixeFor, rembourser,
  saveDoc, setStatut, sousTotal, statutInfo, supprimerDoc, supprimerPaiement,
} from '../lib/documents';
import { fmtDate, fmtMoney, fmtNum, round2 } from '../lib/format';
import { canFinalize } from '../lib/license';
import { supprimerRelance } from '../lib/relances';
import { useGuard } from '../lib/useGuard';
import { L, identifiantPrincipal } from '../regimes';

export default function DocumentEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { profile, loaded } = useProfile();
  const regime = useRegime();
  const clients = useClients();
  const paiements = usePaiements();
  const licence = useLicense();
  const relances = useRelances();
  const isNew = !id;
  const newType: DocType = params.get('type') === 'devis' ? 'devis' : 'facture';

  const [doc, setDoc] = useState<Doc | null>(null);
  const docRef = useRef<Doc | null>(null);
  docRef.current = doc;
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [saving, setSaving] = useState(false);
  const [busy, guard] = useGuard();
  const [error, setError] = useState<ReactNode>(null);
  // Enregistrement des brouillons : un seul à la fois, dans l'ordre des modifications. La session
  // retient l'identifiant attribué au premier enregistrement avant même que l'état de l'écran ne le
  // connaisse : deux enregistrements rapprochés d'un nouveau document n'en créent jamais deux.
  const session = useRef<{ id?: number }>({});
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const abandoned = useRef(false);
  const mounted = useRef(true);
  const persist = useCallback((snapshot: Doc): Promise<number> => {
    const s = session.current;
    const run = saveChain.current
      .then(() => saveDoc({ ...snapshot, id: snapshot.id ?? s.id }, profileRef.current))
      .then((savedId) => {
        s.id = savedId;
        return savedId;
      });
    saveChain.current = run.catch(() => undefined);
    return run;
  }, []);
  /** Enregistre sans attendre les modifications en cours d'un brouillon (changement de document, fermeture). */
  const flush = useCallback(() => {
    const d = docRef.current;
    if (d && dirtyRef.current && !abandoned.current && !isLocked(d)) void persist(d).catch(() => undefined);
  }, [persist]);
  const [clientModal, setClientModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [refundModal, setRefundModal] = useState(false);
  const [catalogueModal, setCatalogueModal] = useState(false);
  const [relanceModal, setRelanceModal] = useState(false);
  const [recurrenceModal, setRecurrenceModal] = useState(false);
  const [linked, setLinked] = useState<Doc | null>(null);

  // Chargement (ou création en mémoire pour un nouveau document).
  useEffect(() => {
    if (!loaded) return;
    if (isNew) {
      // Arrivée depuis un document existant : ses dernières modifications partent, puis on repart à neuf.
      if (docRef.current?.id) {
        flush();
        session.current = {};
        abandoned.current = false;
        setDirty(false);
        setDoc(newDoc(newType, profile, clients.length === 1 ? clients[0].id! : null));
      } else setDoc((d) => d ?? newDoc(newType, profile, clients.length === 1 ? clients[0].id! : null));
      return;
    }
    const num = Number(id);
    // Même document (il vient d'être enregistré pour la première fois) : rien à recharger.
    if (docRef.current?.id === num || session.current.id === num) return;
    flush();
    const s = { id: num };
    session.current = s;
    abandoned.current = false;
    setDirty(false);
    db.documents.get(num).then((d) => {
      if (session.current !== s) return;
      if (d) setDoc(normalizeDoc(d));
      else navigate('/documents', { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loaded, isNew, newType]);

  // À la fermeture de l'écran, les modifications pas encore enregistrées partent tout de suite.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      flush();
    };
  }, [flush]);

  // Document lié (devis ↔ facture, facture ↔ avoir).
  useEffect(() => {
    const lid = doc?.avoirDe ?? doc?.avoirId ?? doc?.devisId ?? doc?.factureId ?? null;
    if (!lid) {
      setLinked(null);
      return;
    }
    db.documents.get(lid).then((d) => setLinked(d ? normalizeDoc(d) : null));
  }, [doc?.devisId, doc?.factureId, doc?.avoirDe, doc?.avoirId]);

  // Enregistrement automatique des brouillons, une demi-seconde après la dernière modification.
  useEffect(() => {
    if (!doc || !dirty || isLocked(doc)) return;
    const timer = setTimeout(async () => {
      const snapshot = docRef.current;
      const s = session.current;
      if (!snapshot || abandoned.current) return;
      setSaving(true);
      try {
        const savedId = await persist(snapshot);
        // L'écran a pu se fermer ou passer à un autre document pendant l'enregistrement.
        if (!mounted.current || session.current !== s) return;
        // Une modification faite entre-temps reste à enregistrer : elle repart pour un tour.
        if (docRef.current === snapshot) setDirty(false);
        if (!snapshot.id) {
          setDoc((d) => (d && !d.id ? { ...d, id: savedId } : d));
          navigate(`/documents/${savedId}`, { replace: true });
        }
      } catch (e) {
        console.error('Enregistrement du brouillon :', e);
      } finally {
        if (mounted.current) setSaving(false);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, dirty]);

  async function reload() {
    if (!doc?.id) return;
    const d = await db.documents.get(doc.id);
    if (d) setDoc(normalizeDoc(d));
  }

  if (!loaded || !doc) return <div className="muted">{t('common.loading')}</div>;

  const locked = isLocked(doc);
  const isFacture = doc.type === 'facture';
  const isAvoir = doc.type === 'avoir';
  const clientPro = doc.client ? doc.client.type === 'pro' : clients.find((c) => c.id === doc.clientId)?.type === 'pro';
  // Un document finalisé garde ses montants, même si le profil (assujettissement, retenue) a changé depuis.
  const totals = locked
    ? { totalHT: doc.totalHT, totalTVA: doc.totalTVA, totalTTC: doc.totalTTC, montantRetenue: doc.montantRetenue, netAPayer: doc.netAPayer }
    : computeTotals(doc, profile.assujettiTVA, !!clientPro);
  const assujetti = locked && doc.emetteur ? doc.emetteur.assujettiTVA : profile.assujettiTVA;
  const brut = sousTotal(doc);
  const remiseAppliquee = montantRemise(doc, brut);
  const paye = montantPaye(doc, paiements);
  const reste = round2(montantDu({ ...doc, ...totals }) - paye);
  const st = statutInfo(doc, paye);
  const mesPaiements = paiements.filter((p) => p.factureId === doc.id).sort((a, b) => a.date.localeCompare(b.date));
  const mesRelances = relances.filter((r) => r.factureId === doc.id).sort((a, b) => a.date.localeCompare(b.date));
  const today = todayISO();
  const origineEncaisse = isAvoir && doc.avoirDe ? paiements.filter((p) => p.factureId === doc.avoirDe && p.montant > 0).reduce((s, p) => s + p.montant, 0) : 0;
  const rembourse = isAvoir ? montantRembourse(doc, paiements) : 0;
  const remboursable = isAvoir ? Math.max(0, round2(Math.min(doc.totalTTC, origineEncaisse) - rembourse)) : 0;
  const bloque = licence.status !== 'loading' && !canFinalize(licence);
  const retenueOption = regime.options.retenue;
  const mentionFranchise = L(regime.tva.mentionFranchise, lang);

  const update = (patch: Partial<Doc>) => {
    setDoc((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
    setError(null);
  };
  const updateLigne = (lid: string, patch: Partial<Ligne>) => update({ lignes: doc.lignes.map((l) => (l.id === lid ? { ...l, ...patch } : l)) });
  const removeLigne = (lid: string) => update({ lignes: doc.lignes.filter((l) => l.id !== lid) });
  const addLigne = () => update({ lignes: [...doc.lignes, newLigne(profile.tauxTVA)] });
  const addFromCatalogue = (p: Prestation) => {
    const ligne: Ligne = { ...newLigne(profile.tauxTVA), description: p.description || p.libelle, unite: p.unite, prixUnitaire: p.prixUnitaire, tauxTVA: p.tauxTVA };
    const seuleLigneVide = doc.lignes.length === 1 && !doc.lignes[0].description.trim() && !doc.lignes[0].prixUnitaire;
    update({ lignes: seuleLigneVide ? [ligne] : [...doc.lignes, ligne] });
  };
  const addToCatalogue = async (l: Ligne) => {
    await db.catalogue.add({ libelle: l.description.split('\n')[0].slice(0, 80), description: l.description, unite: l.unite, prixUnitaire: l.prixUnitaire, tauxTVA: l.tauxTVA });
  };

  function validate(): string {
    if (!doc!.clientId) return t('editor.err.client');
    if (!isValidISO(doc!.dateEmission)) return t('editor.err.date');
    const lignes = doc!.lignes.filter((l) => l.description.trim() || l.prixUnitaire);
    if (!lignes.length) return t('editor.err.lines');
    if (lignes.some((l) => !l.description.trim())) return t('editor.err.description');
    if (totals.totalTTC <= 0) return t('editor.err.amount');
    return '';
  }

  async function onFinaliser() {
    if (!canFinalize(licence)) {
      setError(
        licence.status === 'unverified' ? (
          <span>
            {t('licence.unverifiedFinalize')} <Link to="/parametres?tab=licence">{t('licence.checkLink')}</Link>
          </span>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>
              {licence.status === 'trial_over' ? t('licence.trialOverFinalize') : t('licence.invalidFinalize')} <Link to="/parametres?tab=licence">{t('licence.activateLink')}</Link>
            </span>
            <BuyLicenceButton small />
          </div>
        ),
      );
      return;
    }
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    let d: Doc = { ...doc!, lignes: doc!.lignes.filter((l) => l.description.trim() || l.prixUnitaire) };
    const nid = await persist(d);
    d = { ...d, id: nid };
    setDirty(false);
    const annee = yearOf(d.dateEmission);
    const numero = d.numero || formatNumero(prefixeFor(d.type, profile), annee, await nextSeq(d.type, annee, profile), profile);
    // Mentions obligatoires de l'émetteur : on prévient plutôt que d'émettre un document incomplet sans le dire.
    const principal = identifiantPrincipal(regime);
    const manques = [
      profile.denomination.trim() || profile.nom.trim() || profile.prenom.trim() ? '' : t('editor.missing.identity'),
      profile.adresse.trim() && (profile.codePostal.trim() || profile.ville.trim()) ? '' : t('editor.missing.address'),
      principal && !profile.identifiants[principal.id]?.trim() ? L(principal.label, lang) : '',
    ].filter(Boolean);
    const question = isFacture ? t('editor.confirmFinalizeInvoice', { numero }) : isAvoir ? t('editor.confirmFinalizeCredit', { numero }) : t('editor.confirmFinalizeQuote', { numero });
    const msg = manques.length ? `${t('editor.profileIncomplete', { champs: manques.join(', ') })}\n\n${question}` : question;
    if (!confirm(msg)) {
      setDoc(d);
      return;
    }
    try {
      const updated = await finaliser(d, profile);
      setDoc(normalizeDoc(updated));
    } catch (e) {
      setDoc(d);
      const code = e instanceof Error ? e.message : '';
      setError(code === 'licence.required' ? t('licence.draftOnly') : code === 'doc.noClient' || code === 'doc.clientMissing' ? t('editor.err.client') : t('editor.err.finalize'));
      return;
    }
    if (!doc!.id) navigate(`/documents/${nid}`, { replace: true });
  }

  async function onSupprimer() {
    if (!confirm(t('docs.confirmDeleteDraft'))) return;
    // Plus aucun enregistrement automatique à partir d'ici : il recréerait le brouillon supprimé.
    abandoned.current = true;
    setDirty(false);
    await saveChain.current;
    const cible = doc!.id ?? session.current.id;
    if (cible) await supprimerDoc({ ...doc!, id: cible });
    navigate(`/documents?type=${doc!.type}`);
  }

  async function onDupliquer() {
    // La copie part du document tel qu'il est à l'écran ; l'original garde aussi ses dernières modifications.
    if (dirty && !locked) await persist(doc!);
    const nid = await dupliquer(doc!, profile);
    navigate(`/documents/${nid}`);
  }

  async function onConvertir() {
    const nid = await factureDepuisDevis(doc!, profile);
    navigate(`/documents/${nid}`);
  }

  async function onAnnuler() {
    if (!confirm(t('editor.confirmCancelInvoice'))) return;
    await setStatut(doc!.id!, 'annulee');
    await reload();
  }

  async function onAvoir() {
    if (!confirm(t('editor.confirmCredit', { doc: docLabel(doc!, t) }))) return;
    const nid = await avoirDepuisFacture(doc!, profile);
    navigate(`/documents/${nid}`);
  }

  async function onStatut(s: Doc['statut']) {
    await setStatut(doc!.id!, s);
    await reload();
  }

  const title = isNew && !doc.id ? (isFacture ? t('editor.newInvoice') : isAvoir ? t('editor.newCredit') : t('editor.newQuote')) : docLabel(doc, t);
  const lienLabel = isAvoir ? t('editor.creditOf') : isFacture && doc.avoirId ? t('editor.correctedBy') : isFacture ? t('editor.fromQuote') : t('editor.convertedTo');

  return (
    <>
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {title} <Badge tone={st.tone}>{t(st.key)}</Badge>
            {saving && <span className="small muted">{t('common.saving')}</span>}
          </span>
        }
        subtitle={
          linked && (
            <>
              {lienLabel} <Link to={`/documents/${linked.id}`}>{docLabel(linked, t)}</Link>
              {isAvoir && linked.dateEmission && <> ({fmtDate(linked.dateEmission)})</>}
            </>
          )
        }
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => navigate(`/documents?type=${doc.type}`)}>
              <Icon name="back" /> {t('common.back')}
            </button>
            {doc.id && (
              <button type="button" className="btn" onClick={() => navigate(`/documents/${doc.id}/imprimer`)}>
                <Icon name="print" /> {t('editor.previewPdf')}
              </button>
            )}
            {!locked && (
              <button type="button" className="btn primary" onClick={() => void guard(onFinaliser)} disabled={busy}>
                <Icon name="check" /> {t('editor.finalize')}
              </button>
            )}
            {locked && isFacture && doc.statut === 'envoyee' && (
              <>
                <button type="button" className="btn primary" onClick={() => setPayModal(true)}>
                  <Icon name="wallet" /> {t('editor.receivePayment')}
                </button>
                <button type="button" className="btn" onClick={() => setRelanceModal(true)} title={t('relance.buttonTitle')}>
                  <Icon name="alert" /> {t('relance.button')}
                </button>
              </>
            )}
            {locked && isAvoir && remboursable > 0 && (
              <button type="button" className="btn primary" onClick={() => setRefundModal(true)}>
                <Icon name="wallet" /> {t('editor.recordRefund')}
              </button>
            )}
            {locked && doc.type === 'devis' && doc.statut === 'envoye' && (
              <>
                <button type="button" className="btn" onClick={() => void guard(() => onStatut('refuse'))} disabled={busy}>{t('status.refused')}</button>
                <button type="button" className="btn primary" onClick={() => void guard(onConvertir)} disabled={busy}>
                  <Icon name="convert" /> {t('editor.acceptedToInvoice')}
                </button>
              </>
            )}
            {locked && doc.type === 'devis' && doc.statut === 'accepte' && !doc.factureId && (
              <button type="button" className="btn primary" onClick={() => void guard(onConvertir)} disabled={busy}>
                <Icon name="convert" /> {t('editor.convertToInvoice')}
              </button>
            )}
          </>
        }
      />

      {error && <div style={{ marginBottom: 14 }}><Notice tone="critical">{error}</Notice></div>}
      {bloque && !locked && !error && (
        <div style={{ marginBottom: 14 }}>
          <Notice tone="warning">
            {licence.status === 'unverified' ? (
              <span>
                {t('licence.unverifiedFinalize')} <Link to="/parametres?tab=licence">{t('licence.checkLink')}</Link>
              </span>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>
                  {t('licence.draftOnly')} <Link to="/parametres?tab=licence">{t('licence.activateLink')}</Link>
                </span>
                <BuyLicenceButton small primary={false} />
              </div>
            )}
          </Notice>
        </div>
      )}
      {locked && (
        <div style={{ marginBottom: 14 }}>
          <Notice>{isFacture ? t('editor.lockedInvoice') : isAvoir ? t('editor.lockedCredit') : t('editor.lockedQuote')}</Notice>
        </div>
      )}

      <div className="editor">
        <div className="stack">
          <div className="card">
            <div className="form-row">
              <div className="field">
                <span className="label">{t('common.client')}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={doc.clientId ?? ''} disabled={locked} onChange={(e) => update({ clientId: e.target.value ? Number(e.target.value) : null })} aria-label={t('common.client')}>
                    <option value="">{t('editor.chooseClient')}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                  {!locked && (
                    <button type="button" className="btn icon" onClick={() => setClientModal(true)} aria-label={t('clients.new')} title={t('clients.new')}>
                      <Icon name="plus" />
                    </button>
                  )}
                </div>
              </div>
              <Field label={t('editor.subject')}>
                <input type="text" value={doc.objet} disabled={locked} placeholder={t('editor.subjectPlaceholder')} onChange={(e) => update({ objet: e.target.value })} />
              </Field>
            </div>
            <div className="form-row" style={{ marginTop: 14 }}>
              <Field label={t('editor.issueDate')}>
                <input type="date" value={doc.dateEmission} disabled={locked} onChange={(e) => update({ dateEmission: e.target.value })} />
              </Field>
              <Field label={isFacture ? t('editor.dueDate') : isAvoir ? t('common.date') : t('editor.validUntil')}>
                <input type="date" value={doc.dateEcheance} disabled={locked} onChange={(e) => update({ dateEcheance: e.target.value })} />
              </Field>
              <Field label={t('editor.activity')} help={t('editor.activityHelp')}>
                <select value={doc.activite} disabled={locked} onChange={(e) => update({ activite: e.target.value })}>
                  {regime.activites.map((a) => (
                    <option key={a.id} value={a.id}>{L(a.court, lang)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('editor.docLanguage')}>
                <select value={doc.langue || profile.langueDocuments} disabled={locked} onChange={(e) => update({ langue: e.target.value as Lang })}>
                  {LANGS.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-row" style={{ marginTop: 14 }}>
              <Field label={t('editor.serviceDate')} help={t('editor.serviceDateHelp')}>
                <input type="date" value={doc.prestationDebut} disabled={locked} onChange={(e) => update({ prestationDebut: e.target.value })} />
              </Field>
              <Field label={t('editor.periodEnd')}>
                <input type="date" value={doc.prestationFin} disabled={locked} onChange={(e) => update({ prestationFin: e.target.value })} />
              </Field>
              <Field label={t('editor.poNumber')}>
                <input type="text" value={doc.bonCommande} disabled={locked} onChange={(e) => update({ bonCommande: e.target.value })} />
              </Field>
              {regime.activites.find((a) => a.id === doc.activite)?.groupe === 'vente' && (
                <Field label={t('editor.deliveryAddress')}>
                  <input type="text" value={doc.adresseLivraison} disabled={locked} onChange={(e) => update({ adresseLivraison: e.target.value })} />
                </Field>
              )}
              {retenueOption && (
                <Field label={L(retenueOption.label, lang)} help={retenueOption.proSeulement ? t('editor.withholdingProOnly') : undefined}>
                  <NumInput value={doc.retenue} disabled={locked} onChange={(retenue) => update({ retenue })} min={0} className="inline-num" />
                </Field>
              )}
            </div>
          </div>

          <div className="card lines">
            <div className="card-head">
              <h2>{t('editor.lines')}</h2>
              {!locked && (
                <div className="actions">
                  <button type="button" className="btn sm" onClick={() => setCatalogueModal(true)}>
                    <Icon name="table" size={15} /> {t('editor.fromCatalogue')}
                  </button>
                  <button type="button" className="btn sm" onClick={addLigne}>
                    <Icon name="plus" size={15} /> {t('editor.addLine')}
                  </button>
                </div>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '46%' }}>{t('editor.description')}</th>
                    <th style={{ width: 70 }}>{t('editor.qty')}</th>
                    <th style={{ width: 90 }}>{t('editor.unit')}</th>
                    <th style={{ width: 110 }}>{t('editor.unitPrice')}</th>
                    {assujetti && <th style={{ width: 70 }}>{regime.tva.nom} %</th>}
                    <th className="right">{t('editor.lineTotal')}</th>
                    {!locked && <th style={{ width: 70 }} />}
                  </tr>
                </thead>
                <tbody>
                  {doc.lignes.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <input type="text" value={l.description} disabled={locked} placeholder={t('editor.descriptionPlaceholder')} onChange={(e) => updateLigne(l.id, { description: e.target.value })} aria-label={t('editor.description')} />
                      </td>
                      <td className="num"><NumInput value={l.quantite} disabled={locked} onChange={(quantite) => updateLigne(l.id, { quantite })} ariaLabel={t('editor.qty')} min={0} /></td>
                      <td><input type="text" value={l.unite} disabled={locked} placeholder={t('editor.unitPlaceholder')} onChange={(e) => updateLigne(l.id, { unite: e.target.value })} aria-label={t('editor.unit')} /></td>
                      <td className="num"><NumInput value={l.prixUnitaire} disabled={locked} onChange={(prixUnitaire) => updateLigne(l.id, { prixUnitaire })} ariaLabel={t('editor.unitPrice')} /></td>
                      {assujetti && <td className="num"><NumInput value={l.tauxTVA} disabled={locked} onChange={(tauxTVA) => updateLigne(l.id, { tauxTVA })} ariaLabel={t('editor.vatRate')} min={0} /></td>}
                      <td className="total">{fmtMoney(ligneTotalHT(l))}</td>
                      {!locked && (
                        <td className="nowrap">
                          <button type="button" className="btn ghost sm icon" onClick={() => addToCatalogue(l)} aria-label={t('editor.addToCatalogue')} title={t('editor.addToCatalogue')} disabled={!l.description.trim()}>
                            <Icon name="table" size={15} />
                          </button>
                          <button type="button" className="btn danger sm icon" onClick={() => removeLigne(l.id)} aria-label={t('editor.removeLine')} disabled={doc.lignes.length === 1}>
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
              <div className="field">
                <span className="label">{t('editor.discount')}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <NumInput value={doc.remise} disabled={locked} onChange={(remise) => update({ remise })} min={0} className="inline-num" ariaLabel={t('editor.discount')} />
                  <select value={doc.remiseType === 'pourcent' ? 'pourcent' : 'montant'} disabled={locked} onChange={(e) => update({ remiseType: e.target.value as 'montant' | 'pourcent' })} aria-label={t('editor.discountType')} style={{ width: 'auto' }}>
                    <option value="montant">{t('editor.discountAmount', { devise: doc.devise || profile.devise })}</option>
                    <option value="pourcent">%</option>
                  </select>
                </div>
              </div>
              <Field label={t('editor.notes')} className="span-2">
                <textarea value={doc.notes} disabled={locked} rows={2} onChange={(e) => update({ notes: e.target.value })} placeholder={t('editor.notesPlaceholder')} />
              </Field>
            </div>
          </div>
        </div>

        <div className="stack sticky">
          <div className="card">
            <h2 style={{ marginBottom: 10 }}>{t('common.total')}</h2>
            <div className="totals">
              <div className="row"><span className="text-2">{t('editor.subtotal')}</span><span className="tnum">{fmtMoney(brut)}</span></div>
              {doc.remise > 0 && <div className="row"><span className="text-2">{t('editor.discountShort')}{doc.remiseType === 'pourcent' ? ` (${fmtNum(doc.remise)} %)` : ''}</span><span className="tnum">− {fmtMoney(remiseAppliquee)}</span></div>}
              <div className="row"><span className="text-2">{t('editor.totalExcl')}</span><span className="tnum">{fmtMoney(totals.totalHT)}</span></div>
              {assujetti ? (
                <div className="row"><span className="text-2">{regime.tva.nom}</span><span className="tnum">{fmtMoney(totals.totalTVA)}</span></div>
              ) : (
                mentionFranchise && <div className="row"><span className="muted small">{mentionFranchise}</span></div>
              )}
              <div className="row big"><span>{assujetti ? t('editor.totalIncl') : t('common.total')}</span><span className="tnum">{fmtMoney(totals.totalTTC)}</span></div>
              {totals.montantRetenue > 0 && (
                <>
                  <div className="row"><span className="text-2">{t('editor.withholding', { pct: doc.retenue })}</span><span className="tnum">− {fmtMoney(totals.montantRetenue)}</span></div>
                  <div className="row big" style={{ fontSize: 15 }}><span>{t('editor.netDue')}</span><span className="tnum">{fmtMoney(totals.netAPayer)}</span></div>
                </>
              )}
            </div>
          </div>

          {isAvoir && locked && linked && (
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>{t('editor.originalInvoice')}</h2>
              <dl className="kv">
                <dt>{t('doc.invoice')}</dt><dd><Link to={`/documents/${linked.id}`}>{linked.numero}</Link> ({fmtDate(linked.dateEmission)})</dd>
                <dt>{t('common.amount')}</dt><dd className="tnum">{fmtMoney(linked.totalTTC)}</dd>
                <dt>{t('editor.received')}</dt><dd className="tnum">{fmtMoney(origineEncaisse)}</dd>
                <dt>{t('editor.refunded')}</dt><dd className="tnum">{fmtMoney(rembourse)}</dd>
              </dl>
              <p className="small text-2" style={{ marginTop: 10 }}>
                {origineEncaisse <= 0 ? t('editor.creditNoMoney') : remboursable > 0 ? t('editor.creditRemaining', { montant: fmtMoney(remboursable) }) : t('editor.creditRefunded')}
              </p>
            </div>
          )}

          {isFacture && locked && doc.statut !== 'annulee' && (
            <div className="card">
              <div className="card-head">
                <h2>{t('editor.payments')}</h2>
                {doc.statut === 'envoyee' && (
                  <button type="button" className="btn sm primary" onClick={() => setPayModal(true)}>
                    <Icon name="plus" size={15} /> {t('editor.receivePayment')}
                  </button>
                )}
              </div>
              {mesPaiements.length === 0 ? (
                <p className="small text-2">{t('editor.noPayment')}{doc.dateEcheance < today && <> <b className="critical">{t('editor.overdueSince', { date: fmtDate(doc.dateEcheance) })}</b></>}</p>
              ) : (
                <table className="table">
                  <tbody>
                    {mesPaiements.map((p) => (
                      <tr key={p.id}>
                        <td className="tnum">{fmtDate(p.date)}</td>
                        <td className="text-2 small">{t(MOYENS.find((m) => m.value === p.moyen)?.key ?? 'moyen.autre')}</td>
                        <td className="num">{fmtMoney(p.montant)}</td>
                        <td style={{ width: 32 }}>
                          <button type="button" className="btn danger sm icon" aria-label={t('editor.deletePayment')} onClick={async () => { if (confirm(t('editor.confirmDeletePayment'))) { await supprimerPaiement(p); await reload(); } }}>
                            <Icon name="x" size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {mesRelances.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="label" style={{ marginBottom: 4 }}>{t('relance.plural')}</div>
                  <table className="table">
                    <tbody>
                      {mesRelances.map((r) => (
                        <tr key={r.id}>
                          <td className="tnum small">{fmtDate(r.date)}</td>
                          <td className="small text-2">{t(CANAUX.find((c) => c.value === r.canal)?.key ?? 'relance.canal.other')}{r.note && <> · {r.note}</>}</td>
                          <td style={{ width: 32 }}>
                            <button type="button" className="btn danger sm icon" aria-label={t('common.delete')} onClick={async () => { if (confirm(t('relance.confirmDelete'))) await supprimerRelance(r.id!); }}>
                              <Icon name="x" size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="totals" style={{ marginTop: 10 }}>
                <div className="row"><span className="text-2">{t('editor.received')}</span><span className="tnum">{fmtMoney(paye)}</span></div>
                <div className="row big" style={{ fontSize: 15 }}><span>{t('editor.remaining')}</span><span className={`tnum${reste > 0 ? '' : ' good'}`}>{fmtMoney(Math.max(0, reste))}</span></div>
              </div>
            </div>
          )}

          <div className="card tight">
            <div className="actions" style={{ justifyContent: 'flex-start' }}>
              {doc.id && !isAvoir && (
                <button type="button" className="btn ghost sm" onClick={() => void guard(onDupliquer)} disabled={busy}>
                  <Icon name="copy" size={15} /> {t('editor.duplicate')}
                </button>
              )}
              {locked && isFacture && (doc.statut === 'envoyee' || doc.statut === 'payee') && !doc.avoirId && (
                <button type="button" className="btn ghost sm" onClick={() => void guard(onAvoir)} disabled={busy} title={t('editor.createCreditTitle')}>
                  <Icon name="convert" size={15} /> {t('editor.createCredit')}
                </button>
              )}
              {isFacture && doc.id && doc.clientId && doc.statut !== 'annulee' && (
                <button type="button" className="btn ghost sm" onClick={() => setRecurrenceModal(true)} title={t('recurrence.buttonTitle')}>
                  <Icon name="convert" size={15} /> {t('recurrence.button')}
                </button>
              )}
              {locked && doc.type === 'devis' && !doc.factureId && doc.statut !== 'brouillon' && (
                <button type="button" className="btn ghost sm" onClick={() => onStatut('brouillon')}>
                  <Icon name="pen" size={15} /> {t('editor.backToDraft')}
                </button>
              )}
              {locked && doc.type === 'devis' && doc.statut === 'refuse' && (
                <button type="button" className="btn ghost sm" onClick={() => onStatut('envoye')}>{t('editor.reopen')}</button>
              )}
              {locked && isFacture && doc.statut === 'envoyee' && mesPaiements.length === 0 && !doc.avoirId && (
                <button type="button" className="btn danger sm" onClick={onAnnuler} title={t('editor.cancelTitle')}>{t('editor.cancelInvoice')}</button>
              )}
              {!locked && (
                <button type="button" className="btn danger sm" onClick={() => void guard(onSupprimer)} disabled={busy}>
                  <Icon name="trash" size={15} /> {t('common.delete')}
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
          max={remboursable}
          title={t('editor.recordRefund')}
          intro={t('editor.refundIntro')}
          montantLabel={t('editor.refundAmount')}
          onSubmit={async (p) => {
            await rembourser(doc, p);
            setRefundModal(false);
            await reload();
          }}
        />
      )}
      <CatalogueModal open={catalogueModal} onClose={() => setCatalogueModal(false)} onPick={addFromCatalogue} />
      {isFacture && doc.id && (
        <>
          <RelanceModal open={relanceModal} onClose={() => setRelanceModal(false)} doc={doc} profile={profile} reste={Math.max(0, reste)} relances={mesRelances} />
          <RecurrenceModal open={recurrenceModal} onClose={() => setRecurrenceModal(false)} doc={doc} onCreated={() => navigate('/documents?type=recurrente')} />
        </>
      )}
    </>
  );
}

function PaiementModal({ open, onClose, reste, max, onSubmit, title, intro, montantLabel }: {
  open: boolean;
  onClose: () => void;
  reste: number;
  /** Montant à ne pas dépasser (remboursement d'un avoir) ; sans limite pour un encaissement. */
  max?: number;
  title?: string;
  intro?: string;
  montantLabel?: string;
  onSubmit: (p: { date: string; montant: number; moyen: MoyenPaiement; libelle: string }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(todayISO());
  const [montant, setMontant] = useState(reste);
  const [moyen, setMoyen] = useState<MoyenPaiement>('virement');
  const [libelle, setLibelle] = useState('');
  const [busy, guard] = useGuard();
  // Les champs sont remis à zéro à l'ouverture seulement : un encaissement enregistré pendant la saisie
  // (qui change le reste dû) ne doit pas effacer ce que l'utilisateur est en train de taper.
  const resteRef = useRef(reste);
  resteRef.current = reste;
  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setMontant(resteRef.current);
      setMoyen('virement');
      setLibelle('');
    }
  }, [open]);
  const depasse = max !== undefined && montant > max + 0.005;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? t('editor.recordPayment')}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn primary" disabled={busy || montant <= 0 || depasse || !isValidISO(date)} onClick={() => void guard(() => onSubmit({ date, montant, moyen, libelle }))}>
            <Icon name="check" /> {t('common.save')}
          </button>
        </>
      }
    >
      <p className="small text-2">{intro ?? t('editor.paymentIntro')}</p>
      {depasse && <div style={{ marginBottom: 10 }}><Notice tone="warning">{t('editor.refundTooHigh', { montant: fmtMoney(max ?? 0) })}</Notice></div>}
      <div className="form-row">
        <Field label={t('editor.paymentDate')}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={montantLabel ?? t('editor.paymentAmount')}>
          <NumInput value={montant} onChange={setMontant} min={0} />
        </Field>
      </div>
      <div className="form-row">
        <Field label={t('editor.paymentMethod')}>
          <select value={moyen} onChange={(e) => setMoyen(e.target.value as MoyenPaiement)}>
            {MOYENS.map((m) => (
              <option key={m.value} value={m.value}>{t(m.key)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('editor.paymentRef')}>
          <input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder={t('editor.paymentRefPlaceholder')} />
        </Field>
      </div>
    </Modal>
  );
}
