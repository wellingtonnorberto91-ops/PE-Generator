import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, isAdmin } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

interface Props {
  children: ReactNode;
}

export function RequireAdmin({ children }: Props) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      const admin = await isAdmin(user.uid);
      if (!admin) {
        navigate('/');
        return;
      }
      setChecking(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
