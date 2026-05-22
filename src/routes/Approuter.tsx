// lazy y Suspense para cargar paginas solo cuando entras a la ruta
import { lazy, Suspense } from "react";
// router con hash (#) para que funcione en hosting estatico
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
// wrapper que pide login en rutas privadas
import RequireAuth from "./RequireAuth.tsx";
// perfil sin lazy porque queremos que abra rapido
import ProfilePage from "../pages/ProfilePage.tsx";

// paginas pesadas: lazy import para no cargarlas hasta entrar a la ruta
const Landing = lazy(() => import("../pages/LandingPage.tsx"));
const Login = lazy(() => import("../pages/LoginPage.tsx"));
const Signup = lazy(() => import("../pages/SignupPage.tsx"));
const Recipes = lazy(() => import("../pages/RecipesPage.tsx"));
const RecipeDetailPage = lazy(() => import("../pages/RecipeDetailPage.tsx"));
const PlannerPage = lazy(() => import("../pages/PlannerPage.tsx"));
const SettingsPage = lazy(() => import("../pages/SettingsPage.tsx"));

// placeholder minimo mientras carga el chunk de la pagina
const routeFallback = <div className="profile-page-bg" aria-hidden />;

// define todas las rutas; hash router para deploy estatico
function AppRouter() {
  return (
    <HashRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Routes>
        {/* raiz redirige a landing */}
        <Route path="/" element={<Navigate to="/landing" replace />} />
        {/* pagina publica de bienvenida */}
        <Route
          path="/landing"
          element={
            <Suspense fallback={routeFallback}>
              <Landing />
            </Suspense>
          }
        />
        {/* formulario de login */}
        <Route
          path="/login"
          element={
            <Suspense fallback={routeFallback}>
              <Login />
            </Suspense>
          }
        />
        {/* registro de cuenta nueva */}
        <Route
          path="/register"
          element={
            <Suspense fallback={routeFallback}>
              <Signup />
            </Suspense>
          }
        />
        {/* perfil sin lazy: queremos que cargue rapido */}
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        {/* ajustes del usuario, requiere sesion */}
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
        {/* listado de recetas */}
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
        {/* detalle de una receta por id */}
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
        {/* meal plan semanal */}
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
