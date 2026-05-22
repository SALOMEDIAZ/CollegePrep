import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./RequireAuth.tsx";
import ProfilePage from "../pages/ProfilePage.tsx";

// PESADAS: SOLO SE CARGAN CUANDO ENTRAS A ESA RUTA (PROFILE CARGA MAS RAPIDO)
const Landing = lazy(() => import("../pages/LandingPage.tsx"));
const Login = lazy(() => import("../pages/LoginPage.tsx"));
const Signup = lazy(() => import("../pages/SignupPage.tsx"));
const Recipes = lazy(() => import("../pages/RecipesPage.tsx"));
const RecipeDetailPage = lazy(() => import("../pages/RecipeDetailPage.tsx"));
const PlannerPage = lazy(() => import("../pages/PlannerPage.tsx"));
const SettingsPage = lazy(() => import("../pages/SettingsPage.tsx"));

const routeFallback = <div className="profile-page-bg" aria-hidden />;

// aquí defino todas las rutas de la aplicación
function AppRouter() {
  return (
    <HashRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route
          path="/landing"
          element={
            <Suspense fallback={routeFallback}>
              <Landing />
            </Suspense>
          }
        />
        <Route
          path="/login"
          element={
            <Suspense fallback={routeFallback}>
              <Login />
            </Suspense>
          }
        />
        <Route
          path="/register"
          element={
            <Suspense fallback={routeFallback}>
              <Signup />
            </Suspense>
          }
        />
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
              <Suspense fallback={routeFallback}>
                <SettingsPage />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="/recipes"
          element={
            <RequireAuth>
              <Suspense fallback={routeFallback}>
                <Recipes />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="/recipes/:id"
          element={
            <RequireAuth>
              <Suspense fallback={routeFallback}>
                <RecipeDetailPage />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="/mealplan"
          element={
            <RequireAuth>
              <Suspense fallback={routeFallback}>
                <PlannerPage />
              </Suspense>
            </RequireAuth>
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default AppRouter;
