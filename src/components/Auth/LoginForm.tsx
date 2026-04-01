import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import supabase, { isSupabaseConfigured } from "../../services/supabaseClient";

const LoginForm = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!isSupabaseConfigured) {
    setError("Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.");
    return;
    }

    if (!email || !password) {
    setError("Please enter your email and password.");
    return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    });

    setLoading(false);

    if (error) {
    setError(error.message || "Error during login");
    return;
    }

    if (data.session) {
    navigate("/recipes");
    }
};

return (
    <form onSubmit={onSubmit} style={{ maxWidth: 480, margin: "0 auto" }}>
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

    <div style={{ marginTop: 12 }}>
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
        <div style={{ color: "crimson", marginTop: 12 }} role="alert">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} style={{ marginTop: 20 }}>
        {loading ? "Loading..." : "Log in"}
      </button>
    </form>
  );
};

export default LoginForm;
