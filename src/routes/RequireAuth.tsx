import { Navigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import supabase from "../services/supabaseClient";

interface RequireAuthProps {
    children: ReactNode;
}

const RequireAuth = ({ children }: RequireAuthProps) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

useEffect(() => {
    const checkSession = async () => {
    const { data } = await supabase.auth.getSession();
    setIsAuthenticated(Boolean(data.session));
    setLoading(false);
    };

    checkSession();
}, []);

if (loading) return <div>Cargando...</div>;
if (!isAuthenticated) return <Navigate to="/login" />;

return <>{children}</>;
};

export default RequireAuth;
