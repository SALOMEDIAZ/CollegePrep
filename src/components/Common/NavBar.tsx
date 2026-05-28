import { useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/NavBar.css";

// barra de navegacion que aparece en las paginas con sesion
export const NavBar = () => {
  // estado para saber si el menu movil esta abierto
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // handler: abre o cierra el menu hamburguesa
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  // handler: cierra el menu al hacer click en un link
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="navbar navbar-auth">
      <div className="navbar-content">
        <div className="auth-left">
          {/* logo lleva al home y cierra el menu movil */}
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
          {/* links principales solo en escritorio */}
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
          {/* icono de perfil */}
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
          {/* boton hamburguesa: onClick usa toggleMenu */}
          <button
            className="hamburger"
            onClick={toggleMenu}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            {/* las lineas cambian de clase si isMenuOpen es true */}
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

      {/* menu movil: solo se muestra si isMenuOpen */}
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
