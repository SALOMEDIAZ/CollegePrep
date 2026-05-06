import { Link } from "react-router-dom";
import { useEffect, useState, type CSSProperties } from "react";
import "../styles/profile.css";
import { ensureProfileRow, fetchWeeklyBudgetUsedPercent } from "../services/profileService";
import type { ProfileRow } from "../types/profile";
import { useAppSelector } from "../store/store";

const DEF_AVATAR = `/assets/images-icons/${encodeURIComponent("usuario 1.png")}`;
const SETTINGS_ICON_SRC = "/assets/images-icons/settings.png";

export default function ProfilePage() {
  const reduxUser = useAppSelector((s) => s.profile.user);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [weeklyUsedPct, setWeeklyUsedPct] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      if (!reduxUser) return;
      const { profile: p, error } = await ensureProfileRow(reduxUser.id);
      if (error) {
        console.error(error);
        setReady(true);
        return;
      }
      setProfile(p);
      const usedPct = await fetchWeeklyBudgetUsedPercent(reduxUser.id);
      setWeeklyUsedPct(usedPct);
      setReady(true);
    }
    load();
  }, [reduxUser]);

  useEffect(() => {
    if (!reduxUser) return;
    const uid = reduxUser.id;
    function refreshWeekly() {
      void fetchWeeklyBudgetUsedPercent(uid).then(setWeeklyUsedPct);
    }
    function onVisible() {
      if (document.visibilityState === "visible") refreshWeekly();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reduxUser]);

  const avatar = profile?.avatar_url || DEF_AVATAR;
  const name = profile?.full_name?.trim() || "—";
  const email = reduxUser?.email || "—";
  const loc = profile?.location?.trim() || "—";

  const allergyLine =
    profile && Array.isArray(profile.allergies) && profile.allergies.length
      ? profile.allergies
          .map((a) => String(a).trim())
          .filter(Boolean)
          .join(", ")
      : "—";

  const preferenceParts: string[] = [];
  if (profile?.vegetarian) preferenceParts.push("Vegetarian");
  if (profile?.vegan) preferenceParts.push("Vegan");
  if (profile?.gluten_free) preferenceParts.push("Gluten free");
  if (profile?.lactose_free) preferenceParts.push("Lactose free");
  if (profile?.omnivorous) preferenceParts.push("Omnivorous");
  const preferenceLine = preferenceParts.length ? preferenceParts.join(", ") : "—";

  if (!ready || !reduxUser) {
    return (
      <div className="profile-page-bg profile-loading">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="profile-page-bg profile-root-text" data-theme="light">
      <main className="profile-main">
        <div className="profile-cover" role="img" aria-label="Cover" />
        <div className="profile-avatar-wrap">
          <img src={avatar} alt="Profile" className="profile-avatar" />
        </div>
        <section className="profile-info" aria-labelledby="profile-username">
          <Link
            to="/settings"
            className="profile-settings-link"
            aria-label="Edit profile and settings"
          >
            <img
              src={SETTINGS_ICON_SRC}
              alt=""
              width={32}
              height={32}
              className="profile-settings-img"
            />
          </Link>
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
                <span className="profile-about-strong">Age</span>{" "}
                <span className="profile-about-value">{profile?.age ?? "—"}</span>
              </li>
              <li>
                <span className="profile-about-strong">College</span>{" "}
                <span className="profile-about-value">{profile?.university?.trim() || "—"}</span>
              </li>
              <li>
                <span className="profile-about-strong">Career</span>{" "}
                <span className="profile-about-value">{profile?.career?.trim() || "—"}</span>
              </li>
              <li>
                <span className="profile-about-strong">Allergies</span>{" "}
                <span className="profile-about-value">{allergyLine}</span>
              </li>
              <li>
                <span className="profile-about-strong">Preferences</span>{" "}
                <span className="profile-about-value">{preferenceLine}</span>
              </li>
            </ul>
          </article>
          <article className="profile-card">
            <h2 className="profile-card-h-budget">Your budget</h2>
            <p className="profile-budget-note">Weekly meal plan used</p>
            <div className="profile-budget-inner">
              <div
                className="profile-budget-ring"
                style={{ "--value": weeklyUsedPct } as CSSProperties}
                role="progressbar"
                aria-valuenow={weeklyUsedPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {weeklyUsedPct}%
              </div>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
