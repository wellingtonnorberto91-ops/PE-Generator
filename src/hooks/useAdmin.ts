import { useEffect, useState } from 'react';
import { auth } from '../firebase/config';
import { isAdmin } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function useAdmin() {
  const [admin, setAdmin] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const adminFlag = await isAdmin(user.uid);
        setAdmin(adminFlag);
        if (!adminFlag) {
          // Redirect non-admin users to home or login
          navigate('/', { replace: true });
        }
      } else {
        setAdmin(false);
        navigate('/login', { replace: true });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  return admin;
}
