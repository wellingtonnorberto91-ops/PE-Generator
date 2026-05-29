import { NextFunction, Request, Response } from 'express';
import { getAuth } from 'firebase/auth';
import { isAdmin } from '../firebase/config';

// Middleware for Express-like usage in Vite dev server (using vite-plugin-middleware or similar)
export async function authAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token missing' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const user = await getAuth().verifyIdToken(idToken);
    const admin = await isAdmin(user.uid);
    if (!admin) {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }
    // Attach uid to request for downstream handlers if needed
    (req as Request & { uid?: string }).uid = user.uid;
    next();
  } catch (e) {
    console.error('Auth admin error', e);
    return res.status(401).json({ message: 'Invalid token' });
  }
}
