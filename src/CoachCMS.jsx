import { useEffect, useMemo, useState } from "react";

// NO RULES NUTRITION — Coach CMS (single-file)
// Features:
// - Real login (JWT)
// - Create athlete accounts
// - Delete athletes (with confirmation)
// - Weekly macro plan (MON..SUN) save to backend
// - Calendar macro targets (per-date) save to backend
// - Weight/Mood/Consumed graphs (date-based)
// - Coach check-in calendar (links/notes by date)
// - Coach dashboard overview: weight % change, avg mood, adherence

const API_BASE = import.meta.env.VITE_API_URL || "https://no-rules-api-production.up.railway.app";
const TOKEN_KEY = "nrn_token";

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

async function apiFetch(path, token, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function weekStartISO(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
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

function miniBtnStyle(active = false, color = T.muted) {
  return {
    background: T.card,
    border: `1px solid ${active ? `${T.accent}66` : T.border}`,
    borderRadius: 10,
    padding: "8px 10px",
    color: active ? T.accent : color,
    cursor: "pointer",
    fontFamily: "DM Sans",
    fontSize: 12,
    whiteSpace: "nowrap",
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

function cellInput(width = 80) {
  return {
    width,
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

function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 26, letterSpacing: 1.5, color }}>{value}</div>
        <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>{unit}</div>
      </div>
    </div>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ marginTop: 12, background: `${T.warn}18`, border: `1px solid ${T.warn}44`, borderRadius: 12, padding: 12, color: T.warn, fontFamily: "DM Sans", fontSize: 12 }}>{msg}</div>
  );
}

function ConfirmDeleteModal({ open, athlete, onCancel, onConfirm, working, error }) {
  if (!open || !athlete) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "grid", placeItems: "center", zIndex: 999, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 560, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 20, letterSpacing: 2, color: T.danger }}>DELETE ATHLETE</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted, marginTop: 4 }}>
              This permanently deletes <b>{athlete.name}</b> and all their history.
            </div>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontFamily: "DM Sans" }} type="button">Close</button>
        </div>

        {error ? <ErrorBox msg={error} /> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button onClick={onCancel} disabled={working} style={{ ...miniBtnStyle(false), opacity: working ? 0.6 : 1 }} type="button">Cancel</button>
          <button onClick={onConfirm} disabled={working} style={{ background: working ? `${T.danger}55` : T.danger, border: "none", borderRadius: 12, padding: "10px 14px", color: T.bg, cursor: working ? "default" : "pointer", fontFamily: "Bebas Neue, system-ui", letterSpacing: 2 }} type="button">
            {working ? "DELETING…" : "DELETE"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SparkLine({ labels, values, color = T.accent, height = 170 }) {
  const width = 860;
  const pad = 26;
  if (!values.length) return null;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || 1;

  const x = (i) => pad + (i * (width - pad * 2)) / Math.max(1, values.length - 1);
  const y = (v) => pad + (1 - (v - minV) / span) * (height - pad * 2);

  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x="0" y="0" width={width} height={height} fill={T.surface} rx="14" />
      <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={3.6} fill={color} opacity={0.95} />
          <title>{`${labels[i]}: ${v}`}</title>
        </g>
      ))}
    </svg>
  );
}

