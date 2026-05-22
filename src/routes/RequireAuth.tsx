import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { RequireAuthProps } from "../types/auth";
import { useAppDispatch } from "../store/store";
import { clearUser, setUser } from "../store/slices/profileSlice";
import { firebaseUserToAppUser, subscribeAuth } from "../services/authService";
import { auth } from "../services/firebase";
import { clearProfileIdCache } from "../services/profileService";
import { clearProfilePageCache } from "../services/profilePageCache";
import { NavBar } from "../components/Common/NavBar";

// wrapper que protege las rutas privadas, solo deja entrar si estás logueado
const RequireAuth = ({ children }: RequireAuthProps) => {
  const dispatch = useAppDispatch();
  // SI FIREBASE YA TIENE SESION, NO BLOQUEAMOS LA PANTALLA (MEJORA LCP)
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(auth.currentUser));
  const [loading, setLoading] = useState(() => !auth.currentUser);

  useEffect(() => {
    if (auth.currentUser) {
      dispatch(setUser(firebaseUserToAppUser(auth.currentUser)));
    }

    const unsub = subscribeAuth((appUser) => {
      if (appUser) {
        dispatch(setUser(appUser));
        setIsAuthenticated(true);
      } else {
        clearProfileIdCache();
        clearProfilePageCache();
        dispatch(clearUser());
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => {
      unsub();
    };
  }, [dispatch]);

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <>
      <NavBar />
      {children}
    </>
  );
};

export default RequireAuth;
