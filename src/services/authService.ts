import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import type { AppUser } from "../types/user";
import { auth } from "./firebase";

// CONVIERTE USUARIO DE FIREBASE A OBJETO PARA REDUX
export function firebaseUserToAppUser(u: FirebaseUser): AppUser {
  return {
    id: u.uid,
    email: u.email ?? "",
    displayName: u.displayName,
    photoURL: u.photoURL,
  };
}

// ESTO HACE LOGIN
export async function loginUser(email: string, password: string): Promise<AppUser> {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return firebaseUserToAppUser(res.user);
}

type RegisterExtras = {
  displayName: string;
};

// REGISTRO CON EMAIL Y CONTRASENA
export async function registerUser(
  email: string,
  password: string,
  extras: RegisterExtras,
): Promise<AppUser> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (extras.displayName.trim()) {
    await updateProfile(cred.user, { displayName: extras.displayName.trim() });
    await cred.user.reload();
  }
  return firebaseUserToAppUser(cred.user);
}

// CIERRA SESION EN FIREBASE
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// CALLBACK CUANDO CAMBIA EL USUARIO DE AUTH (LOGIN / LOGOUT)
export function subscribeAuth(callback: (user: AppUser | null) => void) {
  return onAuthStateChanged(auth, (u) => {
    callback(u ? firebaseUserToAppUser(u) : null);
  });
}

// UID ACTUAL DESPUES DE QUE AUTH ESTA LISTO (PARA SERVICES)
export async function getSessionUserId(): Promise<string | null> {
  await auth.authStateReady();
  return auth.currentUser?.uid ?? null;
}

// ACTUALIZAR EMAIL DEL USUARIO
export async function updateUserEmail(newEmail: string): Promise<{ error: Error | null }> {
  await auth.authStateReady();
  const u = auth.currentUser;
  if (!u) return { error: new Error("No session") };
  try {
    await updateEmail(u, newEmail.trim());
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
