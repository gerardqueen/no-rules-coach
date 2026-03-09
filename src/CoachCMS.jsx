import { useEffect, useMemo, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// NO RULES NUTRITION — Coach CMS (Cleaned)
// Phase 1: Removed mock/demo client data + generators
// Phase 2: Real backend login (JWT) against your Railway API
// Backend contract (from server.js):
//   POST  /auth/login  { email, password } -> { token, user }
//   GET   /auth/me     (Bearer token) -> user
//   GET   /athletes    (coach only) -> athlete[]
//   GET   /athletes/:id (coach only) -> athlete
//   POST  /athletes    (coach only) -> create athlete
//   PUT   /athletes/:id (coach only) -> update athlete
// ─────────────────────────────────────────────────────────────────────────────

// ── Google Fonts ─────────────────────────────────────────────────────────────
const fontLinkId = "nrn-fonts";
if (!document.getElementById(fontLinkId)) {
  const fontLink = document.createElement("link");
  fontLink.id = fontLinkId;
  fontLink.rel = "stylesheet";
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap";
  document.head.appendChild(fontLink);
}

// ── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#0a0a0a",
  surface: "#111111",
  card: "#161616",
  border: "#1f1f1f",
  accent: "#FF9A52",
  text: "#f0f0f0",
  muted: "#666",
  coachGreen: "#22c55e",
  danger: "#ef4444",
  warn: "#f59e0b",
  info: "#3b82f6",
};

// ── API helpers ─────────────────────────────────────────────────────────────
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://no-rules-api-production.up.railway.app";

async function apiGet(path, token) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `GET ${path} failed (${res.status})`);
  }
  return res.json();
}

async function apiPost(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `POST ${path} failed (${res.status})`);
  }
  return res.json();
}

async function apiPut(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `PUT ${path} failed (${res.status})`);
  }
  return res.json();
}

// ── Small UI pieces ─────────────────────────────────────────────────────────
const Badge = ({ label, color = T.accent }) => (
  <span
    style={{
      fontFamily: "DM Sans",
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 99,
      background: `${color}20`,
      color,
      border: `1px solid ${color}44`,
      letterSpacing: 0.5,
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </span>
);

const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <div
      style={{
        fontFamily: "Bebas Neue",
        fontSize: 18,
        letterSpacing: 2,
        color: T.text,
      }}
    >
      {children}
    </div>
    {sub && (
      <div
        style={{
          fontFamily: "DM Sans",
          fontSize: 11,
          color: T.muted,
          marginTop: 3,
        }}
      >
        {sub}
      </div>
    )}
  </div>
);

const Avatar = ({ initials = "NR", color = T.accent, size = 40 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `${color}28`,
      border: `2px solid ${color}55`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Bebas Neue",
      fontSize: size * 0.38,
      color,
      flexShrink: 0,
      userSelect: "none",
    }}
  >
    {initials}
  </div>
);

function prettyErr(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  return e.message || "Something went wrong";
}

