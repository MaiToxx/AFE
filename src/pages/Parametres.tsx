import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BuyLicenceButton from '../components/BuyLicenceButton';
import { useTheme, type Theme } from '../components/Layout';
import PrestationForm from '../components/PrestationForm';
import { Badge, Check, Field, Icon, Notice, NumInput, PageHeader, Seg } from '../components/ui';
import { clearAll, db, deleteSetting, exportBackup, importBackup, saveProfile, setSetting } from '../db/db';
import { useBaremes, useCatalogue, useDocuments, useLicense, useProfile } from '../db/hooks';
import { evaluate, PURCHASE_URL, SUPPORT_EMAIL, TRIAL_DAYS, verifyKey, type LicenseStatus } from '../lib/license';
import { ACTIVITES, NATURES, type ActivityKind, type Bareme, type Nature, type Prestation, type Profile } from '../db/types';
import { defaultBaremeFor, pickBareme } from '../lib/bareme';
import { acreEnd } from '../lib/cotisations';
import { todayISO, yearOf } from '../lib/dates';
import { loadDemo } from '../lib/demo';
import { isTauri, openExternal, saveTextFile } from '../lib/desktop';
import { fmtDate, fmtEUR } from '../lib/format';

type Tab = 'profil' | 'facturation' | 'catalogue' | 'bareme' | 'donnees' | 'licence' | 'apparence';
const TAB_VALUES: Tab[] = ['profil', 'facturation', 'catalogue', 'bareme', 'donnees', 'licence', 'apparence'];
const isTab = (t: string | null): t is Tab => !!t && (TAB_VALUES as string[]).includes(t);

export default function Parametres() {
  const { profile, loaded, exists } = useProfile();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (isTab(params.get('tab')) ? (params.get('tab') as Tab) : 'profil'));
  useEffect(() => {
    const t = params.get('tab');
    if (isTab(t)) setTab(t);
  }, [params]);
  const [form, setForm] = useState<Profile>(profile);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loaded && !dirty) setForm(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, profile]);

  const set = (patch: Partial<Profile>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    setSaved(false);
  };

  async function save() {
    await saveProfile(form);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const TABS: { value: Tab; label: string }[] = [
    { value: 'profil', label: 'Profil & activité' },
    { value: 'facturation', label: 'Documents' },
    { value: 'bareme', label: 'Barème URSSAF' },
    { value: 'donnees', label: 'Données' },
    { value: 'catalogue', label: 'Catalogue' },
    { value: 'licence', label: 'Licence' },
    { value: 'apparence', label: 'Apparence' },
  ];

  const showSave = tab === 'profil' || tab === 'facturation';

  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle={!exists && loaded ? 'Commencez par renseigner votre profil : il alimente vos documents et le calcul des cotisations.' : undefined}
        actions={
          showSave && (
            <>
              {saved && <span className="small good"><Icon name="check" size={14} /> Enregistré</span>}
              <button type="button" className="btn primary" onClick={save} disabled={!dirty}>
                <Icon name="check" /> Enregistrer
              </button>
            </>
          )
        }
      />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className={tab === t.value ? 'active' : ''} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profil' && <ProfilTab form={form} set={set} />}
      {tab === 'facturation' && <FacturationTab form={form} set={set} />}
      {tab === 'bareme' && <BaremeTab />}
      {tab === 'donnees' && <DonneesTab />}
      {tab === 'catalogue' && <CatalogueTab tauxTVA={form.tauxTVA} />}
      {tab === 'licence' && <LicenceTab />}
      {tab === 'apparence' && <ApparenceTab />}
    </>
  );
}

