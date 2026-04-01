import { Link } from "react-router-dom";
import { useEffect, useState, type CSSProperties } from "react";
import "../styles/profile.css";
import { ensureProfileRow, fetchSessionUser, upsertProfile, type ProfileRow } from "../services/profileSupabase";
import type { User } from "@supabase/supabase-js";

const DEF_AVATAR =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [budget, setBudget] = useState(75);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      const u = await fetchSessionUser();
      if (!u) return;
      setUser(u);
      const { profile: p, error } = await ensureProfileRow(u.id);
      if (error) {
        console.error(error);
        setReady(true);
        return;
      }
      setProfile(p);
      if (typeof p?.budget_percent === "number") {
        setBudget(p.budget_percent);
      }
      setReady(true);
    }
    load();
  }, []);

  const avatar = profile?.avatar_url || DEF_AVATAR;
  const name = profile?.full_name?.trim() || "—";
  const email = user?.email || "—";
  const loc = profile?.location?.trim() || "—";

  async function handleBudgetChange(newValue: number) {
    if (!user) return;
    setBudget(newValue);
    await upsertProfile(user.id, { budget_percent: newValue });
    setProfile((prev) => {
      if (prev) {
        return { ...prev, budget_percent: newValue };
      }
      return prev;
    });
  }

  if (!ready) {
    return (
      <div className="profile-page-bg profile-loading">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="profile-page-bg profile-root-text" data-theme="light">
      <header className="profile-top">
        <div className="profile-top-left">
          <Link to="/landing" className="profile-brand">
            <span className="profile-brand-green">College</span>
            <span className="profile-brand-orange">Prep</span>
          </Link>
          <nav className="profile-nav-row" aria-label="Main">
            <Link to="/recipes" className="profile-nav-a">
              Recipes
            </Link>
            <a href="#" className="profile-nav-a">
              Meal plan
            </a>
          </nav>
        </div>
        <div className="profile-top-right">
          <label className="profile-search">
            <span className="profile-sr-only">Search</span>
            <input type="search" placeholder="Search" className="profile-search-input" aria-label="Search recipes" />
          </label>
          <Link to="/profile" className="profile-icon-link" aria-label="Profile">
            <span className="profile-nav-icon" aria-hidden />
          </Link>
        </div>
      </header>

      <main className="profile-main">
        <div className="profile-cover" role="img" aria-label="Cover" />
        <div className="profile-avatar-wrap">
          <img src={avatar} alt="Profile" className="profile-avatar" />
        </div>
        <section className="profile-info" aria-labelledby="profile-username">
          <h1 id="profile-username" className="profile-name">
            @{String(profile?.username ?? "user").replace(/^@/, "")}
          </h1>
          <div className="profile-line" />
          <dl className="profile-fields">
            <div className="profile-field">
              <dt className="profile-field-label">Name</dt>
              <dd className="profile-field-value">{name}</dd>
            </div>
            <div className="profile-field">
              <dt className="profile-field-label">Email</dt>
              <dd className="profile-field-value-email">{email}</dd>
            </div>
            <div className="profile-field">
              <dt className="profile-field-label">Location</dt>
              <dd className="profile-field-value">{loc}</dd>
            </div>
          </dl>
        </section>
        <div className="profile-columns">
          <article className="profile-card">
            <h2 className="profile-card-h">About me</h2>
            <ul className="profile-about-list">
              <li>
                <span className="profile-about-strong">Age</span> <span className="profile-about-value">{profile?.age ?? "—"}</span>
              </li>
              <li>
                <span className="profile-about-strong">College</span> <span className="profile-about-value">{profile?.university?.trim() || "—"}</span>
              </li>
              <li>
                <span className="profile-about-strong">Career</span> <span className="profile-about-value">{profile?.career?.trim() || "—"}</span>
              </li>
            </ul>
          </article>
          <article className="profile-card">
            <h2 className="profile-card-h-budget">Your budget</h2>
            <div className="profile-budget-inner">
              <div
                className="profile-budget-ring"
                style={{ "--value": budget } as CSSProperties}
                role="progressbar"
                aria-valuenow={budget}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {budget}%
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={budget}
                onChange={(e) => {
                  handleBudgetChange(Number(e.target.value));
                }}
                className="profile-budget-range"
                aria-label="Budget percent"
              />
            </div>
          </article>
        </div>
        <p className="profile-edit-link-wrap">
          <Link to="/settings" className="profile-edit-link">
            Edit profile & settings
          </Link>
        </p>
      </main>
    </div>
  );
}
