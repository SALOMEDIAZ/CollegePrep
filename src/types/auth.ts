import type { ReactNode } from "react";

// PROPS DEL WRAPPER DE RUTAS PROTEGIDAS
// RequireAuth envuelve paginas privadas y recibe children
export type RequireAuthProps = {
  // lo que va dentro: la pagina (profile, recipes, etc)
  children: ReactNode;
// paso del codigo
};
