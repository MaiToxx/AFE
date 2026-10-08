import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
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

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Tableau de bord', icon: 'dashboard', end: true },
  { to: '/documents', label: 'Factures & devis', icon: 'file' },
  { to: '/clients', label: 'Clients', icon: 'users' },
  { to: '/cotisations', label: 'Cotisations', icon: 'calc' },
  { to: '/parametres', label: 'Paramètres', icon: 'settings' },
];

export default function Layout() {
  const [theme, setTheme] = useTheme();
  const dark = isDark(theme);
  return (
    <div className="app">
      <nav className="nav" aria-label="Navigation principale">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
              <path d="M5 18v-5 M10 18V8 M15 18v-7 M20 18V5" />
            </svg>
          </div>
          <div>
            <div className="brand-title">AFE</div>
            <div className="brand-sub">Auto-entrepreneur</div>
          </div>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `item${isActive ? ' active' : ''}`}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <div className="nav-footer">
          <button type="button" className="btn ghost sm" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}>
            <Icon name={dark ? 'sun' : 'moon'} size={16} />
            <span>{dark ? 'Clair' : 'Sombre'}</span>
          </button>
          <div className="hint">Fonctionne hors ligne. Vos données restent sur cet appareil.</div>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
