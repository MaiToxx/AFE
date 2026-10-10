import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BaremeEditor from '../components/BaremeEditor';
import BuyLicenceButton from '../components/BuyLicenceButton';
import { useTheme, type Theme } from '../components/Layout';
import PrestationForm from '../components/PrestationForm';
import { Badge, Check, Field, Icon, Notice, NumInput, PageHeader, Seg } from '../components/ui';
import { clearAll, db, deleteSetting, exportBackup, importBackup, saveProfile, setSetting } from '../db/db';
import { useCatalogue, useDocuments, useLicense, useProfile, useRegime, useRegimeOverrides } from '../db/hooks';
import type { Frequence, Nature, Prestation, Profile } from '../db/types';
import { colon, LANGS, useI18n, type Lang } from '../i18n';
import { dossierSauvegardes, ouvrirDossierSauvegardes, sauvegardeAutomatique } from '../lib/autoBackup';
import { todayISO, yearOf } from '../lib/dates';
import { loadDemo } from '../lib/demo';
import { isTauri, openExternal, saveTextFile } from '../lib/desktop';
import { fmtDate, fmtMoney } from '../lib/format';
import { PURCHASE_URL, SUPPORT_EMAIL, TRIAL_DAYS, evaluate, verifyKey, type LicenseStatus } from '../lib/license';
import { sauvegarderCleFichier, supprimerCleFichier } from '../lib/licenseStore';
import { verifierMiseAJour } from '../lib/updater';
import { DEVISES, L, PAYS, getRegime, statutsDe } from '../regimes';
import { composanteActive, paramsFor, tvaFrequence } from '../regimes/engine';
import type { Regime } from '../regimes/types';

type Tab = 'profil' | 'facturation' | 'catalogue' | 'bareme' | 'donnees' | 'licence' | 'apparence';
const TAB_VALUES: Tab[] = ['profil', 'facturation', 'catalogue', 'bareme', 'donnees', 'licence', 'apparence'];
const isTab = (x: string | null): x is Tab => !!x && (TAB_VALUES as string[]).includes(x);

export default function Parametres() {
  const { t } = useI18n();
  const { profile, loaded, exists } = useProfile();
  const regime = useRegime();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (isTab(params.get('tab')) ? (params.get('tab') as Tab) : 'profil'));
  useEffect(() => {
    const x = params.get('tab');
    if (isTab(x)) setTab(x);
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

  const TABS: { value: Tab; key: string }[] = [
    { value: 'profil', key: 'settings.tabProfile' },
    { value: 'facturation', key: 'settings.tabDocuments' },
    { value: 'catalogue', key: 'settings.tabCatalogue' },
    { value: 'bareme', key: 'settings.tabRates' },
    { value: 'donnees', key: 'settings.tabData' },
    { value: 'licence', key: 'settings.tabLicence' },
    { value: 'apparence', key: 'settings.tabAppearance' },
  ];
  const showSave = tab === 'profil' || tab === 'facturation';

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        subtitle={!exists && loaded ? t('settings.fillProfile') : undefined}
        actions={
          showSave && (
            <>
              {saved && <span className="small good"><Icon name="check" size={14} /> {t('common.saved')}</span>}
              <button type="button" className="btn primary" onClick={save} disabled={!dirty}>
                <Icon name="check" /> {t('common.save')}
              </button>
            </>
          )
        }
      />
      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.value} type="button" role="tab" aria-selected={tab === x.value} className={tab === x.value ? 'active' : ''} onClick={() => setTab(x.value)}>
            {t(x.key)}
          </button>
        ))}
      </div>

      {tab === 'profil' && <ProfilTab form={form} set={set} regime={getRegime(form.pays, form.statut)} />}
      {tab === 'facturation' && <FacturationTab form={form} set={set} regime={regime} />}
      {tab === 'catalogue' && <CatalogueTab tauxTVA={form.tauxTVA} />}
      {tab === 'bareme' && <BaremeEditor key={regime.code} regime={regime} anneeInitiale={yearOf(todayISO())} />}
      {tab === 'donnees' && <DonneesTab />}
      {tab === 'licence' && <LicenceTab />}
      {tab === 'apparence' && <ApparenceTab />}
    </>
  );
}

