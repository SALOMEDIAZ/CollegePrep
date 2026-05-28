// el router define todas las rutas de la app
import AppRouter from "./routes/Approuter";

// componente principal de la app
// solo renderiza el router, sin layout extra
const App = () => {
  return <AppRouter />;
};

export default App;