// ── CoachLogin (real backend) ───────────────────────────────────────────────
function CoachLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handle = async () => {
    setErr("");
    if (!email || !pass) {
      setErr("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost("/auth/login", {
        email: email.trim().toLowerCase(),
        password: pass,
      });

      if (!res?.token) throw new Error("No token returned");
      if (res?.user?.role !== "coach") throw new Error("Coach access required");

      onLogin({ token: res.token, user: res.user });
    } catch (e) {
      setErr("Login failed. Check credentials and that the account is a coach.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "DM Sans",
        color: T.text,
      }}
    >
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder{color:${T.muted}}
        input{caret-color:${T.accent};outline:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        button{outline:none}
      `}</style>

      <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp .4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <Avatar initials="NR" color={T.accent} size={110} />
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: `${T.coachGreen}18`,
              border: `1px solid ${T.coachGreen}44`,
              borderRadius: 99,
              padding: "4px 14px",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.coachGreen }} />
            <span
              style={{
                fontFamily: "DM Sans",
                fontSize: 11,
                color: T.coachGreen,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              Coach Portal
            </span>
          </div>
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 32 }}>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 22, letterSpacing: 2, marginBottom: 24 }}>
            COACH SIGN IN
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontFamily: "DM Sans",
                fontSize: 11,
                color: T.muted,
                letterSpacing: 1,
                textTransform: "uppercase",
                display: "block",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handle()}
              placeholder="coach@norules.com"
              type="email"
              style={{
                width: "100%",
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "12px 14px",
                color: T.text,
                fontFamily: "DM Sans",
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontFamily: "DM Sans",
                fontSize: 11,
                color: T.muted,
                letterSpacing: 1,
                textTransform: "uppercase",
                display: "block",
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handle()}
                placeholder="••••••••"
                type={showPass ? "text" : "password"}
                style={{
                  width: "100%",
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: "12px 44px 12px 14px",
                  color: T.text,
                  fontFamily: "DM Sans",
                  fontSize: 13,
                }}
              />
              <button
                onClick={() => setShowPass((p) => !p)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: T.muted,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "DM Sans",
                }}
              >
                {showPass ? "hide" : "show"}
              </button>
            </div>
          </div>

          {err && (
            <div
              style={{
                background: `${T.danger}18`,
                border: `1px solid ${T.danger}44`,
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 16,
                fontFamily: "DM Sans",
                fontSize: 12,
                color: T.danger,
              }}
            >
              {err}
            </div>
          )}

          <button
            onClick={handle}
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? T.border : T.accent,
              color: loading ? T.muted : T.bg,
              border: "none",
              borderRadius: 12,
              padding: 14,
              fontFamily: "Bebas Neue",
              fontSize: 18,
              letterSpacing: 2,
              cursor: loading ? "default" : "pointer",
              transition: "all .2s",
            }}
          >
            {loading ? "SIGNING IN…" : "ACCESS COACH PORTAL"}
          </button>

          <div style={{ marginTop: 14, fontFamily: "JetBrains Mono", fontSize: 10, color: T.muted }}>
            API: {API_URL}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Create Athlete ───────────────────────────────────────────────────
function AddAthleteModal({ onClose, onCreate, loading, error }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [sport, setSport] = useState("");
  const [mfpUsername, setMfpUsername] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000cc",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 26, width: "100%", maxWidth: 520 }}>
        <SectionTitle sub="Creates a real athlete account in your Railway database.">Add Athlete</SectionTitle>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Name" value={name} onChange={setName} placeholder="Alex Morgan" />
          <Field label="Sport" value={sport} onChange={setSport} placeholder="Triathlon" />
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Email" value={email} onChange={setEmail} placeholder="alex@norules.com" />
          </div>
          <Field label="Password" value={password} onChange={setPassword} placeholder="athlete-password" />
          <Field label="MFP Username (optional)" value={mfpUsername} onChange={setMfpUsername} placeholder="myfitnesspal_name" />
        </div>

        {error && (
          <div style={{ marginTop: 12, background: `${T.danger}18`, border: `1px solid ${T.danger}44`, padding: "10px 12px", borderRadius: 10, color: T.danger, fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: "none",
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 12,
              color: T.muted,
              cursor: "pointer",
              fontFamily: "DM Sans",
              fontSize: 12,
            }}
          >
            Cancel
          </button>
          <button
            disabled={loading || !email || !name || !password}
            onClick={() => onCreate({ email, name, password, sport, mfpUsername })}
            style={{
              flex: 2,
              background: loading ? T.border : T.accent,
              border: "none",
              borderRadius: 12,
              padding: 12,
              color: loading ? T.muted : T.bg,
              cursor: loading ? "default" : "pointer",
              fontFamily: "Bebas Neue",
              fontSize: 16,
              letterSpacing: 2,
            }}
          >
            {loading ? "CREATING…" : "CREATE ATHLETE"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <div style={{ fontFamily: "DM Sans", fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: "12px 12px",
          color: T.text,
          fontFamily: "DM Sans",
          fontSize: 13,
          outline: "none",
        }}
      />
    </div>
  );
}

// ── Main CMS ────────────────────────────────────────────────────────────────
export default function CoachCMS() {
  const [token, setToken] = useState(() => localStorage.getItem("coach_token"));
  const [me, setMe] = useState(null);
  const [booting, setBooting] = useState(!!localStorage.getItem("coach_token"));

  const [athletes, setAthletes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [athErr, setAthErr] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const selected = useMemo(
    () => athletes.find((a) => String(a.id) === String(selectedId)) || null,
    [athletes, selectedId]
  );

  // Restore session if token exists
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!token) {
        setBooting(false);
        return;
      }
      try {
        const user = await apiGet("/auth/me", token);
        if (cancelled) return;
        if (user?.role !== "coach") throw new Error("Coach access required");
        setMe(user);
      } catch {
        // token invalid/expired
        localStorage.removeItem("coach_token");
        if (!cancelled) {
          setToken(null);
          setMe(null);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Load athletes after login
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || !me) return;
      setLoadingAthletes(true);
      setAthErr("");
      try {
        const rows = await apiGet("/athletes", token);
        if (cancelled) return;
        setAthletes(rows || []);
        if ((rows || []).length && !selectedId) setSelectedId(String(rows[0].id));
      } catch (e) {
        if (!cancelled) setAthErr(prettyErr(e));
      } finally {
        if (!cancelled) setLoadingAthletes(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, me]);

  const onLogin = ({ token: t, user }) => {
    localStorage.setItem("coach_token", t);
    setToken(t);
    setMe(user);
  };

  const logout = async () => {
    try {
      if (token) await apiPost("/auth/logout", {}, token);
    } catch {
      // ignore
    }
    localStorage.removeItem("coach_token");
    setToken(null);
    setMe(null);
    setAthletes([]);
    setSelectedId(null);
  };

  const createAthlete = async (payload) => {
    setCreateErr("");
    setCreating(true);
    try {
      const created = await apiPost(
        "/athletes",
        {
          email: payload.email,
          name: payload.name,
          password: payload.password,
          sport: payload.sport || null,
          mfpUsername: payload.mfpUsername || null,
        },
        token
      );
      setAthletes((p) => {
        const next = [...p, created].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        return next;
      });
      setShowAdd(false);
      setSelectedId(String(created.id));
    } catch (e) {
      setCreateErr(prettyErr(e));
    } finally {
      setCreating(false);
    }
  };

  const refreshSelected = async () => {
    if (!token || !selectedId) return;
    try {
      const full = await apiGet(`/athletes/${selectedId}`, token);
      setAthletes((p) => p.map((a) => (String(a.id) === String(selectedId) ? { ...a, ...full } : a)));
    } catch {
      // ignore
    }
  };

  if (booting) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "DM Sans" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 26, letterSpacing: 2 }}>Loading…</div>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.muted, marginTop: 8 }}>Restoring session</div>
        </div>
      </div>
    );
  }

  if (!token || !me) {
    return <CoachLogin onLogin={onLogin} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "DM Sans" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:${T.surface}}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px}
        button{outline:none}
      `}</style>

      {showAdd && (
        <AddAthleteModal
          onClose={() => setShowAdd(false)}
          onCreate={createAthlete}
          loading={creating}
          error={createErr}
        />
      )}

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 22px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar initials="NR" color={T.accent} size={44} />
          <div>
            <div style={{ fontFamily: "Bebas Neue", fontSize: 22, letterSpacing: 2 }}>NO RULES NUTRITION</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: T.muted }}>Coach Portal · {me.name || me.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Badge label={me.role?.toUpperCase() || "COACH"} color={T.coachGreen} />
          <button
            onClick={() => setShowAdd(true)}
            style={{ background: T.accent, border: "none", borderRadius: 12, padding: "10px 14px", color: T.bg, cursor: "pointer", fontFamily: "Bebas Neue", fontSize: 16, letterSpacing: 2 }}
          >
            + ADD ATHLETE
          </button>
          <button
            onClick={logout}
            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", color: T.muted, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12 }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", minHeight: "calc(100vh - 72px)" }}>
        {/* Left: athletes list */}
        <div style={{ borderRight: `1px solid ${T.border}`, padding: 18 }}>
          <SectionTitle sub="Loaded from your Railway database via GET /athletes.">Athletes</SectionTitle>

          {athErr && (
            <div style={{ background: `${T.danger}18`, border: `1px solid ${T.danger}44`, padding: "10px 12px", borderRadius: 12, color: T.danger, fontSize: 12, marginBottom: 12 }}>
              {athErr}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.muted }}>
              {loadingAthletes ? "Loading…" : `${athletes.length} athlete${athletes.length === 1 ? "" : "s"}`}
            </div>
            <button
              onClick={() => {
                setSelectedId(null);
                setAthletes([]);
                setTimeout(() => {
                  // force reload effect
                  setMe((m) => ({ ...m }));
                }, 0);
              }}
              style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 10px", color: T.muted, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12 }}
              title="Reload list"
            >
              Refresh
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {athletes.map((a) => {
              const active = String(a.id) === String(selectedId);
              const initials = (a.name || "?")
                .split(" ")
                .slice(0, 2)
                .map((x) => x[0])
                .join("")
                .toUpperCase();

              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(String(a.id))}
                  style={{
                    textAlign: "left",
                    background: active ? `${T.accent}10` : T.card,
                    border: `1px solid ${active ? T.accent + "66" : T.border}`,
                    borderRadius: 16,
                    padding: 12,
                    cursor: "pointer",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Avatar initials={initials || "??"} color={active ? T.accent : T.info} size={38} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "DM Sans", fontSize: 13, color: T.text, fontWeight: 600 }}>{a.name || a.email}</div>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: T.muted }}>{a.sport || "—"}</div>
                  </div>
                  <Badge label={`#${a.id}`} color={T.muted} />
                </button>
              );
            })}

            {!loadingAthletes && athletes.length === 0 && (
              <div style={{ background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 16, padding: 14, color: T.muted, fontSize: 12 }}>
                No athletes found for this coach account.
                <div style={{ marginTop: 8 }}>Use <b>+ ADD ATHLETE</b> to create one.</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: athlete details */}
        <div style={{ padding: 22 }}>
          {!selected ? (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: 18 }}>
              <SectionTitle sub="Select an athlete from the left.">No athlete selected</SectionTitle>
              <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
                This cleaned CMS is now connected to your Railway backend for login and athlete management.
                Next step (Phase 3) is wiring macros, check-ins, messages, and MFP entries to the endpoints you’ll add.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Avatar
                    initials={(selected.name || "?")
                      .split(" ")
                      .slice(0, 2)
                      .map((x) => x[0])
                      .join("")
                      .toUpperCase()}
                    color={T.coachGreen}
                    size={54}
                  />
                  <div>
                    <div style={{ fontFamily: "Bebas Neue", fontSize: 24, letterSpacing: 2 }}>{selected.name || "Athlete"}</div>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.muted }}>{selected.email}</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Badge label={selected.sport || "Sport: —"} color={T.info} />
                      <Badge label={selected.mfp_username || selected.mfpUsername || "MFP: —"} color={T.accent} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={refreshSelected}
                    style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", color: T.muted, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12 }}
                  >
                    Refresh profile
                  </button>
                </div>
              </div>

              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: 18 }}>
                <SectionTitle sub="These will be wired in Phase 3+ when you add endpoints for macro_plans, checkins, messages, and mfp_entries.">
                  Next wiring steps
                </SectionTitle>
                <ul style={{ color: T.muted, fontSize: 12, lineHeight: 1.8, paddingLeft: 18 }}>
                  <li>
                    <b style={{ color: T.text }}>Macros:</b> add GET/PUT endpoints for <code>macro_plans</code>.
                  </li>
                  <li>
                    <b style={{ color: T.text }}>Check-ins:</b> add GET/POST endpoints for <code>checkins</code>.
                  </li>
                  <li>
                    <b style={{ color: T.text }}>Messaging:</b> add threads + GET/POST endpoints for <code>messages</code>.
                  </li>
                  <li>
                    <b style={{ color: T.text }}>MFP:</b> add sync endpoints to populate <code>mfp_entries</code>.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
