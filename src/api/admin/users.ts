import express, { Request, Response } from 'express';
import { db } from '../../firebase/config';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const router = express.Router();

// GET all users (admin only)
router.get('/users', async (req: Request, res: Response) => {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const users = snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }));
    res.json(users);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST create user (admin only) - expects email, password, role
router.post('/users', async (req: Request, res: Response) => {
  const { uid, email, role } = req.body;
  if (!uid || !email) {
    return res.status(400).json({ error: 'uid and email required' });
  }
  try {
    await setDoc(doc(db, 'users', uid), { email, role: role || 'user' });
    res.status(201).json({ message: 'User created' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT update user role or data
router.put('/users/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params;
  const { email, role } = req.body;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { email, role }, { merge: true });
    res.json({ message: 'User updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE user
router.delete('/users/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params;
  try {
    await deleteDoc(doc(db, 'users', uid));
    res.json({ message: 'User deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
