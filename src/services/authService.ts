// funciones de firebase auth que usa la app
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
// tipo liviano que guardamos en redux
import type { AppUser } from "../types/user";
// instancia auth ya configurada en firebase.ts
import { auth } from "./firebase";

// pasa el usuario de firebase al formato de la app
export function firebaseUserToAppUser(u: FirebaseUser): AppUser {
  return {
    // uid de firebase es nuestro id
    id: u.uid,
    email: u.email ?? "",
    displayName: u.displayName,
    photoURL: u.photoURL,
  };
}

// login con email y password
export async function loginUser(
  email: string,
  password: string,
): Promise<AppUser> {
  // signIn devuelve credencial con el user
  const res = await signInWithEmailAndPassword(auth, email, password);
  return firebaseUserToAppUser(res.user);
}

// datos extra al registrarse (nombre para mostrar)
type RegisterExtras = {
  displayName: string;
};

// registro: crea cuenta y opcionalmente pone nombre
export async function registerUser(
  email: string,
  password: string,
  extras: RegisterExtras,
): Promise<AppUser> {
  // crea el usuario en firebase auth
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // si escribio nombre lo guardamos en el perfil de firebase
  if (extras.displayName.trim()) {
    await updateProfile(cred.user, { displayName: extras.displayName.trim() });
    await cred.user.reload();
  }
  return firebaseUserToAppUser(cred.user);
}

// cierra sesion en firebase
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// escucha cuando el usuario entra o sale
export function subscribeAuth(callback: (user: AppUser | null) => void) {
  // onAuthStateChanged avisa en login, logout y refresh
  return onAuthStateChanged(auth, (u) => {
    callback(u ? firebaseUserToAppUser(u) : null);
  });
}

// uid actual despues de que firebase este listo
export async function getSessionUserId(): Promise<string | null> {
  // espera a que firebase termine de leer la sesion guardada
  await auth.authStateReady();
  return auth.currentUser?.uid ?? null;
}

// cambia email del usuario logueado
export async function updateUserEmail(
  newEmail: string,
): Promise<{ error: Error | null }> {
  await auth.authStateReady();
  const u = auth.currentUser;
  // sin usuario logueado no podemos cambiar email
  if (!u) return { error: new Error("No session") };
  try {
    await updateEmail(u, newEmail.trim());
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
