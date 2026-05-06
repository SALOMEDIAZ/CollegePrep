import { Navigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import supabase from "../services/supabaseClient";
import { NavBar } from "../components/Common/NavBar";

interface RequireAuthProps {
  children: ReactNode;
}

const RequireAuth = ({ children }: RequireAuthProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      setIsAuthenticated(Boolean(data.user && !error));
      setLoading(false);
    };

    checkUser();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      checkUser();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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
