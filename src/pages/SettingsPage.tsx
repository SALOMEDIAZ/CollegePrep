import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import "../styles/settings.css";
import {
  clearProfileIdCache,
  ensureProfileRow,
  fetchProfileByUserId,
  persistAvatar,
  upsertProfile,
  wipeAccountAndSignOut,
} from "../services/profileService";
import { clearProfilePageCache } from "../services/profilePageCache";
import { firebaseUserToAppUser, logoutUser, updateUserEmail } from "../services/authService";
import { friendlyFirebaseAuthMessage } from "../services/authErrors";
import { auth } from "../services/firebase";
import { useAppDispatch, useAppSelector } from "../store/store";
import { clearUser, setUser } from "../store/slices/profileSlice";
import type { AppUser } from "../types/user";

const DEF_AVATAR = `/assets/images-icons/${encodeURIComponent("usuario 1.png")}`;
const defaultTags = ["Peanut", "Mushrooms", "Milk"];

const PREF_ROWS = [
  { id: "p1", key: "veg" as const, label: "Vegetarian" },
  { id: "p2", key: "vegan" as const, label: "Vegan" },
  { id: "p3", key: "gf" as const, label: "Gluten Free" },
  { id: "p4", key: "lf" as const, label: "Lactose Free" },
  { id: "p5", key: "omni" as const, label: "Omnivorous" },
];

