import { Navigate, Route, Routes } from 'react-router-dom';
import { Catalog } from './pages/Catalog';
import { AdminPage } from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Catalog />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
