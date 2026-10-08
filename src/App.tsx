import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { ensureBaremes } from './db/db';
import Clients from './pages/Clients';
import Cotisations from './pages/Cotisations';
import Dashboard from './pages/Dashboard';
import DocumentEditor from './pages/DocumentEditor';
import DocumentPrint from './pages/DocumentPrint';
import Documents from './pages/Documents';
import Parametres from './pages/Parametres';

export default function App() {
  useEffect(() => {
    void ensureBaremes();
  }, []);
  return (
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
          <Route path="parametres" element={<Parametres />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
