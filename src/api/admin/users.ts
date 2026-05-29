// src/api/admin/users.ts
import { auth, db } from '../../firebase/config';
import { createUserWithEmailAndPassword, deleteUser as firebaseDeleteUser } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

/** Retrieve all users */
export async function getUsers() {
  const usersCol = collection(db, 'users');
  const snapshot = await getDocs(usersCol);
  return snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
}

/** Create a new user with role */
export async function createUser(email: string, password: string, role: 'admin' | 'user') {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await setDoc(doc(db, 'users', uid), { email, role });
  await setDoc(doc(db, 'roles', uid), { isAdmin: role === 'admin' });
}

/** Update user role */
export async function updateUserRole(uid: string, role: 'admin' | 'user') {
  await setDoc(doc(db, 'users', uid), { role }, { merge: true });
  await setDoc(doc(db, 'roles', uid), { isAdmin: role === 'admin' }, { merge: true });
}

/** Delete a user (Firestore records; client‑side Auth deletion if possible) */
export async function deleteUser(uid: string) {
  await deleteDoc(doc(db, 'users', uid));
  await deleteDoc(doc(db, 'roles', uid));
  try {
    const current = auth.currentUser;
    if (current && current.uid === uid) {
      await firebaseDeleteUser(current);
    }
  } catch (e) {
    console.warn('Client‑side user deletion failed; use server function.', e);
  }
}
