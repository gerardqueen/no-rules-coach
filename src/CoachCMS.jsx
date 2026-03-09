import React, { useEffect, useMemo, useState } from "react";

/**
 * No Rules Nutrition — Coach CMS (beginner-friendly)
 * Features:
 * - Coach login (POST /auth/login)
 * - List athletes (GET /athletes)
 * - View + edit macro plans per athlete (GET /athletes/:id/macro-plans)
 * - Save macro plans per day (PUT /athletes/:id/macro-plans/:day)
 *
 * Backend must be running at API_URL and allow your coach site origin in CORS.
 */

const API_URL = "https://no-rules-api-production.up.railway.app";
const TOKEN_KEY = "coach_token";
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

async function apiJson(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const msg =
      (data && data.error) ||
      (typeof data === "string" && data) ||
      `${method} ${path} failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

function Card({ title, children }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      {children}
    </div>
  );
}

function Button({ children, onClick, disabled, kind = "primary", style }) {
  const base = kind === "primary" ? styles.btnPrimary : styles.btnSecondary;
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...style }}>
      {children}
    </button>
  );
}

function Input({ value, onChange, type = "text", placeholder, style }) {
  return (
    <input
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      style={{ ...styles.input, ...style }}
    />
  );
}

function NumberInput({ value, onChange }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={onChange}
      style={styles.numberInput}
    />
  );
}

function Banner({ kind = "info", children }) {
  const s =
    kind === "error"
      ? styles.bannerError
      : kind === "success"
      ? styles.bannerSuccess
      : styles.bannerInfo;
  return <div style={s}>{children}</div>;
}

/**
 * Macro Plans Panel
 * - Loads 7 rows (MON..SUN) from backend
 * - Allows editing local state
 * - Saves each day with PUT
 */
function MacroPlansPanel({ token, athleteId }) {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [savingDay, setSavingDay] = useState(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Load macro plans
  useEffect(() => {
    if (!token || !athleteId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr("");
      setOk("");
      try {
        const rows = await apiJson(`/athletes/${athleteId}/macro-plans`, {
          token,
        });
        if (!cancelled) setPlans(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load macro plans");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, athleteId]);

  const rowForDay = useMemo(() => {
    const map = new Map(plans.map((p) => [p.day_of_week, p]));
    return (day) =>
      map.get(day) || {
        day_of_week: day,
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      };
  }, [plans]);

  function updateLocal(day, field, value) {
    const n = Number(value);
    setPlans((prev) => {
      // ensure row exists
      const exists = prev.some((p) => p.day_of_week === day);
      const next = exists
        ? prev.map((p) =>
            p.day_of_week === day ? { ...p, [field]: n } : p
          )
        : [...prev, { day_of_week: day, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, [field]: n }];
      return next;
    });
  }

  async function saveDay(day) {
    setErr("");
    setOk("");

    const r = rowForDay(day);

    // IMPORTANT: backend expects protein_g/carbs_g/fat_g keys
    const payload = {
      calories: Number(r.calories) || 0,
      protein_g: Number(r.protein_g) || 0,
      carbs_g: Number(r.carbs_g) || 0,
      fat_g: Number(r.fat_g) || 0,
    };

    setSavingDay(day);
    try {
      await apiJson(`/athletes/${athleteId}/macro-plans/${day}`, {
        method: "PUT",
        token,
        body: payload,
      });
      setOk(`Saved ${day}`);
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setSavingDay(null);
    }
  }

  return (
    <Card title="Macro Plans (MON–SUN)">
      {err && <Banner kind="error">{err}</Banner>}
      {ok && <Banner kind="success">✓ {ok}</Banner>}

      {loading ? (
        <div style={styles.muted}>Loading…</div>
      ) : (
        <div style={styles.macroGrid}>
          <div style={styles.macroHeader}>DAY</div>
          <div style={styles.macroHeader}>CAL</div>
          <div style={styles.macroHeader}>P (g)</div>
          <div style={styles.macroHeader}>C (g)</div>
          <div style={styles.macroHeader}>F (g)</div>
          <div />

          {DAYS.map((day) => {
            const r = rowForDay(day);
            return (
              <React.Fragment key={day}>
                <div style={styles.dayCell}>{day}</div>

                <NumberInput
                  value={Number(r.calories) || 0}
                  onChange={(e) => updateLocal(day, "calories", e.target.value)}
                />
                <NumberInput
                  value={Number(r.protein_g) || 0}
                  onChange={(e) => updateLocal(day, "protein_g", e.target.value)}
                />
                <NumberInput
                  value={Number(r.carbs_g) || 0}
                  onChange={(e) => updateLocal(day, "carbs_g", e.target.value)}
                />
                <NumberInput
                  value={Number(r.fat_g) || 0}
                  onChange={(e) => updateLocal(day, "fat_g", e.target.value)}
                />

                <Button
                  kind="primary"
                  disabled={savingDay === day}
                  onClick={() => saveDay(day)}
                >
                  {savingDay === day ? "Saving…" : "Save"}
                </Button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div style={{ ...styles.muted, marginTop: 10 }}>
        Tip: Save is per-day. Edit MON, click Save, repeat for other days.
      </div>
    </Card>
  );
}

/**
 * Main Coach CMS
 */
export default function CoachCMS() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [athletes, setAthletes] = useState([]);
  const [athletesLoading, setAthletesLoading] = useState(false);
  const [athletesErr, setAthletesErr] = useState("");

  const [selectedAthleteId, setSelectedAthleteId] = useState(null);

  // If token exists, try loading /auth/me and athletes
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const me = await apiJson("/auth/me", { token });
        setUser(me);

        // Only coaches should use this CMS
        if (me?.role && me.role !== "coach") {
          throw new Error("This account is not a coach.");
        }
      } catch (e) {
        // token invalid/expired or not coach
        logout();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Load athletes when token is available
  useEffect(() => {
    if (!token) return;

    (async () => {
      setAthletesLoading(true);
      setAthletesErr("");
      try {
        const rows = await apiJson("/athletes", { token });
        setAthletes(Array.isArray(rows) ? rows : []);

        // auto-select first athlete
        if (Array.isArray(rows) && rows.length && !selectedAthleteId) {
          setSelectedAthleteId(rows[0].id);
        }
      } catch (e) {
        setAthletesErr(e.message || "Failed to load athletes");
      } finally {
        setAthletesLoading(false);
      }
    })();
  }, [token]); // intentionally not depending on selectedAthleteId

  async function login() {
    setLoginErr("");
    setLoginLoading(true);
    try {
      const data = await apiJson("/auth/login", {
        method: "POST",
        body: { email: loginEmail, password: loginPass },
      });

      const t = data?.token;
      const u = data?.user;

      if (!t) throw new Error("No token returned from server.");
      if (u?.role && u.role !== "coach") throw new Error("This account is not a coach.");

      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setUser(u || null);
      setLoginEmail("");
      setLoginPass("");
    } catch (e) {
      setLoginErr(e.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setAthletes([]);
    setSelectedAthleteId(null);
    setLoginErr("");
    setAthletesErr("");
  }

  const selectedAthlete = useMemo(
    () => athletes.find((a) => a.id === selectedAthleteId) || null,
    [athletes, selectedAthleteId]
  );

  // ---------- UI ----------
  if (!token) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <h1 style={styles.h1}>NO RULES NUTRITION — COACH PORTAL</h1>
          <div style={styles.muted}>Sign in with your coach credentials.</div>

          <div style={{ height: 16 }} />

          <Card title="Coach Login">
            {loginErr && <Banner kind="error">{loginErr}</Banner>}

            <div style={styles.formRow}>
              <div style={styles.label}>Email</div>
              <Input
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="gerard@norules.com"
                type="email"
              />
            </div>

            <div style={styles.formRow}>
              <div style={styles.label}>Password</div>
              <Input
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
                type="password"
              />
            </div>

            <Button
              kind="primary"
              disabled={loginLoading || !loginEmail || !loginPass}
              onClick={login}
              style={{ width: "100%", marginTop: 10 }}
            >
              {loginLoading ? "Signing in…" : "Sign in"}
            </Button>

            <div style={{ ...styles.muted, marginTop: 10 }}>
              Use your real backend coach accounts (e.g. gerard@norules.com etc).
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.topTitle}>NO RULES NUTRITION</div>
          <div style={styles.muted}>
            Coach: <b>{user?.name || user?.email || "Logged in"}</b>
          </div>
        </div>
        <Button kind="secondary" onClick={logout}>
          Logout
        </Button>
      </div>

      <div style={styles.main}>
        {/* Left column: Athletes list */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarTitle}>Athletes</div>

          {athletesErr && <Banner kind="error">{athletesErr}</Banner>}
          {athletesLoading ? (
            <div style={styles.muted}>Loading athletes…</div>
          ) : athletes.length === 0 ? (
            <div style={styles.muted}>No athletes found for this coach.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {athletes.map((a) => {
                const active = a.id === selectedAthleteId;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAthleteId(a.id)}
                    style={{
                      ...styles.athleteBtn,
                      borderColor: active ? "#ff9a52" : "#2a2a2a",
                      background: active ? "#1b140f" : "#141414",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{a.name || "Unnamed"}</div>
                    <div style={styles.mutedSmall}>
                      #{a.id} · {a.email}
                    </div>
                    <div style={styles.mutedSmall}>
                      {a.sport || "—"} {a.mfp_username ? `· MFP: ${a.mfp_username}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Selected athlete + macro plans */}
        <div style={styles.content}>
          {!selectedAthlete ? (
            <Card title="Select an athlete">
              <div style={styles.muted}>
                Choose an athlete from the list on the left.
              </div>
            </Card>
          ) : (
            <>
              <Card title="Athlete Profile">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={styles.label}>Name</div>
                    <div style={styles.value}>{selectedAthlete.name}</div>
                  </div>
                  <div>
                    <div style={styles.label}>ID</div>
                    <div style={styles.value}>#{selectedAthlete.id}</div>
                  </div>
                  <div>
                    <div style={styles.label}>Email</div>
                    <div style={styles.value}>{selectedAthlete.email}</div>
                  </div>
                  <div>
                    <div style={styles.label}>Sport</div>
                    <div style={styles.value}>{selectedAthlete.sport || "—"}</div>
                  </div>
                  <div>
                    <div style={styles.label}>MFP Username</div>
                    <div style={styles.value}>{selectedAthlete.mfp_username || "—"}</div>
                  </div>
                </div>
              </Card>

              <MacroPlansPanel token={token} athleteId={selectedAthlete.id} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple beginner-friendly styles
const styles = {
  page: {
    minHeight: "100vh",
    background: "#0b0b0b",
    color: "#f0f0f0",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: 24,
  },
  h1: {
    fontSize: 22,
    margin: "0 0 6px 0",
    letterSpacing: 0.5,
  },
  muted: { color: "#a0a0a0", fontSize: 13 },
  mutedSmall: { color: "#9a9a9a", fontSize: 12, marginTop: 2 },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 22px",
    borderBottom: "1px solid #222",
    background: "#0f0f0f",
    position: "sticky",
    top: 0,
    zIndex: 5,
  },
  topTitle: { fontSize: 16, fontWeight: 800, letterSpacing: 1 },

  main: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 16,
    padding: 16,
    maxWidth: 1200,
    margin: "0 auto",
  },

  sidebar: {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 12,
    padding: 14,
    height: "fit-content",
  },
  sidebarTitle: { fontSize: 14, fontWeight: 800, marginBottom: 10 },

  athleteBtn: {
    textAlign: "left",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    cursor: "pointer",
    color: "#f0f0f0",
  },

  content: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  card: {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: 800, marginBottom: 10 },

  formRow: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 },
  label: { color: "#a0a0a0", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  value: { fontSize: 14, fontWeight: 600 },

  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#0d0d0d",
    color: "#f0f0f0",
    fontSize: 14,
  },
  numberInput: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#0d0d0d",
    color: "#f0f0f0",
    fontSize: 14,
    width: "100%",
  },

  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "#ff9a52",
    color: "#0b0b0b",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #333",
    background: "#141414",
    color: "#f0f0f0",
    fontWeight: 700,
    cursor: "pointer",
  },

  bannerInfo: {
    background: "#0b2447",
    border: "1px solid #1d4ed8",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 12,
    fontSize: 13,
  },
  bannerError: {
    background: "#2a0f12",
    border: "1px solid #ef4444",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 12,
    fontSize: 13,
    color: "#ffb4b4",
  },
  bannerSuccess: {
    background: "#102a18",
    border: "1px solid #22c55e",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 12,
    fontSize: 13,
    color: "#b7ffce",
  },

  macroGrid: {
    display: "grid",
    gridTemplateColumns: "70px 1fr 1fr 1fr 1fr 120px",
    gap: 8,
    alignItems: "center",
  },
  macroHeader: { fontSize: 12, fontWeight: 800, color: "#b0b0b0" },
  dayCell: { fontSize: 13, fontWeight: 800 },
};