import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useLicense, useProfile } from '../db/hooks';
import { LANGS, useI18n, type Lang } from '../i18n';
import Automations from './Automations';
import Onboarding from './Onboarding';
import { Icon, type IconName } from './ui';

export type Theme = 'auto' | 'light' | 'dark';

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem('afe-theme');
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(t: Theme) {
  try {
    if (t === 'auto') localStorage.removeItem('afe-theme');
    else localStorage.setItem('afe-theme', t);
  } catch {
    /* stockage indisponible : le thème ne sera pas mémorisé */
  }
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  window.dispatchEvent(new Event('afe-theme'));
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [t, setT] = useState<Theme>(getTheme);
  useEffect(() => {
    const h = () => setT(getTheme());
    window.addEventListener('afe-theme', h);
    return () => window.removeEventListener('afe-theme', h);
  }, []);
  return [t, applyTheme];
}

export function isDark(t: Theme): boolean {
  return t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

const NAV: { to: string; key: string; icon: IconName; end?: boolean }[] = [
  { to: '/', key: 'nav.dashboard', icon: 'dashboard', end: true },
  { to: '/documents', key: 'nav.documents', icon: 'file' },
  { to: '/clients', key: 'nav.clients', icon: 'users' },
  { to: '/cotisations', key: 'nav.contributions', icon: 'calc' },
  { to: '/recettes', key: 'nav.ledger', icon: 'table' },
  { to: '/parametres', key: 'nav.settings', icon: 'settings' },
];

function LicenceBadge() {
  const lic = useLicense();
  const { t, tn } = useI18n();
  const to = '/parametres?tab=licence';
  switch (lic.status) {
    case 'trial':
      return (
        <Link to={to} className={`lic${lic.daysLeft <= 3 ? ' warning' : ''}`} title={t('licence.trialTitle')}>
          <Icon name="info" />
          <span>{tn('licence.trialDays', lic.daysLeft)}</span>
        </Link>
      );
    case 'trial_over':
      return (
        <Link to={to} className="lic critical">
          <Icon name="alert" />
          <span>{t('licence.trialOverShort')}</span>
        </Link>
      );
    case 'expired':
    case 'unsupported':
    case 'invalid':
      return (
        <Link to={to} className="lic critical">
          <Icon name="alert" />
          <span>{t('licence.checkShort')}</span>
        </Link>
      );
    case 'licensed':
      return (
        <Link to={to} className="lic good" title={`${t('licence.number')} ${lic.license.id}`}>
          <Icon name="checkCircle" />
          <span>{t('licence.badge', { name: lic.license.name })}</span>
        </Link>
      );
    default:
      return null;
  }
}

export default function Layout() {
  const [theme, setTheme] = useTheme();
  const dark = isDark(theme);
  const { t, lang, setLang } = useI18n();
  const { loaded, exists } = useProfile();

  if (loaded && !exists) return <Onboarding />;

  return (
    <div className="app">
      <nav className="nav" aria-label={t('nav.main')}>
        <div className="brand">
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
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `item${isActive ? ' active' : ''}`}>
            <Icon name={n.icon} />
            <span>{t(n.key)}</span>
          </NavLink>
        ))}
        <div className="nav-footer">
          <LicenceBadge />
          <div className="nav-tools">
            <button type="button" className="btn ghost sm" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? t('nav.toLight') : t('nav.toDark')}>
              <Icon name={dark ? 'sun' : 'moon'} size={16} />
              <span>{dark ? t('nav.light') : t('nav.dark')}</span>
            </button>
            <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t('nav.language')}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="hint">{t('nav.offline')}</div>
          <div className="version">AFE v{__APP_VERSION__}</div>
        </div>
      </nav>
      <main className="main">
        <Automations />
        <Outlet />
      </main>
    </div>
  );
}
