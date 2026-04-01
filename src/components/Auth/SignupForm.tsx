import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import supabase, { isSupabaseConfigured } from "../../services/supabaseClient";

const SignupForm = () => {
    const navigate = useNavigate();
    const [fullName, setFullName] = useState("");
    const [university, setUniversity] = useState("");
    const [career, setCareer] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!isSupabaseConfigured) {
    setError("Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.");
    return;
    }

    if (!fullName || !email || !password || !confirmPassword) {
    setError("Please fill in all required fields.");
    return;
    }

    if (password.length < 6) {
    setError("Password must be at least 6 characters long.");
    return;
    }

    if (password !== confirmPassword) {
    setError("Passwords do not match.");
    return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
    data: {
    full_name: fullName,
    university,
    career,
        },
    },
    });

    setLoading(false);

    if (error) {
    setError(error.message || "Error during registration");
    return;
    }

    setSuccess(
    "Registration successful, please check your email and then log in.",
    );

    if (data.session) {
        return navigate("/recipes");
    }

    setFullName("");
    setUniversity("");
    setCareer("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
};

return (
    <form onSubmit={onSubmit} style={{ maxWidth: 480, margin: "0 auto" }}>
    <div>
        <label htmlFor="fullName">Full Name</label>
        <input
        id="fullName"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
        />
    </div>

    <div style={{ marginTop: 12 }}>
        <label htmlFor="university">University</label>
        <input
        id="university"
        value={university}
        onChange={(e) => setUniversity(e.target.value)}
        />
    </div>

    <div style={{ marginTop: 12 }}>
        <label htmlFor="career">Career</label>
        <input
        id="career"
        value={career}
        onChange={(e) => setCareer(e.target.value)}
        />
    </div>

    <div style={{ marginTop: 12 }}>
        <label htmlFor="email">Email</label>
        <input
        id="email"
        type="email"
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
        value={password}
        minLength={6}
        onChange={(e) => setPassword(e.target.value)}
        required
        />
    </div>

    <div style={{ marginTop: 12 }}>
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
        <div style={{ color: "crimson", marginTop: 12 }} role="alert">
        {error}
        </div>
    )}

    {success && (
        <div style={{ color: "green", marginTop: 12 }} role="status">
        {success}
        </div>
    )}

    <button type="submit" disabled={loading} style={{ marginTop: 20 }}>
        {loading ? "Cargando..." : "Crear cuenta"}
    </button>
    </form>
);
};

export default SignupForm;
