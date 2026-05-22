import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // SEPARA LIBRERIAS PESADAS (BAJA TBT EN /profile)
        manualChunks(id) {
          if (id.includes("node_modules/firebase")) return "firebase";
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (id.includes("node_modules/@reduxjs") || id.includes("node_modules/react-redux")) {
            return "redux";
          }
        },
      },
    },
  },
});
