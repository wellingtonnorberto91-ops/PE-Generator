import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Função para validar se o usuário tem role admin
export async function isAdmin(uid: string): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    return userDoc.exists() && userDoc.data()?.role === "admin";
  } catch (e) {
    console.error("Erro ao verificar role admin", e);
    return false;
  }
}
export async function setCustomUserClaims(uid: string, claims: Record<string, unknown>) {
  // Placeholder: In production, use a callable Cloud Function or Admin SDK.
  console.warn('setCustomUserClaims should be implemented server‑side.', uid, claims);
}

export async function syncRolesToFirestore(uid: string, isAdmin: boolean) {
  // Sync role document for fallback checks.
  try {
    await setDoc(doc(db, 'roles', uid), { isAdmin });
  } catch (e) {
    console.error('Erro ao sincronizar role no Firestore', e);
  }
}
