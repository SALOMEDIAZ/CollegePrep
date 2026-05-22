// defineConfig tipa la config de vite
import { defineConfig } from "vite";
// plugin de react con fast refresh
import react from "@vitejs/plugin-react";

// configuracion de vite para desarrollo y build
// https://vite.dev/config/
export default defineConfig({
  // habilita jsx y hmr de react
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // separa librerias pesadas en chunks (mejora carga en /profile)
        manualChunks(id) {
          // todo firebase va en un archivo aparte
          if (id.includes("node_modules/firebase")) return "firebase";
          // supabase tambien en su propio chunk
          if (id.includes("node_modules/@supabase")) return "supabase";
          // redux y react-redux juntos
          if (id.includes("node_modules/@reduxjs") || id.includes("node_modules/react-redux")) {
            return "redux";
          }
        },
      },
    },
  },
});
