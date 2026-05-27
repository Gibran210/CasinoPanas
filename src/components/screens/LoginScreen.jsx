import { useState } from "react";
import { useCasino } from "../../context/CasinoContext";

/* ── Micro-components ─────────────────────── */

function Field({ label, type = "text", value, onChange, placeholder, error, autoComplete }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: focused ? "var(--gold)" : "var(--text-secondary)",
        marginBottom: 6, transition: "color 0.2s" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          width: "100%", padding: "12px 16px",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${error ? "#ef4444" : focused ? "var(--gold)" : "var(--border-dim)"}`,
          borderRadius: "var(--radius-sm)",
          color: "white", fontSize: 14,
          transition: "border-color 0.2s",
          boxSizing: "border-box",
        }}
      />
      {error && (
        <p style={{ color: "#f87171", fontSize: 11, marginTop: 4 }}>{error}</p>
      )}
    </div>
  );
}

function PasswordStrength({ password }) {
  let s = 0;
  if (password.length >= 6)           s++;
  if (password.length >= 10)          s++;
  if (/[A-Z]/.test(password))         s++;
  if (/[0-9]/.test(password))         s++;
  if (/[^a-zA-Z0-9]/.test(password))  s++;
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];
  const labels = ["", "Muy débil", "Débil", "Regular", "Buena", "Fuerte"];
  if (!password) return null;
  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 99,
            background: i <= s ? colors[s] : "rgba(255,255,255,0.08)",
            transition: "background 0.3s" }} />
        ))}
      </div>
      <p style={{ color: colors[s], fontSize: 11, margin: 0 }}>{labels[s]}</p>
    </div>
  );
}

/* ── Login Form ───────────────────────────── */

function LoginForm({ onSwitch }) {
  const { login, loading, error } = useCasino();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState({});

  const handleSubmit = async e => {
    e.preventDefault();
    const e2 = {};
    if (!username.trim()) e2.username = "Ingresa tu usuario";
    if (!password)        e2.password = "Ingresa tu contraseña";
    if (Object.keys(e2).length) { setErr(e2); return; }
    setErr({});
    await login(username, password);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Usuario" value={username} onChange={v => { setUsername(v); setErr(p => ({...p, username:""})); }}
        placeholder="Tu nombre de usuario" error={err.username} autoComplete="username" />
      <Field label="Contraseña" type="password" value={password}
        onChange={v => { setPassword(v); setErr(p => ({...p, password:""})); }}
        placeholder="••••••••" error={err.password} autoComplete="current-password" />

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
          <p style={{ color: "#fca5a5", fontSize: 13, margin: 0 }}>⚠ {error}</p>
        </div>
      )}

      <button type="submit" disabled={loading}
        style={{ width: "100%", padding: "13px 0", borderRadius: "var(--radius-sm)",
          background: loading ? "rgba(212,175,55,0.4)" : "linear-gradient(135deg,#d4af37,#f0d060)",
          color: "#0d0d0d", fontWeight: 800, fontSize: 14, letterSpacing: "0.08em",
          textTransform: "uppercase", border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "opacity 0.2s, transform 0.15s" }}
        onMouseEnter={e => { if (!loading) e.target.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.target.style.transform = "translateY(0)"; }}>
        {loading ? "Conectando…" : "Entrar al Casino"}
      </button>

      <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 13, margin: 0 }}>
        ¿No tienes cuenta?{" "}
        <button type="button" onClick={onSwitch}
          style={{ color: "var(--gold)", background: "none", border: "none",
            cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Crear cuenta
        </button>
      </p>
    </form>
  );
}

/* ── Register Form ────────────────────────── */

function RegisterForm({ onSwitch }) {
  const { register, loading, error } = useCasino();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [err, setErr] = useState({});
  const [done, setDone] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    const e2 = {};
    if (!username.trim())      e2.username = "Elige un nombre de usuario";
    else if (username.length < 3) e2.username = "Mínimo 3 caracteres";
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) e2.username = "Solo letras, números y _";
    if (password.length < 6)   e2.password = "Mínimo 6 caracteres";
    if (confirm !== password)  e2.confirm  = "Las contraseñas no coinciden";
    if (Object.keys(e2).length) { setErr(e2); return; }
    setErr({});
    const res = await register(username, password);
    if (res?.success) setDone(true);
  };

  if (done) return (
    <div style={{ textAlign: "center", padding: "24px 0", display: "flex",
      flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%",
        background: "rgba(34,197,94,0.15)", border: "2px solid #22c55e",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🎉</div>
      <p style={{ color: "#4ade80", fontWeight: 700, fontSize: 16, margin: 0 }}>¡Cuenta creada!</p>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
        Tienes $5,000 de fichas esperándote
      </p>
      <button onClick={onSwitch}
        style={{ marginTop: 8, padding: "11px 32px", borderRadius: "var(--radius-sm)",
          background: "linear-gradient(135deg,#d4af37,#f0d060)",
          color: "#0d0d0d", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14 }}>
        Iniciar Sesión
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="Usuario" value={username}
        onChange={v => { setUsername(v); setErr(p => ({...p, username:""})); }}
        placeholder="Solo letras, números y _" error={err.username} autoComplete="username" />
      <Field label="Contraseña" type="password" value={password}
        onChange={v => { setPassword(v); setErr(p => ({...p, password:""})); }}
        placeholder="Mínimo 6 caracteres" error={err.password} autoComplete="new-password" />
      {password && <PasswordStrength password={password} />}
      <Field label="Confirmar contraseña" type="password" value={confirm}
        onChange={v => { setConfirm(v); setErr(p => ({...p, confirm:""})); }}
        placeholder="Repite la contraseña" error={err.confirm} autoComplete="new-password" />

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
          <p style={{ color: "#fca5a5", fontSize: 13, margin: 0 }}>⚠ {error}</p>
        </div>
      )}

      <button type="submit" disabled={loading}
        style={{ width: "100%", padding: "13px 0", borderRadius: "var(--radius-sm)",
          background: loading ? "rgba(212,175,55,0.4)" : "linear-gradient(135deg,#d4af37,#f0d060)",
          color: "#0d0d0d", fontWeight: 800, fontSize: 14, letterSpacing: "0.08em",
          textTransform: "uppercase", border: "none",
          cursor: loading ? "not-allowed" : "pointer" }}>
        {loading ? "Creando cuenta…" : "Crear Cuenta"}
      </button>

      <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 13, margin: 0 }}>
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={onSwitch}
          style={{ color: "var(--gold)", background: "none", border: "none",
            cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Iniciar sesión
        </button>
      </p>
    </form>
  );
}

/* ── Screen principal ─────────────────────── */

export default function LoginScreen() {
  const [mode, setMode] = useState("login");

  const suits = [
    { s: "♠", top: "5%",  left: "4%",  size: 120, color: "rgba(255,255,255,0.04)" },
    { s: "♥", top: "5%",  right: "4%", size: 120, color: "rgba(220,38,38,0.06)" },
    { s: "♦", bottom:"5%",left: "4%",  size: 120, color: "rgba(220,38,38,0.06)" },
    { s: "♣", bottom:"5%",right:"4%",  size: 120, color: "rgba(255,255,255,0.04)" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "stretch",
      background: "var(--surface-1)", position: "relative", overflow: "hidden" }}>

      {/* Palos decorativos */}
      {suits.map(({ s, size, color, ...pos }) => (
        <span key={s} style={{ position: "absolute", fontSize: size, color,
          lineHeight: 1, userSelect: "none", pointerEvents: "none", ...pos }}>
          {s}
        </span>
      ))}

      {/* Panel izquierdo — solo en desktop */}
      <div className="hidden lg:flex" style={{ flex: 1, maxWidth: 480,
        background: "radial-gradient(ellipse at 40% 60%, #1a4a2e 0%, #0a1f10 60%, #050a05 100%)",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 48, position: "relative", borderRight: "1px solid var(--border-subtle)" }}>

        {/* Oval decorativo */}
        <div style={{ width: 260, height: 180, borderRadius: "50%",
          border: "2px solid rgba(212,175,55,0.2)",
          boxShadow: "0 0 60px rgba(212,175,55,0.06)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 40 }}>
          <span style={{ fontSize: 52 }}>🃏</span>
          <span style={{ fontSize: 28, color: "rgba(255,255,255,0.12)", letterSpacing: 8 }}>♠♥♦♣</span>
        </div>

        <h2 className="gold-text" style={{ fontFamily: "Georgia, serif",
          fontSize: 42, fontWeight: 900, letterSpacing: "0.12em",
          textAlign: "center", margin: "0 0 8px" }}>
          PANAS
        </h2>
        <p style={{ color: "#4ade80", fontFamily: "Georgia, serif",
          fontSize: 18, letterSpacing: "0.4em", textTransform: "uppercase",
          textAlign: "center", margin: "0 0 32px" }}>
          CASINO
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 280 }}>
          {[
            { icon: "🎁", text: "$5,000 en fichas de bienvenida" },
            { icon: "⚡", text: "Mesas en tiempo real" },
            { icon: "🔒", text: "Login seguro con Firebase Auth" },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: "var(--radius-sm)",
              background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div style={{ flex: 1, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "24px 16px" }}>
        <div className="anim-fade-up" style={{ width: "100%", maxWidth: 400 }}>

          {/* Logo mobile */}
          <div className="lg:hidden" style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🃏</div>
            <h1 className="gold-text" style={{ fontFamily: "Georgia, serif",
              fontSize: 36, fontWeight: 900, letterSpacing: "0.12em", margin: "0 0 4px" }}>
              PANAS
            </h1>
            <p style={{ color: "#4ade80", fontFamily: "Georgia, serif",
              fontSize: 14, letterSpacing: "0.4em", textTransform: "uppercase", margin: 0 }}>
              CASINO
            </p>
          </div>

          {/* Tarjeta del formulario */}
          <div style={{ background: "var(--surface-2)",
            border: "1px solid var(--gold-border)",
            borderRadius: "var(--radius-lg)",
            padding: "32px 28px",
            boxShadow: "0 0 60px rgba(212,175,55,0.06)" }}>

            {/* Tabs */}
            <div style={{ display: "flex", background: "var(--surface-1)",
              borderRadius: "var(--radius-sm)", padding: 4, marginBottom: 28 }}>
              {[
                { key: "login",    label: "Iniciar Sesión" },
                { key: "register", label: "Crear Cuenta"   },
              ].map(tab => (
                <button key={tab.key} type="button" onClick={() => setMode(tab.key)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
                    cursor: "pointer", fontSize: 13, fontWeight: mode === tab.key ? 700 : 400,
                    transition: "all 0.2s",
                    background: mode === tab.key
                      ? "linear-gradient(135deg,#d4af37,#f0d060)"
                      : "transparent",
                    color: mode === tab.key ? "#0d0d0d" : "var(--text-secondary)" }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {mode === "login"
              ? <LoginForm    onSwitch={() => setMode("register")} />
              : <RegisterForm onSwitch={() => setMode("login")}    />}

            {mode === "register" && (
              <p style={{ textAlign: "center", color: "var(--text-dim)",
                fontSize: 11, marginTop: 16 }}>
                🎁 Nuevos jugadores reciben $5,000 de fichas
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
