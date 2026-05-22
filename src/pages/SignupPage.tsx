// formulario de registro con firebase
import SignupForm from "../components/Auth/SignupForm";
// mismos estilos que login (fondo crema y decoraciones)
import "../styles/Auth.css";

// página para crear una cuenta
const SignupPage = () => {
  return (
    <main className="auth-page">
      {/* logo decorativo */}
      <div className="decor-logo" />
      <div className="decor-bag-red" />
      <div className="decor-bag-bottom" />
      <section className="auth-box">
        <h1>Create an account</h1>
        <h3>Sign up to get started</h3>
        <SignupForm />
      </section>
    </main>
  );
};
export default SignupPage;
