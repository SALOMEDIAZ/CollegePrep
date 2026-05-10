import LoginForm from "../components/Auth/LoginForm";
import "../styles/Auth.css";

// página de login
const LoginPage = () => {
  return (
    <main className="auth-page">
      <div className="decor-logo" />
      <div className="decor-bag-red" />
      <div className="decor-bag-bottom" />
      <section className="auth-box">
        <h1>Log In</h1>
        <h3>Welcome back!</h3>
        <LoginForm />
      </section>
    </main>
  );
};

export default LoginPage;
