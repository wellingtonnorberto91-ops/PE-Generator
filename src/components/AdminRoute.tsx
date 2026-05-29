
import AdminDashboard from '../pages/AdminDashboard';
import useAdmin from '../hooks/useAdmin';
import { Navigate } from 'react-router-dom';

export default function AdminRoute() {
  const isAdmin = useAdmin();

  if (!isAdmin) {
    // Redireciona usuários não-admin para a página inicial
    return <Navigate to="/" replace />;
  }

  return <AdminDashboard />;
}
