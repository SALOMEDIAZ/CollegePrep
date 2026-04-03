import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import supabase from "../../services/supabaseClient";
import "./NavBar.css";

export const NavBar = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(Boolean(data.session));
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setIsAuthenticated(Boolean(session));
      },
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <header className="navbar-landing">
        <div className="navbar-brand">
          <img
            src="/assets/images-icons/Logo.png"
            alt="CollegePrep"
            className="navbar-logo"
          />
        </div>

        <nav className="navbar-actions">
          <Link to="/login" className="nav-link">
            Log in
          </Link>
          <Link to="/register" className="cta-btn">
            Get Started
          </Link>
        </nav>
      </header>
    );
  }

  return (
    <header className="navbar navbar-auth">
      <div className="navbar-content">
        <div className="auth-left">
          <Link to="/" className="navbar-brand" aria-label="CollegePrep Home">
            <img
              src="/assets/images-icons/Logo.png"
              alt="CollegePrep"
              className="navbar-logo"
            />
          </Link>
          <Link to="/recipes" className="nav-item">
            Recipes
          </Link>
          <Link to="/mealplan" className="nav-item">
            Meal plan
          </Link>
        </div>

        <div className="auth-right">
          <Link to="/profile" className="user-icon" aria-label="Profile">
            <img
              src="/assets/images-icons/usuario%201.png"
              alt="Usuario"
              className="icon-image"
            />
          </Link>
        </div>
      </div>
    </header>
  );
};
