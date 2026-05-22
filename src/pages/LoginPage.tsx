// formulario reutilizable con la logica de firebase
import LoginForm from "../components/Auth/LoginForm";
// estilos de login y registro (fondo, caja, decoraciones)
import "../styles/Auth.css";

// página de login
const LoginPage = () => {
  return (
    // contenedor full screen con decoraciones de fondo
    <main className="auth-page">
      {/* logo decorativo arriba a la izquierda */}
      <div className="decor-logo" />
      {/* bolsa roja decorativa */}
      <div className="decor-bag-red" />
      {/* otra bolsa abajo */}
      <div className="decor-bag-bottom" />
      {/* caja blanca con el formulario */}
      <section className="auth-box">
        <h1>Log In</h1>
        <h3>Welcome back!</h3>
        <LoginForm />
      </section>
    </main>
  );
};

export default LoginPage;
