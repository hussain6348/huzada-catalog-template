import { useState, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CatalogEngine } from './components/CatalogEngine';
import { Admin } from './pages/Admin';
import { AdminLogin } from './components/AdminLogin';
import { isAuthenticated, AUTH_CHANGE_EVENT } from './lib/auth';

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
          </div>
        }
      />
      <Route path="/admin" element={<ProtectedAdminRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
