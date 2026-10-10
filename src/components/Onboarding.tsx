import { useState } from 'react';
import { saveProfile } from '../db/db';
import { LANGS, useI18n, type Lang } from '../i18n';
import { loadDemo } from '../lib/demo';
import { L, PAYS, getRegime, statutsDe } from '../regimes';
import { paramsFor } from '../regimes/engine';
import { Icon } from './ui';

/** Premier lancement : langue de l'interface, pays d'imposition et statut, qui pilotent tout le reste. */
export default function Onboarding() {
  const { t, tn, lang, setLang } = useI18n();
  const [pays, setPays] = useState('');
  const [statut, setStatut] = useState('');
  const [busy, setBusy] = useState(false);

  const statuts = pays ? statutsDe(pays) : [];
  const regime = pays ? getRegime(pays, statut) : null;

  function choisirPays(code: string) {
    setPays(code);
    setStatut(statutsDe(code)[0].statutId);
  }

  async function continuer(avecDemo: boolean) {
    const r = regime ?? getRegime('FR');
    const { params } = paramsFor(r, {}, new Date().getFullYear());
    setBusy(true);
    await saveProfile({
      pays: r.pays,
      statut: r.statutId,
      langueDocuments: r.langues.includes(lang) ? lang : r.langues[0],
      devise: r.devise,
      activite: r.activiteDefaut,
      frequence: r.periodiciteDefaut,
      periodiciteTVA: '',
      remunerationMensuelle: 0,
      tauxTVA: params.tvaDefaut,
      retenueSource: r.options.retenue?.tauxDefaut ?? 0,
      assujettiTVA: !r.tva.franchisePossible,
    });
    if (avecDemo) await loadDemo();
    setBusy(false);
    if (!avecDemo) window.location.hash = '#/parametres';
  }

  return (
    <div className="onboarding">
      <div className="card onboarding-card">
        <div className="brand" style={{ padding: 0, marginBottom: 14 }}>
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
              <path d="M5 18v-5 M10 18V8 M15 18v-7 M20 18V5" />
            </svg>
          </div>
          <div>
            <div className="brand-title">AFE</div>
            <div className="brand-sub">{t('nav.brandSub')}</div>
          </div>
        </div>
        <h1>{t('onb.title')}</h1>
        <p className="text-2" style={{ margin: '6px 0 18px' }}>{t('onb.intro')}</p>

        <div className="field" style={{ marginBottom: 16 }}>
          <span className="label">{t('onb.language')}</span>
          <div className="chip-row">
            {LANGS.map((l) => (
              <button key={l.code} type="button" className={`chip${lang === l.code ? ' active' : ''}`} onClick={() => setLang(l.code as Lang)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <span className="label">{t('onb.country')}</span>
          <div className="country-grid">
            {PAYS.map((r) => {
              const n = statutsDe(r.pays).length;
              const sous = n > 1 ? tn('onb.statutsCount', n) : L(r.statut, lang);
              return (
                <button key={r.pays} type="button" className={`country${pays === r.pays ? ' active' : ''}`} aria-pressed={pays === r.pays} aria-label={`${L(r.nom, lang)} — ${sous}`} onClick={() => choisirPays(r.pays)}>
                  <span className="flag" aria-hidden="true">{r.drapeau}</span>
                  <span>
                    <b>{L(r.nom, lang)}</b>
                    <small>{sous}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {statuts.length > 1 && (
          <div className="field" style={{ marginBottom: 16 }}>
            <span className="label">{t('onb.statut')}</span>
            <div className="chip-row">
              {statuts.map((r) => (
                <button key={r.code} type="button" className={`chip${statut === r.statutId ? ' active' : ''}`} aria-pressed={statut === r.statutId} onClick={() => setStatut(r.statutId)}>
                  {L(r.statut, lang)}
                </button>
              ))}
            </div>
            <span className="help">{t('onb.statutHelp')}</span>
          </div>
        )}

        {regime && (
          <p className="help" style={{ marginBottom: 16 }}>
            {t('onb.summary', { devise: regime.devise, tva: regime.tva.nom })}
            {regime.forme === 'societe' ? ` · ${t('onb.summarySociete')}` : regime.params[Object.keys(regime.params).map(Number).sort((a, b) => b - a)[0]].baseRevenu === 'reel' ? ` · ${t('onb.summaryReel')}` : ''}
          </p>
        )}

        <div className="actions">
          <button type="button" className="btn primary" disabled={!pays || busy} onClick={() => continuer(false)}>
            <Icon name="check" /> {t('onb.continue')}
          </button>
          <button type="button" className="btn" disabled={!pays || busy} onClick={() => continuer(true)}>
            <Icon name="eye" /> {t('onb.demo')}
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 14 }}>{t('onb.privacy')}</p>
      </div>
    </div>
  );
}
