import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "../pages/LoginPage.tsx";
import Signup from "../pages/SignupPage.tsx";
import Recipes from "../pages/RecipesPage.tsx";
import RecipeDetailPage from "../pages/RecipeDetailPage.tsx";
import PlannerPage from "../pages/PlannerPage.tsx";
import RequireAuth from "./RequireAuth.tsx";
import Landing from "../pages/LandingPage.tsx";
import ProfilePage from "../pages/ProfilePage.tsx";
import SettingsPage from "../pages/SettingsPage.tsx";

// aquí defino todas las rutas de la aplicación
function AppRouter() {
  return (
    <HashRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Routes>
        {/* landing es la página sin autenticación requerida */}
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="/landing" element={<Landing />} />

        {/* rutas de autenticación */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Signup />} />

        {/* rutas protegidas (requieren estar logueado) */}
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/recipes"
          element={
            <RequireAuth>
              <Recipes />
            </RequireAuth>
          }
        />
        <Route
          path="/recipes/:id"
          element={
            <RequireAuth>
              <RecipeDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/mealplan"
          element={
            <RequireAuth>
              <PlannerPage />
            </RequireAuth>
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default AppRouter;
