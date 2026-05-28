// autoprefixer agrega prefijos -webkit para viejos navegadores
import autoprefixer from "autoprefixer";
// tailwind genera utilidades desde clases en jsx
import tailwindcss from "tailwindcss";

// postcss procesa el css antes de mandarlo al navegador
export default {
  // primero tailwind luego autoprefixer
  plugins: [tailwindcss, autoprefixer],
// parte del flujo que explica el paso a paso
};
