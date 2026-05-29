import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAdmin from '../hooks/useAdmin';
import { getUsers, deleteUser } from '../services/roleService';
import UserForm from '../components/Admin/UserForm';
import { UserTable } from '../components/Admin/UserTable';
import '../styles/admin.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const isAdmin = useAdmin();
  const loading = false;
  const [users, setUsers] = useState<Array<{uid: string; role?: string}>>([]);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/login');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      getUsers().then(setUsers);
    }
  }, [isAdmin]);

  const handleDelete = async (uid: string) => {
    await deleteUser(uid);
    setUsers(prev => prev.filter(u => u.uid !== uid));
  };

  return (
    <div className="admin-dashboard p-8 bg-bg text-white" style={{ backgroundColor: 'var(--color-bg)' }}>
      <h1 className="text-4xl font-bold mb-6" style={{ color: 'var(--color-primary)' }}>Painel de Administrador</h1>
      <UserForm onSuccess={() => getUsers().then(setUsers)} />
      <UserTable users={users} onDelete={handleDelete} />
    </div>
  );
}
