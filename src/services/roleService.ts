import { auth, db } from '../firebase/config';
import { createUserWithEmailAndPassword, deleteUser as firebaseDeleteUser } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

// Helper to set custom claim via callable Cloud Function (placeholder)
async function setCustomUserClaims(uid: string, claims: { admin?: boolean }) {
  // TODO: Implement callable function to set custom claims on server side.
  // This is a placeholder to illustrate the flow.
  console.warn('setCustomUserClaims is not implemented on client side.', uid, claims);
}

export async function getUsers() {
  const usersCol = collection(db, 'users');
  const snapshot = await getDocs(usersCol);
  return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
}

export async function createUser(email: string, password: string, role: 'admin' | 'user') {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;
  // Save user profile in Firestore
  await setDoc(doc(db, 'users', uid), { email, role });
  // Optionally set custom claim
  if (role === 'admin') {
    await setCustomUserClaims(uid, { admin: true });
    // Also store in roles collection for fallback
    await setDoc(doc(db, 'roles', uid), { isAdmin: true });
  } else {
    await setDoc(doc(db, 'roles', uid), { isAdmin: false });
  }
}

export async function updateUserRole(uid: string, role: 'admin' | 'user') {
  // Update role in Firestore users collection
  await setDoc(doc(db, 'users', uid), { role }, { merge: true });
  // Update role mapping in roles collection for fallback
  await setDoc(doc(db, 'roles', uid), { isAdmin: role === 'admin' }, { merge: true });
  // Update custom claim via placeholder callable
  if (role === 'admin') {
    await setCustomUserClaims(uid, { admin: true });
  } else {
    await setCustomUserClaims(uid, { admin: false });
  }
}

export async function deleteUser(uid: string) {
  // Delete from Firestore collections
  await deleteDoc(doc(db, 'users', uid));
  await deleteDoc(doc(db, 'roles', uid));
  // Deleting the auth user requires admin SDK; placeholder here.
  try {
    const user = auth.currentUser;
    if (user && user.uid === uid) {
      await firebaseDeleteUser(user);
    } else {
      console.warn('Cannot delete remote Auth user from client. Use Cloud Function.');
    }
  } catch (e) {
    console.error('Error deleting Auth user:', e);
  }
}