function ProfilTab({ form, set, regime }: { form: Profile; set: (p: Partial<Profile>) => void; regime: Regime }) {
  const { t, lang } = useI18n();
  const overrides = useRegimeOverrides(regime.code);
  const { params } = paramsFor(regime, overrides, yearOf(todayISO()));
  const optionnelles = params.composantes.filter((c) => c.optionnel);

  /** Valeurs pilotées par le régime, réappliquées quand le pays ou le statut change. */
  const defautsDe = (r: Regime): Partial<Profile> => {
    const p = paramsFor(r, {}, yearOf(todayISO())).params;
    return {
      pays: r.pays,
      statut: r.statutId,
      activite: r.activites.some((a) => a.id === form.activite) ? form.activite : r.activiteDefaut,
      frequence: r.periodicites.includes(form.frequence) ? form.frequence : r.periodiciteDefaut,
      periodiciteTVA: '',
      tauxTVA: p.tvaTaux.includes(form.tauxTVA) ? form.tauxTVA : p.tvaDefaut,
      retenueSource: r.options.retenue?.tauxDefaut ?? 0,
      assujettiTVA: r.tva.franchisePossible ? form.assujettiTVA : true,
      optionsRegime: {},
      acre: r.options.acre ? form.acre : false,
      versementLiberatoire: r.options.vl ? form.versementLiberatoire : false,
      remunerationMensuelle: r.remuneration ? form.remunerationMensuelle : 0,
    };
  };

  function changerPays(code: string) {
    if (code === form.pays) return;
    const r = getRegime(code);
    if (!confirm(t('settings.confirmCountry', { pays: L(r.nom, lang) }))) return;
    set({
      ...defautsDe(r),
      devise: r.devise,
      assujettiTVA: !r.tva.franchisePossible,
      langueDocuments: r.langues.includes(form.langueDocuments) ? form.langueDocuments : r.langues[0],
      acre: false,
      versementLiberatoire: false,
      identifiants: {},
    });
  }

  function changerStatut(statutId: string) {
    if (statutId === form.statut) return;
    const r = getRegime(form.pays, statutId);
    if (!confirm(t('settings.confirmStatut', { statut: L(r.statut, lang) }))) return;
    set(defautsDe(r));
  }

  const statuts = statutsDe(form.pays);
  const tvaPeriodicites = regime.tva.periodicites ?? [...new Set<Frequence>([...regime.periodicites, 'annuelle'])];

  return (
    <div className="card">
      <div className="form-section">
        <h3>{t('settings.country')}</h3>
        <div className="form-row">
          <Field label={t('settings.taxCountry')} help={t('settings.taxCountryHelp')}>
            <select value={form.pays} onChange={(e) => changerPays(e.target.value)}>
              {PAYS.map((r) => (
                <option key={r.pays} value={r.pays}>{r.drapeau} {L(r.nom, lang)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('settings.statut')} help={t('settings.statutHelp')}>
            <select value={regime.statutId} onChange={(e) => changerStatut(e.target.value)}>
              {statuts.map((r) => (
                <option key={r.code} value={r.statutId}>{L(r.statut, lang)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('settings.currency')}>
            <select value={form.devise} onChange={(e) => set({ devise: e.target.value })}>
              {[...new Set([form.devise, regime.devise, ...DEVISES])].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>{L(regime.avertissement, lang)}</p>
      </div>

      <div className="form-section">
        <h3>{t('settings.identity')}</h3>
        <div className="form-row">
          <Field label={t('settings.firstName')}><input type="text" value={form.prenom} onChange={(e) => set({ prenom: e.target.value })} /></Field>
          <Field label={t('settings.lastName')}><input type="text" value={form.nom} onChange={(e) => set({ nom: e.target.value })} /></Field>
          <Field label={t('settings.tradeName')}><input type="text" value={form.denomination} onChange={(e) => set({ denomination: e.target.value })} /></Field>
        </div>
        <Field label={t('clients.form.address')}><input type="text" value={form.adresse} onChange={(e) => set({ adresse: e.target.value })} /></Field>
        <div className="form-row">
          <Field label={t('clients.form.zip')}><input type="text" value={form.codePostal} onChange={(e) => set({ codePostal: e.target.value })} /></Field>
          <Field label={t('clients.form.city')}><input type="text" value={form.ville} onChange={(e) => set({ ville: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label={t('clients.form.email')}><input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label={t('clients.form.phone')}><input type="tel" value={form.telephone} onChange={(e) => set({ telephone: e.target.value })} /></Field>
          <Field label={t('settings.website')}><input type="text" value={form.siteWeb} onChange={(e) => set({ siteWeb: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          {regime.identifiants.filter((i) => !i.pourTva || form.assujettiTVA).map((i) => (
            <Field key={i.id} label={L(i.label, lang)}>
              <input type="text" value={form.identifiants[i.id] ?? ''} placeholder={i.placeholder} onChange={(e) => set({ identifiants: { ...form.identifiants, [i.id]: e.target.value } })} />
            </Field>
          ))}
        </div>
      </div>

      <div className="form-section">
        <h3>{t('settings.activity')}</h3>
        <div className="form-row">
          <Field label={t('settings.activityLabel')} help={t('settings.activityLabelHelp')}><input type="text" value={form.activiteLibelle} onChange={(e) => set({ activiteLibelle: e.target.value })} placeholder={t('settings.activityPlaceholder')} /></Field>
          <Field label={t('settings.defaultActivity')} help={t('settings.defaultActivityHelp')}>
            <select value={form.activite} onChange={(e) => set({ activite: e.target.value })}>
              {regime.activites.map((a) => <option key={a.id} value={a.id}>{L(a.label, lang)}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          {regime.natures && (
            <Field label={t('settings.nature')} help={t('settings.natureHelp')}>
              <select value={form.nature} onChange={(e) => set({ nature: e.target.value as Nature })}>
                {regime.natures.map((n) => <option key={n.id} value={n.id}>{L(n.label, lang)}</option>)}
              </select>
            </Field>
          )}
          <Field label={t('settings.startDate')}>
            <input type="date" value={form.dateDebutActivite} onChange={(e) => set({ dateDebutActivite: e.target.value })} />
          </Field>
          <Field label={t('settings.periodicity')}>
            <select value={form.frequence} onChange={(e) => set({ frequence: e.target.value as Profile['frequence'] })}>
              {regime.periodicites.map((p) => <option key={p} value={p}>{t(`freq.${p}`)}</option>)}
            </select>
          </Field>
        </div>
        {regime.natures && form.nature === 'artisan' && (
          <Check label={t('settings.dualRegistration')} help={t('settings.dualRegistrationHelp')} checked={form.doubleImmatriculation} onChange={(v) => set({ doubleImmatriculation: v })} />
        )}
        {regime.options.acre && (
          <Check label={L(regime.options.acre.label, lang)} help={L(regime.options.acre.aide, lang)} checked={form.acre} onChange={(v) => set({ acre: v })} />
        )}
        {regime.options.vl && (
          <Check label={L(regime.options.vl.label, lang)} help={L(regime.options.vl.aide, lang)} checked={form.versementLiberatoire} onChange={(v) => set({ versementLiberatoire: v })} />
        )}
        {optionnelles.map((c) => (
          <Check
            key={c.id}
            label={L(c.label, lang)}
            help={c.note ? L(c.note, lang) : t('settings.optionalComponent')}
            checked={composanteActive(c, form)}
            onChange={(v) => set({ optionsRegime: { ...form.optionsRegime, [c.id]: v } })}
          />
        ))}
        <div className="form-row">
          {regime.remuneration && (
            <Field label={L(regime.remuneration.label, lang)} help={L(regime.remuneration.aide, lang)}>
              <NumInput value={form.remunerationMensuelle} onChange={(remunerationMensuelle) => set({ remunerationMensuelle })} min={0} />
            </Field>
          )}
          <Field label={t('settings.goal')} help={t('settings.goalHelp')}>
            <NumInput value={form.objectifCA} onChange={(objectifCA) => set({ objectifCA })} min={0} />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <h3>{regime.tva.nom}</h3>
        {regime.tva.franchisePossible ? (
          <Check label={t('settings.vatSubject', { tva: regime.tva.nom })} help={`${t('settings.vatSubjectHelp')} « ${L(regime.tva.mentionFranchise, lang)} »`} checked={form.assujettiTVA} onChange={(v) => set({ assujettiTVA: v })} />
        ) : (
          <Check label={t('settings.vatApply', { tva: regime.tva.nom })} checked={form.assujettiTVA} onChange={(v) => set({ assujettiTVA: v })} />
        )}
        {form.assujettiTVA && (
          <div className="form-row">
            <Field label={t('settings.vatDefaultRate', { tva: regime.tva.nom })}>
              <NumInput value={form.tauxTVA} onChange={(tauxTVA) => set({ tauxTVA })} min={0} />
              <span className="help">{t('settings.vatRatesAvailable')}{colon(lang)}{params.tvaTaux.join(' %, ')} %</span>
            </Field>
            <Field label={t('settings.vatPeriodicity', { tva: regime.tva.nom })} help={t('settings.vatPeriodicityHelp')}>
              <select value={form.periodiciteTVA || tvaFrequence(regime, form)} onChange={(e) => set({ periodiciteTVA: e.target.value as Frequence })}>
                {tvaPeriodicites.map((p) => (
                  <option key={p} value={p}>{t(`freq.${p}`)}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        {regime.options.retenue && (
          <div className="form-row">
            <Field label={L(regime.options.retenue.label, lang)} help={regime.options.retenue.proSeulement ? t('editor.withholdingProOnly') : undefined}>
              <NumInput value={form.retenueSource} onChange={(retenueSource) => set({ retenueSource })} min={0} />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

function FacturationTab({ form, set, regime }: { form: Profile; set: (p: Partial<Profile>) => void; regime: Regime }) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState('');

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 600_000) {
      setLogoError(t('settings.logoTooBig'));
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
        <h3>{t('settings.docAppearance')}</h3>
        <div className="form-row">
          <div className="field">
            <span className="label">{t('settings.logo')}</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {form.logo ? <img src={form.logo} alt="Logo" style={{ maxHeight: 56, maxWidth: 160, objectFit: 'contain', background: '#fff', borderRadius: 6, padding: 4 }} /> : <span className="small muted">{t('settings.noLogo')}</span>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
              <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} /> {t('common.import')}</button>
              {form.logo && <button type="button" className="btn ghost sm" onClick={() => set({ logo: '' })}>{t('common.remove')}</button>}
            </div>
            {logoError && <span className="help critical">{logoError}</span>}
          </div>
          <Field label={t('settings.accentColor')}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={form.couleur} onChange={(e) => set({ couleur: e.target.value })} />
              <span className="small tnum text-2">{form.couleur}</span>
            </div>
          </Field>
          <div className="field">
            <span className="label">{t('settings.docStyle')}</span>
            <Seg
              value={form.themeDocument}
              onChange={(themeDocument) => set({ themeDocument })}
              options={[
                { value: 'clair', label: t('settings.styleLight') },
                { value: 'sombre', label: t('settings.styleDark') },
              ]}
            />
            <span className="help">{t('settings.docStyleHelp')}</span>
          </div>
          <Field label={t('settings.docLanguage')} help={t('settings.docLanguageHelp')}>
            <select value={form.langueDocuments} onChange={(e) => set({ langueDocuments: e.target.value as Lang })}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.label}{regime.langues.includes(l.code) ? '' : ' *'}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <div className="form-section">
        <h3>{t('settings.numbering')}</h3>
        <div className="form-row">
          <Field label={t('settings.invoicePrefix')} help={`${t('common.example')} ${form.prefixeFacture || 'F'}-${yearOf(todayISO())}-0001`}><input type="text" value={form.prefixeFacture} onChange={(e) => set({ prefixeFacture: e.target.value.trim() })} /></Field>
          <Field label={t('settings.quotePrefix')}><input type="text" value={form.prefixeDevis} onChange={(e) => set({ prefixeDevis: e.target.value.trim() })} /></Field>
          <Field label={t('settings.creditPrefix')}><input type="text" value={form.prefixeAvoir} onChange={(e) => set({ prefixeAvoir: e.target.value.trim() })} /></Field>
          <Field label={t('settings.paymentDelay')}><NumInput value={form.delaiPaiementJours} onChange={(n) => set({ delaiPaiementJours: Math.round(n) })} min={0} /></Field>
          <Field label={t('settings.quoteValidity')}><NumInput value={form.validiteDevisJours} onChange={(n) => set({ validiteDevisJours: Math.round(n) })} min={0} /></Field>
        </div>
      </div>
      <div className="form-section">
        <h3>{t('settings.mentions')}</h3>
        <Field label={t('settings.paymentTerms')}><input type="text" value={form.conditionsPaiement} onChange={(e) => set({ conditionsPaiement: e.target.value })} placeholder={t('settings.paymentTermsPlaceholder')} /></Field>
        <div className="form-row">
          <Field label="IBAN"><input type="text" value={form.iban} onChange={(e) => set({ iban: e.target.value })} /></Field>
          <Field label="BIC"><input type="text" value={form.bic} onChange={(e) => set({ bic: e.target.value })} /></Field>
        </div>
        <Field label={t('settings.footerMentions')} help={t('settings.footerMentionsHelp')}>
          <textarea value={form.mentionsPied} onChange={(e) => set({ mentionsPied: e.target.value })} rows={3} />
        </Field>
        <p className="small muted">{t('settings.autoMentions')}</p>
      </div>
    </div>
  );
}

function CatalogueTab({ tauxTVA }: { tauxTVA: number }) {
  const { t } = useI18n();
  const catalogue = useCatalogue();
  const [editing, setEditing] = useState<Prestation | null | undefined>(undefined);
  async function remove(p: Prestation) {
    if (confirm(t('catalogue.confirmDelete', { name: p.libelle }))) await db.catalogue.delete(p.id!);
  }
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>{t('catalogue.title')}</h3>
          <p className="small text-2">{t('catalogue.intro')}</p>
        </div>
        <button type="button" className="btn primary sm" onClick={() => setEditing(null)}><Icon name="plus" size={15} /> {t('common.add')}</button>
      </div>
      {catalogue.length === 0 ? (
        <p className="text-2">{t('catalogue.empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>{t('catalogue.label')}</th><th>{t('catalogue.description')}</th><th>{t('editor.unit')}</th><th className="num">{t('editor.unitPrice')}</th><th className="num">{t('editor.vatRate')}</th><th /></tr>
            </thead>
            <tbody>
              {catalogue.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setEditing(p)}>
                  <td><b>{p.libelle}</b></td>
                  <td className="text-2 ellipsis" title={p.description}>{p.description || <span className="muted">—</span>}</td>
                  <td className="text-2">{p.unite}</td>
                  <td className="num">{fmtMoney(p.prixUnitaire)}</td>
                  <td className="num">{p.tauxTVA} %</td>
                  <td>
                    <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn ghost sm icon" onClick={() => setEditing(p)} aria-label={t('common.edit')}><Icon name="pen" size={15} /></button>
                      <button type="button" className="btn danger sm icon" onClick={() => remove(p)} aria-label={t('common.delete')}><Icon name="trash" size={15} /></button>
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

function SauvegardeAutoCard() {
  const { t } = useI18n();
  const { profile } = useProfile();
  const last = useLiveQuery(() => db.settings.get('lastAutoBackup'), []);
  const [dossier, setDossier] = useState('');
  useEffect(() => {
    dossierSauvegardes().then(setDossier).catch(() => setDossier(''));
  }, []);
  return (
    <div className="card">
      <h3>{t('settings.autoBackup')}</h3>
      <p className="small text-2" style={{ margin: '4px 0 8px' }}>
        {t('settings.autoBackupText')}{dossier ? ` (${dossier})` : ''} {last?.value ? t('settings.lastBackup', { date: fmtDate(last.value) }) : t('settings.noBackupYet')}
      </p>
      <Check label={t('settings.autoBackupEnable')} checked={profile.sauvegardeAuto} onChange={(v) => void saveProfile({ sauvegardeAuto: v })} />
      <div className="actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn sm" onClick={() => void sauvegardeAutomatique({ ...profile, sauvegardeAuto: true }, true).then(() => alert(t('settings.backupDone')))}>
          <Icon name="download" size={15} /> {t('settings.backupNow')}
        </button>
        <button type="button" className="btn sm" onClick={() => void ouvrirDossierSauvegardes()}>
          <Icon name="eye" size={15} /> {t('settings.openFolder')}
        </button>
      </div>
    </div>
  );
}

function DonneesTab() {
  const { t } = useI18n();
  const docs = useDocuments();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone?: 'warning' | 'critical'; text: string } | null>(null);

  async function onExport() {
    const data = await exportBackup();
    try {
      const ok = await saveTextFile(`afe-${t('settings.backupFile')}-${todayISO()}.json`, JSON.stringify(data, null, 2));
      if (ok) setMsg({ text: t('settings.exportDone') });
    } catch (e) {
      setMsg({ tone: 'critical', text: e instanceof Error ? e.message : t('settings.exportFailed') });
    }
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    if (!confirm(t('settings.confirmImport'))) return;
    try {
      await importBackup(await file.text());
      setMsg({ text: t('settings.importDone') });
    } catch (e) {
      setMsg({ tone: 'critical', text: e instanceof Error && e.message === 'backup.invalid' ? t('settings.backupInvalid') : t('settings.importFailed') });
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onDemo() {
    if (docs.length && !confirm(t('settings.confirmDemo'))) return;
    await loadDemo();
    setMsg({ text: t('settings.demoDone') });
  }

  async function onClear() {
    if (!confirm(t('settings.confirmClear1'))) return;
    if (!confirm(t('settings.confirmClear2'))) return;
    await clearAll();
    setMsg({ tone: 'warning', text: t('settings.clearDone') });
  }

  return (
    <div className="stack">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="card">
        <h3>{t('settings.backup')}</h3>
        <p className="small text-2" style={{ margin: '4px 0 12px' }}>{t('settings.backupText')}</p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={onExport}><Icon name="download" /> {t('settings.exportBackup')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" /> {t('settings.restoreBackup')}</button>
        </div>
      </div>
      {isTauri && <SauvegardeAutoCard />}
      <div className="card">
        <h3>{t('settings.demo')}</h3>
        <p className="small text-2" style={{ margin: '4px 0 12px' }}>{t('settings.demoText')}</p>
        <button type="button" className="btn" onClick={onDemo}><Icon name="eye" /> {t('settings.loadDemo')}</button>
      </div>
      <div className="card">
        <h3>{t('settings.dangerZone')}</h3>
        <p className="small text-2" style={{ margin: '4px 0 12px' }}>{t('settings.clearText')}</p>
        <button type="button" className="btn danger" onClick={onClear}><Icon name="trash" /> {t('settings.clearAll')}</button>
      </div>
    </div>
  );
}

function LicenceEtat({ lic }: { lic: LicenseStatus }) {
  const { t, tn } = useI18n();
  switch (lic.status) {
    case 'loading':
      return <p className="muted">{t('licence.checking')}</p>;
    case 'trial':
      return (
        <>
          <p><Badge tone="info">{t('licence.trialBadge')}</Badge></p>
          <p className="text-2" style={{ marginTop: 8 }}>{tn('licence.trialText', lic.daysLeft, { date: fmtDate(lic.endsOn) })}</p>
        </>
      );
    case 'trial_over':
      return (
        <>
          <p><Badge tone="critical">{t('licence.trialOverBadge')}</Badge></p>
          <p className="text-2" style={{ marginTop: 8 }}>{t('licence.trialOverText', { days: TRIAL_DAYS })}</p>
        </>
      );
    case 'invalid':
      return (
        <>
          <p><Badge tone="critical">{t('licence.invalidBadge')}</Badge></p>
          <p className="text-2" style={{ marginTop: 8 }}>{t(lic.reasonKey)}</p>
        </>
      );
    case 'licensed':
    case 'expired':
    case 'unsupported': {
      const l = lic.license;
      return (
        <>
          <p>
            {lic.status === 'licensed' && <Badge tone="good">{t('licence.activeBadge')}</Badge>}
            {lic.status === 'expired' && <Badge tone="critical">{t('licence.expiredBadge', { date: fmtDate(l.expires ?? '') })}</Badge>}
            {lic.status === 'unsupported' && <Badge tone="critical">{t('licence.unsupportedBadge', { version: __APP_VERSION__ })}</Badge>}
          </p>
          <dl className="kv" style={{ marginTop: 10 }}>
            <dt>{t('licence.holder')}</dt><dd>{l.name}</dd>
            <dt>{t('clients.form.email')}</dt><dd>{l.email}</dd>
            <dt>{t('licence.type')}</dt><dd>{l.plan === 'abonnement' ? t('licence.subscriptionUntil', { date: fmtDate(l.expires ?? '') }) : t('licence.perpetual')}{l.maxMajor !== undefined ? ` · ${t('licence.updatesUntil', { major: l.maxMajor })}` : ''}</dd>
            <dt>{t('licence.number')}</dt><dd className="tnum">{l.id}</dd>
            <dt>{t('licence.issued')}</dt><dd>{fmtDate(l.issued)}</dd>
          </dl>
          {lic.status === 'unsupported' && <p className="text-2 small" style={{ marginTop: 8 }}>{t('licence.unsupportedText', { major: l.maxMajor ?? 0, email: SUPPORT_EMAIL })}</p>}
        </>
      );
    }
  }
}

function LicenceTab() {
  const { t } = useI18n();
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
        setMsg({ tone: 'critical', text: t(r.reasonKey) });
        return;
      }
      const ev = evaluate(r.payload);
      if (ev.status === 'invalid') {
        setMsg({ tone: 'critical', text: t(ev.reasonKey) });
        return;
      }
      if (ev.status === 'expired') {
        setMsg({ tone: 'critical', text: t('licence.err.expired', { date: fmtDate(r.payload.expires ?? '') }) });
        return;
      }
      if (ev.status === 'unsupported') {
        setMsg({ tone: 'critical', text: t('licence.err.unsupported', { major: r.payload.maxMajor ?? 0, version: __APP_VERSION__ }) });
        return;
      }
      const clean = key.replace(/\s+/g, '');
      await setSetting('licenseKey', clean);
      await sauvegarderCleFichier(clean);
      setKey('');
      setMsg({ text: t('licence.activated', { name: r.payload.name }) });
    } finally {
      setBusy(false);
    }
  }

  async function retirer() {
    if (!confirm(t('licence.confirmRemove'))) return;
    await deleteSetting('licenseKey');
    await supprimerCleFichier();
    setMsg({ text: t('licence.removed') });
  }

  return (
    <div className="stack">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="card">
        <div className="card-head">
          <h3>{t('licence.stateTitle')}</h3>
          {hasKey && <button type="button" className="btn ghost sm" onClick={retirer}>{t('licence.remove')}</button>}
        </div>
        <LicenceEtat lic={lic} />
      </div>
      <div className="card">
        <h3>{t('licence.activateTitle')}</h3>
        <p className="small text-2" style={{ margin: '4px 0 12px' }}>{t('licence.activateText')}{isTauri ? ` ${t('licence.fileCopy')}` : ''}</p>
        <textarea value={key} onChange={(e) => setKey(e.target.value)} rows={4} placeholder="AFE1-…" spellCheck={false} style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5 }} aria-label={t('licence.keyLabel')} />
        <div className="actions" style={{ marginTop: 10 }}>
          <button type="button" className="btn primary" onClick={activer} disabled={busy || !key.trim()}>
            <Icon name="check" /> {t('licence.activate')}
          </button>
        </div>
      </div>
      {lic.status !== 'licensed' && (
        <div className="card">
          <h3>{t('licence.getTitle')}</h3>
          <p className="small text-2" style={{ margin: '4px 0 12px' }}>{t('licence.getText')}{PURCHASE_URL ? '' : ` ${t('licence.getTextMail')}`}</p>
          <div className="actions">
            <BuyLicenceButton />
            <span className="small muted">{t('licence.support')} : <a href={`mailto:${SUPPORT_EMAIL}`} onClick={(e) => { e.preventDefault(); void openExternal(`mailto:${SUPPORT_EMAIL}`); }}>{SUPPORT_EMAIL}</a></span>
          </div>
        </div>
      )}
    </div>
  );
}

function MiseAJourButton() {
  const { t } = useI18n();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    setMsg(t('update.checking'));
    const r = await verifierMiseAJour();
    setBusy(false);
    setMsg(
      r.status === 'a_jour' ? t('update.upToDate') : r.status === 'refusee' ? t('update.later2', { version: r.version }) : r.status === 'installee' ? t('update.installed') : r.status === 'erreur' ? t('update.error', { message: r.message }) : '',
    );
  }
  return (
    <div className="actions">
      <button type="button" className="btn sm" onClick={check} disabled={busy}><Icon name="download" size={15} /> {t('update.check')}</button>
      {msg && <span className="small text-2">{msg}</span>}
    </div>
  );
}

function ApparenceTab() {
  const { t, lang, setLang } = useI18n();
  const [theme, setTheme] = useTheme();
  return (
    <div className="card">
      <div className="form-section">
        <h3>{t('settings.language')}</h3>
        <p className="small text-2" style={{ margin: '4px 0 12px' }}>{t('settings.languageHelp')}</p>
        <div className="chip-row">
          {LANGS.map((l) => (
            <button key={l.code} type="button" className={`chip${lang === l.code ? ' active' : ''}`} onClick={() => setLang(l.code)}>{l.label}</button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <h3>{t('settings.theme')}</h3>
        <p className="small text-2" style={{ margin: '4px 0 12px' }}>{t('settings.themeHelp')}</p>
        <Seg<Theme>
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'auto', label: t('settings.themeAuto') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
        />
      </div>
      <div className="form-section">
        <h3>{t('settings.about')}</h3>
        <p className="small text-2">AFE {t('settings.version')} {__APP_VERSION__}.</p>
        {isTauri && <MiseAJourButton />}
      </div>
      {!isTauri && (
        <div className="form-section">
          <h3>{t('settings.installApp')}</h3>
          <p className="small text-2">{t('settings.installAppText')}</p>
        </div>
      )}
    </div>
  );
}
