import { useEffect, useMemo, useState } from "react";
import logo from "./assets/no-rules-logo-220.png"; // ✅ your attached logo 

/**
 * CoachCMS.jsx (Full replacement)
 *
 * Fixes included:
 * ✅ Uses provided logo image
 * ✅ Macro plan SAVE persists even if backend returns 404:
 *    - If /macro-plans endpoint is missing, falls back to localStorage
 *    - Shows a banner "Local save mode" so you know it's not DB yet
 *
 * Backend assumptions:
 * - /auth/login POST -> { token, user }
 * - /auth/me GET -> user
 * - /auth/logout POST (optional)
 * - /athletes GET -> list
 * - /athletes POST -> create
 *
 * Macro plan endpoints (optional, currently missing in your case -> 404):
 * - GET /macro-plans/:athleteId
 * - PUT /macro-plans/:athleteId
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const TOKEN_KEY = "nrn_token";
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const T = {
  bg: "#0a0a0a",
  surface: "#111111",
  card: "#161616",
  border: "#1f1f1f",
  accent: "#FF9A52",
  text: "#f0f0f0",
  muted: "#777",
  protein: "#f97316",
  carbs: "#3b82f6",
  fat: "#a855f7",
  coachGreen: "#22c55e",
  danger: "#ef4444",
  warn: "#f59e0b",
};

async function apiFetch(path, token, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));

  // Attach status for smarter handling (e.g. 404 -> local fallback)
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function initialsOf(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "A").toUpperCase() + (parts[1]?.[0] || "");
}

function randomAvatarColor() {
  const colors = ["#3b82f6", "#a855f7", "#f97316", "#22c55e", "#FF9A52", "#ef4444", "#06b6d4"];
  return colors[Math.floor(Math.random() * colors.length)];
}

const labelStyle = {
  fontFamily: "DM Sans",
  fontSize: 11,
  color: T.muted,
  letterSpacing: 1,
  textTransform: "uppercase",
  display: "block",
  marginBottom: 6,
};

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

const StatCard = ({ label, value, color = T.text, unit }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 12px" }}>
    <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 26, color, lineHeight: 1 }}>
      {value}
      {unit && <span style={{ fontFamily: "DM Sans", fontSize: 11, color: T.muted, marginLeft: 6 }}>{unit}</span>}
    </div>
    <div style={{ fontFamily: "DM Sans", fontSize: 10, color: T.muted, letterSpacing: 1, marginTop: 6 }}>
      {label}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Login
────────────────────────────────────────────────────────────────────────────── */
function CoachLogin({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img
            src={logo}
            alt="No Rules Nutrition"
            style={{ width: 130, height: "auto", display: "block", margin: "0 auto 12px" }}
          />
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
            }}
            type="button"
          >
            {loading ? "SIGNING IN…" : "ACCESS COACH PORTAL"}
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: T.muted, textAlign: "center" }}>
          API: <span style={{ fontFamily: "JetBrains Mono, ui-monospace" }}>{API_BASE}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Weekly Macro Plan (rows per day) with localStorage fallback on 404
