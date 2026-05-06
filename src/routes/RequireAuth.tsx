import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { RequireAuthProps } from "../types/auth";
import { useAppDispatch } from "../store/store";
import { clearUser, setUser } from "../store/slices/profileSlice";
import { subscribeAuth } from "../services/authService";
import { NavBar } from "../components/Common/NavBar";

const RequireAuth = ({ children }: RequireAuthProps) => {
  const dispatch = useAppDispatch();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeAuth((appUser) => {
      if (appUser) {
        dispatch(setUser(appUser));
        setIsAuthenticated(true);
      } else {
        dispatch(clearUser());
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => {
      unsub();
    };
  }, [dispatch]);

  if (loading) return <div>Cargando...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <>
      <NavBar />
      {children}
    </>
  );
};

export default RequireAuth;
