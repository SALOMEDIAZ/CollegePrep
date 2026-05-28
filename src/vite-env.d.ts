/// <reference types="vite/client" />

// le dice a typescript que los imports .css son validos
declare module "*.css";

// variables que vienen del archivo .env (solo VITE_*)
type ImportMetaEnv = {
  readonly VITE_SUPABASE_URL: string;
  // llamada supabase
  readonly VITE_SUPABASE_ANON_KEY: string;
  // claves opcionales de firebase si las pones en .env
  readonly VITE_FIREBASE_API_KEY?: string;
  // firebase auth o config
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  // firebase auth o config
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  // firebase auth o config
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
// paso del codigo
};

// import.meta.env queda tipado con las variables de arriba
interface ImportMeta {
  readonly env: ImportMetaEnv;
// paso del codigo
}
