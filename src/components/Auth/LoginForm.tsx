import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../store/store";
import { setUser } from "../../store/slices/profileSlice";
import { loginUser } from "../../services/authService";
import { friendlyFirebaseAuthMessage } from "../../services/authErrors";

// componente del formulario de login
const LoginForm = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // estados para el email y contraseña
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // controlo si está enviando el formulario
  const [loading, setLoading] = useState(false);
  // mensaje de error si algo falla
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    // valido que los campos no estén vacíos
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      // intento logear al usuario
      const user = await loginUser(email, password);
      // guardo en redux
      dispatch(setUser(user));
      navigate("/recipes");
    } catch (e) {
      setError(friendlyFirebaseAuthMessage(e));
    }

    setLoading(false);
  };

  return (
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

      {error && (
        <div className="auth-message auth-message--error" role="alert">
          {error}
        </div>
      )}

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
