// Navigate redirige si no hay sesion
import { Navigate } from "react-router-dom";
// useEffect para escuchar firebase, useState para saber si hay user
import { useEffect, useState } from "react";
// tipo de las props children
import type { RequireAuthProps } from "../types/auth";
// dispatch de redux
import { useAppDispatch } from "../store/store";
// acciones para guardar o limpiar usuario en el slice profile
import { clearUser, setUser } from "../store/slices/profileSlice";
// helpers de login y listener de sesion
import { firebaseUserToAppUser, subscribeAuth } from "../services/authService";
// instancia auth de firebase ya inicializada
import { auth } from "../services/firebase";
// limpia cache del id de supabase al cerrar sesion
import { clearProfileIdCache } from "../services/profileService";
// limpia cache de la pagina profile en sessionStorage
import { clearProfilePageCache } from "../services/profilePageCache";
// barra de navegacion que va arriba en rutas privadas
import { NavBar } from "../components/Common/NavBar";

// envuelve rutas privadas: si no hay sesion manda a /login
const RequireAuth = ({ children }: RequireAuthProps) => {
  const dispatch = useAppDispatch();
  // si firebase ya tiene user, no mostramos pantalla en blanco al inicio
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(auth.currentUser));
  // loading true solo si aun no sabemos si hay currentUser
  const [loading, setLoading] = useState(() => !auth.currentUser);

  useEffect(() => {
    // hidrata redux con el usuario que ya estaba logueado
    if (auth.currentUser) {
      dispatch(setUser(firebaseUserToAppUser(auth.currentUser)));
    }

    // escucha cambios de sesion (login, logout, token refresh)
    const unsub = subscribeAuth((appUser) => {
      if (appUser) {
        // usuario entro: guardamos en redux y marcamos autenticado
        dispatch(setUser(appUser));
        setIsAuthenticated(true);
      } else {
        // al salir limpiamos caches locales del perfil
        clearProfileIdCache();
        clearProfilePageCache();
        dispatch(clearUser());
        setIsAuthenticated(false);
      }
      // ya sabemos el estado de sesion, quitamos loading
      setLoading(false);
    });

    // al desmontar dejamos de escuchar firebase
    return () => {
      unsub();
    };
  }, [dispatch]);

  // mientras no sabemos si hay sesion, no renderizamos nada
  if (loading) return null;
  // sin sesion redirigimos al login
  if (!isAuthenticated) return <Navigate to="/login" />;

  // con sesion mostramos navbar y el contenido de la ruta hija
  return (
    <>
      <NavBar />
      {children}
    </>
  );
};

export default RequireAuth;
