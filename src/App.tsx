import { useCallback, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { ensureTrialStart, setSetting } from './db/db';
import { useProfile, useSetting } from './db/hooks';
import { I18nProvider, detectLang, isLang, type Lang } from './i18n';
import { setFormatting } from './lib/format';
import Clients from './pages/Clients';
import Cotisations from './pages/Cotisations';
import Dashboard from './pages/Dashboard';
import Depenses from './pages/Depenses';
import DocumentEditor from './pages/DocumentEditor';
import DocumentPrint from './pages/DocumentPrint';
import Echeances from './pages/Echeances';
import Documents from './pages/Documents';
import Parametres from './pages/Parametres';
import Recettes from './pages/Recettes';
import { localeFor } from './regimes';

export default function App() {
  useEffect(() => {
    void ensureTrialStart();
  }, []);
  const stored = useSetting('langue');
  const { profile } = useProfile();
  const lang: Lang = isLang(stored) ? stored : detectLang();
  const locale = localeFor(lang, profile.pays);
  const currency = profile.devise || 'EUR';
  // Fixé pendant le rendu : les enfants formatent déjà dans la bonne locale/devise.
  setFormatting(locale, currency);
  const setLang = useCallback((l: Lang) => {
    void setSetting('langue', l);
  }, []);

  return (
    <I18nProvider lang={lang} locale={locale} currency={currency} onChange={setLang}>
      <HashRouter>
        <Routes>
          <Route path="/documents/:id/imprimer" element={<DocumentPrint />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="documents" element={<Documents />} />
            <Route path="documents/nouveau" element={<DocumentEditor />} />
            <Route path="documents/:id" element={<DocumentEditor />} />
            <Route path="clients" element={<Clients />} />
            <Route path="cotisations" element={<Cotisations />} />
            <Route path="echeances" element={<Echeances />} />
            <Route path="recettes" element={<Recettes />} />
            <Route path="depenses" element={<Depenses />} />
            <Route path="parametres" element={<Parametres />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </I18nProvider>
  );
}
