import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAdmin from '../hooks/useAdmin';
import { getUsers, deleteUser } from '../services/roleService';
import UserForm from '../components/Admin/UserForm';
import '../styles/admin.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const isAdmin = useAdmin();
  const loading = false;
  const [users, setUsers] = useState<Array<{uid: string; role: string}>>([]);

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
      <table className="w-full mt-8 border-collapse">
        <thead>
          <tr className="border-b border-white">
            <th className="text-left p-2">UID</th>
            <th className="text-left p-2">Papel</th>
            <th className="p-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.uid} className="border-b border-gray-600">
            <td className="p-2">{user.uid}</td>
            <td className="p-2 capitalize">{user.role}</td>
              <td className="p-2">
                <button
                  className="text-red-400 hover:text-red-200 transition"
                  onClick={() => handleDelete(user.uid)}
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
