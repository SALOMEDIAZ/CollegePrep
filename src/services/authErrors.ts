import { FirebaseError } from "firebase/app";

// MENSAJES CLAROS EN INGLES PARA ERRORES DE FIREBASE AUTH
export function friendlyFirebaseAuthMessage(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email or password is not correct. Please check and try again.";
    case "auth/invalid-email":
      return "That email does not look valid. Please check and try again.";
    case "auth/invalid-api-key":
      return "Firebase is misconfigured (invalid API key). Copy the web API key from the Firebase console into .env as VITE_FIREBASE_API_KEY.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a minute and try again.";
    case "auth/email-already-in-use":
      return "This email is already in use. Try logging in instead.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/requires-recent-login":
      return "For security, log out and log in again, then try changing your email.";
    default:
      return "Something went wrong. Please try again.";
  }
}
