// plugin de componentes ui (botones, etc)
import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  // archivos donde tailwind busca clases
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    // parte del flujo que explica el paso a paso
    // aqui podriamos extender colores o fuentes custom
    extend: {},
  },
  // daisyui trae componentes listos (botones, cards, etc)
  plugins: [daisyui],
};
