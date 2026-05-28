// StrictMode ayuda a detectar efectos raros en desarrollo
import { StrictMode } from "react";
// createRoot es la forma moderna de montar react 18
import { createRoot } from "react-dom/client";
// Provider inyecta el store de redux en el arbol
import { Provider } from "react-redux";
// estilos globales (fuentes, reset, variables)
import "./styles/index.css";
// componente raiz con las rutas
import App from "./App.tsx";
// store configurado en store.tsx
import { store } from "./store/store";

// arranca la app en el div#root del index.html
// Provider pasa el store de redux a todos los hijos
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
