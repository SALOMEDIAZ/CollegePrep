import { Navigate, Route, Routes } from "react-router-dom";
import Login from "../pages/LoginPage.tsx";
import Signup from "../pages/SignupPage.tsx";
import Recipes from "../pages/RecipesPage.tsx";
import RecipeDetailPage from "../pages/RecipeDetailPage.tsx";
import PlannerPage from "../pages/PlannerPage.tsx";
import RequireAuth from "./RequireAuth.tsx";
import Landing from "../pages/LandingPage.tsx";
import ProfilePage from "../pages/ProfilePage.tsx";
import SettingsPage from "../pages/SettingsPage.tsx";
import "./App.css";

function AppRouter() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Signup />} />
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
    </>
  );
}

export default AppRouter;