function MultiLine({ labels, series, height = 200 }) {
  const width = 860;
  const pad = 26;
  if (!series?.length || !labels.length) return null;
  const all = series.flatMap((s) => s.values);
  const minV = Math.min(...all);
  const maxV = Math.max(...all);
  const span = maxV - minV || 1;
  const n = labels.length;

  const x = (i) => pad + (i * (width - pad * 2)) / Math.max(1, n - 1);
  const y = (v) => pad + (1 - (v - minV) / span) * (height - pad * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x="0" y="0" width={width} height={height} fill={T.surface} rx="14" />
      {series.map((s, si) => {
        const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
        return <path key={si} d={d} fill="none" stroke={s.color} strokeWidth="2.6" strokeLinecap="round" />;
      })}
    </svg>
  );
}

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", null, {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!data?.token) throw new Error("No token returned");
      localStorage.setItem(TOKEN_KEY, data.token);
      onLoggedIn(data.token, data.user);
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, display: "grid", placeItems: "center", padding: 18 }}>
      <div style={{ width: "100%", maxWidth: 520, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
        <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 28, letterSpacing: 2 }}>COACH LOGIN</div>
        <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted, marginTop: 4 }}>Real coach account (no demo users)</div>

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" style={{ width: "100%", ...cellInput("100%") }} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" style={{ width: "100%", ...cellInput("100%") }} />
          {err ? <ErrorBox msg={err} /> : null}
          <button onClick={submit} disabled={loading} style={{ background: loading ? T.border : T.accent, border: "none", borderRadius: 12, padding: "12px 16px", color: loading ? T.muted : T.bg, cursor: loading ? "default" : "pointer", fontFamily: "Bebas Neue, system-ui", fontSize: 16, letterSpacing: 3 }} type="button">
            {loading ? "SIGNING IN…" : "SIGN IN"}
          </button>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.muted }}>API: {API_BASE}</div>
        </div>
      </div>
    </div>
  );
}

