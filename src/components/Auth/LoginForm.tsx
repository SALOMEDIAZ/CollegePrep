import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../store/store";
import { setUser } from "../../store/slices/profileSlice";
import { loginUser } from "../../services/authService";
import { writeProfilePageCache } from "../../services/profilePageCache";
import { friendlyFirebaseAuthMessage } from "../../services/authErrors";

// formulario de inicio de sesion
const LoginForm = () => {
  // hook de react router para redirigir despues del login
  const navigate = useNavigate();
  // hook de redux para guardar el usuario en el store
  const dispatch = useAppDispatch();

  // estados controlados del formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // loading mientras esperamos firebase
  const [loading, setLoading] = useState(false);
  // mensaje de error para mostrar al usuario
  const [error, setError] = useState("");

  // handler del submit del form
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    // validacion basica antes de llamar al servicio
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      // login con firebase auth
      const user = await loginUser(email, password);
      // guardamos el usuario en redux
      dispatch(setUser(user));
      // precargamos el perfil en segundo plano para que /profile abra mas rapido
      void import("../../services/profileService").then(({ loadProfilePageData }) =>
        loadProfilePageData(user.id),
      ).then(async ({ profile: p, dbUserId }) => {
        if (!p || !dbUserId) return;
        const { fetchWeeklyBudgetUsedPercent } = await import("../../services/profileService");
        const budgetPct = await fetchWeeklyBudgetUsedPercent(user.id, dbUserId);
        writeProfilePageCache({
          uid: user.id,
          dbUserId,
          profile: p,
          budgetPct,
        });
      });
      navigate("/recipes");
    } catch (e) {
      setError(friendlyFirebaseAuthMessage(e));
    }

    setLoading(false);
  };

  return (
    // onSubmit enlaza el handler cuando envian el form
    <form onSubmit={onSubmit} className="auth-form">
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
      </div>

      {/* solo mostramos el error si hay texto en el state */}
      {error && (
        <div className="auth-message auth-message--error" role="alert">
          {error}
        </div>
      )}

      {/* el boton se deshabilita mientras loading es true */}
      <button type="submit" disabled={loading} className="auth-submit">
        {loading ? "Loading..." : "Log in"}
      </button>
      <div className="auth-link">
        <span>Don't have an account?</span>{" "}
        <Link to="/register">Create an account</Link>
      </div>
    </form>
  );
};

export default LoginForm;
