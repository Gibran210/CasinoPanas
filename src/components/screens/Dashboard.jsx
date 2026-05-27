import { useState } from "react";
import { useCasino } from "../../context/CasinoContext";

const GAME_INFO = {
  "21":    { emoji: "🃏", label: "21 / Blackjack", desc: "Supera al dealer sin pasarte de 21" },
  "viuda": { emoji: "👻", label: "La Viuda",        desc: "Intercambia cartas y arma la mejor mano" },
};

const MIN_BETS = [50, 100, 250, 500, 1000];

/* ── Badge de estado de mesa ─────────────── */
function TableStatusBadge({ seats }) {
  const players = Object.values(seats || {}).filter(Boolean);
  const ready   = players.filter(p => p.ready).length;
  const total   = players.length;
  if (total === 0) return (
    <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>Vacía</span>
  );
  if (total === ready && total > 0) return (
    <span style={{ fontSize: 11, fontWeight: 600, color: "#4ade80" }}>● Todos listos</span>
  );
  return (
    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--gold)" }}>
      {total}/5 jugadores
    </span>
  );
}

export default function Dashboard() {
  const { userData, tables, createTable, joinTable, logout, loading } = useCasino();

  const [game,      setGame]      = useState("21");
  const [minBet,    setMinBet]    = useState(100);
  const [joinCode,  setJoinCode]  = useState("");
  const [joinError, setJoinError] = useState("");
  const [creating,  setCreating]  = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    await createTable({ game, minBet });
    setCreating(false);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoinError("");
    const res = await joinTable(joinCode.trim().toUpperCase());
    if (!res?.success) setJoinError("Mesa no encontrada. Verifica el código.");
  };

  const inputStyle = {
    width: "100%", padding: "11px 14px",
    background: "var(--surface-3)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-sm)",
    color: "white", fontSize: 14,
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-1)", color: "white" }}>

      {/* ── Navbar ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50,
        background: "rgba(13,13,13,0.95)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "6px clamp(12px,3vw,20px)",
        display: "flex", flexDirection: "column", gap: 4 }}>

        {/* Fila 1: Logo + Balance + Salir */}
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🃏</span>
            <span className="gold-text" style={{ fontFamily: "Georgia, serif",
              fontSize: "clamp(14px,3vw,18px)", fontWeight: 900,
              letterSpacing: "0.06em", whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis" }}>
              ROYAL CASINO
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: "var(--radius-sm)",
              background: "var(--gold-dim)", border: "1px solid var(--gold-border)" }}>
              <span style={{ fontSize: 13 }}>💰</span>
              <span style={{ color: "var(--gold)", fontWeight: 700,
                fontSize: "clamp(12px,2vw,15px)" }}>
                ${(userData?.balance || 0).toLocaleString()}
              </span>
            </div>
            <button onClick={logout}
              style={{ padding: "5px 10px", borderRadius: "var(--radius-sm)",
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              onMouseEnter={e => { e.target.style.background = "rgba(239,68,68,0.2)"; }}
              onMouseLeave={e => { e.target.style.background = "rgba(239,68,68,0.1)"; }}>
              Salir
            </button>
          </div>
        </div>

        {/* Fila 2: Usuario */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12 }}>🎮</span>
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            {userData?.username}
          </span>
        </div>
      </nav>

      {/* ── Contenido ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 16px 48px" }}>

        {/* Título */}
        <div className="anim-fade-up" style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, margin: "0 0 4px" }}>
            Bienvenido, <span style={{ color: "var(--gold)" }}>{userData?.username}</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
            Crea una mesa o únete a una existente
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20, marginBottom: 32 }}>

          {/* ── Crear mesa ── */}
          <div className="anim-fade-up" style={{ background: "var(--surface-2)",
            border: "1px solid var(--border-dim)", borderRadius: "var(--radius-lg)",
            padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px",
              display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>✦</span> Crear Mesa
            </h2>

            {/* Selector de juego */}
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
              Juego
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {Object.entries(GAME_INFO).map(([key, info]) => (
                <button key={key} type="button" onClick={() => setGame(key)}
                  style={{ padding: "12px 8px", borderRadius: "var(--radius-sm)",
                    border: `1px solid ${game === key ? "var(--gold)" : "var(--border-dim)"}`,
                    background: game === key ? "var(--gold-dim)" : "var(--surface-3)",
                    color: "white", cursor: "pointer", transition: "all 0.2s",
                    textAlign: "left" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{info.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 600,
                    color: game === key ? "var(--gold)" : "var(--text-primary)" }}>
                    {info.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                    {info.desc}
                  </div>
                </button>
              ))}
            </div>

            {/* Apuesta mínima */}
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
              Apuesta mínima
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              {MIN_BETS.map(v => (
                <button key={v} type="button" onClick={() => setMinBet(v)}
                  style={{ padding: "8px 14px", borderRadius: "var(--radius-sm)",
                    border: `1px solid ${minBet === v ? "var(--gold)" : "var(--border-dim)"}`,
                    background: minBet === v ? "var(--gold-dim)" : "var(--surface-3)",
                    color: minBet === v ? "var(--gold)" : "var(--text-secondary)",
                    fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.2s" }}>
                  ${v}
                </button>
              ))}
            </div>

            <button onClick={handleCreate} disabled={creating || loading}
              style={{ width: "100%", padding: "13px 0", borderRadius: "var(--radius-sm)",
                background: creating ? "rgba(212,175,55,0.4)" : "linear-gradient(135deg,#d4af37,#f0d060)",
                color: "#0d0d0d", fontWeight: 800, fontSize: 14, letterSpacing: "0.06em",
                textTransform: "uppercase", border: "none",
                cursor: creating ? "not-allowed" : "pointer", transition: "opacity 0.2s" }}>
              {creating ? "Creando…" : "Crear Mesa"}
            </button>
          </div>

          {/* ── Unirse por código ── */}
          <div className="anim-fade-up delay-1" style={{ background: "var(--surface-2)",
            border: "1px solid var(--border-dim)", borderRadius: "var(--radius-lg)",
            padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px",
              display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🔑</span> Unirse por Código
            </h2>

            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
              Código de mesa
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase().slice(0, 6)); setJoinError(""); }}
              placeholder="XXXXXX"
              maxLength={6}
              style={{ ...inputStyle, textAlign: "center", fontSize: 22,
                fontFamily: "monospace", letterSpacing: "0.3em",
                borderColor: joinError ? "#ef4444" : "var(--border-dim)" }}
              onFocus={e => { e.target.style.borderColor = "var(--gold)"; }}
              onBlur={e  => { e.target.style.borderColor = joinError ? "#ef4444" : "var(--border-dim)"; }}
            />
            {joinError && (
              <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{joinError}</p>
            )}

            <button onClick={handleJoin} disabled={joinCode.length < 4 || loading}
              style={{ width: "100%", marginTop: 16, padding: "13px 0",
                borderRadius: "var(--radius-sm)",
                background: "rgba(74,222,128,0.12)",
                border: "1px solid rgba(74,222,128,0.3)",
                color: "#4ade80", fontWeight: 700, fontSize: 14, cursor: "pointer",
                transition: "all 0.2s", opacity: joinCode.length < 4 ? 0.4 : 1 }}
              onMouseEnter={e => { e.target.style.background = "rgba(74,222,128,0.2)"; }}
              onMouseLeave={e => { e.target.style.background = "rgba(74,222,128,0.12)"; }}>
              Entrar a la Mesa
            </button>

            {/* Lista de mesas */}
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12 }}>
                Mesas activas ({tables.length})
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8,
                maxHeight: 260, overflowY: "auto", paddingRight: 4 }}>
                {tables.length === 0 ? (
                  <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "12px 0" }}>
                    No hay mesas disponibles
                  </p>
                ) : (
                  tables.map(table => {
                    const info = GAME_INFO[table.game] || { emoji: "🎮", label: table.game };
                    return (
                      <div key={table.id}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 14px", borderRadius: "var(--radius-sm)",
                          background: "var(--surface-3)", border: "1px solid var(--border-subtle)",
                          transition: "border-color 0.2s", gap: 10 }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold-border)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 20, flexShrink: 0 }}>{info.emoji}</span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 2px",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {info.label}
                            </p>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontFamily: "monospace", fontSize: 12,
                                color: "var(--gold)", letterSpacing: "0.15em" }}>
                                {table.code}
                              </span>
                              <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
                                Min ${table.minBet}
                              </span>
                              <TableStatusBadge seats={table.seats} />
                            </div>
                          </div>
                        </div>
                        <button onClick={() => joinTable(table.code)}
                          style={{ flexShrink: 0, padding: "7px 14px",
                            borderRadius: "var(--radius-sm)",
                            background: "linear-gradient(135deg,#d4af37,#f0d060)",
                            color: "#0d0d0d", fontWeight: 700, fontSize: 12,
                            border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                          Entrar
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