function LicenceEtat({ lic }: { lic: LicenseStatus }) {
  switch (lic.status) {
    case 'loading':
      return <p className="muted">Vérification…</p>;
    case 'trial':
      return (
        <>
          <p><Badge tone="info">Période d'essai</Badge></p>
          <p className="text-2" style={{ marginTop: 8 }}>
            Toutes les fonctions sont disponibles encore {lic.daysLeft} jour{lic.daysLeft > 1 ? 's' : ''} (jusqu'au {fmtDate(lic.endsOn)}).
            Ensuite, vos données resteront consultables et exportables, mais la finalisation de nouveaux devis et factures nécessitera une licence.
          </p>
        </>
      );
    case 'trial_over':
      return (
        <>
          <p><Badge tone="critical">Essai terminé</Badge></p>
          <p className="text-2" style={{ marginTop: 8 }}>
            Les {TRIAL_DAYS} jours d'essai sont écoulés. Vos données restent accessibles (consultation, PDF des documents existants, export),
            mais la finalisation de nouveaux documents est désactivée jusqu'à l'activation d'une licence.
          </p>
        </>
      );
    case 'invalid':
      return (
        <>
          <p><Badge tone="critical">Clé invalide</Badge></p>
          <p className="text-2" style={{ marginTop: 8 }}>{lic.reason}</p>
        </>
      );
    case 'licensed':
    case 'expired':
    case 'unsupported': {
      const l = lic.license;
      return (
        <>
          <p>
            {lic.status === 'licensed' && <Badge tone="good">Licence active</Badge>}
            {lic.status === 'expired' && <Badge tone="critical">Abonnement expiré le {fmtDate(l.expires ?? '')}</Badge>}
            {lic.status === 'unsupported' && <Badge tone="critical">Version {__APP_VERSION__} non couverte</Badge>}
          </p>
          <dl className="kv" style={{ marginTop: 10 }}>
            <dt>Titulaire</dt><dd>{l.name}</dd>
            <dt>E-mail</dt><dd>{l.email}</dd>
            <dt>Type</dt><dd>{l.plan === 'abonnement' ? `Abonnement jusqu'au ${fmtDate(l.expires ?? '')}` : 'Licence perpétuelle'}{l.maxMajor !== undefined ? ` · mises à jour incluses jusqu'à la version ${l.maxMajor}.x` : ''}</dd>
            <dt>N° de licence</dt><dd className="tnum">{l.id}</dd>
            <dt>Émise le</dt><dd>{fmtDate(l.issued)}</dd>
          </dl>
          {lic.status === 'unsupported' && (
            <p className="text-2 small" style={{ marginTop: 8 }}>Cette licence couvre les versions jusqu'à {l.maxMajor}.x. Contactez {SUPPORT_EMAIL} pour une mise à niveau.</p>
          )}
        </>
      );
    }
  }
}

function CatalogueTab({ tauxTVA }: { tauxTVA: number }) {
  const catalogue = useCatalogue();
  const [editing, setEditing] = useState<Prestation | null | undefined>(undefined);
  async function remove(p: Prestation) {
    if (confirm(`Supprimer « ${p.libelle} » du catalogue ?`)) await db.catalogue.delete(p.id!);
  }
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>Catalogue de prestations</h3>
          <p className="small text-2">Vos prestations habituelles, insérables en un clic dans un devis ou une facture (bouton « Depuis le catalogue »).</p>
        </div>
        <button type="button" className="btn primary sm" onClick={() => setEditing(null)}><Icon name="plus" size={15} /> Ajouter</button>
      </div>
      {catalogue.length === 0 ? (
        <p className="text-2">Aucune prestation pour l'instant. Vous pouvez aussi enregistrer une ligne existante depuis l'éditeur de document (icône « + catalogue »).</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Libellé</th><th>Description</th><th>Unité</th><th className="num">Prix unitaire HT</th><th className="num">TVA</th><th /></tr>
            </thead>
            <tbody>
              {catalogue.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setEditing(p)}>
                  <td><b>{p.libelle}</b></td>
                  <td className="text-2 ellipsis" title={p.description}>{p.description || <span className="muted">—</span>}</td>
                  <td className="text-2">{p.unite}</td>
                  <td className="num">{fmtEUR(p.prixUnitaire)}</td>
                  <td className="num">{p.tauxTVA} %</td>
                  <td>
                    <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn ghost sm icon" onClick={() => setEditing(p)} aria-label="Modifier"><Icon name="pen" size={15} /></button>
                      <button type="button" className="btn danger sm icon" onClick={() => remove(p)} aria-label="Supprimer"><Icon name="trash" size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PrestationForm open={editing !== undefined} prestation={editing ?? null} tauxTVA={tauxTVA} onClose={() => setEditing(undefined)} />
    </div>
  );
}

function LicenceTab() {
  const lic = useLicense();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone?: 'warning' | 'critical'; text: string } | null>(null);
  const hasKey = 'license' in lic || lic.status === 'invalid';

  async function activer() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await verifyKey(key);
      if (!r.ok) {
        setMsg({ tone: 'critical', text: r.reason });
        return;
      }
      const ev = evaluate(r.payload);
      if (ev.status === 'expired') {
        setMsg({ tone: 'critical', text: `Cette licence a expiré le ${fmtDate(r.payload.expires ?? '')}.` });
        return;
      }
      if (ev.status === 'unsupported') {
        setMsg({ tone: 'critical', text: `Cette licence couvre les versions jusqu'à ${r.payload.maxMajor}.x ; vous utilisez la version ${__APP_VERSION__}.` });
        return;
      }
      await setSetting('licenseKey', key.replace(/\s+/g, ''));
      setKey('');
      setMsg({ text: `Licence activée pour ${r.payload.name}. Merci pour votre confiance !` });
    } finally {
      setBusy(false);
    }
  }

  async function retirer() {
    if (!confirm('Retirer la licence de cet appareil ? Vous pourrez la réactiver avec la même clé.')) return;
    await deleteSetting('licenseKey');
    setMsg({ text: 'Licence retirée.' });
  }

  return (
    <div className="stack">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="card">
        <div className="card-head">
          <h3>État de la licence</h3>
          {hasKey && <button type="button" className="btn ghost sm" onClick={retirer}>Retirer la licence</button>}
        </div>
        <LicenceEtat lic={lic} />
      </div>
      <div className="card">
        <h3>Activer une licence</h3>
        <p className="small text-2" style={{ margin: '4px 0 12px' }}>Collez la clé reçue après votre achat (elle commence par « AFE1- »). L'activation se fait hors ligne, aucune donnée n'est envoyée.</p>
        <textarea
          value={key}
          onChange={(e) => setKey(e.target.value)}
          rows={4}
          placeholder="AFE1-…"
          spellCheck={false}
          style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5 }}
          aria-label="Clé de licence"
        />
        <div className="actions" style={{ marginTop: 10 }}>
          <button type="button" className="btn primary" onClick={activer} disabled={busy || !key.trim()}>
            <Icon name="check" /> Activer
          </button>
        </div>
      </div>
      {lic.status !== 'licensed' && (
        <div className="card">
          <h3>Obtenir une licence</h3>
          <p className="small text-2" style={{ margin: '4px 0 12px' }}>
            Licence personnelle, sans abonnement obligatoire, valable sur tous vos appareils et incluse dans vos sauvegardes.
            Vous recevez votre clé par e-mail après l'achat.{PURCHASE_URL ? '' : ' Tant que la boutique en ligne n’est pas ouverte, la demande se fait par e-mail.'}
          </p>
          <div className="actions">
            <BuyLicenceButton />
            <span className="small muted">Assistance : <a href={`mailto:${SUPPORT_EMAIL}`} onClick={(e) => { e.preventDefault(); void openExternal(`mailto:${SUPPORT_EMAIL}`); }}>{SUPPORT_EMAIL}</a></span>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfilTab({ form, set }: { form: Profile; set: (p: Partial<Profile>) => void }) {
  return (
    <div className="card">
      <div className="form-section">
        <h3>Identité</h3>
        <div className="form-row">
          <Field label="Prénom"><input type="text" value={form.prenom} onChange={(e) => set({ prenom: e.target.value })} /></Field>
          <Field label="Nom"><input type="text" value={form.nom} onChange={(e) => set({ nom: e.target.value })} /></Field>
          <Field label="Nom commercial (optionnel)"><input type="text" value={form.denomination} onChange={(e) => set({ denomination: e.target.value })} /></Field>
        </div>
        <Field label="Adresse"><input type="text" value={form.adresse} onChange={(e) => set({ adresse: e.target.value })} /></Field>
        <div className="form-row">
          <Field label="Code postal"><input type="text" value={form.codePostal} onChange={(e) => set({ codePostal: e.target.value })} /></Field>
          <Field label="Ville"><input type="text" value={form.ville} onChange={(e) => set({ ville: e.target.value })} /></Field>
          <Field label="SIRET"><input type="text" value={form.siret} onChange={(e) => set({ siret: e.target.value })} placeholder="123 456 789 00012" /></Field>
        </div>
        <div className="form-row">
          <Field label="E-mail"><input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" value={form.telephone} onChange={(e) => set({ telephone: e.target.value })} /></Field>
          <Field label="Site web"><input type="text" value={form.siteWeb} onChange={(e) => set({ siteWeb: e.target.value })} /></Field>
        </div>
      </div>

      <div className="form-section">
        <h3>Activité</h3>
        <div className="form-row">
          <Field label="Intitulé de l'activité" help="Affiché sur vos documents."><input type="text" value={form.activiteLibelle} onChange={(e) => set({ activiteLibelle: e.target.value })} placeholder="Ex. Graphiste freelance" /></Field>
          <Field label="Catégorie URSSAF par défaut" help="Détermine le taux de cotisations. Modifiable document par document.">
            <select value={form.activite} onChange={(e) => set({ activite: e.target.value as ActivityKind })}>
              {ACTIVITES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Nature" help="Détermine la contribution à la formation professionnelle et la taxe pour frais de chambre.">
            <select value={form.nature} onChange={(e) => set({ nature: e.target.value as Nature })}>
              {NATURES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </Field>
          <Field label="Date de début d'activité">
            <input type="date" value={form.dateDebutActivite} onChange={(e) => set({ dateDebutActivite: e.target.value })} />
          </Field>
          <Field label="Périodicité de déclaration URSSAF">
            <select value={form.frequence} onChange={(e) => set({ frequence: e.target.value as Profile['frequence'] })}>
              <option value="mensuelle">Mensuelle</option>
              <option value="trimestrielle">Trimestrielle</option>
            </select>
          </Field>
        </div>
        {form.nature === 'artisan' && (
          <Check label="Double immatriculation (RM + RCS)" help="Ajoute la part CCI (0,007 %) à la taxe pour frais de chambre." checked={form.doubleImmatriculation} onChange={(v) => set({ doubleImmatriculation: v })} />
        )}
        <Check
          label="Je bénéficie de l'ACRE"
          help={form.dateDebutActivite ? `Cotisations réduites de moitié jusqu'au ${fmtDate(acreEnd(form.dateDebutActivite))} (fin du 3e trimestre civil suivant le début d'activité).` : 'Renseignez la date de début pour calculer la période d\'exonération.'}
          checked={form.acre}
          onChange={(v) => set({ acre: v })}
        />
        <Check label="J'ai opté pour le versement libératoire de l'impôt sur le revenu" help="L'impôt est alors prélevé par l'URSSAF avec les cotisations (1 %, 1,7 % ou 2,2 % du CA)." checked={form.versementLiberatoire} onChange={(v) => set({ versementLiberatoire: v })} />
      </div>

      <div className="form-section">
        <h3>TVA</h3>
        <Check label="Je suis assujetti à la TVA" help="Décoché : vos documents portent la mention « TVA non applicable, art. 293 B du CGI » (franchise en base)." checked={form.assujettiTVA} onChange={(v) => set({ assujettiTVA: v })} />
        {form.assujettiTVA && (
          <div className="form-row">
            <Field label="Taux de TVA par défaut (%)"><NumInput value={form.tauxTVA} onChange={(tauxTVA) => set({ tauxTVA })} min={0} /></Field>
            <Field label="Numéro de TVA intracommunautaire"><input type="text" value={form.numeroTVA} onChange={(e) => set({ numeroTVA: e.target.value })} placeholder="FR12 345678901" /></Field>
          </div>
        )}
      </div>
    </div>
  );
}

function FacturationTab({ form, set }: { form: Profile; set: (p: Partial<Profile>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState('');

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 600_000) {
      setLogoError('Image trop lourde (max. 600 Ko). Réduisez-la avant de l’importer.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set({ logo: String(reader.result) });
      setLogoError('');
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="card">
      <div className="form-section">
        <h3>Apparence des devis et factures</h3>
        <div className="form-row">
          <div className="field">
            <span className="label">Logo</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {form.logo ? <img src={form.logo} alt="Logo" style={{ maxHeight: 56, maxWidth: 160, objectFit: 'contain', background: '#fff', borderRadius: 6, padding: 4 }} /> : <span className="small muted">Aucun logo</span>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
              <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} /> Importer</button>
              {form.logo && <button type="button" className="btn ghost sm" onClick={() => set({ logo: '' })}>Retirer</button>}
            </div>
            {logoError && <span className="help critical">{logoError}</span>}
          </div>
          <Field label="Couleur d'accent">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={form.couleur} onChange={(e) => set({ couleur: e.target.value })} />
              <span className="small tnum text-2">{form.couleur}</span>
            </div>
          </Field>
        </div>
      </div>
      <div className="form-section">
        <h3>Numérotation et délais</h3>
        <div className="form-row">
          <Field label="Préfixe des factures" help={`Ex. ${form.prefixeFacture || 'F'}-${yearOf(todayISO())}-0001`}><input type="text" value={form.prefixeFacture} onChange={(e) => set({ prefixeFacture: e.target.value.trim() })} /></Field>
          <Field label="Préfixe des devis"><input type="text" value={form.prefixeDevis} onChange={(e) => set({ prefixeDevis: e.target.value.trim() })} /></Field>
          <Field label="Préfixe des avoirs"><input type="text" value={form.prefixeAvoir} onChange={(e) => set({ prefixeAvoir: e.target.value.trim() })} /></Field>
          <Field label="Délai de paiement (jours)"><NumInput value={form.delaiPaiementJours} onChange={(n) => set({ delaiPaiementJours: Math.round(n) })} min={0} /></Field>
          <Field label="Validité des devis (jours)"><NumInput value={form.validiteDevisJours} onChange={(n) => set({ validiteDevisJours: Math.round(n) })} min={0} /></Field>
        </div>
      </div>
      <div className="form-section">
        <h3>Mentions</h3>
        <Field label="Conditions de règlement"><input type="text" value={form.conditionsPaiement} onChange={(e) => set({ conditionsPaiement: e.target.value })} /></Field>
        <div className="form-row">
          <Field label="IBAN"><input type="text" value={form.iban} onChange={(e) => set({ iban: e.target.value })} /></Field>
          <Field label="BIC"><input type="text" value={form.bic} onChange={(e) => set({ bic: e.target.value })} /></Field>
        </div>
        <Field label="Mentions complémentaires en pied de page" help="Ex. assurance RC pro, numéro d'agrément, conditions générales…">
          <textarea value={form.mentionsPied} onChange={(e) => set({ mentionsPied: e.target.value })} rows={3} />
        </Field>
        <p className="small muted">Les mentions légales obligatoires (franchise de TVA, pénalités de retard et indemnité de 40 € pour les clients professionnels, SIRET…) sont ajoutées automatiquement.</p>
      </div>
    </div>
  );
}

function BaremeTab() {
  const baremes = useBaremes();
  const curY = yearOf(todayISO());
  const years = [...new Set([...baremes.map((b) => b.annee), curY])].sort((a, b) => b - a);
  const [year, setYear] = useState(curY);
  const bareme = pickBareme(baremes, year);
  const [form, setForm] = useState<Bareme>(bareme);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(pickBareme(baremes, year));
    setDirty(false);
  }, [year, baremes]);

  const upd = (fn: (b: Bareme) => Bareme) => {
    setForm((b) => fn(structuredClone(b)));
    setDirty(true);
  };
  const pct = (value: number, onChange: (n: number) => void) => <NumInput value={value} onChange={onChange} min={0} className="inline-num" />;

  async function save() {
    await db.baremes.put({ ...form, annee: year });
    setDirty(false);
  }
  async function reset() {
    if (!confirm(`Rétablir les valeurs par défaut du barème ${year} ?`)) return;
    await db.baremes.put(defaultBaremeFor(year));
  }
  async function addNext() {
    const latest = Math.max(...years);
    await db.baremes.put({ ...pickBareme(baremes, latest), annee: latest + 1 });
    setYear(latest + 1);
  }

  return (
    <div className="card">
      <div className="toolbar">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Année du barème">
          {years.map((y) => <option key={y} value={y}>Barème {y}</option>)}
        </select>
        <button type="button" className="btn sm" onClick={addNext}><Icon name="plus" size={15} /> Ajouter {Math.max(...years) + 1}</button>
        <span className="spacer" />
        <button type="button" className="btn ghost sm" onClick={reset}>Valeurs par défaut</button>
        <button type="button" className="btn primary sm" onClick={save} disabled={!dirty}><Icon name="check" size={15} /> Enregistrer</button>
      </div>
      <Notice>
        Taux en % du chiffre d'affaires encaissé. Les valeurs par défaut reprennent le barème URSSAF publié ; vérifiez-les chaque début d'année sur urssaf.fr et ajustez-les ici si besoin (Alsace-Moselle, évolutions législatives…).
      </Notice>

      <div className="form-section" style={{ marginTop: 18 }}>
        <h3>Cotisations sociales</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Activité</th><th className="num">Taux normal</th><th className="num">Versement libératoire (impôt)</th><th className="num">Abattement forfaitaire (régime micro)</th></tr></thead>
            <tbody>
              {ACTIVITES.map((a) => (
                <tr key={a.value}>
                  <td>{a.label}</td>
                  <td className="num">{pct(form.cotisations[a.value], (n) => upd((b) => { b.cotisations[a.value] = n; return b; }))}</td>
                  <td className="num">{pct(form.versementLiberatoire[a.value], (n) => upd((b) => { b.versementLiberatoire[a.value] = n; return b; }))}</td>
                  <td className="num">{pct(form.abattement[a.value], (n) => upd((b) => { b.abattement[a.value] = n; return b; }))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Field label="Réduction ACRE (% des cotisations)" className="inline">{pct(form.acreReduction, (n) => upd((b) => { b.acreReduction = n; return b; }))}</Field>
      </div>

      <div className="form-section">
        <h3>Contribution à la formation professionnelle (CFP)</h3>
        <div className="form-row">
          {NATURES.map((n) => (
            <Field key={n.value} label={n.label}>{pct(form.cfp[n.value], (v) => upd((b) => { b.cfp[n.value] = v; return b; }))}</Field>
          ))}
        </div>
      </div>

      <div className="form-section">
        <h3>Taxe pour frais de chambre consulaire</h3>
        <div className="form-row">
          <Field label="CCI — vente">{pct(form.chambre.cciVente, (v) => upd((b) => { b.chambre.cciVente = v; return b; }))}</Field>
          <Field label="CCI — services">{pct(form.chambre.cciServices, (v) => upd((b) => { b.chambre.cciServices = v; return b; }))}</Field>
          <Field label="CMA — vente">{pct(form.chambre.cmaVente, (v) => upd((b) => { b.chambre.cmaVente = v; return b; }))}</Field>
          <Field label="CMA — services">{pct(form.chambre.cmaServices, (v) => upd((b) => { b.chambre.cmaServices = v; return b; }))}</Field>
          <Field label="Double immatriculation">{pct(form.chambre.doubleImmatriculation, (v) => upd((b) => { b.chambre.doubleImmatriculation = v; return b; }))}</Field>
        </div>
      </div>

      <div className="form-section">
        <h3>Plafonds et seuils (€)</h3>
        <div className="form-row">
          <Field label="Plafond CA — vente">{pct(form.plafondCA.vente, (v) => upd((b) => { b.plafondCA.vente = v; return b; }))}</Field>
          <Field label="Plafond CA — services">{pct(form.plafondCA.services, (v) => upd((b) => { b.plafondCA.services = v; return b; }))}</Field>
        </div>
        <div className="form-row">
          <Field label="Franchise TVA vente — seuil">{pct(form.franchiseTVA.venteBase, (v) => upd((b) => { b.franchiseTVA.venteBase = v; return b; }))}</Field>
          <Field label="Franchise TVA vente — majoré">{pct(form.franchiseTVA.venteMajore, (v) => upd((b) => { b.franchiseTVA.venteMajore = v; return b; }))}</Field>
          <Field label="Franchise TVA services — seuil">{pct(form.franchiseTVA.servicesBase, (v) => upd((b) => { b.franchiseTVA.servicesBase = v; return b; }))}</Field>
          <Field label="Franchise TVA services — majoré">{pct(form.franchiseTVA.servicesMajore, (v) => upd((b) => { b.franchiseTVA.servicesMajore = v; return b; }))}</Field>
        </div>
      </div>
    </div>
  );
}

function DonneesTab() {
  const docs = useDocuments();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone?: 'warning' | 'critical'; text: string } | null>(null);

  async function onExport() {
    const data = await exportBackup();
    try {
      const ok = await saveTextFile(`afe-sauvegarde-${todayISO()}.json`, JSON.stringify(data, null, 2));
      if (ok) setMsg({ text: 'Sauvegarde enregistrée. Conservez-la dans un endroit sûr (cloud, clé USB…).' });
    } catch (e) {
      setMsg({ tone: 'critical', text: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    }
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    if (!confirm('Importer cette sauvegarde remplacera toutes les données actuelles. Continuer ?')) return;
    try {
      await importBackup(await file.text());
      setMsg({ text: 'Sauvegarde restaurée.' });
    } catch (e) {
      setMsg({ tone: 'critical', text: e instanceof Error ? e.message : 'Import impossible.' });
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onDemo() {
    if (docs.length && !confirm('Des données existent déjà. Les données de démonstration seront ajoutées par-dessus. Continuer ?')) return;
    await loadDemo();
    setMsg({ text: 'Données de démonstration chargées.' });
  }

  async function onClear() {
    if (!confirm('Supprimer définitivement toutes les données (profil, clients, documents, encaissements) ?')) return;
    if (!confirm('Dernière confirmation : cette action est irréversible. Avez-vous exporté une sauvegarde ?')) return;
    await clearAll();
    setMsg({ tone: 'warning', text: 'Toutes les données ont été effacées.' });
  }

  return (
    <div className="stack">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="card">
        <h3>Sauvegarde</h3>
        <p className="small text-2" style={{ margin: '4px 0 12px' }}>
          Vos données ne quittent jamais cet appareil : elles vivent dans le stockage local du navigateur. Exportez régulièrement une sauvegarde — et avant de vider le cache ou de changer d'ordinateur.
        </p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={onExport}><Icon name="download" /> Exporter une sauvegarde (JSON)</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" /> Restaurer une sauvegarde</button>
        </div>
      </div>
      <div className="card">
        <h3>Démonstration</h3>
        <p className="small text-2" style={{ margin: '4px 0 12px' }}>Charge un profil fictif, des clients et 20 mois de factures pour découvrir le tableau de bord.</p>
        <button type="button" className="btn" onClick={onDemo}><Icon name="eye" /> Charger les données de démonstration</button>
      </div>
      <div className="card">
        <h3>Zone sensible</h3>
        <p className="small text-2" style={{ margin: '4px 0 12px' }}>Efface tout le contenu de l'application sur cet appareil.</p>
        <button type="button" className="btn danger" onClick={onClear}><Icon name="trash" /> Tout effacer</button>
      </div>
    </div>
  );
}

function ApparenceTab() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="card">
      <h3>Thème</h3>
      <p className="small text-2" style={{ margin: '4px 0 12px' }}>« Automatique » suit le réglage de votre système.</p>
      <Seg<Theme>
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'auto', label: 'Automatique' },
          { value: 'light', label: 'Clair' },
          { value: 'dark', label: 'Sombre' },
        ]}
      />
      {!isTauri && (
        <div className="form-section">
          <h3>Installer comme application</h3>
          <p className="small text-2">
            Dans Chrome ou Edge, cliquez sur l'icône « Installer » dans la barre d'adresse (ou menu → Installer AFE) : l'application s'ouvre alors dans sa propre fenêtre, sans navigateur, et fonctionne hors ligne.
          </p>
        </div>
      )}
    </div>
  );
}
