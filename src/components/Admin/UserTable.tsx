// src/components/Admin/UserTable.tsx
import type { FC } from 'react';

interface User {
  uid: string;
  email?: string;
  role?: string;
}

interface Props {
  users: User[];
  onDelete: (uid: string) => void;
}

/**
 * Tabela brutalista que lista usuários e permite excluir.
 * Estilo agressivo: cores primárias, bordas nítidas e animações de hover.
 */
export const UserTable: FC<Props> = ({ users, onDelete }) => {
  return (
    <table className="w-full border-collapse text-left text-sm text-white">
      <thead>
        <tr className="border-b border-primary">
          <th className="p-2">UID</th>
          <th className="p-2">Email</th>
          <th className="p-2">Papel</th>
          <th className="p-2">Ações</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.uid} className="border-b border-gray-700 hover:bg-gray-800 transition-colors">
            <td className="p-2 break-all">{user.uid}</td>
            <td className="p-2">{user.email ?? '-'} </td>
            <td className="p-2 capitalize">{user.role ?? '-'} </td>
            <td className="p-2">
              <button
                className="text-red-400 hover:text-red-200 transition-colors"
                onClick={() => onDelete(user.uid)}
              >
                Excluir
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
