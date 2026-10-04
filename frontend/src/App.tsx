import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import Sidebar from './components/Sidebar';
import UncategorizedAlert from './components/UncategorizedAlert';
import { usePanelSummary } from './hooks/usePanelSummary';
import AlegraSettings from './pages/AlegraSettings';
import Bundles from './pages/Bundles';
import Generate from './pages/Generate';
import History from './pages/History';
import Home from './pages/Home';
import Login from './pages/Login';
import Print from './pages/Print';
import Sections from './pages/Sections';
import TemplateEditor from './pages/TemplateEditor';
import Uncategorized from './pages/Uncategorized';
import { api, UNAUTHORIZED_EVENT } from './services/api';

function Shell({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const panel = usePanelSummary(location.pathname);

  return (
    <AppShell sidebar={<Sidebar summary={panel.summary} onLogout={onLogout} />}>
      <Routes>
        <Route path="/" element={<Home {...panel} />} />
        <Route path="/alegra" element={<AlegraSettings />} />
        <Route path="/sin-categoria" element={<Uncategorized />} />
        <Route path="/contenido" element={<Sections />} />
        <Route path="/secciones" element={<Navigate to="/contenido" replace />} />
        <Route path="/productos-propios" element={<Navigate to="/contenido?tab=productos" replace />} />
        <Route path="/combos" element={<Bundles />} />
        <Route
          path="/generar"
          element={
            <div className="flex flex-col gap-4">
              <UncategorizedAlert />
              <Generate />
            </div>
          }
        />
        <Route path="/historial" element={<History />} />
        <Route path="/negocio" element={<Navigate to="/apariencia" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  const location = useLocation();
  const [auth, setAuth] = useState<'checking' | 'in' | 'out'>('checking');

  const check = useCallback(async () => {
    try {
      await api.get('/api/auth/session');
      setAuth('in');
    } catch {
      setAuth('out');
    }
  }, []);

  useEffect(() => {
    void check();
    const onUnauthorized = () => setAuth('out');
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [check]);

  if (auth === 'checking') return <p className="p-6">Cargando…</p>;
  if (auth === 'out') return <Login onLoggedIn={() => setAuth('in')} />;

  // Vista de impresión y vista previa: sin menú (el navegador headless usa una sesión temporal).
  if (location.pathname.startsWith('/print/')) {
    return (
      <Routes>
        <Route path="/print/:prepareId" element={<Print />} />
      </Routes>
    );
  }
  if (location.pathname.startsWith('/vista-previa/')) {
    return (
      <Routes>
        <Route path="/vista-previa/:prepareId" element={<Print preview />} />
      </Routes>
    );
  }

  // El editor de plantillas ocupa toda la ventana: sin barra lateral ni márgenes del panel.
  if (location.pathname === '/apariencia') {
    return (
      <Routes>
        <Route path="/apariencia" element={<TemplateEditor />} />
      </Routes>
    );
  }

  return (
    <Shell
      onLogout={async () => {
        await api.post('/api/auth/logout');
        setAuth('out');
      }}
    />
  );
}
