import { Link } from "react-router-dom";
import "../styles/landing.css";

// imagen del hero de la landing
const asset = (f: string) => `/assets/main/${encodeURIComponent(f)}`;
const LANDING_HERO =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80";

// página de landing (la que ven sin registrarse)
export default function Landing() {
  return (
    <div className="landing-page-root landing-shell" data-theme="light">
      {/* header con logo y botones de login/signup */}
      <header className="landing-header">
        <div className="landing-header-left">
          <Link to="/landing" className="landing-logo">
            <span className="landing-logo-green">College</span>
            <span className="landing-logo-orange">Prep</span>
          </Link>
        </div>
        <div className="landing-header-actions">
          <Link to="/login" className="landing-login">
            Log in
          </Link>
          <Link
            to="/register"
            className="btn btn-sm px-6 md:btn-md landing-btn-primary"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* sección hero con el pitch principal */}
      <section className="landing-hero-wrap">
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <h1 className="landing-hero-title">
              Smart Meal Planning for{" "}
              <span className="landing-hero-accent">Busy Students</span>
            </h1>
            <p className="landing-hero-p">
              Plan affordable, balanced meals around your class schedule.
              CollegePrep helps you shop smarter, cook with confidence, and skip
              the stress of last-minute food decisions.
            </p>
            <Link
              to="/register"
              className="landing-hero-cta landing-btn-primary"
            >
              Get Started
            </Link>
          </div>
          <div className="landing-hero-img-wrap">
            <img
              src={LANDING_HERO}
              alt="Fresh vegetables and healthy ingredients on a plate"
              className="landing-hero-img"
            />
          </div>
        </div>
      </section>

      {/* sección de características */}
      <section className="landing-section" aria-labelledby="why-heading">
        <div className="landing-section-inner">
          <h2 id="why-heading" className="landing-section-title">
            Why Choose Us
          </h2>
          <div className="landing-section-img-wrap">
            <img
              src={asset("Group 30.png")}
              alt="Recipe Finder, Budget Tracker, and Set Your Preferences"
              className="landing-section-img-wide"
            />
          </div>
        </div>
      </section>

      {/* sección about us */}
      <section className="landing-about" aria-labelledby="about-heading">
        <div className="landing-about-grid">
          <div className="landing-about-text-col">
            <h2 id="about-heading" className="landing-about-h">
              About Us
            </h2>
            <p className="landing-about-p">
              CollegePrep was built for students who are juggling lectures,
              work, and tight budgets. We combine recipe discovery, realistic
              cost estimates, and personal preferences so you can eat well
              without overspending.
            </p>
          </div>
          <div className="landing-about-img-col">
            <img
              src={asset("Group 21.png")}
              alt="Healthy meal and CollegePrep lifestyle"
              className="landing-about-img"
            />
          </div>
        </div>
      </section>

      {/* sección highlight */}
      <section
        className="landing-highlight"
        aria-labelledby="highlight-heading"
      >
        <div className="landing-highlight-inner">
          <div className="landing-highlight-img-wrap"></div>
        </div>
      </section>

      {/* call to action */}
      <section className="landing-cta-band">
        <div className="landing-cta-inner">
          <p className="landing-cta-line1">
            No more overspending. No more last-minute fast food.
          </p>
          <p className="landing-cta-line2">
            Be part of our community of students who share the same challenges
            as you.
          </p>
          <Link to="/register" className="landing-cta-btn landing-btn-primary">
            Get Started
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <aside className="landing-footer-aside">
            <p className="landing-footer-brand">
              <span className="landing-footer-brand-green">College</span>
              <span className="landing-footer-brand-orange">Prep</span>
            </p>
            <p className="landing-footer-aside-p">
              Smart meal planning tailored to student life—budgets, tastes, and
              busy schedules in one place.
            </p>
          </aside>
          <div className="landing-footer-cols">
            <nav className="landing-footer-nav">
              <p className="landing-footer-nav-h">About the app</p>
              <Link to="/landing" className="landing-footer-link">
                Landing
              </Link>
              <a href="#" className="landing-footer-link">
                Pricing
              </a>
              <a href="#" className="landing-footer-link">
                FAQ
              </a>
            </nav>
            <nav className="landing-footer-nav">
              <p className="landing-footer-nav-h">Company</p>
              <a href="#" className="landing-footer-link">
                About
              </a>
              <a href="#" className="landing-footer-link">
                Careers
              </a>
              <a href="#" className="landing-footer-link">
                Press
              </a>
            </nav>
            <nav className="landing-footer-nav">
              <p className="landing-footer-nav-h">Support</p>
              <a href="#" className="landing-footer-link">
                Help center
              </a>
              <a href="#" className="landing-footer-link">
                Contact
              </a>
              <a href="#" className="landing-footer-link">
                Privacy
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
