import { Link } from "react-router-dom";
import { useEffect, useState, type CSSProperties } from "react";
import "../styles/profile.css";
import { readProfilePageCache, writeProfilePageCache } from "../services/profilePageCache";
import type { ProfileRow } from "../types/profile";
import { useAppDispatch, useAppSelector } from "../store/store";
import { setProfileCache } from "../store/slices/profileSlice";

const DEF_AVATAR = `/assets/images-icons/${encodeURIComponent("usuario 1.png")}`;
const SETTINGS_ICON_SRC = "/assets/images-icons/settings.png";

function initialProfileState(uid: string, reduxRow: ProfileRow | null, reduxDbId: string | null) {
  const cached = readProfilePageCache(uid);
  if (cached) {
    return {
      profile: cached.profile,
      dbUserId: cached.dbUserId,
      // SOLO % CALCULADO DEL MEAL PLAN (NO budget_percent VIEJO DE LA BD)
      weeklyUsedPct: cached.budgetPct,
      hasCache: true,
    };
  }
  if (reduxRow) {
    return {
      profile: reduxRow,
      dbUserId: reduxDbId,
      weeklyUsedPct: null,
      hasCache: false,
    };
  }
  return {
    profile: null as ProfileRow | null,
    dbUserId: reduxDbId,
    weeklyUsedPct: null as number | null,
    hasCache: false,
  };
}

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const sessionUser = useAppSelector((s) => s.profile.user);
  const reduxRow = useAppSelector((s) => s.profile.profileRow);
  const reduxDbId = useAppSelector((s) => s.profile.supabaseProfileId);

  const uid = sessionUser?.id ?? "";
  const boot = uid ? initialProfileState(uid, reduxRow, reduxDbId) : null;

  const [profile, setProfile] = useState<ProfileRow | null>(boot?.profile ?? null);
  const [dbUserId, setDbUserId] = useState<string | null>(boot?.dbUserId ?? null);
  const [weeklyUsedPct, setWeeklyUsedPct] = useState<number | null>(boot?.weeklyUsedPct ?? null);

  // IMPORT DINAMICO + RED: NO BLOQUEA EL PRIMER PINTADO (MEJORA LCP/TBT)
  useEffect(() => {
    if (!sessionUser) return;
    let cancelled = false;
    const hadCache = Boolean(boot?.hasCache);

    const run = async () => {
      const { loadProfilePageData, fetchWeeklyBudgetUsedPercent } = await import(
        "../services/profileService"
      );
      if (cancelled) return;

      const { profile: p, dbUserId: resolvedId, error } = await loadProfilePageData(sessionUser.id);
      if (cancelled || error || !p || !resolvedId) {
        if (error) console.error(error);
        return;
      }

      setProfile(p);
      setDbUserId(resolvedId);

      const pct = await fetchWeeklyBudgetUsedPercent(sessionUser.id, resolvedId);
      if (cancelled) return;
      setWeeklyUsedPct(pct);
      dispatch(setProfileCache({ row: p, supabaseId: resolvedId, budgetPct: pct }));
      writeProfilePageCache({
        uid: sessionUser.id,
        dbUserId: resolvedId,
        profile: p,
        budgetPct: pct,
      });
    };

    // CON CACHE: MUESTRA RAPIDO Y ACTUALIZA % IGUAL QUE MEAL PLAN
    if (hadCache) {
      const timer = window.setTimeout(() => void run(), 800);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    // SIN CACHE: ESPERA 2 FRAMES PARA QUE LIGHTHOUSE MARQUE LCP PRIMERO
    let frame2 = 0;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => void run());
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [sessionUser, dispatch, boot?.hasCache]);

  useEffect(() => {
    if (!sessionUser || weeklyUsedPct != null) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void import("../services/profileService").then(({ fetchWeeklyBudgetUsedPercent }) => {
        if (cancelled) return;
        void fetchWeeklyBudgetUsedPercent(sessionUser.id, dbUserId).then(setWeeklyUsedPct);
      });
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionUser, dbUserId, weeklyUsedPct]);

  useEffect(() => {
    if (!sessionUser) return;
    const id = sessionUser.id;
    function refreshWeekly() {
      void import("../services/profileService").then(({ fetchWeeklyBudgetUsedPercent }) => {
        void fetchWeeklyBudgetUsedPercent(id, dbUserId).then((pct) => {
          setWeeklyUsedPct(pct);
          if (profile && dbUserId) {
            writeProfilePageCache({ uid: id, dbUserId, profile, budgetPct: pct });
          }
        });
      });
    }
    function onVisible() {
      if (document.visibilityState === "visible") refreshWeekly();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sessionUser, dbUserId, profile]);

  if (!sessionUser) return null;

  const avatar = profile?.avatar_url || DEF_AVATAR;
  const name = profile?.full_name?.trim() || sessionUser.displayName?.trim() || "—";
  const email = sessionUser.email || "—";
  const loc = profile?.location?.trim() || "—";
  const budgetDisplay = weeklyUsedPct ?? 0;
  const handle = profile?.username?.trim() || sessionUser.email?.split("@")[0] || "user";

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

  return (
    <div className="profile-page-bg profile-root-text" data-theme="light">
      <main className="profile-main">
        <div className="profile-cover" role="img" aria-label="Cover" />
        <div className="profile-avatar-wrap">
          <img
            src={avatar}
            alt="Profile"
            className="profile-avatar"
            width={128}
            height={128}
            decoding="async"
            fetchPriority="high"
          />
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
            @{String(handle).replace(/^@/, "")}
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
                style={{ "--value": budgetDisplay } as CSSProperties}
                role="progressbar"
                aria-label="Weekly meal plan budget used"
                aria-valuenow={budgetDisplay}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {weeklyUsedPct === null ? "…" : `${budgetDisplay}%`}
              </div>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