function AddAthleteModal({ open, onClose, onCreated, token }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", sport: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ name: "", email: "", password: "", sport: "" });
    setErr("");
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setErr("");
    if (!form.name || !form.email || !form.password) {
      setErr("Name, email and password are required");
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch("/athletes", token, {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          sport: form.sport.trim() || null,
        }),
      });
      onCreated?.(created);
      onClose?.();
    } catch (e) {
      setErr(e.message || "Could not create athlete");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "grid", placeItems: "center", zIndex: 999, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 560, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 22, letterSpacing: 2 }}>ADD ATHLETE</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontFamily: "DM Sans" }} type="button">Close</button>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" style={{ width: "100%", ...cellInput("100%") }} />
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" style={{ width: "100%", ...cellInput("100%") }} />
          <input value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))} placeholder="Sport (optional)" style={{ width: "100%", ...cellInput("100%") }} />
          <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Password" type="password" style={{ width: "100%", ...cellInput("100%") }} />
          {err ? <ErrorBox msg={err} /> : null}
          <button onClick={submit} disabled={saving} style={{ background: saving ? T.border : T.accent, border: "none", borderRadius: 12, padding: "12px 16px", color: saving ? T.muted : T.bg, cursor: saving ? "default" : "pointer", fontFamily: "Bebas Neue, system-ui", fontSize: 15, letterSpacing: 3 }} type="button">
            {saving ? "CREATING…" : "CREATE"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WeeklyMacroPlan({ athleteId, token }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const byDay = useMemo(() => Object.fromEntries((rows || []).map((r) => [r.day_of_week, r])), [rows]);

  const load = async () => {
    setErr("");
    try {
      const data = await apiFetch(`/macro-plans/${athleteId}`, token);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Could not load macro plan");
    }
  };

  useEffect(() => {
    if (!athleteId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  const setField = (day, key, val) => {
    const num = Math.max(0, Math.min(20000, Number(val) || 0));
    setRows((prev) => {
      const existing = prev.find((r) => r.day_of_week === day);
      if (!existing) {
        return [...prev, { day_of_week: day, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, [key]: num }];
      }
      return prev.map((r) => (r.day_of_week === day ? { ...r, [key]: num } : r));
    });
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      const plans = DAYS.map((d) => {
        const r = byDay[d] || {};
        return {
          dayOfWeek: d,
          calories: Number(r.calories || 0),
          protein_g: Number(r.protein_g || 0),
          carbs_g: Number(r.carbs_g || 0),
          fat_g: Number(r.fat_g || 0),
        };
      });
      await apiFetch(`/macro-plans/${athleteId}`, token, { method: "PUT", body: JSON.stringify({ plans }) });
      await load();
    } catch (e) {
      setErr(e.message || "Could not save macro plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 18, letterSpacing: 2 }}>WEEKLY MACRO PLAN</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>Baseline plan (Mon-Sun)</div>
        </div>
        <button onClick={save} disabled={saving} style={{ ...miniBtnStyle(false, T.accent), borderColor: `${T.accent}55`, color: T.accent }} type="button">{saving ? "SAVING…" : "SAVE"}</button>
      </div>
      <ErrorBox msg={err} />

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={thStyle()}>DAY</th>
              <th style={thStyle()}>CAL</th>
              <th style={thStyle()}>P</th>
              <th style={thStyle()}>C</th>
              <th style={thStyle()}>F</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => {
              const r = byDay[d] || {};
              return (
                <tr key={d}>
                  <td style={tdStyle()}>{d}</td>
                  <td style={tdStyle()}><input value={r.calories ?? 0} onChange={(e) => setField(d, "calories", e.target.value)} style={cellInput(90)} /></td>
                  <td style={tdStyle()}><input value={r.protein_g ?? 0} onChange={(e) => setField(d, "protein_g", e.target.value)} style={cellInput(90)} /></td>
                  <td style={tdStyle()}><input value={r.carbs_g ?? 0} onChange={(e) => setField(d, "carbs_g", e.target.value)} style={cellInput(90)} /></td>
                  <td style={tdStyle()}><input value={r.fat_g ?? 0} onChange={(e) => setField(d, "fat_g", e.target.value)} style={cellInput(90)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TargetsCalendar({ athleteId, token }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [rows, setRows] = useState({});
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const start = isoDate(weekStartISO(weekOffset));
  const endD = new Date(weekStartISO(weekOffset));
  endD.setDate(endD.getDate() + 6);
  const end = isoDate(endD);

  const load = async () => {
    setErr("");
    try {
      const data = await apiFetch(`/macro-targets/${athleteId}?start=${start}&end=${end}`, token);
      const map = {};
      (data || []).forEach((r) => {
        map[r.date] = { calories: Number(r.calories || 0), protein_g: Number(r.protein_g || 0), carbs_g: Number(r.carbs_g || 0), fat_g: Number(r.fat_g || 0) };
      });
      // ensure all days exist
      for (const d of DAYS) {
        const date = dateForWeekDay(weekOffset, d);
        if (!map[date]) map[date] = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
      }
      setRows(map);
    } catch (e) {
      setErr(e.message || "Could not load targets");
    }
  };

  useEffect(() => {
    if (!athleteId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId, weekOffset]);

  const setField = (date, key, val) => {
    const num = Math.max(0, Math.min(20000, Number(val) || 0));
    setRows((prev) => ({ ...prev, [date]: { ...(prev[date] || {}), [key]: num } }));
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      const entries = Object.entries(rows).map(([date, v]) => ({ date, calories: v.calories || 0, protein_g: v.protein_g || 0, carbs_g: v.carbs_g || 0, fat_g: v.fat_g || 0 }));
      await apiFetch(`/macro-targets/${athleteId}`, token, { method: "PUT", body: JSON.stringify({ entries }) });
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
          <div style={{ fontFamily: "Bebas Neue, system-ui", fontSize: 18, letterSpacing: 2 }}>CAL TARGETS (DATE)</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>{start} → {end}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setWeekOffset((w) => w - 1)} style={miniBtnStyle()} type="button">◀</button>
          <button onClick={() => setWeekOffset((w) => Math.min(0, w + 1))} style={miniBtnStyle()} type="button">▶</button>
          <button onClick={save} disabled={saving} style={{ ...miniBtnStyle(false, T.accent), borderColor: `${T.accent}55`, color: T.accent }} type="button">{saving ? "SAVING…" : "SAVE"}</button>
        </div>
      </div>
      <ErrorBox msg={err} />

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
                  <td style={tdStyle()}><input value={v.calories} onChange={(e) => setField(date, "calories", e.target.value)} style={cellInput(90)} /></td>
                  <td style={tdStyle()}><input value={v.protein_g} onChange={(e) => setField(date, "protein_g", e.target.value)} style={cellInput(90)} /></td>
                  <td style={tdStyle()}><input value={v.carbs_g} onChange={(e) => setField(date, "carbs_g", e.target.value)} style={cellInput(90)} /></td>
                  <td style={tdStyle()}><input value={v.fat_g} onChange={(e) => setField(date, "fat_g", e.target.value)} style={cellInput(90)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeightPanel({ athleteId, token }) {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const w = await apiFetch(`/weights/${athleteId}`, token);
      setRows(Array.isArray(w) ? w : []);
    } catch (e) {
      setErr(e.message || "Could not load weights");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  const end = isoDate(new Date());
  const startD = new Date();
  startD.setDate(startD.getDate() - (days - 1));
  const start = isoDate(startD);
  const dates = Array.from({ length: days }, (_, i) => isoDate(new Date(startD.getTime() + i * 86400000)));
  const map = Object.fromEntries(rows.map((r) => [r.date, r]));
  const pts = dates.filter((d) => map[d]).map((d) => ({ d, v: Number(map[d].kg) }));

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 18, letterSpacing: 2 }}>WEIGHT</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>{start} → {end}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[7, 30, 90, 180].map((d) => (
            <button key={d} onClick={() => setDays(d)} style={miniBtnStyle(days === d)} type="button">{d}d</button>
          ))}
          <button onClick={load} style={{ ...miniBtnStyle(false, T.info), borderColor: `${T.info}55`, color: T.info }} type="button">Refresh</button>
        </div>
      </div>
      <ErrorBox msg={err} />
      {pts.length ? <div style={{ marginTop: 12 }}><SparkLine labels={pts.map((p) => p.d)} values={pts.map((p) => p.v)} color={T.coachGreen} /></div> : <div style={{ marginTop: 12, color: T.muted, fontFamily: "DM Sans", fontSize: 12 }}>No weight entries yet.</div>}

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead><tr><th style={thStyle()}>DATE</th><th style={thStyle()}>KG</th></tr></thead>
          <tbody>
            {dates.slice().reverse().map((d) => (
              <tr key={d}>
                <td style={{ ...tdStyle(), fontFamily: "JetBrains Mono" }}>{d}</td>
                <td style={tdStyle()}>{map[d] ? Number(map[d].kg).toFixed(1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MoodPanel({ athleteId, token }) {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const m = await apiFetch(`/moods/${athleteId}`, token);
      setRows(Array.isArray(m) ? m : []);
    } catch (e) {
      setErr(e.message || "Could not load moods");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  const end = isoDate(new Date());
  const startD = new Date();
  startD.setDate(startD.getDate() - (days - 1));
  const start = isoDate(startD);
  const dates = Array.from({ length: days }, (_, i) => isoDate(new Date(startD.getTime() + i * 86400000)));
  const map = Object.fromEntries(rows.map((r) => [r.date, r]));
  const pts = dates.filter((d) => map[d]).map((d) => ({ d, v: Number(map[d].mood_id || 0) }));

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 18, letterSpacing: 2 }}>MOOD</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>{start} → {end}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[7, 30, 90, 180].map((d) => (
            <button key={d} onClick={() => setDays(d)} style={miniBtnStyle(days === d)} type="button">{d}d</button>
          ))}
          <button onClick={load} style={{ ...miniBtnStyle(false, T.info), borderColor: `${T.info}55`, color: T.info }} type="button">Refresh</button>
        </div>
      </div>
      <ErrorBox msg={err} />
      {pts.length ? <div style={{ marginTop: 12 }}><SparkLine labels={pts.map((p) => p.d)} values={pts.map((p) => p.v)} color={T.accent} /></div> : <div style={{ marginTop: 12, color: T.muted, fontFamily: "DM Sans", fontSize: 12 }}>No mood entries yet.</div>}

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead><tr><th style={thStyle()}>DATE</th><th style={thStyle()}>MOOD</th><th style={thStyle()}>NOTE</th></tr></thead>
          <tbody>
            {dates.slice().reverse().map((d) => (
              <tr key={d}>
                <td style={{ ...tdStyle(), fontFamily: "JetBrains Mono" }}>{d}</td>
                <td style={tdStyle()}>{map[d] ? `${map[d].emoji || ""} ${map[d].label || map[d].mood_id}` : "—"}</td>
                <td style={{ ...tdStyle(), color: T.muted }}>{map[d]?.note || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConsumedPanel({ athleteId, token }) {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [targets, setTargets] = useState([]);
  const [err, setErr] = useState("");

  const end = isoDate(new Date());
  const startD = new Date();
  startD.setDate(startD.getDate() - (days - 1));
  const start = isoDate(startD);
  const dates = Array.from({ length: days }, (_, i) => isoDate(new Date(startD.getTime() + i * 86400000)));

  const load = async () => {
    setErr("");
    try {
      const [t, mt] = await Promise.all([
        apiFetch(`/daily-totals/${athleteId}?start=${start}&end=${end}`, token),
        apiFetch(`/macro-targets/${athleteId}?start=${start}&end=${end}`, token).catch(() => []),
      ]);
      setRows(Array.isArray(t) ? t : []);
      setTargets(Array.isArray(mt) ? mt : []);
    } catch (e) {
      setErr(e.message || "Could not load consumed totals");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId, days]);

  const map = Object.fromEntries(rows.map((r) => [r.date, r]));
  const tmap = Object.fromEntries(targets.map((r) => [r.date, r]));

  const calSeries = dates.map((d) => (map[d] ? Number(map[d].calories || 0) : 0));
  const tarSeries = dates.map((d) => (tmap[d] ? Number(tmap[d].calories || 0) : 0));

  const hasAny = rows.length || targets.length;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 18, letterSpacing: 2 }}>CONSUMED vs TARGET</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>{start} → {end}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[7, 30, 90, 180].map((d) => (
            <button key={d} onClick={() => setDays(d)} style={miniBtnStyle(days === d)} type="button">{d}d</button>
          ))}
          <button onClick={load} style={{ ...miniBtnStyle(false, T.info), borderColor: `${T.info}55`, color: T.info }} type="button">Refresh</button>
        </div>
      </div>
      <ErrorBox msg={err} />

      {hasAny ? (
        <div style={{ marginTop: 12 }}>
          <MultiLine labels={dates} series={[{ name: "Consumed", color: T.accent, values: calSeries }, { name: "Target", color: T.coachGreen, values: tarSeries }]} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: T.accent, marginRight: 6 }} />Consumed</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: T.coachGreen, marginRight: 6 }} />Target</span>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, color: T.muted, fontFamily: "DM Sans", fontSize: 12 }}>No daily totals yet (client must SAVE DAY).</div>
      )}

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead><tr><th style={thStyle()}>DATE</th><th style={thStyle()}>CAL</th><th style={thStyle()}>P</th><th style={thStyle()}>C</th><th style={thStyle()}>F</th><th style={thStyle()}>NOTE</th></tr></thead>
          <tbody>
            {dates.slice().reverse().map((d) => (
              <tr key={d}>
                <td style={{ ...tdStyle(), fontFamily: "JetBrains Mono" }}>{d}</td>
                <td style={tdStyle()}>{map[d] ? map[d].calories : "—"}</td>
                <td style={tdStyle()}>{map[d] ? map[d].protein_g : "—"}</td>
                <td style={tdStyle()}>{map[d] ? map[d].carbs_g : "—"}</td>
                <td style={tdStyle()}>{map[d] ? map[d].fat_g : "—"}</td>
                <td style={{ ...tdStyle(), color: T.muted }}>{map[d]?.note || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckinCalendarPanel({ athleteId, token }) {
  const [days, setDays] = useState(30);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: "", title: "Check-in", linkUrl: "", notes: "" });

  const end = isoDate(new Date());
  const startD = new Date();
  startD.setDate(startD.getDate() - (days - 1));
  const start = isoDate(startD);

  const load = async () => {
    setErr("");
    try {
      const rows = await apiFetch(`/checkins/${athleteId}?start=${start}&end=${end}`, token);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr(e.message || "Could not load check-ins");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId, days]);

  const create = async () => {
    setErr("");
    try {
      await apiFetch(`/checkins/${athleteId}`, token, { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setForm({ date: "", title: "Check-in", linkUrl: "", notes: "" });
      await load();
    } catch (e) {
      setErr(e.message || "Could not create check-in");
    }
  };

  const remove = async (id) => {
    setErr("");
    try {
      await apiFetch(`/checkins/${athleteId}/${id}`, token, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr(e.message || "Could not delete check-in");
    }
  };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 18, letterSpacing: 2 }}>CHECK-IN CALENDAR</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>{start} → {end}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[7, 30, 90, 180].map((d) => (
            <button key={d} onClick={() => setDays(d)} style={miniBtnStyle(days === d)} type="button">{d}d</button>
          ))}
          <button onClick={load} style={{ ...miniBtnStyle(false, T.info), borderColor: `${T.info}55`, color: T.info }} type="button">Refresh</button>
          <button onClick={() => setOpen(true)} style={{ ...miniBtnStyle(false, T.accent), borderColor: `${T.accent}55`, color: T.accent }} type="button">+ Add</button>
        </div>
      </div>
      <ErrorBox msg={err} />

      {open ? (
        <div style={{ marginTop: 12, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} placeholder="YYYY-MM-DD" style={{ ...cellInput("100%"), width: "100%" }} />
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" style={{ ...cellInput("100%"), width: "100%" }} />
          </div>
          <input value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} placeholder="Link (Teams/Zoom/URL)" style={{ ...cellInput("100%"), width: "100%", marginTop: 10 }} />
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes" style={{ ...cellInput("100%"), width: "100%", marginTop: 10, height: 80 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button onClick={() => setOpen(false)} style={miniBtnStyle()} type="button">Cancel</button>
            <button onClick={create} style={{ ...miniBtnStyle(false, T.coachGreen), borderColor: `${T.coachGreen}66`, color: T.coachGreen }} type="button">Save</button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead><tr><th style={thStyle()}>DATE</th><th style={thStyle()}>TITLE</th><th style={thStyle()}>LINK</th><th style={thStyle()}>NOTES</th><th style={thStyle()}></th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td style={{ ...tdStyle(), fontFamily: "JetBrains Mono" }}>{it.date}</td>
                <td style={tdStyle()}>{it.title}</td>
                <td style={tdStyle()}>{it.linkUrl ? <a href={it.linkUrl} target="_blank" rel="noreferrer" style={{ color: T.info }}>Open</a> : "—"}</td>
                <td style={{ ...tdStyle(), color: T.muted }}>{it.notes || ""}</td>
                <td style={tdStyle()}><button onClick={() => remove(it.id)} style={{ ...miniBtnStyle(false, T.danger), borderColor: `${T.danger}55`, color: T.danger }} type="button">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AthleteDetail({ athlete, token, onBack, onDelete }) {
  const [tab, setTab] = useState("macroplan");
  const tabs = [
    { id: "macroplan", label: "MACRO PLAN" },
    { id: "targets", label: "CAL TARGETS" },
    { id: "weight", label: "WEIGHT" },
    { id: "mood", label: "MOOD" },
    { id: "consumed", label: "CONSUMED" },
    { id: "calendar", label: "CHECK-IN CAL" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ ...miniBtnStyle(false), padding: "8px 14px" }} type="button">← Back</button>
        <button onClick={() => onDelete(athlete)} style={{ background: `${T.danger}18`, border: `1px solid ${T.danger}44`, borderRadius: 10, padding: "8px 12px", color: T.danger, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12 }} type="button">Delete Athlete</button>
        <div style={{ fontFamily: "Bebas Neue", fontSize: 26, letterSpacing: 2, marginLeft: 6 }}>{(athlete.name || "ATHLETE").toUpperCase()}</div>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.muted }}>{athlete.email}</div>
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
              borderBottom: tab === t.id ? `2px solid ${T.accent}` : "2px solid transparent",
              whiteSpace: "nowrap",
            }}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "macroplan" ? <WeeklyMacroPlan athleteId={athlete.id} token={token} /> : null}
      {tab === "targets" ? <TargetsCalendar athleteId={athlete.id} token={token} /> : null}
      {tab === "weight" ? <WeightPanel athleteId={athlete.id} token={token} /> : null}
      {tab === "mood" ? <MoodPanel athleteId={athlete.id} token={token} /> : null}
      {tab === "consumed" ? <ConsumedPanel athleteId={athlete.id} token={token} /> : null}
      {tab === "calendar" ? <CheckinCalendarPanel athleteId={athlete.id} token={token} /> : null}
    </div>
  );
}

function OverviewDashboard({ token, days, setDays, onSelectAthlete }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await apiFetch(`/coach/overview?days=${days}`, token);
      setData(res);
    } catch (e) {
      setErr(e.message || "Could not load overview");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const athletes = data?.athletes || [];
  const avg = (arr) => {
    const nums = arr.filter((x) => typeof x === "number" && Number.isFinite(x));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };

  const avgMood = avg(athletes.map((a) => a.moodAvg));
  const avgAdh = avg(athletes.map((a) => a.adherencePct));

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 18, letterSpacing: 2 }}>COACH DASHBOARD</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>Weight Δ%, Avg Mood, Macro Adherence — last {days} days</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[7, 30, 90, 180].map((d) => (
            <button key={d} onClick={() => setDays(d)} style={miniBtnStyle(days === d)} type="button">{d}d</button>
          ))}
          <button onClick={load} style={{ ...miniBtnStyle(false, T.info), borderColor: `${T.info}55`, color: T.info }} type="button">{loading ? "Loading…" : "Refresh"}</button>
        </div>
      </div>

      <ErrorBox msg={err} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
        <StatCard label="AVG MOOD" value={avgMood ? avgMood.toFixed(2) : "—"} color={T.accent} unit="id" />
        <StatCard label="AVG ADHERENCE" value={avgAdh ? avgAdh.toFixed(0) : "—"} color={T.coachGreen} unit="%" />
        <StatCard label="ATHLETES" value={athletes.length} color={T.info} unit="" />
      </div>

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={thStyle()}>ATHLETE</th>
              <th style={thStyle()}>WEIGHT Δ%</th>
              <th style={thStyle()}>LATEST KG</th>
              <th style={thStyle()}>AVG MOOD</th>
              <th style={thStyle()}>ADHERENCE</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((a) => (
              <tr key={a.id}>
                <td style={tdStyle()}>
                  <button onClick={() => onSelectAthlete(a)} style={{ background: "none", border: "none", color: T.text, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, padding: 0 }} type="button">
                    {a.name || a.email || "Athlete"}
                  </button>
                </td>
                <td style={{ ...tdStyle(), color: typeof a.weightChangePct === "number" ? (a.weightChangePct >= 0 ? T.coachGreen : T.danger) : T.muted }}>
                  {typeof a.weightChangePct === "number" ? `${a.weightChangePct.toFixed(1)}%` : "—"}
                </td>
                <td style={tdStyle()}>{typeof a.latestKg === "number" ? Number(a.latestKg).toFixed(1) : "—"}</td>
                <td style={tdStyle()}>{typeof a.moodAvg === "number" ? a.moodAvg.toFixed(2) : "—"}</td>
                <td style={tdStyle()}>{typeof a.adherencePct === "number" ? `${a.adherencePct.toFixed(0)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CoachCMS() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [me, setMe] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);

  const [overviewDays, setOverviewDays] = useState(30);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteWorking, setDeleteWorking] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const loadAthletes = async () => {
    if (!token) return;
    const data = await apiFetch("/athletes", token);
    setAthletes(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (!token) return;
    loadAthletes().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const logout = async () => {
    try {
      if (token) await apiFetch("/auth/logout", token, { method: "POST" });
    } catch {}
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setMe(null);
    setAthletes([]);
    setSelected(null);
  };

  const requestDelete = (a) => {
    setDeleteErr("");
    setDeleteTarget(a);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteWorking(true);
    setDeleteErr("");
    try {
      await apiFetch(`/athletes/${deleteTarget.id}`, token, { method: "DELETE" });
      setDeleteOpen(false);
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) setSelected(null);
      await loadAthletes();
    } catch (e) {
      setDeleteErr(e.message || "Could not delete athlete");
    } finally {
      setDeleteWorking(false);
    }
  };

  if (!token) {
    return (
      <Login
        onLoggedIn={(t, user) => {
          setToken(t);
          setMe(user);
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, padding: 18 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "Bebas Neue", letterSpacing: 2, fontSize: 18 }}>NO RULES NUTRITION</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>Coach Portal</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setAdding(true)} style={{ ...miniBtnStyle(false, T.accent), borderColor: `${T.accent}55`, color: T.accent }} type="button">+ Add Athlete</button>
            <button onClick={logout} style={{ ...miniBtnStyle(false, T.danger), borderColor: `${T.danger}55`, color: T.danger }} type="button">Logout</button>
          </div>
        </div>

        <ConfirmDeleteModal open={deleteOpen} athlete={deleteTarget} onCancel={() => !deleteWorking && setDeleteOpen(false)} onConfirm={confirmDelete} working={deleteWorking} error={deleteErr} />
        <AddAthleteModal open={adding} onClose={() => setAdding(false)} onCreated={() => loadAthletes()} token={token} />

        {selected ? (
          <AthleteDetail
            athlete={selected}
            token={token}
            onBack={() => setSelected(null)}
            onDelete={requestDelete}
          />
        ) : (
          <>
            <OverviewDashboard token={token} days={overviewDays} setDays={setOverviewDays} onSelectAthlete={(a) => setSelected(athletes.find((x) => x.id === a.id) || a)} />

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "Bebas Neue", fontSize: 18, letterSpacing: 2 }}>ATHLETES</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>Click a row to view details; use 🗑 to delete.</div>
                </div>
                <button onClick={loadAthletes} style={{ ...miniBtnStyle(false, T.info), borderColor: `${T.info}55`, color: T.info }} type="button">Refresh</button>
              </div>

              <div style={{ marginTop: 12 }}>
                {!athletes.length ? (
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>No athletes yet. Click “Add Athlete”.</div>
                ) : (
                  athletes.map((a, idx) => (
                    <div
                      key={a.id}
                      onClick={() => setSelected(a)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 18px",
                        borderBottom: idx < athletes.length - 1 ? `1px solid ${T.border}` : "none",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "Bebas Neue", letterSpacing: 1.5, fontSize: 16 }}>{(a.name || "Athlete").toUpperCase()}</div>
                        <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.muted }}>{a.email}</div>
                      </div>
                      <div style={{ fontFamily: "DM Sans", fontSize: 12, color: T.muted }}>{a.sport || ""}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDelete(a);
                        }}
                        title="Delete athlete"
                        style={{ background: `${T.danger}18`, border: `1px solid ${T.danger}44`, color: T.danger, borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontFamily: "DM Sans", fontSize: 12 }}
                        type="button"
                      >
                        🗑
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
