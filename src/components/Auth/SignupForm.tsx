import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../store/store";
import { setUser } from "../../store/slices/profileSlice";
import { registerUser } from "../../services/authService";
import { friendlyFirebaseAuthMessage } from "../../services/authErrors";
import { ensureProfileRow, upsertProfile } from "../../services/profileService";

// formulario para registrar un usuario nuevo
const SignupForm = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // estados de cada campo del formulario
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [career, setCareer] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // estados de ui: carga, error y mensaje de exito
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    // validamos campos obligatorios
    if (!fullName || !email || !password || !confirmPassword) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    // las dos contrasenas deben coincidir
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // creamos la cuenta en firebase
      const user = await registerUser(email, password, {
        displayName: fullName,
      });

      // guardamos datos extra en supabase (perfil)
      const { profile, error: profErr } = await ensureProfileRow(user.id);
      if (!profErr && profile) {
        await upsertProfile(user.id, {
          full_name: fullName,
          university,
          career,
        });
      }

      dispatch(setUser(user));
      setSuccess(
        "Registration successful, please check your email and then log in.",
      );
      navigate("/recipes");

      // limpiamos el form despues de registrar
      setFullName("");
      setUniversity("");
      setCareer("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(friendlyFirebaseAuthMessage(e));
    }

    setLoading(false);
  };

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <div>
        <label htmlFor="fullName">Full Name</label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="university">University</label>
        <input
          id="university"
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="career">Career</label>
        <input
          id="career"
          value={career}
          onChange={(e) => setCareer(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
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
          value={password}
          minLength={6}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <div className="auth-message auth-message--error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="auth-message auth-message--success" role="status">
          {success}
        </div>
      )}

      <button type="submit" disabled={loading} className="auth-submit">
        {loading ? "Loading..." : "Create Account"}
      </button>
      <div className="auth-link">
        <span>Already have an account?</span> <Link to="/login">Log In</Link>
      </div>
    </form>
  );
};

export default SignupForm;
