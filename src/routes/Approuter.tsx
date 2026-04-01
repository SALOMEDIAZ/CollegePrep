import { Route, Routes } from "react-router-dom";
import NavBar from "../components/Common/NavBar";
import Login from "../pages/LoginPage";
import Signup from "../pages/SignupPage";
import Recipes from "../pages/RecipesPage";
import RequireAuth from "./RequireAuth";
import Landing from "../pages/LandingPage";
import "./App.css";


function AppRouter() {
return (
    <>
    <NavBar />
    <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Signup />} />

        <Route path="/recipes" element={
            <RequireAuth>
            <Recipes />
            </RequireAuth>
        }/>
        //aqui ponen las otras rutas como profile, settings, etc asi como lo hice yo
        </Routes>
    </>
);
}

export default AppRouter;
