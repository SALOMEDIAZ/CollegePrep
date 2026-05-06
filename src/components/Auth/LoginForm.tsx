import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../store/store";
import { setUser } from "../../store/slices/profileSlice";
import { loginUser } from "../../services/authService";

const LoginForm = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      // ESTO HACE LOGIN
      const user = await loginUser(email, password);
      // ESTO GUARDA EN REDUX
      dispatch(setUser(user));
      navigate("/recipes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error during login");
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
