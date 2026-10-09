import { useState, useEffect } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { CatalogEngine } from './components/CatalogEngine';
import { Admin } from './pages/Admin';
import { AdminLogin } from './components/AdminLogin';
import { isAuthenticated, AUTH_CHANGE_EVENT } from './lib/auth';
import { Settings } from 'lucide-react';

function ProtectedAdminRoute() {
  const [authed, setAuthed] = useState(() => isAuthenticated());

  useEffect(() => {
    const handleAuthChange = () => {
      setAuthed(isAuthenticated());
    };
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
  }, []);

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return <Admin onLogout={() => setAuthed(false)} />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-zinc-100/50 py-12 px-4 relative">
            <CatalogEngine />
            {/* Visible Floating Pill to Admin Console */}
            <Link
              to="/admin"
              className="fixed bottom-6 right-6 z-40 bg-zinc-900 hover:bg-black text-white px-4 py-2.5 rounded-full text-xs font-semibold shadow-xl hover:shadow-2xl transition-all flex items-center gap-2 border border-zinc-700/60 active:scale-95"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-300" />
              <span>Go to Admin Console (/admin)</span>
            </Link>
          </div>
        }
      />
      <Route path="/admin" element={<ProtectedAdminRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