const NOTIF_ROWS = [
  { id: "n1", labId: "n1-l", label: "Kitchen reminder", key: "k" as const },
  { id: "n2", labId: "n2-l", label: "Budget notice", key: "b" as const },
  { id: "n3", labId: "n3-l", label: "New weekly recipe", key: "r" as const },
];

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const reduxUser = useAppSelector((s) => s.profile.user);
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const user: AppUser | null = reduxUser;
  const [name, setName] = useState("");
  const [email, setEmail] = useState(() => reduxUser?.email || "");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [university, setUniversity] = useState("");
  const [career, setCareer] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const [draftAllergy, setDraftAllergy] = useState("");
  const [prefs, setPrefs] = useState({
    veg: false,
    vegan: false,
    gf: false,
    lf: false,
    omni: false,
  });
  const [notif, setNotif] = useState({
    k: true,
    b: true,
    r: false,
  });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      if (!reduxUser) return;
      setEmail(reduxUser.email || "");
      const { profile: p, error } = await ensureProfileRow(reduxUser.id);
      if (error || !p) {
        console.error(error);
        setReady(true);
        return;
      }
      setName(p.full_name || "");
      setUsername(p.username || "");
      setAge(p.age != null ? String(p.age) : "");
      setLocation(p.location || "");
      setUniversity(p.university || "");
      setCareer(p.career || "");
      setTags(Array.isArray(p.allergies) && p.allergies.length ? p.allergies : defaultTags);
      setPrefs({
        veg: !!p.vegetarian,
        vegan: !!p.vegan,
        gf: !!p.gluten_free,
        lf: !!p.lactose_free,
        omni: !!p.omnivorous,
      });
      setNotif({
        k: p.notif_kitchen !== false,
        b: p.notif_budget !== false,
        r: !!p.notif_recipe,
      });
      if (p.avatar_url) setPreview(p.avatar_url);
      setReady(true);
    }
    load();
  }, [reduxUser]);

  const avatarSrc = preview || DEF_AVATAR;
  const shownTags = tags.filter((t) => t.toLowerCase().includes(tagFilter.trim().toLowerCase()));
  const handle = username.trim() || user?.email?.split("@")[0] || "user";

  const textFields = [
    { label: "Name", value: name, set: setName },
    { label: "Username (without @)", value: username, set: setUsername },
    { label: "Age", value: age, set: setAge, type: "number" as const },
    { label: "Location", value: location, set: setLocation },
    { label: "University", value: university, set: setUniversity },
    { label: "Career", value: career, set: setCareer },
  ];

  async function saveAll() {
    if (!user) return;
    setSaveNotice(null);
    setSaving(true);

    const ageNum = age.trim() === "" ? null : Number.parseInt(age, 10);

    // PRIMERO SUPABASE: DIETA, ALERGIAS, CARRERA, ETC (SIN EMAIL NI PASSWORD EN SUPABASE AUTH)
    const res = await upsertProfile(user.id, {
      full_name: name,
      username: username.replace(/^@/, ""),
      age: Number.isFinite(ageNum) ? ageNum : null,
      location,
      university,
      career,
      allergies: tags,
      vegetarian: prefs.veg,
      vegan: prefs.vegan,
      gluten_free: prefs.gf,
      lactose_free: prefs.lf,
      omnivorous: prefs.omni,
      notif_kitchen: notif.k,
      notif_budget: notif.b,
      notif_recipe: notif.r,
    });

    if (res.error) {
      setSaving(false);
      setSaveNotice({
        kind: "err",
        text: res.error.message || "Could not save your profile preferences.",
      });
      return;
    }

    // DESPUES FIREBASE: SOLO SI CAMBIA EL EMAIL DE LOGIN
    if (email.trim() && email.trim() !== user.email) {
      const eRes = await updateUserEmail(email.trim());
      if (eRes.error) {
        setEmail(user.email);
        setSaving(false);
        setSaveNotice({
          kind: "warn",
          text: `Your preferences were saved. Email was not updated: ${friendlyFirebaseAuthMessage(eRes.error)}`,
        });
        return;
      }
      await auth.currentUser?.reload();
      const refreshed = auth.currentUser;
      if (refreshed) {
        dispatch(setUser(firebaseUserToAppUser(refreshed)));
        setEmail(refreshed.email || "");
      }
    }

    setSaving(false);
    setSaveNotice({ kind: "ok", text: "Your preferences were saved." });
  }

  function onPickPhoto() {
    fileRef.current?.click();
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    const r = await persistAvatar(f, user.id);
    if (r.error) {
      setSaveNotice({ kind: "err", text: r.error.message || "Could not update your photo." });
    } else {
      const { profile: p } = await fetchProfileByUserId(user.id);
      if (p?.avatar_url) setPreview(p.avatar_url);
    }
    e.target.value = "";
  }

  async function addAllergy() {
    const t = draftAllergy.trim();
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase()) || !user) return;
    const next = [...tags, t];
    setTags(next);
    setDraftAllergy("");
    dlgRef.current?.close();
    const res = await upsertProfile(user.id, { allergies: next });
    if (res.error) {
      setSaveNotice({ kind: "err", text: res.error.message || "Could not save allergy changes." });
    }
  }

  async function removeAllergy(tagToRemove: string) {
    if (!user) return;
    const next = tags.filter((t) => t !== tagToRemove);
    setTags(next);
    const res = await upsertProfile(user.id, { allergies: next });
    if (res.error) {
      setSaveNotice({ kind: "err", text: res.error.message || "Could not save allergy changes." });
    }
  }

  async function signOut() {
    await logoutUser();
    clearProfileIdCache();
    clearProfilePageCache();
    dispatch(clearUser());
    nav("/login");
  }

  async function deleteAccount() {
    if (!confirm("This will delete your profile data and sign you out. Continue?")) return;
    const r = await wipeAccountAndSignOut();
    if ("error" in r && r.error) alert(String(r.error.message));
    clearProfileIdCache();
    clearProfilePageCache();
    dispatch(clearUser());
    nav("/login");
  }

  if (!ready || !user) {
    return (
      <div className="settings-page-bg settings-loading">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="settings-page-bg settings-root-text" data-theme="light">
      <input ref={fileRef} type="file" accept="image/*" className="settings-file-input" onChange={onFile} />
      <dialog ref={dlgRef} className="settings-dialog">
        <div className="settings-modal-box">
          <h3 className="settings-modal-title">Add allergy</h3>
          <p className="settings-modal-desc">Type what you are allergic to.</p>
          <input
            className="settings-modal-inp"
            value={draftAllergy}
            onChange={(e) => setDraftAllergy(e.target.value)}
            placeholder="e.g. Shellfish"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAllergy();
              }
            }}
          />
          <div className="settings-modal-actions">
            <button type="button" className="settings-modal-cancel" onClick={() => dlgRef.current?.close()}>
              Cancel
            </button>
            <button type="button" className="settings-modal-add" onClick={() => addAllergy()}>
              Add
            </button>
          </div>
        </div>
        <form method="dialog" className="settings-modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <header className="settings-header">
        <div className="settings-header-inner">
          <Link to="/landing" className="settings-brand">
            <span className="settings-brand-green">College</span>
            <span className="settings-brand-orange">Prep</span>
          </Link>
          <Link to="/profile" className="settings-back">
            Back to profile
          </Link>
        </div>
      </header>

      <main className="settings-main">
        <h1 className="settings-h1">Profile</h1>
        <section className="settings-form-wrap">
          <div className="settings-form-row">
            <div className="settings-photo-col">
              <div className="settings-photo-wrap">
                <img src={avatarSrc} alt="Profile" className="settings-avatar" />
                <button type="button" onClick={onPickPhoto} className="settings-photo-btn" aria-label="Change photo">
                  <span className="settings-photo-btn-icon" aria-hidden />
                </button>
              </div>
              <p className="settings-handle">@{handle}</p>
            </div>
            <div className="settings-fields">
              <label className="settings-field">
                <span className="settings-field-label">Email</span>
                <input
                  type="email"
                  className="settings-inp"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {textFields.map((f) => (
                <label key={f.label} className="settings-field">
                  <span className="settings-field-label">{f.label}</span>
                  <input
                    type={f.type ?? "text"}
                    className="settings-inp"
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    {...(f.type === "number" ? { min: 0 } : {})}
                  />
                </label>
              ))}
              {saveNotice && (
                <p
                  className={`settings-save-notice settings-save-notice--${saveNotice.kind}`}
                  role="status"
                >
                  {saveNotice.text}
                </p>
              )}
              <button type="button" disabled={saving} className="settings-save" onClick={() => saveAll()}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </section>

        <div className="settings-two-col">
          <article className="settings-card">
            <h2 className="settings-card-h">Preferences</h2>
            {PREF_ROWS.map((row) => (
              <label key={row.id} htmlFor={row.id} className="settings-pref-row">
                <input
                  id={row.id}
                  type="checkbox"
                  className="settings-pref-check"
                  checked={prefs[row.key]}
                  onChange={(e) => setPrefs({ ...prefs, [row.key]: e.target.checked })}
                />
                <span>{row.label}</span>
              </label>
            ))}
          </article>
          <article className="settings-card">
            <h2 className="settings-card-h">Allergies</h2>
            <input
              className="settings-filter-inp"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="Filter allergies…"
              aria-label="Filter allergies"
            />
            <div className="settings-tags">
              {shownTags.map((tag, i) => (
                <span key={tag + "-" + i} className="settings-tag">
                  <span className="settings-tag-label">{tag}</span>
                  <button
                    type="button"
                    className="settings-tag-remove"
                    onClick={() => removeAllergy(tag)}
                    aria-label={`Remove ${tag}`}
                  >
                    <img src="/assets/images-icons/x.png" alt="" className="settings-tag-x" width={18} height={18} />
                  </button>
                </span>
              ))}
            </div>
            <button type="button" className="settings-add-btn" onClick={() => dlgRef.current?.showModal()}>
              + Add
            </button>
          </article>
        </div>

        <article className="settings-notif-card">
          <h2 className="settings-notif-title">Notifications</h2>
          {NOTIF_ROWS.map((row) => (
            <div key={row.id} className="settings-notif-row">
              <span id={row.labId}>{row.label}</span>
              <input
                id={row.id}
                type="checkbox"
                className="settings-notif-toggle"
                checked={notif[row.key]}
                onChange={(e) => setNotif({ ...notif, [row.key]: e.target.checked })}
                role="switch"
                aria-labelledby={row.labId}
              />
            </div>
          ))}
        </article>

        <div className="settings-danger-wrap">
          <div className="settings-danger-btns">
            <button type="button" className="settings-logout-btn" onClick={() => signOut()}>
              Log Out
            </button>
            <button type="button" className="settings-delete-btn" onClick={() => deleteAccount()}>
              Delete Account
            </button>
          </div>
          <p className="settings-danger-note">All your data will be erased.</p>
        </div>
      </main>
    </div>
  );
}
