import { useEffect, useMemo, useRef, useState } from "react";

/**
 * COACHCMS.jsx — Full replacement file
 * - Real backend login (/auth/login)
 * - Load athletes (/athletes)
 * - Add athlete (/athletes)
 * - Macro plan rows-per-day (GET/PUT /macro-plans/:athleteId)
 *
 * API base:
 *  - Set VITE_API_URL in your frontend .env (recommended)
 *  - Fallback is http://localhost:3001
 */

const API_BASE = import.meta.env.VITE_API_URL || "https://no-rules-api-production.up.railway.app";
const TOKEN_KEY = "nrn_token";

/* ─────────────────────────────────────────────────────────────────────────────
   Theme + constants
────────────────────────────────────────────────────────────────────────────── */
const T = {
  bg: "#0a0a0a",
  surface: "#111111",
  card: "#161616",
  border: "#1f1f1f",
  accent: "#FF9A52",
  text: "#f0f0f0",
  muted: "#666",
  protein: "#f97316",
  carbs: "#3b82f6",
  fat: "#a855f7",
  coachGreen: "#22c55e",
  danger: "#ef4444",
  warn: "#f59e0b",
  info: "#3b82f6",
};

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 * Logo: embedded SVG so it never depends on a removed file.
 * (If you want your original logo image, you can swap this string with your own base64.)
 */
const LOGO_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#FF9A52" stop-opacity="0.95"/>
      <stop offset="70%" stop-color="#FF9A52" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0a0a0a" stop-opacity="1"/>
    </radialGradient>
  </defs>
  <rect width="240" height="240" fill="#0a0a0a"/>
  <circle cx="120" cy="120" r="102" fill="url(#g)" stroke="#FF9A52" stroke-opacity="0.35" stroke-width="6"/>
  <circle cx="120" cy="120" r="84" fill="#111111" stroke="#FF9A52" stroke-opacity="0.25" stroke-width="2"/>
  <text x="50%" y="48%" fill="#FF9A52" font-family="Arial Black, Impact, sans-serif" font-size="56" text-anchor="middle" dominant-baseline="middle">NRN</text>
  <text x="50%" y="63%" fill="#9aa0a6" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="middle" letter-spacing="2">COACH PORTAL</text>
