import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { RequireAuthProps } from "../types/auth";
import { useAppDispatch } from "../store/store";
import { clearUser, setUser } from "../store/slices/profileSlice";
import { subscribeAuth } from "../services/authService";
import { NavBar } from "../components/Common/NavBar";

// wrapper que protege las rutas privadas, solo deja entrar si estás logueado
const RequireAuth = ({ children }: RequireAuthProps) => {
  const dispatch = useAppDispatch();
  // controlo si el usuario está autenticado
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // controlo si todavía estoy verificando la sesión
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // me suscribo a los cambios de autenticación
    const unsub = subscribeAuth((appUser) => {
      if (appUser) {
        // guardo el usuario en redux
        dispatch(setUser(appUser));
        setIsAuthenticated(true);
      } else {
        // limpio el usuario si cierra sesión
        dispatch(clearUser());
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => {
      unsub();
    };
  }, [dispatch]);

  // mientras cargo, muestro loading
  if (loading) return <div>Cargando...</div>;
  // si no está autenticado, lo mando al login
  if (!isAuthenticated) return <Navigate to="/login" />;

  // si todo está bien, muestro la navbar y el contenido
  return (
    <>
      <NavBar />
      {children}
    </>
  );
};

export default RequireAuth;
