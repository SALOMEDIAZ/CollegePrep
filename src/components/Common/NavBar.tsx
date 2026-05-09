import { useState } from "react";
import { Link } from "react-router-dom";
import "./NavBar.css";

// barra de navegación que aparece en todas las páginas autenticadas
export const NavBar = () => {
  // controlo si el menú móvil está abierto
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // abro o cierro el menú
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  // cierro el menú (cuando hago click en un link)
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="navbar navbar-auth">
      <div className="navbar-content">
        <div className="auth-left">
          <Link
            to="/"
            className="navbar-brand"
            onClick={closeMenu}
            aria-label="CollegePrep Home"
          >
            <img
              src="/assets/images-icons/Logo.png"
              alt="CollegePrep"
              className="navbar-logo"
            />
          </Link>
          {/* menú de escritorio */}
          <nav className="nav-items-desktop">
            <Link to="/recipes" className="nav-item">
              Recipes
            </Link>
            <Link to="/mealplan" className="nav-item">
              Meal plan
            </Link>
          </nav>
        </div>

        <div className="auth-right">
          <Link
            to="/profile"
            className="user-icon"
            onClick={closeMenu}
            aria-label="Profile"
          >
            <img
              src="/assets/images-icons/usuario%201.png"
              alt="Usuario"
              className="icon-image"
            />
          </Link>
          {/* botón de hamburguesa para móvil */}
          <button
            className="hamburger"
            onClick={toggleMenu}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            <span
              className={`hamburger-line ${isMenuOpen ? "line-1" : ""}`}
            ></span>
            <span
              className={`hamburger-line ${isMenuOpen ? "line-2" : ""}`}
            ></span>
            <span
              className={`hamburger-line ${isMenuOpen ? "line-3" : ""}`}
            ></span>
          </button>
        </div>
      </div>

      {/* menú móvil que aparece cuando abro el hamburger */}
      {isMenuOpen && (
        <nav className="mobile-menu">
          <Link to="/recipes" className="nav-item" onClick={closeMenu}>
            Recipes
          </Link>
          <Link to="/mealplan" className="nav-item" onClick={closeMenu}>
            Meal plan
          </Link>
        </nav>
      )}
    </header>
  );
};
