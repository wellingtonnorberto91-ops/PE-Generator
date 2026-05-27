import React, { useState } from 'react';
import { createUser } from '../../services/roleService';

export default function UserForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createUser(email, password, role);
      setEmail('');
      setPassword('');
      setRole('user');
      onSuccess();
    } catch (err) {
      console.error(err);
      setError('Falha ao criar usuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="bg-bg p-6 rounded" onSubmit={handleSubmit} style={{ backgroundColor: 'var(--color-bg)' }}>
      <h2 className="text-2xl mb-4" style={{ color: 'var(--color-primary)' }}>Criar Usuário</h2>
      {error && <p className="text-red-400 mb-2">{error}</p>}
      <div className="mb-4">
        <label className="block mb-1" style={{ color: 'var(--color-primary)' }}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1" style={{ color: 'var(--color-primary)' }}>Senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1" style={{ color: 'var(--color-primary)' }}>Papel</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value as 'admin' | 'user')}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="user">Usuário</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {loading ? 'Criando...' : 'Criar'}
      </button>
    </form>
  );
}
