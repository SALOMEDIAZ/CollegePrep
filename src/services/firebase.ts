import { initializeApp } from "firebase/app";
import {
  // paso del codigo
  browserLocalPersistence,
  browserSessionPersistence,
  // paso del codigo
  getAuth,
  inMemoryPersistence,
  // paso del codigo
  setPersistence,
} from "firebase/auth";

// configuración de firebase (estos valores los puedo cambiar en el .env)
const firebaseConfig = {
  apiKey:
    // firebase auth o config
    import.meta.env.VITE_FIREBASE_API_KEY ??
    "AIzaSyDRo65WY6UkjSPjyYzkUHV0lUmK-6vTI9o",
  // paso del codigo
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ??
    // firebase auth o config
    "collegeprep-433f2.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "collegeprep-433f2",
  // paso del codigo
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ??
    // firebase auth o config
    "collegeprep-433f2.firebasestorage.app",
  messagingSenderId:
    // firebase auth o config
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "482320266458",
  appId:
    // firebase auth o config
    import.meta.env.VITE_FIREBASE_APP_ID ??
    "1:482320266458:web:1a90568daa0740923821e3",
  // firebase auth o config
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-TJ5L4EYQ1Q",
};

// inicializa la app de firebase con la config de arriba
const app = initializeApp(firebaseConfig);

// auth es lo que usamos para login y registro
export const auth = getAuth(app);

// configuro si quiero que guarde la sesión en local, en memoria o solo de sesión
const persistenceMode = String(
  import.meta.env.VITE_FIREBASE_PERSISTENCE ?? "session",
// paso del codigo
).toLowerCase();
const persistence =
  // paso del codigo
  persistenceMode === "memory"
    ? inMemoryPersistence
    // paso del codigo
    : persistenceMode === "local"
      ? browserLocalPersistence
      // paso del codigo
      : browserSessionPersistence;

void setPersistence(auth, persistence);
