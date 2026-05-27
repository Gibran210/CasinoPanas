import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useCasino } from "../../context/CasinoContext";
import { evaluateBestHand, getRoundWildcardRank, isWildcard, rankName } from "../../utils/viudaEvaluator";

/* ══════════════════════════════════════════════════════
   VIUDA TABLE — La Viuda multijugador en tiempo real

   Fases:
     waiting     → sala de espera (asientos, listo)
     countdown   → modal 5 seg
     playing     → juego activo, turnos por ronda
     final_round → alguien tocó, último turno para los demás
     results     → revelar manos, mostrar ganador
══════════════════════════════════════════════════════ */

const RED_SUITS = new Set(["♥","♦"]);
const isRed = (card) => card && RED_SUITS.has(card[card.length - 1]);

/* ── Carta visual ─────────────────────────────────── */
function VCard({ card, faceDown = false, small = false, selected = false, onClick, isWild = false }) {
  const w  = small ? 44  : 58;
  const h  = small ? 62  : 82;
  const r  = small ? 7   : 9;
  const cf = small ? 9   : 12;
  const sf = small ? 13  : 18;

  const cursor = onClick ? "pointer" : "default";
  const shadow = selected
    ? "0 0 0 2px #d4af37, 0 0 16px rgba(212,175,55,0.5)"
    : "0 4px 12px rgba(0,0,0,0.5)";
  const transform = selected ? "translateY(-10px)" : "none";

  if (faceDown) return (
    <div onClick={onClick} style={{
      width:w, height:h, borderRadius:r, flexShrink:0,
      background:"linear-gradient(145deg,#1a3a6b,#0d2044)",
      border:"2px solid rgba(59,130,246,0.4)",
      boxShadow:shadow, transform, transition:"all 0.2s",
      cursor, overflow:"hidden", position:"relative",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div style={{ position:"absolute", inset:4, borderRadius:r-2,
        border:"1px solid rgba(96,165,250,0.15)",
        background:"repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(96,165,250,0.05) 5px,rgba(96,165,250,0.05) 10px)" }} />
      <span style={{ fontSize:sf, opacity:0.25, color:"#93c5fd", position:"relative" }}>✦</span>
    </div>
  );

  // Joker
  if (card === 'JK1' || card === 'JK2') return (
    <div onClick={onClick} style={{
      width:w, height:h, borderRadius:r, flexShrink:0,
      background:"linear-gradient(145deg,#1c0530,#2e0a50)",
      border:`2px solid ${selected?"#d4af37":"rgba(216,180,254,0.6)"}`,
      boxShadow:selected?"0 0 0 2px #d4af37,0 0 16px rgba(212,175,55,0.5)":"0 4px 12px rgba(0,0,0,0.6)",
      transform, transition:"all 0.2s",
      cursor, overflow:"hidden", position:"relative",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:2,
    }}>
      <span style={{ fontSize:small?16:22, lineHeight:1 }}>🃏</span>
      <span style={{ fontSize:small?8:10, fontWeight:800, color:"#d8b4fe",
        letterSpacing:"0.05em" }}>JOKER</span>
    </div>
  );

  const suit  = card[card.length - 1];
  const rank  = card.slice(0, -1);
  const red   = isRed(card);
  const color = red ? "#c0392b" : "#111827";
  const face  = ["J","Q","K"].includes(rank);

  // wildRank check is passed via context via the parent — here we just
  // use a prop "isWild" that the parent can pass optionally
  const cardBorder = (typeof isWild !== "undefined" && isWild)
    ? "2px solid #fbbf24"
    : "1.5px solid #d1d5db";

  return (
    <div onClick={onClick} style={{
      width:w, height:h, borderRadius:r, flexShrink:0,
      background:"white", border:cardBorder,
      display:"flex", flexDirection:"column", padding:`${small?3:4}px`,
      boxShadow:shadow, transform, transition:"all 0.2s",
      cursor, overflow:"hidden", userSelect:"none",
    }}>
      <div style={{ lineHeight:1.1 }}>
        <span style={{ fontSize:cf, fontWeight:900, color, display:"block", lineHeight:1 }}>{rank}</span>
        <span style={{ fontSize:cf-1, color, lineHeight:1 }}>{suit}</span>
      </div>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
        {face
          ? <span style={{ fontSize:sf+4, fontWeight:900, color, fontFamily:"Georgia,serif", lineHeight:1 }}>{rank}</span>
          : <span style={{ fontSize:sf+2, color, fontWeight:900, lineHeight:1 }}>{suit}</span>
        }
      </div>
      <div style={{ lineHeight:1.1, transform:"rotate(180deg)" }}>
        <span style={{ fontSize:cf, fontWeight:900, color, display:"block", lineHeight:1 }}>{rank}</span>
        <span style={{ fontSize:cf-1, color, lineHeight:1 }}>{suit}</span>
      </div>
    </div>
  );
}

/* ── Countdown modal reutilizable ─────────────────── */
// ViudaCountdown: solo visual — el disparo de dealViudaCards
// ocurre en CasinoContext (sin stale closures)
function ViudaCountdown({ table }) {
  const [secs, setSecs] = useState(5);

  useEffect(() => {
    if (!table?.countdownStartedAt) return;
    const startedAt = table.countdownStartedAt;
    const iv = setInterval(() => {
      const elapsed   = (Date.now() - startedAt) / 1000;
      const remaining = Math.max(0, 5 - elapsed);
      setSecs(Math.ceil(remaining));
      if (remaining <= 0) clearInterval(iv);
    }, 100);
    return () => clearInterval(iv);
  }, [table?.countdownStartedAt]);

  const progress = (secs / 5) * 100;
  const seated   = Object.values(table?.seats || {}).filter(Boolean);

  return createPortal(
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"rgba(0,0,0,0.78)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:16,
    }}>
      <div style={{
        width:"100%", maxWidth:380,
        background:"linear-gradient(160deg,#140a1e,#0e1520)",
        border:"1px solid rgba(139,92,246,0.4)",
        borderRadius:24, padding:"28px 24px", textAlign:"center",
        boxShadow:"0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(139,92,246,0.08)",
      }}>
        {/* Timer circular */}
        <div style={{ position:"relative", width:100, height:100, margin:"0 auto 20px" }}>
          <svg width="100" height="100" style={{ transform:"rotate(-90deg)" }}>
            <circle cx="50" cy="50" r="44" fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
            <circle cx="50" cy="50" r="44" fill="none"
              stroke={secs > 2 ? "#8b5cf6" : "#ef4444"}
              strokeWidth="6"
              strokeDasharray={`${2*Math.PI*44}`}
              strokeDashoffset={`${2*Math.PI*44*(1-progress/100)}`}
              strokeLinecap="round"
              style={{ transition:"stroke-dashoffset 0.1s linear, stroke 0.3s" }}
            />
          </svg>
          <div style={{ position:"absolute", inset:0, display:"flex",
            flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:30, fontWeight:900,
              color:secs>2?"#a78bfa":"#ef4444", lineHeight:1 }}>{secs}</span>
            <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)",
              letterSpacing:"0.1em", textTransform:"uppercase" }}>seg</span>
          </div>
        </div>

        <h2 style={{ margin:"0 0 6px", fontSize:18, fontWeight:800, color:"white" }}>
          ¡La partida comienza!
        </h2>
        <p style={{ margin:"0 0 16px", color:"rgba(255,255,255,0.3)", fontSize:13 }}>
          {seated.length} jugador{seated.length!==1?"es":""} · Apuesta: ${table?.minBet}
        </p>

        {/* Reglas rápidas */}
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:12, padding:"12px 14px", textAlign:"left" }}>
          <p style={{ margin:"0 0 6px", fontSize:10, fontWeight:700, letterSpacing:"0.12em",
            textTransform:"uppercase", color:"rgba(139,92,246,0.8)" }}>
            Recordatorio
          </p>
          {[
            "Solo ves tus propias cartas",
            "Ronda 1: cambiar carta o cambiar todo",
            "Ronda 2+: también puedes pasar o tocar",
            "El que toque da 1 turno final a los demás",
          ].map((tip, i) => (
            <p key={i} style={{ margin:"3px 0", color:"rgba(255,255,255,0.35)", fontSize:12 }}>
              • {tip}
            </p>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Asiento en sala de espera ─────────────────────── */
function WaitSeat({ num, player, isMe, hasAnySeat, onSit, onLeave, onToggleReady }) {
  return (
    <div style={{
      borderRadius:16, padding:12,
      border:`1.5px solid ${isMe?"rgba(139,92,246,0.6)":!player?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.14)"}`,
      background:isMe?"rgba(139,92,246,0.08)":!player?"rgba(0,0,0,0.2)":"rgba(0,0,0,0.32)",
      backdropFilter:"blur(12px)",
      display:"flex", flexDirection:"column", alignItems:"center",
      gap:8, minHeight:160, justifyContent:"space-between",
      boxShadow:isMe?"0 0 20px rgba(139,92,246,0.1)":"none",
      transition:"all 0.3s",
    }}>
      <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.15em",
        textTransform:"uppercase", color:"rgba(167,139,250,0.65)" }}>
        Asiento {num}
      </span>

      {!player ? (
        <>
          <span style={{ fontSize:34 }}>💺</span>
          {!hasAnySeat
            ? <button onClick={() => onSit(num)} style={{ width:"100%", padding:"7px 0",
                borderRadius:10, background:"linear-gradient(135deg,#7c3aed,#a855f7)",
                color:"white", fontWeight:700, fontSize:12, border:"none", cursor:"pointer" }}>
                Sentarse
              </button>
            : <span style={{ color:"rgba(255,255,255,0.18)", fontSize:10 }}>Libre</span>
          }
        </>
      ) : (
        <>
          <div style={{ width:44, height:44, borderRadius:"50%",
            background:isMe?"rgba(139,92,246,0.2)":"rgba(167,139,250,0.1)",
            border:`2px solid ${isMe?"rgba(139,92,246,0.5)":"rgba(167,139,250,0.2)"}`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
            {isMe?"🙋":"🎮"}
          </div>
          <p style={{ margin:0, fontWeight:700, fontSize:12, textAlign:"center",
            maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {player.username}
            {isMe&&<span style={{ display:"block", fontSize:8, color:"#a78bfa" }}>(tú)</span>}
          </p>
          <span style={{ padding:"2px 8px", borderRadius:99, fontSize:9, fontWeight:700,
            textTransform:"uppercase", letterSpacing:"0.08em",
            background:player.ready?"rgba(34,197,94,0.14)":"rgba(239,68,68,0.1)",
            border:`1px solid ${player.ready?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.22)"}`,
            color:player.ready?"#4ade80":"#f87171" }}>
            {player.ready?"✓ Listo":"✗ Espera"}
          </span>
          {isMe && (
            <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:4 }}>
              <button onClick={onToggleReady} style={{ width:"100%", padding:"5px 0",
                borderRadius:8, border:"none",
                background:player.ready?"#ea580c":"#16a34a",
                color:"white", fontWeight:700, fontSize:11, cursor:"pointer" }}>
                {player.ready?"Cancelar":"¡Listo!"}
              </button>
              <button onClick={onLeave} style={{ width:"100%", padding:"4px 0",
                borderRadius:8, background:"rgba(239,68,68,0.12)",
                border:"1px solid rgba(239,68,68,0.28)",
                color:"#f87171", fontWeight:600, fontSize:11, cursor:"pointer" }}>
                Levantarse
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Toast de todos listos ─────────────────────────── */
function ReadyToast({ count, onStart }) {
  return createPortal(
    <div style={{
      position:"fixed", top:66, right:16, zIndex:9998, width:240,
      borderRadius:16,
      background:"linear-gradient(135deg,#14052e,#0e1020)",
      border:"1px solid rgba(139,92,246,0.45)",
      boxShadow:"0 0 0 1px rgba(139,92,246,0.1), 0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(139,92,246,0.15)",
      padding:"14px 16px",
      display:"flex", flexDirection:"column", gap:10,
      animation:"slideInRight 0.3s ease-out both",
    }}>
      <style>{`
        @keyframes slideInRight {
          from{opacity:0;transform:translateX(24px)}
          to{opacity:1;transform:translateX(0)}
        }
      `}</style>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#a855f7",
          boxShadow:"0 0 8px #a855f7", animation:"pulse 1.4s ease-in-out infinite" }} />
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        <span style={{ color:"#c4b5fd", fontWeight:700, fontSize:13 }}>¡Todos listos!</span>
      </div>
      <p style={{ margin:0, color:"rgba(255,255,255,0.3)", fontSize:11, lineHeight:1.4 }}>
        {count===1?"Puedes jugar solo.":
          `Los ${count} jugadores están listos.`} No hace falta llenar la mesa.
      </p>
      <button onClick={onStart} style={{ width:"100%", padding:"9px 0", borderRadius:10,
        background:"linear-gradient(135deg,#7c3aed,#a855f7)",
        color:"white", fontWeight:800, fontSize:13, letterSpacing:"0.06em",
        textTransform:"uppercase", border:"none", cursor:"pointer",
        boxShadow:"0 0 18px rgba(139,92,246,0.35)",
        transition:"transform 0.15s" }}
        onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.03)"}}
        onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)"}}>
        🃏 Iniciar Partida
      </button>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════ */
export default function ViudaTable() {
  const {
    activeTable, user, userData,
    sitOnSeat, leaveSeat, leaveTable, toggleReady,
    startCountdown, dealViudaCards,
    viudaSwapCard, viudaSwapAll, viudaSkipAll, viudaPass, viudaTouch,
    resetViudaRound, updateSeatBet,
  } = useCasino();

  // Modo de intercambio de carta: null o "selecting_mine" o "selecting_center"
  const [swapCardMode, setSwapCardMode] = useState(false);
  const [selectedMyIdx, setSelectedMyIdx] = useState(null);

  const seats      = activeTable?.seats      || {};
  const spectators = activeTable?.spectators || [];
  const phase      = activeTable?.phase      || "waiting";
  const round      = activeTable?.round      || 1;
  const centerCards = activeTable?.centerCards || [];

  const myEntry       = Object.entries(seats).find(([_, p]) => p?.uid === user?.uid);
  const mySeatKey     = myEntry?.[0] ?? null;
  const myPlayer      = myEntry?.[1] ?? null;
  const seatedPlayers = Object.values(seats).filter(Boolean);
  const readyCount    = seatedPlayers.filter(p => p.ready).length;
  const allReady      = seatedPlayers.length > 0 && readyCount === seatedPlayers.length;
  const isMyTurn      = activeTable?.currentTurn === mySeatKey;
  const round1Phase   = activeTable?.round1Phase;  // "choose_all" | "individual" | null
  const isChooseAll   = round1Phase === "choose_all"; // Ronda 1: elegir cambiar todo o no
  // Tocar: disponible cuando firstOfferedSeat ya actuó en ronda 1
  // (es decir, la primera vuelta completa ha terminado)
  const firstOfferedActed = activeTable?.firstOfferedActed || false;
  const canTouch = firstOfferedActed && isMyTurn && phase === "playing";
  const canPass       = phase === "final_round" && isMyTurn; // SOLO tras un toque
  const inGame        = ["playing","final_round","results","dealing"].includes(phase);

  const phaseLabels = {
    waiting:     "Sala de espera",
    countdown:   "¡Iniciando!",
    playing:     `Ronda ${round}`,
    final_round: "🖐 Última Ronda",
    results:     "Resultados",
  };

  // Cancelar modo swap al cambiar de turno
  useEffect(() => {
    if (!isMyTurn) { setSwapCardMode(false); setSelectedMyIdx(null); }
  }, [isMyTurn]);

  /* ── Handlers ── */
  const handleSelectMyCard = (idx) => {
    if (!swapCardMode || !isMyTurn) return;
    setSelectedMyIdx(prev => prev === idx ? null : idx);
  };

  const handleSelectCenterCard = async (idx) => {
    if (!isMyTurn) return;
    if (swapCardMode && selectedMyIdx !== null) {
      await viudaSwapCard(selectedMyIdx, idx);
      setSwapCardMode(false);
      setSelectedMyIdx(null);
    }
  };

  const handleSwapCard = () => {
    setSwapCardMode(true);
    setSelectedMyIdx(null);
  };

  const handleCancelSwap = () => {
    setSwapCardMode(false);
    setSelectedMyIdx(null);
  };

  /* ── Mano evaluada del jugador actual ── */
  // wildcardRank viene de Firestore (guardado por dealViudaCards)
  // Así todos los jugadores ven EXACTAMENTE el mismo comodín
  const wildRank   = activeTable?.wildcardRank || null;
  const myHandEval  = myPlayer?.cards?.length === 5
    ? evaluateBestHand(myPlayer.cards, wildRank)
    : null;

  /* ── Render ── */
  return (
    <>
      <style>{`
        .v-seats-in  { display:flex!important; }
        .v-seats-out { display:none!important; }
        @media(max-width:580px){
          .v-seats-in  { display:none!important; }
          .v-seats-out { display:grid!important; }
        }
      `}</style>

      {/* Modales */}
      {phase === "countdown" && (
        <ViudaCountdown table={activeTable} />
      )}
      {phase === "waiting" && allReady && seatedPlayers.length > 0 && mySeatKey && (
        <ReadyToast count={seatedPlayers.length} onStart={startCountdown} />
      )}

      <div style={{ minHeight:"100vh", background:"#080610", color:"white",
        display:"flex", flexDirection:"column" }}>

        {/* ═══ NAVBAR ═══ */}
        <nav style={{
          position:"sticky", top:0, zIndex:50,
          background:"rgba(8,6,16,0.97)", backdropFilter:"blur(20px)",
          borderBottom:"1px solid rgba(139,92,246,0.12)",
          padding:"0 clamp(12px,3vw,28px)", height:56, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={leaveTable} style={{ padding:"6px 12px", borderRadius:10,
              background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.18)",
              color:"#f87171", fontSize:13, fontWeight:600, cursor:"pointer" }}>
              ← Salir
            </button>
            <div style={{ width:1, height:22, background:"rgba(255,255,255,0.08)" }} />
            <span style={{ fontFamily:"Georgia,serif",
              fontSize:"clamp(16px,2.5vw,22px)", fontWeight:900,
              color:"#a78bfa", letterSpacing:"0.1em" }}>
              LA VIUDA
            </span>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontFamily:"monospace", fontSize:13, color:"#a78bfa",
              letterSpacing:"0.2em", padding:"4px 10px", borderRadius:99,
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
              {activeTable?.code}
            </span>
            <span style={{ fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:99,
              background:inGame?"rgba(139,92,246,0.12)":"rgba(139,92,246,0.05)",
              border:`1px solid ${inGame?"rgba(139,92,246,0.3)":"rgba(139,92,246,0.15)"}`,
              color:"#c4b5fd", whiteSpace:"nowrap" }}>
              {phaseLabels[phase] || phase}
            </span>
            {phase==="final_round" && (
              <span style={{ fontSize:12, fontWeight:700, padding:"4px 10px", borderRadius:99,
                background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)",
                color:"#f87171", whiteSpace:"nowrap" }}>
                ¡Última ronda!
              </span>
            )}
            {/* Comodín de la ronda — visible durante toda la partida */}
            {wildRank && (
              <div style={{ display:"flex", alignItems:"center", gap:5,
                padding:"4px 12px", borderRadius:99,
                background:"rgba(251,191,36,0.12)",
                border:"1px solid rgba(251,191,36,0.4)",
                boxShadow:"0 0 10px rgba(251,191,36,0.1)" }}>
                <span style={{ fontSize:13 }}>★</span>
                <div>
                  <span style={{ color:"rgba(251,191,36,0.6)", fontSize:9,
                    fontWeight:600, letterSpacing:"0.1em",
                    textTransform:"uppercase", display:"block", lineHeight:1 }}>
                    Comodín
                  </span>
                  <span style={{ color:"#fbbf24", fontSize:14, fontWeight:900, lineHeight:1 }}>
                    {wildRank}
                  </span>
                </div>
              </div>
            )}
            <span style={{ fontSize:14, fontWeight:700, padding:"4px 10px", borderRadius:99,
              background:"rgba(212,175,55,0.08)", border:"1px solid rgba(212,175,55,0.18)",
              color:"#d4af37", whiteSpace:"nowrap" }}>
              💰 ${(userData?.balance||0).toLocaleString()}
            </span>
          </div>
        </nav>

        {/* ═══ CONTENIDO ═══ */}
        <div style={{ flex:1, padding:"clamp(10px,2vw,16px)",
          maxWidth:1200, margin:"0 auto", width:"100%",
          display:"flex", flexDirection:"column", gap:14 }}>

          {/* ═══════════════════════════
              TAPETE
          ═══════════════════════════ */}
          <div style={{
            position:"relative",
            borderRadius:"clamp(36px,6vw,72px) clamp(36px,6vw,72px) 18px 18px",
            minHeight:"clamp(400px,52vw,580px)",
            overflow:"hidden",
            display:"flex", flexDirection:"column",
            border:"clamp(6px,1vw,10px) solid",
            borderColor:"#6b3fa0 #9333ea #5b2f90 #9333ea",
            boxShadow:"0 0 0 1px rgba(139,92,246,0.1), 0 8px 60px rgba(0,0,0,0.85)",
          }}>
            {/* Fondo del tapete — morado oscuro para La Viuda */}
            <div style={{ position:"absolute", inset:0, zIndex:0,
              background:"radial-gradient(ellipse at 50% 20%, #2d1a5c 0%, #1a0f38 45%, #0d0820 80%, #060410 100%)" }} />
            <div style={{ position:"absolute", inset:0, zIndex:0, opacity:0.05,
              pointerEvents:"none",
              backgroundImage:"radial-gradient(circle,#fff 1px,transparent 1px)",
              backgroundSize:"20px 20px" }} />
            <div style={{ position:"absolute", zIndex:0,
              top:"clamp(6px,1%,12px)", left:"clamp(8px,1.5%,18px)",
              right:"clamp(8px,1.5%,18px)", bottom:"clamp(6px,1%,12px)",
              borderRadius:"clamp(30px,5vw,66px) clamp(30px,5vw,66px) 14px 14px",
              border:"1px solid rgba(139,92,246,0.14)", pointerEvents:"none" }} />

            {/* ── OTROS JUGADORES (arriba) ── */}
            {inGame && (
              <div style={{ position:"relative", zIndex:1,
                flex:"0 0 auto", padding:"clamp(10px,2%,18px) 16px 6px",
                display:"flex", justifyContent:"center",
                gap:"clamp(8px,2vw,20px)", flexWrap:"wrap" }}>
                {Object.entries(seats)
                  .filter(([_, p]) => p !== null && p.uid !== user?.uid)
                  .map(([key, player]) => {
                    const isTurn = activeTable?.currentTurn === key;
                    const isResult = phase === "results";
                    return (
                      <div key={key} style={{
                        display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                        padding:"8px 10px",
                        borderRadius:12,
                        border:`1px solid ${isTurn?"rgba(139,92,246,0.6)":"rgba(255,255,255,0.1)"}`,
                        background:isTurn?"rgba(139,92,246,0.1)":"rgba(0,0,0,0.25)",
                        backdropFilter:"blur(8px)",
                        boxShadow:isTurn?"0 0 16px rgba(139,92,246,0.2)":"none",
                        transition:"all 0.3s",
                        minWidth:100,
                      }}>
                        {isTurn && (
                          <span style={{ fontSize:9, fontWeight:800, color:"#c4b5fd",
                            letterSpacing:"0.1em", textTransform:"uppercase" }}>
                            ⏳ Su turno
                          </span>
                        )}
                        <div style={{ width:36, height:36, borderRadius:"50%",
                          background:"rgba(139,92,246,0.15)",
                          border:"1px solid rgba(139,92,246,0.3)",
                          display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                          🎮
                        </div>
                        <p style={{ margin:0, fontSize:11, fontWeight:600,
                          color:isTurn?"#c4b5fd":"rgba(255,255,255,0.7)",
                          maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {player.username}
                        </p>
                        {/* Cartas siempre boca abajo durante el juego, reveladas en resultados */}
                        <div style={{ display:"flex", gap:3, justifyContent:"center" }}>
                          {(player.cards?.length ? player.cards : Array(5).fill("?")).map((card, i) => (
                            <VCard key={i} card={card}
                              faceDown={!isResult}
                              small />
                          ))}
                        </div>
                        {/* Resultado y mano en fase de resultados */}
                        {isResult && player.result && (
                          <div style={{ textAlign:"center" }}>
                            <span style={{
                              fontSize:10, fontWeight:700, padding:"2px 8px",
                              borderRadius:99, letterSpacing:"0.06em",
                              background:player.result==="win"?"rgba(212,175,55,0.15)":"rgba(239,68,68,0.1)",
                              border:`1px solid ${player.result==="win"?"rgba(212,175,55,0.4)":"rgba(239,68,68,0.3)"}`,
                              color:player.result==="win"?"#fbbf24":"#f87171",
                              display:"block", marginBottom:2,
                            }}>
                              {player.result==="win"?"🏆 Ganador":"💸 Perdiste"}
                            </span>
                            <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>
                              {evaluateBestHand(player.cards, wildRank).name}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* ── CENTRO — 5 CARTAS ── */}
            {inGame && (
              <div style={{ position:"relative", zIndex:1,
                flex:"0 0 auto", padding:"8px 20px",
                display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <div style={{ display:"flex", alignItems:"center",
                  justifyContent:"center", gap:12, flexWrap:"wrap" }}>
                  <p style={{ margin:0, fontSize:10, fontWeight:700, letterSpacing:"0.15em",
                    textTransform:"uppercase", color:"rgba(167,139,250,0.6)" }}>
                    ✦ La Viuda ✦
                    <span style={{ marginLeft:8, textTransform:"none", letterSpacing:"normal",
                      fontSize:10, color:"rgba(167,139,250,0.5)", fontWeight:500 }}>
                      {isChooseAll ? "(boca abajo — ronda 1)" : "(intercambia carta individual)"}
                    </span>
                  </p>
                  {wildRank && (
                    <div style={{ display:"flex", alignItems:"center", gap:4,
                      padding:"2px 8px", borderRadius:99,
                      background:"rgba(251,191,36,0.1)",
                      border:"1px solid rgba(251,191,36,0.3)" }}>
                      <span style={{ color:"rgba(251,191,36,0.6)", fontSize:9,
                        textTransform:"uppercase", letterSpacing:"0.08em" }}>
                        Comodín:
                      </span>
                      <span style={{ color:"#fbbf24", fontWeight:900, fontSize:12 }}>
                        {wildRank}
                      </span>
                    </div>
                  )}
                </div>
                  {swapCardMode && selectedMyIdx !== null && (
                    <p style={{ margin:"2px 0 0", color:"#fbbf24",
                      fontSize:10, textAlign:"center" }}>
                      ← Elige una carta del centro
                    </p>
                  )}
                <div style={{ display:"flex", gap:"clamp(4px,1vw,8px)", justifyContent:"center" }}>
                  {centerCards.map((cc, i) => (
                    <VCard key={i}
                      card={cc.card}
                      faceDown={!cc.revealed}
                      small
                      selected={swapCardMode && selectedMyIdx !== null}
                      isWild={cc.revealed && isWildcard(cc.card, wildRank)}
                      onClick={swapCardMode && !isChooseAll ? () => handleSelectCenterCard(i) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── ZONA CENTRAL (logo / estado) en espera ── */}
            {!inGame && (
              <div style={{ position:"relative", zIndex:1,
                flex:1, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center",
                padding:"20px", textAlign:"center",
                pointerEvents:"none", userSelect:"none" }}>
                <p style={{ margin:"0 0 4px", fontSize:"clamp(14px,2vw,20px)",
                  opacity:0.15, letterSpacing:"0.25em" }}>♠ ♥ ♦ ♣</p>
                <p style={{ margin:0,
                  fontFamily:"Georgia,serif",
                  fontSize:"clamp(32px,6vw,76px)",
                  fontWeight:900, letterSpacing:"0.1em", lineHeight:1,
                  background:"linear-gradient(180deg,#a78bfa 0%,#c4b5fd 40%,#7c3aed 100%)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                  backgroundClip:"text" }}>
                  La Viuda
                </p>
                <p style={{ margin:"6px 0 0", fontSize:"clamp(10px,1.3vw,13px)",
                  color:"rgba(167,139,250,0.45)", fontWeight:500 }}>
                  {seatedPlayers.length===0?"Esperando jugadores…"
                    :allReady?"¡Todos listos — inicia la partida!"
                    :`${readyCount} de ${seatedPlayers.length} listos`}
                </p>
              </div>
            )}

            {/* ── MI MANO (abajo, dentro del tapete) ── */}
            {inGame && myPlayer && (
              <div style={{ position:"relative", zIndex:1,
                flex:1, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"flex-end",
                padding:"8px 20px clamp(12px,2vw,20px)" }}>

                {/* Estado de mi turno */}
                {isMyTurn && phase !== "results" && (
                  <p style={{ margin:"0 0 6px", fontSize:12, fontWeight:700,
                    color:"#a78bfa" }}>
                    {swapCardMode && selectedMyIdx === null
                      ? "Selecciona una de tus cartas"
                      : swapCardMode && selectedMyIdx !== null
                        ? "Ahora selecciona una carta del centro"
                        : isChooseAll
                          ? "Ronda 1 — ¿Cambias toda tu mano por las del centro?"
                          : !firstOfferedActed
                            ? "Ronda 1 — Todos deben actuar antes de poder tocar"
                            : "Es tu turno — elige una acción"}
                  </p>
                )}
                {!isMyTurn && phase !== "results" && phase !== "waiting" && (
                  <p style={{ margin:"0 0 6px", fontSize:12,
                    color:"rgba(255,255,255,0.25)" }}>
                    Turno de{" "}
                    <strong style={{ color:"white" }}>
                      {seats[activeTable?.currentTurn]?.username || "…"}
                    </strong>
                  </p>
                )}

                {/* Mis cartas */}
                <div style={{ display:"flex", gap:"clamp(4px,1vw,8px)",
                  justifyContent:"center", flexWrap:"wrap" }}>
                  {myPlayer.cards.map((card, i) => (
                    <VCard key={i} card={card}
                      faceDown={false}
                      selected={selectedMyIdx === i}
                      isWild={isWildcard(card, wildRank)}
                      onClick={swapCardMode && isMyTurn && !isChooseAll
                        ? () => handleSelectMyCard(i)
                        : undefined}
                    />
                  ))}
                </div>

                {/* Mi combinación actual */}
                {myHandEval && phase !== "results" && (
                  <p style={{ margin:"6px 0 0", fontSize:11,
                    color:"rgba(167,139,250,0.6)", fontWeight:500 }}>
                    Tu mano: <strong style={{ color:"#c4b5fd" }}>{myHandEval.display}</strong>
                  </p>
                )}

                {/* Resultado propio */}
                {phase === "results" && myPlayer.result && (
                  <div style={{ marginTop:8, textAlign:"center" }}>
                    <span style={{
                      fontSize:13, fontWeight:800, padding:"4px 14px",
                      borderRadius:99, letterSpacing:"0.06em",
                      background:myPlayer.result==="win"
                        ?"rgba(212,175,55,0.15)":"rgba(239,68,68,0.1)",
                      border:`1px solid ${myPlayer.result==="win"
                        ?"rgba(212,175,55,0.4)":"rgba(239,68,68,0.3)"}`,
                      color:myPlayer.result==="win"?"#fbbf24":"#f87171",
                    }}>
                      {myPlayer.result==="win"
                        ?`🏆 Ganaste! +$${myPlayer.payout}`
                        :"💸 Perdiste"}
                    </span>
                    <p style={{ margin:"4px 0 0", fontSize:11, color:"rgba(255,255,255,0.4)" }}>
                      Tu mano: {evaluateBestHand(myPlayer.cards, wildRank).display}
                    </p>
                  </div>
                )}

                <p style={{ margin:"4px 0 0", fontSize:10, color:"rgba(255,255,255,0.2)" }}>
                  {myPlayer.bet ? `Apuesta: $${myPlayer.bet}` : ""}
                </p>
              </div>
            )}

            {/* ── ASIENTOS en sala de espera ── */}
            {!inGame && (
              <>
                <div className="v-seats-in" style={{
                  position:"relative", zIndex:1,
                  flex:"0 0 auto",
                  padding:"6px clamp(8px,2%,20px) clamp(10px,2%,18px)",
                  justifyContent:"space-between", alignItems:"flex-end",
                  gap:"clamp(4px,0.8vw,10px)" }}>
                  {Object.entries(seats).map(([num, player]) => (
                    <div key={num} style={{ flex:"0 1 19%", minWidth:95, maxWidth:165 }}>
                      <WaitSeat num={num} player={player}
                        isMe={player?.uid===user?.uid}
                        hasAnySeat={!!mySeatKey}
                        onSit={sitOnSeat} onLeave={leaveSeat} onToggleReady={toggleReady} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* ── FIN TAPETE ── */}

          {/* Asientos mobile */}
          {!inGame && (
            <div className="v-seats-out"
              style={{ gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:8 }}>
              {Object.entries(seats).map(([num, player]) => (
                <WaitSeat key={num} num={num} player={player}
                  isMe={player?.uid===user?.uid}
                  hasAnySeat={!!mySeatKey}
                  onSit={sitOnSeat} onLeave={leaveSeat} onToggleReady={toggleReady} />
              ))}
            </div>
          )}

          {/* ═══════════════════════════
              CONTROLES DE ACCIÓN
          ═══════════════════════════ */}
          {(phase==="playing"||phase==="final_round") && mySeatKey && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
              {isMyTurn ? (
                <>
                  {/* ── RONDA 1: elegir cambiar todo o no ── */}
                  {isChooseAll && !swapCardMode && (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                      <div style={{ textAlign:"center",
                        padding:"10px 16px", borderRadius:12,
                        background:"rgba(139,92,246,0.08)",
                        border:"1px solid rgba(139,92,246,0.2)" }}>
                        <p style={{ margin:"0 0 4px", color:"#c4b5fd", fontWeight:700, fontSize:14 }}>
                          Ronda 0 — Cartas del centro boca abajo
                        </p>
                        <p style={{ margin:0, color:"rgba(255,255,255,0.3)", fontSize:12 }}>
                          ¿Cambias toda tu mano por las 5 del centro?
                        </p>
                      </div>
                      <div style={{ display:"flex", gap:12 }}>
                        <button onClick={viudaSwapAll}
                          style={{ padding:"12px 28px", borderRadius:12,
                            background:"linear-gradient(135deg,#4c1d95,#7c3aed)",
                            color:"white", fontWeight:800, fontSize:14,
                            border:"none", cursor:"pointer",
                            boxShadow:"0 0 16px rgba(124,58,237,0.35)",
                            transition:"transform 0.15s" }}
                          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
                          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                          🔀 Sí, cambiar todo
                        </button>
                        <button onClick={viudaSkipAll}
                          style={{ padding:"12px 28px", borderRadius:12,
                            background:"rgba(255,255,255,0.06)",
                            border:"1px solid rgba(255,255,255,0.15)",
                            color:"rgba(255,255,255,0.6)", fontWeight:700, fontSize:14,
                            cursor:"pointer", transition:"transform 0.15s" }}
                          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
                          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                          ❌ No cambiar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── RONDAS 2+: intercambio individual ── */}
                  {!isChooseAll && !swapCardMode && (
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
                      <button onClick={handleSwapCard}
                        style={{ padding:"11px 22px", borderRadius:12,
                          background:"linear-gradient(135deg,#1e3a5f,#2563eb)",
                          color:"white", fontWeight:700, fontSize:14,
                          border:"1px solid rgba(96,165,250,0.3)", cursor:"pointer",
                          transition:"transform 0.15s" }}
                        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
                        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                        🔄 Cambiar Carta
                      </button>
                      <button onClick={viudaSwapAll}
                        style={{ padding:"11px 22px", borderRadius:12,
                          background:"linear-gradient(135deg,#4c1d95,#7c3aed)",
                          color:"white", fontWeight:700, fontSize:14,
                          border:"none", cursor:"pointer", transition:"transform 0.15s" }}
                        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
                        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                        🔀 Cambiar Todo
                      </button>
                      {/* Pasar: SOLO en final_round */}
                      {canPass && (
                        <button onClick={viudaPass}
                          style={{ padding:"11px 22px", borderRadius:12,
                            background:"rgba(255,255,255,0.06)",
                            border:"1px solid rgba(255,255,255,0.12)",
                            color:"rgba(255,255,255,0.55)", fontWeight:600, fontSize:14,
                            cursor:"pointer", transition:"transform 0.15s" }}
                          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
                          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                          ⏭ Pasar
                        </button>
                      )}
                      {canTouch && (
                        <button onClick={viudaTouch}
                          style={{ padding:"11px 22px", borderRadius:12,
                            background:"linear-gradient(135deg,#7f1d1d,#b91c1c)",
                            color:"white", fontWeight:800, fontSize:14,
                            border:"none", cursor:"pointer",
                            boxShadow:"0 0 16px rgba(185,28,28,0.3)",
                            transition:"transform 0.15s" }}
                          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
                          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                          🖐 Tocar la Mesa
                        </button>
                      )}
                    </div>
                  )}

                  {/* Modo selección de carta */}
                  {swapCardMode && (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                      <p style={{ margin:0, color:"#a78bfa", fontSize:13, fontWeight:600 }}>
                        {selectedMyIdx === null
                          ? "1. Toca una de tus cartas"
                          : "2. Toca una carta del centro para intercambiar"}
                      </p>
                      <button onClick={handleCancelSwap}
                        style={{ padding:"8px 20px", borderRadius:10,
                          background:"rgba(255,255,255,0.05)",
                          border:"1px solid rgba(255,255,255,0.1)",
                          color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer" }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ margin:0, color:"rgba(255,255,255,0.3)", fontSize:14 }}>
                  ⏳ Turno de{" "}
                  <strong style={{ color:"white" }}>
                    {seats[activeTable?.currentTurn]?.username || "…"}
                  </strong>
                  {phase==="final_round" && (
                    <span style={{ color:"#f87171", marginLeft:6 }}>· Última ronda</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* ═══ RESULTADOS ═══ */}
          {phase==="results" && (
            <div style={{ display:"flex", flexDirection:"column",
              alignItems:"center", gap:14 }}>

              {/* Tabla de resultados */}
              <div style={{ width:"100%", maxWidth:600,
                background:"rgba(255,255,255,0.02)",
                border:"1px solid rgba(139,92,246,0.2)",
                borderRadius:16, overflow:"hidden" }}>
                <div style={{ padding:"12px 16px",
                  borderBottom:"1px solid rgba(255,255,255,0.06)",
                  background:"rgba(139,92,246,0.08)" }}>
                  <p style={{ margin:0, fontWeight:700, fontSize:15, textAlign:"center" }}>
                    🏆 Resultados de la mano
                  </p>
                </div>
                {Object.entries(seats)
                  .filter(([_, p]) => p)
                  .sort(([_a, a], [_b, b]) => {
                    if (a.result===b.result) return 0;
                    return a.result==="win"?-1:1;
                  })
                  .map(([key, p]) => (
                    <div key={key} style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"10px 16px", gap:12,
                      borderBottom:"1px solid rgba(255,255,255,0.04)",
                      background:p.result==="win"?"rgba(212,175,55,0.05)":"transparent",
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:16 }}>
                          {p.result==="win"?"🏆":"💸"}
                        </span>
                        <div>
                          <p style={{ margin:0, fontWeight:700, fontSize:13,
                            color:p.uid===user?.uid?"#a78bfa":"white" }}>
                            {p.username}
                            {p.uid===user?.uid&&
                              <span style={{ fontSize:9, color:"rgba(167,139,250,0.6)", marginLeft:4 }}>
                                (tú)
                              </span>
                            }
                          </p>
                          <p style={{ margin:0, fontSize:11, color:"rgba(255,255,255,0.35)" }}>
                            {evaluateBestHand(p.cards, wildRank).display}
                          </p>
                        </div>
                      </div>
                      <span style={{
                        fontSize:13, fontWeight:700,
                        color:p.result==="win"?"#fbbf24":"#f87171" }}>
                        {p.result==="win"?`+$${p.payout}`:`-$${p.bet}`}
                      </span>
                    </div>
                  ))}
              </div>

              <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
                <button onClick={resetViudaRound}
                  style={{ padding:"12px 36px", borderRadius:12,
                    background:"linear-gradient(135deg,#7c3aed,#a855f7)",
                    color:"white", fontWeight:800, fontSize:14,
                    border:"none", cursor:"pointer",
                    transition:"transform 0.15s" }}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                  🔄 Nueva Mano
                </button>
                <button onClick={leaveTable}
                  style={{ padding:"12px 24px", borderRadius:12,
                    background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.1)",
                    color:"rgba(255,255,255,0.45)", fontSize:14, cursor:"pointer" }}>
                  Salir
                </button>
              </div>
            </div>
          )}

          {/* ═══ ESPECTADORES ═══ */}
          <div style={{ background:"rgba(255,255,255,0.02)",
            border:"1px solid rgba(255,255,255,0.05)",
            borderRadius:14, padding:"clamp(10px,1.5vw,16px)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em",
                textTransform:"uppercase", color:"rgba(255,255,255,0.2)" }}>
                👁 Espectadores
              </span>
              <span style={{ background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.3)",
                fontSize:11, fontWeight:600, padding:"1px 8px", borderRadius:99 }}>
                {spectators.length}
              </span>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {spectators.length===0
                ? <p style={{ color:"rgba(255,255,255,0.18)", fontSize:12, margin:0 }}>Sin espectadores</p>
                : spectators.map(s => (
                    <div key={s.uid} style={{ display:"flex", alignItems:"center", gap:6,
                      padding:"5px 11px", borderRadius:99,
                      background:s.uid===user?.uid?"rgba(139,92,246,0.07)":"rgba(255,255,255,0.04)",
                      border:`1px solid ${s.uid===user?.uid?"rgba(139,92,246,0.2)":"rgba(255,255,255,0.06)"}`,
                      fontSize:12 }}>
                      <span>{s.uid===user?.uid?"👤":"👁️"}</span>
                      <span style={{ color:s.uid===user?.uid?"#a78bfa":"rgba(255,255,255,0.65)" }}>
                        {s.username}
                      </span>
                    </div>
                  ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
