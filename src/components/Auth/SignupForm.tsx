import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../store/store";
import { setUser } from "../../store/slices/profileSlice";
import { registerUser } from "../../services/authService";
import { friendlyFirebaseAuthMessage } from "../../services/authErrors";
import { ensureProfileRow, upsertProfile } from "../../services/profileService";

// componente para crear una cuenta nueva
const SignupForm = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // estados del formulario
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [career, setCareer] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // estados para controlar el proceso
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    // valido que todos los campos obligatorios estén llenos
    if (!fullName || !email || !password || !confirmPassword) {
      setError("Please fill in all required fields.");
      return;
    }

    // valido la contraseña
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    // me aseguro que las contraseñas coincidan
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // creo el usuario en firebase
      const user = await registerUser(email, password, {
        displayName: fullName,
      });

      // creo un registro en supabase para guardar datos extra
      const { profile, error: profErr } = await ensureProfileRow(user.id);
      if (!profErr && profile) {
        await upsertProfile(user.id, {
          full_name: fullName,
          university,
          career,
        });
      }

      // guardo en redux
      dispatch(setUser(user));
      setSuccess(
        "Registration successful, please check your email and then log in.",
      );
      navigate("/recipes");

      // limpio el formulario
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