────────────────────────────────────────────────────────────────────────────── */
function WeeklyMacroPlan({ athleteId, baseTargets, token }) {
  const LS_KEY = `macroplan:${athleteId}`;
  const [plan, setPlan] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [localMode, setLocalMode] = useState(false); // ✅ becomes true if API is missing (404)

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

  // Reset defaults when athlete changes
  useEffect(() => {
    setErr("");
    setSaved(false);
    setLocalMode(false);

    // Start with localStorage if it exists
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setPlan(parsed);
        return;
      } catch {
        // fall through to defaults
      }
    }
    setPlan(emptyWeek());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  // Try to load from API (if exists). If 404 -> keep localMode on.
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!athleteId) return;

      setLoading(true);
      setErr("");

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
        localStorage.setItem(LS_KEY, JSON.stringify(next)); // keep local in sync too
        setLocalMode(false);
      } catch (e) {
        // If endpoint doesn't exist yet, switch to local-only mode.
        if (e.status === 404) {
          setLocalMode(true);
          setErr("Macro plan API not found (404). Saving locally in this browser for now.");
          // keep whatever plan is already in state/local
        } else {
          setErr(e.message);
        }
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

  const setCell = (day, key, value) => {
    const num = Number(value);
    setPlan((p) => ({
      ...p,
      [day]: {
        ...p[day],
        [key]: Number.isFinite(num) ? num : 0,
      },
    }));
  };

  const populateAll = () => {
    const next = emptyWeek();
    setPlan(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  };

  const savePlan = async () => {
    setSaving(true);
    setErr("");

    // Always save locally (so it “remains” no matter what)
    localStorage.setItem(LS_KEY, JSON.stringify(plan));

    // If we already know API is missing, don’t attempt network
    if (localMode) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      setSaving(false);
      return;
    }

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
      setTimeout(() => setSaved(false), 1600);
      setLocalMode(false);
    } catch (e) {
      if (e.status === 404) {
        setLocalMode(true);
        setErr("Macro plan API not found (404). Saved locally in this browser.");
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      } else {
        setErr(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const avg = useMemo(() => {
    const s = DAYS.reduce(
      (a, d) => {
        a.calories += plan?.[d]?.calories ?? 0;
        a.protein += plan?.[d]?.protein ?? 0;
        a.carbs += plan?.[d]?.carbs ?? 0;
        a.fat += plan?.[d]?.fat ?? 0;
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

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {localMode && <Badge label="LOCAL SAVE MODE" color={T.warn} />}

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
          ✓ Saved. {localMode ? "Stored in this browser." : "Stored in database."}
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
                  <input
                    type="number"
                    value={plan?.[d]?.calories ?? 0}
                    onChange={(e) => setCell(d, "calories", e.target.value)}
                    style={macroInput}
                  />
                </td>

                <td style={macroTd}>
                  <input
                    type="number"
                    value={plan?.[d]?.protein ?? 0}
                    onChange={(e) => setCell(d, "protein", e.target.value)}
                    style={macroInput}
                  />
                </td>

                <td style={macroTd}>
                  <input
                    type="number"
                    value={plan?.[d]?.carbs ?? 0}
                    onChange={(e) => setCell(d, "carbs", e.target.value)}
                    style={macroInput}
                  />
                </td>

                <td style={macroTd}>
                  <input
                    type="number"
                    value={plan?.[d]?.fat ?? 0}
                    onChange={(e) => setCell(d, "fat", e.target.value)}
                    style={macroInput}
                  />
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
   Athlete Detail
────────────────────────────────────────────────────────────────────────────── */
function AthleteDetail({ athlete, token, onBack }) {
  const [tab, setTab] = useState("macroplan");

  // base targets used by "Populate all days"
  const [goals, setGoals] = useState({
    calories: 2500,
    protein: 180,
    carbs: 280,
    fat: 75,
  });

  const tabs = [
    { id: "macroplan", label: "MACRO PLAN" },
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
        <StatCard label="CAL DEFAULT" value={goals.calories} color={T.accent} unit="kcal" />
        <StatCard label="PRO DEFAULT" value={goals.protein} color={T.protein} unit="g" />
        <StatCard label="CARB DEFAULT" value={goals.carbs} color={T.carbs} unit="g" />
        <StatCard label="FAT DEFAULT" value={goals.fat} color={T.fat} unit="g" />
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
            }}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "macroplan" && (
        <WeeklyMacroPlan athleteId={athlete.id} baseTargets={goals} token={token} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Coach CMS
────────────────────────────────────────────────────────────────────────────── */
export default function CoachCMS() {
  const [me, setMe] = useState(null);
  const [token, setToken] = useState(null);

  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterErr, setRosterErr] = useState("");
  const [athletes, setAthletes] = useState([]);

  const [view, setView] = useState("overview");
  const [selected, setSelected] = useState(null);

  // Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  // Restore token session
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    setToken(t);

    (async () => {
      try {
        const user = await apiFetch("/auth/me", t);
        setMe({ ...user, token: t });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setMe(null);
      }
    })();
  }, []);

  // Load athletes roster
  useEffect(() => {
    if (!token || !me) return;

    setLoadingRoster(true);
    setRosterErr("");

    (async () => {
      try {
        const rows = await apiFetch("/athletes", token);
        const mapped = rows.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          sport: a.sport || "—",
          avatar: initialsOf(a.name),
          avatarColor: randomAvatarColor(),
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
      if (token) await apiFetch("/auth/logout", token, { method: "POST" });
    } catch {}
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
    setAthletes([]);
    setSelected(null);
    setView("overview");
  };

  if (!me || !token) return <CoachLogin onLoggedIn={onLoggedIn} />;

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
          <img src={logo} alt="No Rules Nutrition" style={{ width: 46, height: "auto" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 22, letterSpacing: 2 }}>
              NO RULES NUTRITION
            </div>
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
                  Click an athlete to open their Macro Plan.
                </div>
              </div>
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
              <StatCard label="API" value="CONNECTED" color={T.coachGreen} />
              <StatCard label="STATUS" value={loadingRoster ? "LOADING…" : "READY"} color={loadingRoster ? T.warn : T.text} />
              <StatCard label="ENV" value={API_BASE.includes("localhost") ? "LOCAL" : "REMOTE"} color={T.muted} />
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
                  No athletes found yet.
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
    </div>
  );
}