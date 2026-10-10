import { useState } from 'react';
import { saveProfile } from '../db/db';
import { LANGS, useI18n, type Lang } from '../i18n';
import { loadDemo } from '../lib/demo';
import { L, REGIMES, getRegime } from '../regimes';
import { paramsFor } from '../regimes/engine';
import { Icon } from './ui';

/** Premier lancement : langue de l'interface et pays d'imposition, qui pilotent tout le reste. */
export default function Onboarding() {
  const { t, lang, setLang } = useI18n();
  const [pays, setPays] = useState('');
  const [busy, setBusy] = useState(false);

  async function continuer(avecDemo: boolean) {
    const code = pays || 'FR';
    const regime = getRegime(code);
    const { params } = paramsFor(regime, {}, new Date().getFullYear());
    setBusy(true);
    await saveProfile({
      pays: code,
      langueDocuments: regime.langues.includes(lang) ? lang : regime.langues[0],
      devise: regime.devise,
      activite: regime.activiteDefaut,
      frequence: regime.periodiciteDefaut,
      tauxTVA: params.tvaDefaut,
      retenueSource: regime.options.retenue?.tauxDefaut ?? 0,
      assujettiTVA: !regime.tva.franchisePossible,
    });
    if (avecDemo) await loadDemo();
    setBusy(false);
    if (!avecDemo) window.location.hash = '#/parametres';
  }

  const regime = pays ? getRegime(pays) : null;

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
            {REGIMES.map((r) => (
              <button key={r.code} type="button" className={`country${pays === r.code ? ' active' : ''}`} aria-pressed={pays === r.code} aria-label={`${L(r.nom, lang)} — ${L(r.statut, lang)}`} onClick={() => setPays(r.code)}>
                <span className="flag" aria-hidden="true">{r.drapeau}</span>
                <span>
                  <b>{L(r.nom, lang)}</b>
                  <small>{L(r.statut, lang)}</small>
                </span>
              </button>
            ))}
          </div>
          {regime && (
            <span className="help">
              {t('onb.summary', { devise: regime.devise, tva: regime.tva.nom })}
            </span>
          )}
        </div>

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
