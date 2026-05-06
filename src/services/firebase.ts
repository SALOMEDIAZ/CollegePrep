import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// VALORES POR DEFECTO DEL PROYECTO; PERMITE SOBRESCRIBIR CON .env (VITE_FIREBASE_*)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyDRo65WY6UkjSPjyYzkUHV0lUmK-6vTI9o",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "collegeprep-433f2.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "collegeprep-433f2",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "collegeprep-433f2.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "482320266458",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:482320266458:web:1a90568daa0740923821e3",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-TJ5L4EYQ1Q",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
