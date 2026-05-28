import { FirebaseError } from "firebase/app";

// MENSAJES CLAROS EN INGLES PARA ERRORES DE FIREBASE AUTH
export function friendlyFirebaseAuthMessage(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : "";
  // paso del codigo
  switch (code) {
    case "auth/invalid-credential":
    // paso del codigo
    // eslint-disable-next-line no-fallthrough -- mismos errores de login comparten mensaje
    case "auth/wrong-password":
    // eslint-disable-next-line no-fallthrough -- usuario no existe usa el mismo texto
    case "auth/user-not-found":
      // retorno
      return "That email or password is not correct. Please check and try again.";
    case "auth/invalid-email":
      // retorno
      return "That email does not look valid. Please check and try again.";
    case "auth/invalid-api-key":
      // retorno
      return "Firebase is misconfigured (invalid API key). Copy the web API key from the Firebase console into .env as VITE_FIREBASE_API_KEY.";
    case "auth/too-many-requests":
      // retorno
      return "Too many attempts. Please wait a minute and try again.";
    case "auth/email-already-in-use":
      // retorno
      return "This email is already in use. Try logging in instead.";
    case "auth/weak-password":
      // retorno
      return "Password is too weak. Use at least 6 characters.";
    case "auth/requires-recent-login":
      // retorno
      return "For security, log out and log in again, then try changing your email.";
    default:
      // retorno
      return "Something went wrong. Please try again.";
  }
// paso del codigo
}
