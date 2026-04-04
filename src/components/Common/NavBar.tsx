import { Link } from "react-router-dom";
import "./NavBar.css";

export const NavBar = () => {
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
          <div className="nav-items-desktop">
            <Link to="/recipes" className="nav-item">
              Recipes
            </Link>
            <Link to="/mealplan" className="nav-item">
              Meal plan
            </Link>
          </div>
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