</svg>
`);

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────────────────── */
async function apiFetch(path, token, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function initialsOf(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.map(p => p[0]).join("").slice(0, 2).toUpperCase() || "A";
}

function randomAvatarColor() {
  const colors = ["#3b82f6", "#a855f7", "#f97316", "#22c55e", "#FF9A52", "#ef4444", "#06b6d4"];
  return colors[Math.floor(Math.random() * colors.length)];
}

/* ─────────────────────────────────────────────────────────────────────────────
   Small UI atoms
────────────────────────────────────────────────────────────────────────────── */
const Badge = ({ label, color = T.accent }) => (
  <span
    style={{
      fontFamily: "DM Sans",
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 999,
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
      letterSpacing: 0.8,
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </span>
);

const Avatar = ({ initials, color, size = 40 }) => (
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
      fontFamily: "Bebas Neue, system-ui",
      fontSize: size * 0.38,
      color,
      flexShrink: 0,
      userSelect: "none",
    }}
  >
    {initials}
  </div>
);

const StatCard = ({ label, value, color = T.text, sub, unit }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 12px" }}>
    <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 26, color, lineHeight: 1 }}>
      {value}
      {unit && <span style={{ fontFamily: "DM Sans", fontSize: 11, color: T.muted, marginLeft: 6 }}>{unit}</span>}
    </div>
    <div style={{ fontFamily: "DM Sans", fontSize: 10, color: T.muted, letterSpacing: 1, marginTop: 6 }}>
      {label}
    </div>
    {sub && <div style={{ fontFamily: "DM Sans", fontSize: 11, color, marginTop: 4 }}>{sub}</div>}
  </div>
);

const inputStyle = {
  width: "100%",
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: "11px 14px",
  color: T.text,
  fontFamily: "DM Sans",
  fontSize: 13,
  outline: "none",
};

const labelStyle = {
  fontFamily: "DM Sans",
  fontSize: 11,
  color: T.muted,
  letterSpacing: 1,
  textTransform: "uppercase",
  display: "block",
  marginBottom: 6,
};

/* ─────────────────────────────────────────────────────────────────────────────
   Coach Login
────────────────────────────────────────────────────────────────────────────── */
function CoachLogin({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Demo accounts for quick fill (UI-only convenience)
  const DEMOS = [
    { email: "gerard@norules.com", password: "gerard1", name: "Gerard Queen", role: "Coach" },
    { email: "luke@norules.com", password: "luke1", name: "Luke Bastick", role: "Coach" },
    { email: "esme@norules.com", password: "esme1", name: "Esme", role: "Coach" },
  ];

  const handleLogin = async () => {
    setErr("");
    if (!email.trim() || !pass) {
      setErr("Enter your coach credentials.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", null, {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: pass }),
      });

      // data: { token, user }  (your backend returns this) [1](https://github.com/orgs/community/discussions/151670)
      localStorage.setItem(TOKEN_KEY, data.token);
      onLoggedIn({ ...data.user, token: data.token });
    } catch (e) {
      setErr(e.message);
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
      }}
    >
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder{color:${T.muted}}
        input{caret-color:${T.accent}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp .35s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <img
              src={LOGO_SRC}
              alt="No Rules Nutrition"
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                objectFit: "cover",
                border: `3px solid ${T.accent}44`,
                boxShadow: `0 0 32px ${T.accent}22`,
              }}
            />
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: `${T.coachGreen}18`,
              border: `1px solid ${T.coachGreen}44`,
              borderRadius: 999,
              padding: "4px 14px",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.coachGreen }} />
            <span style={{ fontSize: 11, color: T.coachGreen, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Coach Portal
            </span>
          </div>
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 30 }}>
          <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 22, letterSpacing: 2, color: T.text, marginBottom: 22 }}>
            COACH SIGN IN
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="coach@norules.com"
              type="email"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                type={showPass ? "text" : "password"}
                style={{ ...inputStyle, paddingRight: 52 }}
              />
              <button
                onClick={() => setShowPass((p) => !p)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: T.muted,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "DM Sans",
                }}
                type="button"
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
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 14,
                fontSize: 12,
                color: T.danger,
              }}
            >
              {err}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? T.border : T.accent,
              color: loading ? T.muted : T.bg,
              border: "none",
              borderRadius: 12,
              padding: 14,
              fontFamily: "Bebas Neue, system-ui",
              fontSize: 18,
              letterSpacing: 2,
              cursor: loading ? "default" : "pointer",
              transition: "all .2s",
            }}
            type="button"
          >
            {loading ? "SIGNING IN…" : "ACCESS COACH PORTAL"}
          </button>
        </div>

        <div style={{ marginTop: 14, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
            Demo Accounts — click to fill
          </div>

          {DEMOS.map((d) => (
            <button
              key={d.email}
              onClick={() => {
                setEmail(d.email);
                setPass(d.password);
                setErr("");
              }}
              style={{
                width: "100%",
                textAlign: "left",
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 8,
                cursor: "pointer",
              }}
              type="button"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{d.name}</span>
                <Badge label={d.role} color={T.coachGreen} />
              </div>
              <div style={{ fontFamily: "JetBrains Mono, ui-monospace", fontSize: 10, color: T.muted, marginTop: 2 }}>
                {d.email}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: T.muted, textAlign: "center" }}>
          API: <span style={{ fontFamily: "JetBrains Mono, ui-monospace" }}>{API_BASE}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Add Athlete Modal (persists to backend via POST /athletes)
────────────────────────────────────────────────────────────────────────────── */
function AddAthleteModal({ onClose, onCreate, creating }) {
  const SPORTS = ["Triathlon", "Powerlifting", "CrossFit", "Swimming", "Running", "Other"];

  const [form, setForm] = useState({
    name: "",
    loginEmail: "",
    password: "",
    sport: "Running",
    mfpUsername: "",
  });

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const valid =
    form.name.trim() &&
    form.loginEmail.trim() &&
    form.password.trim() &&
    form.password.trim().length >= 6;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000d0",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: T.card,
          border: `1px solid ${T.accent}44`,
          borderRadius: 22,
          overflow: "hidden",
          animation: "fadeUp .2s ease",
        }}
      >
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 22, letterSpacing: 2, color: T.text }}>
              ADD NEW ATHLETE
            </div>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: T.muted, marginTop: 4 }}>
              Creates an athlete account in the database (coach‑owned).
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}
            type="button"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "18px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input value={form.name} onChange={set("name")} placeholder="e.g. Alex Morgan" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Sport</label>
              <select
                value={form.sport}
                onChange={set("sport")}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s} style={{ background: T.bg }}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Portal Login Email *</label>
            <input value={form.loginEmail} onChange={set("loginEmail")} placeholder="athlete@norules.com" style={inputStyle} />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Password * (min 6 chars)</label>
            <input value={form.password} onChange={set("password")} placeholder="Create a password…" style={inputStyle} />
            {form.password && form.password.length < 6 && (
              <div style={{ marginTop: 6, fontFamily: "DM Sans", fontSize: 11, color: T.danger }}>
                Password must be at least 6 characters.
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>MyFitnessPal Username (optional)</label>
            <input value={form.mfpUsername} onChange={set("mfpUsername")} placeholder="e.g. alexmorgan" style={inputStyle} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: "none",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: 11,
                color: T.muted,
                fontFamily: "DM Sans",
                fontSize: 13,
                cursor: "pointer",
              }}
              type="button"
            >
              Cancel
            </button>

            <button
              onClick={() => onCreate(form)}
              disabled={!valid || creating}
              style={{
                flex: 2,
                background: valid ? T.accent : T.border,
                color: valid ? T.bg : T.muted,
                border: "none",
                borderRadius: 10,
                padding: 11,
                fontFamily: "Bebas Neue, system-ui",
                fontSize: 16,
                letterSpacing: 1.5,
                cursor: valid && !creating ? "pointer" : "default",
                transition: "all .2s",
              }}
              type="button"
            >
              {creating ? "CREATING…" : "CREATE ATHLETE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Weekly Macro Plan — Rows per day
   - GET /macro-plans/:athleteId (optional but recommended)
   - PUT /macro-plans/:athleteId
────────────────────────────────────────────────────────────────────────────── */
function WeeklyMacroPlan({ athleteId, baseTargets, token, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const emptyWeek = () =>
    DAYS.reduce((acc, d) => {
      acc[d] = {
        calories: baseTargets?.calories ?? 2000,
        protein: baseTargets?.protein ?? 150,
        carbs: baseTargets?.carbs ?? 200,
        fat: baseTargets?.fat ?? 70,
      };
      return acc;
    }, {});

  const [plan, setPlan] = useState(emptyWeek());

  useEffect(() => {
    // refresh defaults when athlete changes
    setPlan(emptyWeek());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  const setCell = (day, key, value) => {
    const num = Number(value);
    setPlan((p) => ({
      ...p,
      [day]: { ...p[day], [key]: Number.isFinite(num) ? num : 0 },
    }));
  };

  const populateAll = () => setPlan(emptyWeek());

  // Load saved plan if endpoint exists
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!athleteId) return;
      setErr("");
      setLoading(true);
      try {
        const rows = await apiFetch(`/macro-plans/${athleteId}`, token);
        if (ignore) return;

        const next = emptyWeek();
        (rows || []).forEach((r) => {
          const d = String(r.day_of_week || "").toUpperCase();
          if (!next[d]) return;
          next[d] = {
            calories: r.calories ?? next[d].calories,
            protein: r.protein_g ?? next[d].protein,
            carbs: r.carbs_g ?? next[d].carbs,
            fat: r.fat_g ?? next[d].fat,
          };
        });
        setPlan(next);
      } catch (e) {
        // If not added yet, keep local-only
        setErr(e.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  const savePlan = async () => {
    setErr("");
    setSaving(true);
    try {
      const payload = {
        plans: DAYS.map((d) => ({
          dayOfWeek: d,
          calories: plan[d].calories,
          protein_g: plan[d].protein,
          carbs_g: plan[d].carbs,
          fat_g: plan[d].fat,
        })),
      };

      await apiFetch(`/macro-plans/${athleteId}`, token, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setSaved(true);
      onSaved?.(plan);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const avg = useMemo(() => {
    const s = DAYS.reduce(
      (a, d) => {
        a.calories += plan[d].calories;
        a.protein += plan[d].protein;
        a.carbs += plan[d].carbs;
        a.fat += plan[d].fat;
        return a;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      calories: Math.round(s.calories / 7),
      protein: Math.round(s.protein / 7),
      carbs: Math.round(s.carbs / 7),
      fat: Math.round(s.fat / 7),
    };
  }, [plan]);

  const macroTh = {
    textAlign: "left",
    fontFamily: "Bebas Neue, system-ui",
    fontSize: 12,
    letterSpacing: 1.5,
    color: "#9aa0a6",
    padding: "10px 10px",
    borderBottom: `1px solid ${T.border}`,
  };

  const macroTd = {
    padding: "8px 10px",
    borderBottom: `1px solid ${T.border}22`,
    minWidth: 120,
  };

  const macroDayCell = {
    padding: "8px 10px",
    borderBottom: `1px solid ${T.border}22`,
    fontFamily: "Bebas Neue, system-ui",
    letterSpacing: 1.5,
    color: T.accent,
    minWidth: 70,
  };

  const macroAvg = {
    padding: "10px 10px",
    fontFamily: "JetBrains Mono, ui-monospace",
    color: T.muted,
    borderTop: `1px solid ${T.border}`,
  };

  const macroInput = {
    width: "100%",
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "8px 10px",
    color: T.text,
    fontFamily: "JetBrains Mono, ui-monospace",
    fontSize: 12,
    outline: "none",
  };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 18, letterSpacing: 2, color: T.text }}>
            WEEKLY MACRO PLAN
          </div>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, color: T.muted, marginTop: 4 }}>
            Rows per day · edit specific days or populate all days as an overview.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={populateAll}
            style={{
              background: `${T.accent}14`,
              border: `1px solid ${T.accent}40`,
              borderRadius: 10,
              padding: "8px 14px",
              color: T.accent,
              fontFamily: "DM Sans",
              fontSize: 12,
              cursor: "pointer",
            }}
            type="button"
          >
            ⇅ Populate all days
          </button>

          <button
            onClick={savePlan}
            disabled={saving || loading}
            style={{
              background: saving ? T.border : T.accent,
              border: "none",
              borderRadius: 10,
              padding: "8px 16px",
              color: saving ? T.muted : T.bg,
              fontFamily: "Bebas Neue, system-ui",
              fontSize: 14,
              letterSpacing: 1.5,
              cursor: saving ? "default" : "pointer",
            }}
            type="button"
          >
            {saving ? "SAVING…" : "SAVE PLAN"}
          </button>
        </div>
      </div>

      {saved && (
        <div
          style={{
            background: `${T.coachGreen}18`,
            border: `1px solid ${T.coachGreen}44`,
            borderRadius: 10,
            padding: "10px 14px",
            fontFamily: "DM Sans",
            fontSize: 12,
            color: T.coachGreen,
            marginBottom: 12,
          }}
        >
          ✓ Macro plan saved.
        </div>
      )}

      {err && (
        <div
          style={{
            background: `${T.warn}18`,
            border: `1px solid ${T.warn}44`,
            borderRadius: 10,
            padding: "10px 14px",
            fontFamily: "DM Sans",
            fontSize: 12,
            color: T.warn,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontFamily: "DM Sans" }}>
          <thead>
            <tr>
              <th style={macroTh}>DAY</th>
              <th style={macroTh}>CAL</th>
              <th style={macroTh}>PRO (g)</th>
              <th style={macroTh}>CARB (g)</th>
              <th style={macroTh}>FAT (g)</th>
            </tr>
          </thead>

          <tbody>
            {DAYS.map((d) => (
              <tr key={d}>
                <td style={macroDayCell}>{d}</td>

                <td style={macroTd}>
                  <input type="number" value={plan[d].calories} onChange={(e) => setCell(d, "calories", e.target.value)} style={macroInput} />
                </td>

                <td style={macroTd}>
                  <input type="number" value={plan[d].protein} onChange={(e) => setCell(d, "protein", e.target.value)} style={macroInput} />
                </td>

                <td style={macroTd}>
                  <input type="number" value={plan[d].carbs} onChange={(e) => setCell(d, "carbs", e.target.value)} style={macroInput} />
                </td>

                <td style={macroTd}>
                  <input type="number" value={plan[d].fat} onChange={(e) => setCell(d, "fat", e.target.value)} style={macroInput} />
                </td>
              </tr>
            ))}

            <tr>
              <td style={{ ...macroDayCell, color: T.muted }}>AVG</td>
              <td style={macroAvg}>{avg.calories}</td>
              <td style={macroAvg}>{avg.protein}</td>
              <td style={macroAvg}>{avg.carbs}</td>
              <td style={macroAvg}>{avg.fat}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {loading && (
        <div style={{ marginTop: 10, fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>
          Loading saved macro plan…
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Athlete detail panel (click athlete -> opens)
   Tabs:
   - NUTRITION (base targets used for overview)
   - MACRO PLAN (rows-per-day)
────────────────────────────────────────────────────────────────────────────── */
function AthleteDetail({ athlete, token, onBack }) {
  const [tab, setTab] = useState("nutrition");
  const [editing, setEditing] = useState(false);
  const [goals, setGoals] = useState(() => ({
    calories: athlete.macroGoals?.calories ?? 2500,
    protein: athlete.macroGoals?.protein ?? 180,
    carbs: athlete.macroGoals?.carbs ?? 280,
    fat: athlete.macroGoals?.fat ?? 75,
  }));
  const [saved, setSaved] = useState(false);

  const handleSaveTargets = () => {
    // Targets here are local UI "defaults" used for Populate All Days.
    // If you want to persist these as well, add an endpoint and POST here.
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const tabs = [
    { id: "nutrition", label: "NUTRITION" },
    { id: "macroplan", label: "MACRO PLAN" },
    { id: "targets", label: "TARGETS (CAL)" },
    { id: "checkins", label: "CHECK-INS" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp .2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={onBack}
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: "6px 14px",
            color: T.muted,
            fontFamily: "DM Sans",
            fontSize: 12,
            cursor: "pointer",
          }}
          type="button"
        >
          ← Back
        </button>

        <Avatar initials={athlete.avatar} color={athlete.avatarColor} size={52} />

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
            <span style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 26, letterSpacing: 1.5, color: T.text }}>
              {athlete.name.toUpperCase()}
            </span>
            <Badge label={athlete.sport || "ATHLETE"} color={T.coachGreen} />
          </div>

          <div style={{ fontFamily: "JetBrains Mono, ui-monospace", fontSize: 11, color: T.muted }}>
            {athlete.email}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="CAL TARGET" value={goals.calories} color={T.accent} unit="kcal" />
        <StatCard label="PROTEIN" value={goals.protein} color={T.protein} unit="g" />
        <StatCard label="CARBS" value={goals.carbs} color={T.carbs} unit="g" />
        <StatCard label="FAT" value={goals.fat} color={T.fat} unit="g" />
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, gap: 1, overflowX: "auto" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "Bebas Neue, system-ui",
              fontSize: 13,
              letterSpacing: 1.5,
              color: tab === t.id ? T.accent : T.muted,
              whiteSpace: "nowrap",
              borderBottom: tab === t.id ? `2px solid ${T.accent}` : "2px solid transparent",
              marginBottom: -1,
              transition: "all .2s",
            }}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "nutrition" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 22 }}>
          {saved && (
            <div
              style={{
                background: `${T.coachGreen}18`,
                border: `1px solid ${T.coachGreen}44`,
                borderRadius: 10,
                padding: "10px 14px",
                fontFamily: "DM Sans",
                fontSize: 12,
                color: T.coachGreen,
                marginBottom: 12,
              }}
            >
              ✓ Targets updated (local defaults for macro overview).
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 18, letterSpacing: 2, color: T.text }}>
                MACRO TARGETS (DEFAULTS)
              </div>
              <div style={{ fontFamily: "DM Sans", fontSize: 11, color: T.muted, marginTop: 4 }}>
                Used by “Populate all days” in the Macro Plan tab.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {editing ? (
                <>
                  <button
                    onClick={() => {
                      setGoals({
                        calories: athlete.macroGoals?.calories ?? 2500,
                        protein: athlete.macroGoals?.protein ?? 180,
                        carbs: athlete.macroGoals?.carbs ?? 280,
                        fat: athlete.macroGoals?.fat ?? 75,
                      });
                      setEditing(false);
                    }}
                    style={{
                      background: "none",
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      padding: "8px 12px",
                      color: T.muted,
                      fontFamily: "DM Sans",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                    type="button"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleSaveTargets}
                    style={{
                      background: T.accent,
                      border: "none",
                      borderRadius: 10,
                      padding: "8px 14px",
                      color: T.bg,
                      fontFamily: "Bebas Neue, system-ui",
                      fontSize: 14,
                      letterSpacing: 1.5,
                      cursor: "pointer",
                    }}
                    type="button"
                  >
                    SAVE
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    background: "none",
                    border: `1px solid ${T.accent}44`,
                    borderRadius: 10,
                    padding: "8px 14px",
                    color: T.accent,
                    fontFamily: "DM Sans",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                  type="button"
                >
                  ✏ Edit Targets
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { key: "calories", label: "Calories", unit: "kcal", color: T.accent },
              { key: "protein", label: "Protein", unit: "g", color: T.protein },
              { key: "carbs", label: "Carbs", unit: "g", color: T.carbs },
              { key: "fat", label: "Fat", unit: "g", color: T.fat },
            ].map((m) => (
              <div key={m.key}>
                <label style={labelStyle}>{m.label}</label>
                {editing ? (
                  <input
                    type="number"
                    value={goals[m.key]}
                    onChange={(e) => setGoals((g) => ({ ...g, [m.key]: clamp(Number(e.target.value), 0, 20000) }))}
                    style={{
                      ...inputStyle,
                      border: `1px solid ${m.color}44`,
                      color: m.color,
                      fontFamily: "JetBrains Mono, ui-monospace",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 30, color: m.color }}>{goals[m.key]}</span>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>{m.unit}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "macroplan" && (
        <WeeklyMacroPlan athleteId={athlete.id} baseTargets={goals} token={token} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Coach CMS
────────────────────────────────────────────────────────────────────────────── */


/* ─────────────────────────────────────────────────────────────────────────────
   Calendar helpers (coach)
───────────────────────────────────────────────────────────────────────────── */
function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function weekStartISO(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function dateForWeekDay(weekOffset, dayKey) {
  const idx = DAYS.indexOf(dayKey);
  const start = weekStartISO(weekOffset);
  const d = new Date(start);
  d.setDate(start.getDate() + (idx < 0 ? 0 : idx));
  return isoDate(d);
}

function miniBtnStyle() {
  return {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: "8px 10px",
    color: T.muted,
    cursor: "pointer",
    fontFamily: "DM Sans",
    fontSize: 12,
  };
}

function thStyle() {
  return {
    textAlign: "left",
    fontFamily: "Bebas Neue, system-ui",
    letterSpacing: 1.5,
    fontSize: 12,
    color: T.muted,
    padding: "10px 10px",
    borderBottom: `1px solid ${T.border}`,
  };
}

function tdStyle() {
  return {
    padding: "10px 10px",
    borderBottom: `1px solid ${T.border}22`,
    fontFamily: "DM Sans",
    fontSize: 12,
    color: T.text,
    verticalAlign: "middle",
  };
}

function cellInput() {
  return {
    width: 70,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: "8px 10px",
    color: T.text,
    fontFamily: "JetBrains Mono",
    fontSize: 12,
    outline: "none",
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TargetsCalendar — calendar-based macro targets (coach -> client)
   Uses backend: GET/PUT /macro-targets/:athleteId
───────────────────────────────────────────────────────────────────────────── */
function TargetsCalendar({ athleteId, token, defaults }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const start = isoDate(weekStartISO(weekOffset));
  const endD = new Date(weekStartISO(weekOffset));
  endD.setDate(endD.getDate() + 6);
  const end = isoDate(endD);

  const load = async () => {
    if (!athleteId) return;
    setErr("");
    try {
      const data = await apiFetch(`/macro-targets/${athleteId}?start=${start}&end=${end}`, token);
      const map = {};
      (data || []).forEach((r) => {
        map[r.date] = {
          calories: Number(r.calories || 0),
          protein_g: Number(r.protein_g || 0),
          carbs_g: Number(r.carbs_g || 0),
          fat_g: Number(r.fat_g || 0),
        };
      });
      for (const d of DAYS) {
        const iso = dateForWeekDay(weekOffset, d);
        if (!map[iso]) {
          map[iso] = {
            calories: defaults.calories,
            protein_g: defaults.protein,
            carbs_g: defaults.carbs,
            fat_g: defaults.fat,
          };
        }
      }
      setRows(map);
    } catch (e) {
      setErr(e.message || "Could not load targets");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId, weekOffset]);

  const setField = (date, key, val) => {
    setRows((prev) => ({
      ...prev,
      [date]: { ...prev[date], [key]: clamp(Number(val), 0, 20000) },
    }));
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      const entries = Object.entries(rows).map(([date, v]) => ({
        date,
        calories: Number(v.calories || 0),
        protein_g: Number(v.protein_g || 0),
        carbs_g: Number(v.carbs_g || 0),
        fat_g: Number(v.fat_g || 0),
      }));
      await apiFetch(`/macro-targets/${athleteId}`, token, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setErr(e.message || "Could not save targets");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 18, letterSpacing: 2, color: T.text }}>
            CALENDAR TARGETS
          </div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>
            Set per-date macro targets (history kept).
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setWeekOffset((w) => w - 1)} style={miniBtnStyle()} type="button">◀</button>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.muted }}>{start} → {end}</div>
          <button onClick={() => setWeekOffset((w) => Math.min(0, w + 1))} style={miniBtnStyle()} type="button">▶</button>
          <button onClick={save} disabled={saving} style={{ ...miniBtnStyle(), borderColor: `${T.accent}55`, color: T.accent }} type="button">
            {saving ? "SAVING…" : "SAVE"}
          </button>
        </div>
      </div>

      {err ? (
        <div style={{ marginTop: 12, background: `${T.warn}18`, border: `1px solid ${T.warn}44`, borderRadius: 12, padding: 12, color: T.warn, fontFamily: "DM Sans", fontSize: 12 }}>
          {err}
        </div>
      ) : null}
      {saved ? (
        <div style={{ marginTop: 12, background: `${T.coachGreen}18`, border: `1px solid ${T.coachGreen}44`, borderRadius: 12, padding: 12, color: T.coachGreen, fontFamily: "DM Sans", fontSize: 12 }}>
          ✓ Saved
        </div>
      ) : null}

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={thStyle()}>DAY</th>
              <th style={thStyle()}>DATE</th>
              <th style={thStyle()}>CAL</th>
              <th style={thStyle()}>P</th>
              <th style={thStyle()}>C</th>
              <th style={thStyle()}>F</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => {
              const date = dateForWeekDay(weekOffset, d);
              const v = rows[date] || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
              return (
                <tr key={date}>
                  <td style={tdStyle()}>{d}</td>
                  <td style={{ ...tdStyle(), fontFamily: "JetBrains Mono" }}>{date}</td>
                  <td style={tdStyle()}><input value={v.calories} onChange={(e) => setField(date, "calories", e.target.value)} style={cellInput()} /></td>
                  <td style={tdStyle()}><input value={v.protein_g} onChange={(e) => setField(date, "protein_g", e.target.value)} style={cellInput()} /></td>
                  <td style={tdStyle()}><input value={v.carbs_g} onChange={(e) => setField(date, "carbs_g", e.target.value)} style={cellInput()} /></td>
                  <td style={tdStyle()}><input value={v.fat_g} onChange={(e) => setField(date, "fat_g", e.target.value)} style={cellInput()} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CheckinsPanel — weight, mood, macros consumed (daily totals)
───────────────────────────────────────────────────────────────────────────── */
function CheckinsPanel({ athleteId, token }) {
  const [rangeDays, setRangeDays] = useState(30);
  const [weights, setWeights] = useState([]);
  const [moods, setMoods] = useState([]);
  const [totals, setTotals] = useState([]);
  const [err, setErr] = useState("");

  const end = isoDate(new Date());
  const startD = new Date();
  startD.setDate(startD.getDate() - (rangeDays - 1));
  const start = isoDate(startD);

  const load = async () => {
    setErr("");
    try {
      const [w, m, t] = await Promise.all([
        apiFetch(`/weights/${athleteId}`, token),
        apiFetch(`/moods/${athleteId}`, token),
        apiFetch(`/daily-totals/${athleteId}?start=${start}&end=${end}`, token),
      ]);
      setWeights(Array.isArray(w) ? w : []);
      setMoods(Array.isArray(m) ? m : []);
      setTotals(Array.isArray(t) ? t : []);
    } catch (e) {
      setErr(e.message || "Could not load check-ins");
    }
  };

  useEffect(() => {
    if (!athleteId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId, rangeDays]);

  const moodMap = Object.fromEntries(moods.map((r) => [r.date, r]));
  const weightMap = Object.fromEntries(weights.map((r) => [r.date, r]));
  const totalMap = Object.fromEntries(totals.map((r) => [r.date, r]));

  const dates = [];
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(startD.getTime() + i * 86400000);
    dates.push(isoDate(d));
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 18, letterSpacing: 2, color: T.text }}>
            CHECK-INS & CONSUMPTION
          </div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>
            Weight, mood, and macros consumed — by date.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[7, 30, 90, 180].map((d) => (
            <button
              key={d}
              onClick={() => setRangeDays(d)}
              style={{
                ...miniBtnStyle(),
                borderColor: rangeDays === d ? `${T.accent}66` : T.border,
                color: rangeDays === d ? T.accent : T.muted,
              }}
              type="button"
            >
              {d}d
            </button>
          ))}
          <button onClick={load} style={{ ...miniBtnStyle(), borderColor: `${T.info}55`, color: T.info }} type="button">Refresh</button>
        </div>
      </div>

      {err ? (
        <div style={{ marginTop: 12, background: `${T.warn}18`, border: `1px solid ${T.warn}44`, borderRadius: 12, padding: 12, color: T.warn, fontFamily: "DM Sans", fontSize: 12 }}>
          {err}
        </div>
      ) : null}

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={thStyle()}>DATE</th>
              <th style={thStyle()}>WEIGHT (KG)</th>
              <th style={thStyle()}>MOOD</th>
              <th style={thStyle()}>CAL</th>
              <th style={thStyle()}>P</th>
              <th style={thStyle()}>C</th>
              <th style={thStyle()}>F</th>
              <th style={thStyle()}>NOTE</th>
            </tr>
          </thead>
          <tbody>
            {dates.slice().reverse().map((date) => {
              const w = weightMap[date];
              const m = moodMap[date];
              const t = totalMap[date];
              return (
                <tr key={date}>
                  <td style={{ ...tdStyle(), fontFamily: "JetBrains Mono" }}>{date}</td>
                  <td style={tdStyle()}>{w ? Number(w.kg).toFixed(1) : "—"}</td>
                  <td style={tdStyle()}>{m ? `${m.emoji || ""} ${m.label || m.mood_id}` : "—"}</td>
                  <td style={tdStyle()}>{t ? t.calories : "—"}</td>
                  <td style={tdStyle()}>{t ? t.protein_g : "—"}</td>
                  <td style={tdStyle()}>{t ? t.carbs_g : "—"}</td>
                  <td style={tdStyle()}>{t ? t.fat_g : "—"}</td>
                  <td style={{ ...tdStyle(), color: T.muted }}>{t?.note || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export default function CoachCMS() {
  const [me, setMe] = useState(null); // { id, email, name, role, token }
  const [token, setToken] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterErr, setRosterErr] = useState("");
  const [athletes, setAthletes] = useState([]);
  const [view, setView] = useState("overview"); // overview | athlete
  const [selected, setSelected] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);

  // Inject fonts once
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  // Try restore session token from localStorage, then /auth/me
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return;

    setToken(t);
    (async () => {
      try {
        const user = await apiFetch("/auth/me", t); // backend supports this [1](https://github.com/orgs/community/discussions/151670)
        setMe({ ...user, token: t });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setMe(null);
      }
    })();
  }, []);

  // Load roster after login
  useEffect(() => {
    if (!token || !me) return;
    if (me.role !== "coach") return;

    setRosterErr("");
    setLoadingRoster(true);

    (async () => {
      try {
        const rows = await apiFetch("/athletes", token); // backend supports this [1](https://github.com/orgs/community/discussions/151670)
        const mapped = rows.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          sport: a.sport || "—",
          avatar: initialsOf(a.name),
          avatarColor: randomAvatarColor(),
          macroGoals: { calories: 2500, protein: 180, carbs: 280, fat: 75 },
        }));
        setAthletes(mapped);
      } catch (e) {
        setRosterErr(e.message);
      } finally {
        setLoadingRoster(false);
      }
    })();
  }, [token, me]);

  const onLoggedIn = (userWithToken) => {
    setMe(userWithToken);
    setToken(userWithToken.token);
  };

  const logout = async () => {
    try {
      if (token) await apiFetch("/auth/logout", token, { method: "POST" }); // optional [1](https://github.com/orgs/community/discussions/151670)
    } catch {}
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
    setAthletes([]);
    setSelected(null);
    setView("overview");
  };

  const createAthlete = async (form) => {
    setCreating(true);
    try {
      const created = await apiFetch("/athletes", token, {
        method: "POST",
        body: JSON.stringify({
          email: form.loginEmail.trim().toLowerCase(),
          name: form.name.trim(),
          password: form.password,
          sport: form.sport,
          mfpUsername: form.mfpUsername?.trim() || null,
        }),
      }); // backend supports POST /athletes [1](https://github.com/orgs/community/discussions/151670)

      const mapped = {
        id: created.id,
        name: created.name,
        email: created.email,
        sport: created.sport || form.sport || "—",
        avatar: initialsOf(created.name),
        avatarColor: randomAvatarColor(),
        macroGoals: { calories: 2500, protein: 180, carbs: 280, fat: 75 },
      };

      setAthletes((p) => [mapped, ...p].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAdd(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  if (!me || !token) {
    return <CoachLogin onLoggedIn={onLoggedIn} />;
  }

  // Basic coach-only guard
  if (me.role !== "coach") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "DM Sans", padding: 30 }}>
        <h2 style={{ fontFamily: "Bebas Neue, system-ui", letterSpacing: 2 }}>Access denied</h2>
        <p style={{ color: T.muted, marginTop: 10 }}>
          Your account role is <strong>{me.role}</strong>. This portal is for coaches only.
        </p>
        <button
          onClick={logout}
          style={{
            marginTop: 16,
            background: T.accent,
            border: "none",
            color: T.bg,
            borderRadius: 10,
            padding: "10px 16px",
            fontFamily: "Bebas Neue, system-ui",
            letterSpacing: 1.5,
            cursor: "pointer",
          }}
          type="button"
        >
          LOG OUT
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "DM Sans" }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: `${T.bg}f0`,
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <img src={LOGO_SRC} alt="NRN" style={{ width: 42, height: 42, borderRadius: "50%", border: `2px solid ${T.accent}44` }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 22, letterSpacing: 2 }}>NO RULES NUTRITION</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
              Coach: <span style={{ color: T.text, fontWeight: 600 }}>{me.name}</span> ·{" "}
              <span style={{ fontFamily: "JetBrains Mono, ui-monospace" }}>{me.email}</span>
            </div>
          </div>

          <Badge label="COACH" color={T.coachGreen} />

          <button
            onClick={logout}
            style={{
              background: "none",
              border: `1px solid ${T.border}`,
              color: T.muted,
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              fontFamily: "DM Sans",
              fontSize: 12,
            }}
            type="button"
          >
            Log out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px" }}>
        {view === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 28, letterSpacing: 2 }}>
                  CLIENT ROSTER
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted, marginTop: 4 }}>
                  Click an athlete to open their profile and macro plan.
                </div>
              </div>

              <button
                onClick={() => setShowAdd(true)}
                style={{
                  background: T.accent,
                  color: T.bg,
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 18px",
                  fontFamily: "Bebas Neue, system-ui",
                  fontSize: 14,
                  letterSpacing: 1.5,
                  cursor: "pointer",
                }}
                type="button"
              >
                + ADD ATHLETE
              </button>
            </div>

            {rosterErr && (
              <div
                style={{
                  background: `${T.danger}18`,
                  border: `1px solid ${T.danger}44`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  color: T.danger,
                  fontSize: 12,
                }}
              >
                {rosterErr}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              <StatCard label="TOTAL ATHLETES" value={athletes.length} color={T.accent} />
              <StatCard label="API" value="CONNECTED" color={T.coachGreen} sub={API_BASE} />
              <StatCard label="TOKEN" value={token ? "ACTIVE" : "—"} color={token ? T.coachGreen : T.warn} />
              <StatCard label="STATUS" value={loadingRoster ? "LOADING…" : "READY"} color={loadingRoster ? T.warn : T.text} />
            </div>

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 16, letterSpacing: 2 }}>ATHLETES</div>
                <Badge label={`${athletes.length} ATHLETES`} color={T.accent} />
              </div>

              {loadingRoster ? (
                <div style={{ padding: 18, color: T.muted }}>Loading athletes…</div>
              ) : athletes.length === 0 ? (
                <div style={{ padding: 18, color: T.muted }}>
                  No athletes found for this coach yet. Click <b>+ ADD ATHLETE</b> to create one.
                </div>
              ) : (
                athletes.map((a, idx) => (
                  <div
                    key={a.id}
                    onClick={() => {
                      setSelected(a);
                      setView("athlete");
                    }}
                    style={{
                      padding: "14px 18px",
                      borderBottom: idx < athletes.length - 1 ? `1px solid ${T.border}` : "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      transition: "background .15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.surface)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Avatar initials={a.avatar} color={a.avatarColor} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700 }}>{a.name}</span>
                        <Badge label={a.sport || "ATHLETE"} color={T.coachGreen} />
                      </div>
                      <div style={{ fontFamily: "JetBrains Mono, ui-monospace", fontSize: 10, color: T.muted, marginTop: 3 }}>
                        {a.email}
                      </div>
                    </div>
                    <div style={{ color: T.muted, fontSize: 12 }}>›</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === "athlete" && selected && (
          <AthleteDetail
            athlete={selected}
            token={token}
            onBack={() => {
              setView("overview");
              setSelected(null);
            }}
          />
        )}
      </div>

      {showAdd && (
        <AddAthleteModal
          onClose={() => setShowAdd(false)}
          onCreate={createAthlete}
          creating={creating}
        />
      )}
    </div>
  );
}