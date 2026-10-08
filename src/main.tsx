import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { isTauri } from './lib/desktop';
import './styles.css';

// Le service worker n'a de sens que pour la version web (hors-ligne + installation PWA).
if (!isTauri) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
