import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useCasino } from "../../context/CasinoContext";

/* ══════════════════════════════════════════════════
   TABLE 21  ·  Blackjack multijugador en tiempo real
   Layout del tapete:
     ┌──────────────────────────┐
     │   🎩  DEALER  [cartas]   │  ← top 25%
     │                          │
     │    ♠ ♥ ♦ ♣   21 (logo)  │  ← centro (solo waiting)
     │                          │
     │  [P1] [P2] [P3] [P4] [P5]│  ← bottom 35% (dentro del tapete)
     └──────────────────────────┘
     [HIT]   [STAND]              ← controles bajo el tapete
══════════════════════════════════════════════════ */

// ── Constantes ──────────────────────────────────
const RED_SUITS = new Set(["♥","♦"]);
const isRed = (card) => card && RED_SUITS.has(card[card.length - 1]);

/* ══════════════════════════════════════════════════
   GAME CARD — naipe visual limpio, sin overflow
   Tamaños:
     sm → 44×62  (mano del jugador compacta)
     md → 58×82  (dealer, normal)
   Diseño: esquina TL + símbolo central + esquina BR
   overflow:hidden garantiza que nada se sale
══════════════════════════════════════════════════ */

function GameCard({ card, faceDown = false, small = false }) {
  /* Dimensiones según tamaño */
  const w   = small ? 44  : 58;
  const h   = small ? 62  : 82;
  const r   = small ? 7   : 9;
  const cf  = small ? 9   : 12;   // corner font
  const sf  = small ? 14  : 19;   // center suit/rank font

  /* ── REVERSO ── */
  if (faceDown) return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(145deg,#1a3a6b 0%,#0d2044 100%)",
      border: "2px solid rgba(59,130,246,0.4)",
      boxShadow: "0 4px 14px rgba(0,0,0,0.65)",
      overflow: "hidden", position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        position: "absolute", inset: 4, borderRadius: r - 2,
        border: "1px solid rgba(96,165,250,0.18)",
        background: "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(96,165,250,0.05) 5px,rgba(96,165,250,0.05) 10px)",
      }} />
      <span style={{ position: "relative", fontSize: sf, opacity: 0.25, color: "#93c5fd" }}>✦</span>
    </div>
  );

  const suit  = card?.[card.length - 1] ?? "";
  const rank  = card?.slice(0, -1)      ?? "";
  const red   = isRed(card);
  const color = red ? "#c0392b" : "#111827";
  const isFace = ["J", "Q", "K"].includes(rank);

  /* Símbolo central: para figuras mostramos letra grande + palo pequeño.
     Para número/As mostramos el palo. Sin emojis → sin overflow. */
  const CenterSymbol = () => {
    if (isFace) return (
      <div style={{ display: "flex", flexDirection: "column",
        alignItems: "center", gap: 0, lineHeight: 1 }}>
        <span style={{ fontSize: sf + 4, fontWeight: 900, color,
          fontFamily: "Georgia, serif", lineHeight: 1 }}>
          {rank}
        </span>
        <span style={{ fontSize: sf - 2, color, lineHeight: 1 }}>{suit}</span>
      </div>
    );
    return (
      <span style={{ fontSize: sf + 2, color, lineHeight: 1, fontWeight: 900 }}>
        {suit}
      </span>
    );
  };

  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: "white",
      border: "1.5px solid #d1d5db",
      display: "flex", flexDirection: "column",
      padding: `${small ? 3 : 4}px`,
      boxShadow: "0 4px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.9)",
      userSelect: "none",
      overflow: "hidden",      /* ← clave: nada se sale */
      position: "relative",
    }}>
      {/* Esquina superior izquierda */}
      <div style={{ display: "flex", flexDirection: "column",
        alignItems: "flex-start", lineHeight: 1, gap: 0 }}>
        <span style={{ fontSize: cf, fontWeight: 900, color, lineHeight: 1.1 }}>{rank}</span>
        <span style={{ fontSize: cf - 1, color, lineHeight: 1 }}>{suit}</span>
      </div>

      {/* Centro */}
      <div style={{ flex: 1, display: "flex", alignItems: "center",
        justifyContent: "center", overflow: "hidden" }}>
        <CenterSymbol />
      </div>

      {/* Esquina inferior derecha (rotada 180°) */}
      <div style={{ display: "flex", flexDirection: "column",
        alignItems: "flex-start", lineHeight: 1, gap: 0,
        transform: "rotate(180deg)" }}>
        <span style={{ fontSize: cf, fontWeight: 900, color, lineHeight: 1.1 }}>{rank}</span>
        <span style={{ fontSize: cf - 1, color, lineHeight: 1 }}>{suit}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PLAYER SEAT — asiento en sala de espera
══════════════════════════════════════════════════ */
function WaitingSeat({num,player,isMe,hasAnySeat,onSit,onLeave,onToggleReady}) {
  return (
    <div style={{
      borderRadius:14, padding:"12px 10px",
      border:`1.5px solid ${isMe?"rgba(212,175,55,0.6)":!player?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.14)"}`,
      background: isMe?"rgba(212,175,55,0.07)":!player?"rgba(0,0,0,0.2)":"rgba(0,0,0,0.35)",
      backdropFilter:"blur(10px)",
      display:"flex",flexDirection:"column",alignItems:"center",gap:6,
      minHeight:160, justifyContent:"space-between",
      boxShadow: isMe?"0 0 16px rgba(212,175,55,0.12)":"none",
      transition:"all 0.3s", flex:"0 1 18%", minWidth:120, maxWidth:170,
    }}>
      <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.15em",
        textTransform:"uppercase",color:"rgba(134,239,172,0.6)"}}>
        Asiento {num}
      </span>
      {!player?(
        <>
          <span style={{fontSize:34}}>💺</span>
          {!hasAnySeat?(
            <button onClick={()=>onSit(num)} style={{width:"100%",padding:"7px 0",
              borderRadius:9,background:"linear-gradient(135deg,#d4af37,#f0d060)",
              color:"#0d0d0d",fontWeight:700,fontSize:11,border:"none",cursor:"pointer"}}>
              Sentarse
            </button>
          ):(
            <span style={{color:"rgba(255,255,255,0.18)",fontSize:10}}>Libre</span>
          )}
        </>
      ):(
        <>
          <div style={{width:40,height:40,borderRadius:"50%",
            background:isMe?"rgba(212,175,55,0.2)":"rgba(34,197,94,0.12)",
            border:`2px solid ${isMe?"rgba(212,175,55,0.5)":"rgba(34,197,94,0.25)"}`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
            {isMe?"🙋":"🎮"}
          </div>
          <p style={{margin:0,fontWeight:700,fontSize:12,textAlign:"center",
            maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {player.username}
            {isMe&&<span style={{display:"block",fontSize:9,color:"#d4af37"}}>(tú)</span>}
          </p>
          <span style={{padding:"2px 8px",borderRadius:99,fontSize:9,fontWeight:700,
            textTransform:"uppercase",letterSpacing:"0.08em",
            background:player.ready?"rgba(34,197,94,0.14)":"rgba(239,68,68,0.1)",
            border:`1px solid ${player.ready?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.22)"}`,
            color:player.ready?"#4ade80":"#f87171"}}>
            {player.ready?"✓ Listo":"✗ Espera"}
          </span>
          {isMe&&(
            <div style={{width:"100%",display:"flex",flexDirection:"column",gap:4}}>
              <button onClick={onToggleReady} style={{width:"100%",padding:"6px 0",
                borderRadius:8,background:player.ready?"#ea580c":"#16a34a",
                border:"none",color:"white",fontWeight:700,fontSize:10,cursor:"pointer"}}>
                {player.ready?"Cancelar":"¡Listo!"}
              </button>
              <button onClick={onLeave} style={{width:"100%",padding:"5px 0",
                borderRadius:8,background:"rgba(239,68,68,0.12)",
                border:"1px solid rgba(239,68,68,0.28)",
                color:"#f87171",fontWeight:600,fontSize:10,cursor:"pointer"}}>
                Levantarse
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PLAYER GAME CARD — dentro del tapete durante juego
══════════════════════════════════════════════════ */
function PlayerGameCard({player,isMe,isCurrentTurn,isDone}) {
  const RC = {
    win:       {bg:"rgba(34,197,94,0.15)",  b:"rgba(34,197,94,0.5)",  t:"#4ade80",  icon:"🏆"},
    blackjack: {bg:"rgba(212,175,55,0.15)", b:"rgba(212,175,55,0.6)", t:"#fbbf24",  icon:"🃏"},
    push:      {bg:"rgba(129,140,248,0.12)",b:"rgba(129,140,248,0.4)",t:"#a5b4fc",  icon:"🤝"},
    lose:      {bg:"rgba(239,68,68,0.12)",  b:"rgba(239,68,68,0.4)",  t:"#f87171",  icon:"💸"},
  };
  const rc = player.result ? RC[player.result] : null;

  const borderColor = rc ? rc.b
    : isCurrentTurn && isMe  ? "#d4af37"
    : isCurrentTurn          ? "#60a5fa"
    : isMe                   ? "rgba(212,175,55,0.35)"
    : "rgba(255,255,255,0.12)";

  const bgColor = rc ? rc.bg
    : isCurrentTurn ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.4)";

  const opacity = isDone && !isCurrentTurn && !rc ? 0.65 : 1;

  return (
    <div style={{
      borderRadius:14,
      padding:"10px 10px 8px",
      border:`1.5px solid ${borderColor}`,
      background: bgColor,
      backdropFilter:"blur(12px)",
      display:"flex",flexDirection:"column",alignItems:"center",gap:6,
      position:"relative",
      transition:"all 0.3s",
      opacity,
      minWidth:120,
      flex:"1 1 0",
      maxWidth:175,
      boxShadow: isCurrentTurn && !rc
        ? `0 0 0 2px ${isMe?"rgba(212,175,55,0.4)":"rgba(96,165,250,0.3)"}, 0 0 20px ${isMe?"rgba(212,175,55,0.2)":"rgba(96,165,250,0.15)"}`
        : rc ? `0 0 16px ${rc.b}40` : "none",
    }}>

      {/* Badge de turno */}
      {isCurrentTurn && !rc && (
        <div style={{
          position:"absolute", top:-11, left:"50%", transform:"translateX(-50%)",
          background: isMe?"#d4af37":"#3b82f6",
          borderRadius:99, padding:"2px 10px",
          fontSize:10, fontWeight:800,
          color: isMe?"#0d0d0d":"white",
          whiteSpace:"nowrap",
          boxShadow:`0 2px 10px ${isMe?"rgba(212,175,55,0.5)":"rgba(59,130,246,0.5)"}`,
          letterSpacing:"0.04em",
        }}>
          {isMe ? "👆 TU TURNO" : "⏳ JUGANDO…"}
        </div>
      )}

      {/* Nombre */}
      <p style={{margin:0, fontWeight:700, fontSize:11, textAlign:"center",
        maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
        color: rc?rc.t : isMe?"#d4af37":"rgba(255,255,255,0.85)"}}>
        {player.username}
        {isMe&&<span style={{fontSize:8,color:"rgba(212,175,55,0.5)",marginLeft:3}}>(tú)</span>}
      </p>

      {/* Score */}
      {player.score > 0 && (
        <div style={{display:"flex",alignItems:"baseline",gap:4}}>
          <span style={{
            fontSize:player.busted?16:22, fontWeight:900, lineHeight:1,
            color: player.busted?"#f87171" : player.score===21?"#fbbf24" : "white",
          }}>
            {player.score}
          </span>
          {player.busted && (
            <span style={{fontSize:9,fontWeight:700,color:"#f87171",
              background:"rgba(239,68,68,0.15)",padding:"1px 5px",borderRadius:4,
              border:"1px solid rgba(239,68,68,0.3)"}}>BUST</span>
          )}
          {player.stand && !player.busted && !rc && (
            <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",
              background:"rgba(255,255,255,0.06)",padding:"1px 5px",borderRadius:4}}>
              PLANTADO
            </span>
          )}
        </div>
      )}

      {/* Cartas */}
      <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center"}}>
        {(player.cards||[]).map((card,i)=>(
          <GameCard key={i} card={card} size="sm"/>
        ))}
        {!(player.cards?.length) && (
          <div style={{width:42,height:60,borderRadius:7,
            border:"2px dashed rgba(255,255,255,0.08)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"rgba(255,255,255,0.12)",fontSize:18}}>+</span>
          </div>
        )}
      </div>

      {/* Resultado */}
      {rc && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <span style={{fontSize:13,lineHeight:1}}>{rc.icon}</span>
          <span style={{fontSize:10,fontWeight:700,color:rc.t}}>
            {player.result==="win"?"Ganaste"
              :player.result==="blackjack"?"Blackjack"
              :player.result==="push"?"Empate"
              :"Perdiste"}
          </span>
          {player.balanceChange!==0&&(
            <span style={{fontSize:10,color:rc.t,opacity:0.8}}>
              {player.balanceChange>0?`+$${player.balanceChange}`:`-$${Math.abs(player.balanceChange)}`}
            </span>
          )}
        </div>
      )}

      {/* Apuesta */}
      <span style={{fontSize:9,color:"rgba(255,255,255,0.25)"}}>
        ${player.bet||0}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   READY TOAST — notificación top-right
══════════════════════════════════════════════════ */
function ReadyToast({count, onStart}) {
  return createPortal(
    <div style={{
      position:"fixed", top:66, right:16, zIndex:9998,
      width:250, borderRadius:16,
      background:"linear-gradient(135deg,#0d2010,#0a1a0d)",
      border:"1px solid rgba(34,197,94,0.4)",
      boxShadow:"0 0 0 1px rgba(34,197,94,0.08), 0 8px 28px rgba(0,0,0,0.6), 0 0 20px rgba(34,197,94,0.12)",
      padding:"14px 14px",
      animation:"slideInRight 0.3s ease-out both",
    }}>
      <style>{`@keyframes slideInRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",
          boxShadow:"0 0 6px #22c55e",animation:"blink 1.4s ease-in-out infinite"}}/>
        <span style={{color:"#4ade80",fontWeight:700,fontSize:13}}>
          {count===1?"¡Estás listo!":"¡Todos listos!"}
        </span>
      </div>
      <p style={{margin:"0 0 10px",color:"rgba(255,255,255,0.3)",fontSize:11,lineHeight:1.4}}>
        {count===1?"Puedes jugar solo.":"Los "+count+" jugadores están listos."}
        {" "}No hace falta llenar la mesa.
      </p>
      <button onClick={onStart}
        style={{width:"100%",padding:"9px 0",borderRadius:10,
          background:"linear-gradient(135deg,#16a34a,#22c55e)",
          color:"white",fontWeight:800,fontSize:12,letterSpacing:"0.07em",
          textTransform:"uppercase",border:"none",cursor:"pointer",
          boxShadow:"0 0 16px rgba(34,197,94,0.3)"}}
        onMouseEnter={e=>{e.currentTarget.style.filter="brightness(1.1)";}}
        onMouseLeave={e=>{e.currentTarget.style.filter="none";}}>
        🃏 Iniciar Partida
      </button>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════
   COUNTDOWN MODAL — overlay completo
══════════════════════════════════════════════════ */
function CountdownModal({table, user, userData, onDeal, onBetChange}) {
  const [secs, setSecs] = useState(5);
  const minBet = table?.minBet || 100;

  const [myBet, setMyBet] = useState(() => {
    const myEntry = Object.values(table?.seats || {}).find(p => p?.uid === user?.uid);
    return myEntry?.bet || minBet;
  });

  // ── useRef para evitar stale closure en el setInterval ──
  // myBetRef.current SIEMPRE tiene el valor más reciente de myBet
  const myBetRef = useRef(myBet);
  const firedRef = useRef(false);

  const addChip = (value) => {
    const newBet = myBet + value;
    myBetRef.current = newBet; // actualizar ref ANTES del setState
    setMyBet(newBet);
    if (onBetChange) onBetChange(newBet);
  };

  const resetBet = () => {
    myBetRef.current = minBet;
    setMyBet(minBet);
    if (onBetChange) onBetChange(minBet);
  };

  useEffect(() => {
    if (!table?.countdownStartedAt) return;
    const iv = setInterval(() => {
      const elapsed   = (Date.now() - table.countdownStartedAt) / 1000;
      const remaining = Math.max(0, 5 - elapsed);
      setSecs(Math.ceil(remaining));
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(iv);
        const seats   = Object.values(table.seats || {}).filter(Boolean);
        const isFirst = table.createdBy === user?.uid || seats[0]?.uid === user?.uid;
        // Usar myBetRef.current → siempre el valor más reciente, sin stale closure
        if (isFirst) onDeal(); // bet ya está en pendingBetRef del contexto
      }
    }, 100);
    return () => clearInterval(iv);
  }, [table?.countdownStartedAt]); // eslint-disable-line

  const seated = Object.values(table?.seats||{}).filter(Boolean);
  const progress = (secs/5)*100;
  const CHIPS=[
    {v:10,bg:"#1d4ed8",b:"#93c5fd",l:"$10"},
    {v:50,bg:"#b91c1c",b:"#fca5a5",l:"$50"},
    {v:100,bg:"#065f46",b:"#6ee7b7",l:"$100"},
    {v:500,bg:"#1c1917",b:"#fbbf24",l:"$500"},
  ];

  return createPortal(
    <div style={{position:"fixed",inset:0,zIndex:9999,
      background:"rgba(0,0,0,0.78)",backdropFilter:"blur(8px)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:400,
        background:"linear-gradient(160deg,#0d1f0d,#111820)",
        border:"1px solid rgba(212,175,55,0.35)",borderRadius:24,
        padding:"28px 24px",textAlign:"center",
        boxShadow:"0 0 60px rgba(0,0,0,0.8),0 0 30px rgba(212,175,55,0.06)"}}>

        {/* Círculo countdown */}
        <div style={{position:"relative",width:100,height:100,margin:"0 auto 20px"}}>
          <svg width="100" height="100" style={{transform:"rotate(-90deg)"}}>
            <circle cx="50" cy="50" r="44" fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
            <circle cx="50" cy="50" r="44" fill="none"
              stroke={secs>2?"#d4af37":"#ef4444"} strokeWidth="6"
              strokeDasharray={`${2*Math.PI*44}`}
              strokeDashoffset={`${2*Math.PI*44*(1-progress/100)}`}
              strokeLinecap="round"
              style={{transition:"stroke-dashoffset 0.1s linear,stroke 0.3s"}}/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",
            flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:34,fontWeight:900,lineHeight:1,
              fontFamily:"Georgia,serif",
              color:secs>2?"#d4af37":"#ef4444",transition:"color 0.3s"}}>
              {secs}
            </span>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:"0.1em"}}>SEG</span>
          </div>
        </div>

        <h2 style={{margin:"0 0 4px",fontSize:18,fontWeight:800,color:"white"}}>
          ¡La partida comienza!
        </h2>
        <p style={{margin:"0 0 18px",color:"rgba(255,255,255,0.3)",fontSize:12}}>
          {seated.length} jugador{seated.length!==1?"es":""} · Apuesta mín. ${table?.minBet}
        </p>

        {/* Chips apuesta */}
        <div style={{background:"rgba(255,255,255,0.04)",
          border:"1px solid rgba(212,175,55,0.18)",
          borderRadius:12,padding:"12px 14px",marginBottom:12}}>
          <p style={{margin:"0 0 8px",fontSize:10,fontWeight:700,
            letterSpacing:"0.12em",textTransform:"uppercase",
            color:"rgba(255,255,255,0.28)"}}>Tu apuesta</p>
          <p style={{margin:"0 0 10px",fontSize:28,fontWeight:900,
            color:"#d4af37",lineHeight:1}}>${myBet.toLocaleString()}</p>
          <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
            {CHIPS.map(c=>(
              <button key={c.v} onClick={()=>addChip(c.v)}
                style={{width:46,height:46,borderRadius:"50%",
                  background:c.bg,border:`3px dashed ${c.b}`,
                  color:c.b,fontWeight:700,fontSize:11,cursor:"pointer",
                  transition:"transform 0.12s"}}
                onMouseEnter={e=>e.currentTarget.style.transform="scale(1.15)"}
                onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                {c.l}
              </button>
            ))}
          </div>
          {myBet>(table?.minBet||0)&&(
            <button onClick={resetBet}
              style={{marginTop:8,padding:"3px 12px",borderRadius:99,
                background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
                color:"rgba(255,255,255,0.35)",fontSize:11,cursor:"pointer"}}>
              Resetear
            </button>
          )}
        </div>
        <p style={{margin:0,color:"rgba(255,255,255,0.18)",fontSize:11}}>
          La apuesta se confirma al iniciar
        </p>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════ */
export default function Table21() {
  const {
    activeTable, user, userData,
    sitOnSeat, leaveSeat, leaveTable, toggleReady,
    startCountdown, dealCards, hit, stand, resetRound, updateSeatBet,
  } = useCasino();

  const seats      = activeTable?.seats      || {};
  const spectators = activeTable?.spectators || [];
  const phase      = activeTable?.phase      || "waiting";

  const myEntry       = Object.entries(seats).find(([_, p]) => p?.uid === user?.uid);
  const mySeatKey     = myEntry?.[0] ?? null;
  const myPlayer      = myEntry?.[1] ?? null;
  const seatedPlayers = Object.values(seats).filter(Boolean);
  const readyCount    = seatedPlayers.filter(p => p.ready).length;
  const allReady      = seatedPlayers.length > 0 && readyCount === seatedPlayers.length;
  const isMyTurn      = activeTable?.currentTurn === mySeatKey;

  const inGame = phase !== "waiting" && phase !== "countdown";

  const phaseLabel = {
    waiting:     "Sala de espera",
    countdown:   "¡Iniciando!",
    playing:     "Partida en curso",
    dealer_turn: "Turno del dealer",
    results:     "Resultados",
  }[phase] || phase;

  /* ────────────────────────────────────────────────
     SLOT DE JUGADOR — en juego (dentro del tapete)
  ──────────────────────────────────────────────── */
  const GameSlot = ({ seatKey, player }) => {
    if (!player) return null; // slot vacío no ocupa espacio

    const isMe   = player.uid === user?.uid;
    const isTurn = activeTable?.currentTurn === seatKey;

    const RESULT_CFG = {
      win:       { border: "rgba(34,197,94,0.7)",   bg: "rgba(34,197,94,0.12)",   text: "#4ade80",  label: "🏆 +$" + player.bet },
      blackjack: { border: "rgba(212,175,55,0.8)",  bg: "rgba(212,175,55,0.14)",  text: "#fbbf24",  label: "🃏 BJ!" },
      push:      { border: "rgba(129,140,248,0.6)", bg: "rgba(129,140,248,0.1)",  text: "#a5b4fc",  label: "🤝 Empate" },
      lose:      { border: "rgba(239,68,68,0.6)",   bg: "rgba(239,68,68,0.1)",    text: "#f87171",  label: "💸 -$" + player.bet },
    };
    const rc = player.result ? RESULT_CFG[player.result] : null;

    return (
      <div style={{
        position: "relative",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 6,
        padding: "10px 10px 8px",
        borderRadius: 14,
        border: `1.5px solid ${rc?.border ?? (isTurn ? (isMe ? "#d4af37" : "#60a5fa") : isMe ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.12)")}`,
        background: rc?.bg ?? (isTurn ? "rgba(255,255,255,0.07)" : isMe ? "rgba(212,175,55,0.06)" : "rgba(0,0,0,0.3)"),
        backdropFilter: "blur(10px)",
        minWidth: 100, maxWidth: 160, flex: "1 1 0",
        boxShadow: isTurn && !rc ? `0 0 22px ${isMe ? "rgba(212,175,55,0.25)" : "rgba(96,165,250,0.2)"}` : "none",
        transition: "all 0.3s",
        opacity: player.busted && !rc ? 0.7 : 1,
      }}>
        {/* Indicador de turno */}
        {isTurn && !rc && (
          <div style={{
            position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
            background: isMe ? "#d4af37" : "#60a5fa",
            borderRadius: 99, padding: "1px 9px",
            fontSize: 9, fontWeight: 800, whiteSpace: "nowrap",
            color: isMe ? "#0d0d0d" : "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}>
            {isMe ? "👆 TU TURNO" : "⏳ ESPERANDO"}
          </div>
        )}

        {/* Nombre */}
        <p style={{ margin: 0, fontWeight: 700, fontSize: 11,
          color: rc?.text ?? (isMe ? "#d4af37" : "rgba(255,255,255,0.85)"),
          maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textAlign: "center", lineHeight: 1.2 }}>
          {player.username}
          {isMe && <span style={{ fontSize: 8, color: "rgba(212,175,55,0.6)", marginLeft: 3 }}>(tú)</span>}
        </p>

        {/* Score + badges */}
        {player.score > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{
              fontSize: 20, fontWeight: 900, lineHeight: 1,
              color: player.busted ? "#f87171" : player.score === 21 ? "#fbbf24" : "white",
            }}>
              {player.score}
            </span>

            {/* Bust badge */}
            {player.busted && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em",
                color: "#f87171", textTransform: "uppercase",
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.35)",
                borderRadius: 99, padding: "1px 7px" }}>
                BUST
              </span>
            )}

            {/* Blackjack natural badge */}
            {player.naturalBJ && !player.result && (
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                background: "linear-gradient(135deg,#d4af37,#f0d060)",
                color: "#0d0d0d", borderRadius: 99, padding: "2px 8px",
                boxShadow: "0 0 10px rgba(212,175,55,0.4)",
                animation: "bj-pulse 1.2s ease-in-out infinite",
              }}>
                🃏 BLACKJACK
              </span>
            )}

            {/* Llegó a 21 (no natural) */}
            {player.reached21 && !player.naturalBJ && !player.result && (
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                background: "rgba(251,191,36,0.15)",
                border: "1px solid rgba(251,191,36,0.4)",
                color: "#fbbf24", borderRadius: 99, padding: "2px 8px",
              }}>
                ¡21!
              </span>
            )}

            {/* Plantado (sin bust ni 21) */}
            {player.stand && !player.busted && !player.reached21 && !player.result && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Plantado
              </span>
            )}
          </div>
        )}

        {/* Cartas */}
        <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}>
          {(player.cards || []).map((card, i) => (
            <GameCard key={i} card={card} small />
          ))}
        </div>

        {/* Resultado */}
        {rc && (
          <span style={{
            padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700,
            background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text,
            whiteSpace: "nowrap",
          }}>
            {rc.label}
          </span>
        )}

        {/* Apuesta */}
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
          ${player.bet}
        </span>
      </div>
    );
  };

  /* ────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        .seats-inside  { display: flex !important; }
        @keyframes bj-pulse {
          0%,100% { box-shadow: 0 0 8px rgba(212,175,55,0.3); }
          50%      { box-shadow: 0 0 18px rgba(212,175,55,0.7); }
        }
        .seats-outside { display: none !important; }
        @media (max-width: 600px) {
          .seats-inside  { display: none !important; }
          .seats-outside { display: grid !important; }
        }
      `}</style>

      {/* Modales con portal */}
      {phase === "countdown" && (
        <CountdownModal table={activeTable} user={user} userData={userData} onDeal={dealCards} onBetChange={updateSeatBet} />
      )}
      {phase === "waiting" && allReady && seatedPlayers.length > 0 && mySeatKey && (
        <ReadyToast count={seatedPlayers.length} onStart={startCountdown} />
      )}

      <div style={{ minHeight: "100vh", background: "#060e07", color: "white",
        display: "flex", flexDirection: "column" }}>

        {/* ══════════ NAVBAR ══════════ */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(6,14,7,0.97)", backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(212,175,55,0.1)",
          padding: "6px clamp(10px,3vw,20px)", flexShrink: 0,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {/* Fila 1: Salir + Título + Balance */}
          <div style={{ display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <button onClick={leaveTable}
                style={{ padding: "5px 10px", borderRadius: 8, flexShrink: 0,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)",
                  color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ← Salir
              </button>
              <span style={{ fontFamily: "Georgia,serif",
                fontSize: "clamp(16px,3vw,22px)", fontWeight: 900,
                color: "#d4af37", letterSpacing: "0.12em" }}>21</span>
            </div>
            <span style={{ fontSize: "clamp(12px,2vw,14px)", fontWeight: 700,
              padding: "4px 10px", borderRadius: 99, flexShrink: 0,
              background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.18)",
              color: "#d4af37", whiteSpace: "nowrap" }}>
              💰 ${(userData?.balance || 0).toLocaleString()}
            </span>
          </div>

          {/* Fila 2: Código + Fase */}
          <div style={{ display: "flex", alignItems: "center", gap: 6,
            overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#d4af37",
              letterSpacing: "0.15em", padding: "3px 8px", borderRadius: 99, flexShrink: 0,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {activeTable?.code}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px",
              borderRadius: 99, flexShrink: 0,
              background: inGame ? "rgba(34,197,94,0.1)" : "rgba(212,175,55,0.08)",
              border: `1px solid ${inGame ? "rgba(34,197,94,0.25)" : "rgba(212,175,55,0.18)"}`,
              color: inGame ? "#4ade80" : "#d4af37", whiteSpace: "nowrap" }}>
              {phaseLabel}
            </span>
          </div>
        </nav>

        {/* ══════════ CONTENIDO ══════════ */}
        <div style={{ flex: 1, padding: "clamp(10px,2vw,18px)",
          maxWidth: 1400, margin: "0 auto", width: "100%",
          display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ══════════════════════════════════════════════
              TAPETE — flex column, TODO dentro del feltro
          ══════════════════════════════════════════════ */}
          <div style={{
            position: "relative",
            borderRadius: "clamp(40px,8vw,90px) clamp(40px,8vw,90px) 24px 24px",
            overflow: "hidden",   /* ← ahora hidden: todo cabe dentro */
            display: "flex",
            flexDirection: "column",
            /* Altura total = dealer + centro + jugadores */
            minHeight: "clamp(440px,58vw,640px)",
            border: "clamp(6px,1vw,11px) solid",
            borderColor: "#8b6914 #c8921a #7a5c10 #c8921a",
            boxShadow: "0 0 0 1px rgba(212,175,55,0.1), 0 8px 60px rgba(0,0,0,0.85)",
          }}>
            {/* Fondo feltro */}
            <div style={{ position: "absolute", inset: 0, zIndex: 0,
              background: "radial-gradient(ellipse at 50% 20%,#2d7545 0%,#1a5232 45%,#0f3520 80%,#081a0f 100%)" }} />
            {/* Textura */}
            <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.055,
              pointerEvents: "none",
              backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)",
              backgroundSize: "20px 20px" }} />
            {/* Borde interior dorado */}
            <div style={{ position: "absolute", zIndex: 0,
              top: "clamp(6px,1%,12px)", left: "clamp(8px,1.5%,18px)",
              right: "clamp(8px,1.5%,18px)", bottom: "clamp(6px,1%,12px)",
              borderRadius: "clamp(36px,7vw,82px) clamp(36px,7vw,82px) 18px 18px",
              border: "1px solid rgba(212,175,55,0.15)", pointerEvents: "none" }} />

            {/* ── ZONA DEALER (arriba) ── */}
            <div style={{ position: "relative", zIndex: 1,
              flex: "0 0 auto", padding: "clamp(12px,2.5vw,24px) 20px 8px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>

              <div style={{ width: "clamp(52px,6.5vw,80px)", height: "clamp(52px,6.5vw,80px)",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)",
                border: "3px solid rgba(212,175,55,0.55)",
                boxShadow: "0 0 28px rgba(212,175,55,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "clamp(24px,4vw,46px)" }}>
                🎩
              </div>

              <p style={{ margin: 0, fontWeight: 800, fontSize: "clamp(12px,1.6vw,16px)",
                color: "#d4af37" }}>Dealer</p>

              {/* Cartas del dealer */}
              <div style={{ display: "flex", gap: 6, minHeight: 70,
                alignItems: "center", justifyContent: "center" }}>
                {inGame && (activeTable?.dealerCards || []).map((card, i) => (
                  <GameCard key={i} card={card}
                    faceDown={i === 1 && activeTable.dealerHidden} />
                ))}
                {!inGame && (
                  <div style={{ width: 58, height: 80, borderRadius: 9,
                    border: "2px dashed rgba(212,175,55,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "rgba(212,175,55,0.2)", fontSize: 22 }}>🂠</span>
                  </div>
                )}
              </div>

              {/* Score dealer visible */}
              {!activeTable?.dealerHidden && (activeTable?.dealerScore > 0) && (
                <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 1,
                  color: activeTable.dealerScore > 21 ? "#f87171"
                    : activeTable.dealerScore === 21 ? "#fbbf24" : "white" }}>
                  {activeTable.dealerScore}
                  {activeTable.dealerScore > 21 && (
                    <span style={{ fontSize: 11, marginLeft: 4 }}>BUST</span>
                  )}
                </span>
              )}
            </div>

            {/* ── ZONA CENTRO (logo / estado) ── */}
            <div style={{ position: "relative", zIndex: 1,
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "0 20px", textAlign: "center",
              pointerEvents: "none", userSelect: "none" }}>

              {!inGame && (
                <>
                  <p style={{ margin: "0 0 2px", fontSize: "clamp(12px,1.6vw,16px)",
                    opacity: 0.15, letterSpacing: "0.25em" }}>♠ ♥ ♦ ♣</p>
                  <p style={{ margin: 0,
                    fontFamily: "Georgia,serif",
                    fontSize: "clamp(42px,8vw,100px)",
                    fontWeight: 900, letterSpacing: "0.08em", lineHeight: 1,
                    background: "linear-gradient(180deg,#d4af37 0%,#f0d060 40%,#a07820 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    backgroundClip: "text" }}>
                    21
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: "clamp(10px,1.3vw,13px)",
                    color: "rgba(134,239,172,0.5)", fontWeight: 500 }}>
                    {seatedPlayers.length === 0 ? "Esperando jugadores…"
                      : allReady ? "¡Todos listos — inicia la partida!"
                      : `${readyCount} de ${seatedPlayers.length} listos`}
                  </p>
                </>
              )}

              {phase === "playing" && (
                <p style={{ margin: 0, fontSize: "clamp(12px,1.5vw,15px)",
                  color: "rgba(255,255,255,0.2)", fontWeight: 500, pointerEvents: "auto" }}>
                  {isMyTurn
                    ? "👆 Es tu turno"
                    : `Turno de ${seats[activeTable?.currentTurn]?.username || "…"}`}
                </p>
              )}

              {phase === "dealer_turn" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 18px", borderRadius: 10,
                  background: "rgba(212,175,55,0.08)",
                  border: "1px solid rgba(212,175,55,0.2)",
                  pointerEvents: "auto" }}>
                  <span style={{ fontSize: 18 }}>🎩</span>
                  <span style={{ color: "#d4af37", fontWeight: 700, fontSize: 14 }}>
                    El dealer está jugando…
                  </span>
                </div>
              )}
            </div>

            {/* ── ZONA JUGADORES (abajo, dentro del tapete) ── */}
            <div style={{ position: "relative", zIndex: 1,
              flex: "0 0 auto",
              padding: "8px clamp(8px,2vw,20px) clamp(12px,2vw,20px)" }}>

              {/* ── Sala de espera: asientos ── */}
              {!inGame && (
                <>
                  {/* Desktop: fila horizontal */}
                  <div className="seats-inside" style={{
                    justifyContent: "space-between", alignItems: "flex-end",
                    gap: "clamp(4px,0.8vw,10px)" }}>
                    {Object.entries(seats).map(([num, player]) => (
                      <div key={num} style={{ flex: "0 1 19%", minWidth: 100, maxWidth: 175 }}>
                        <WaitingSeat num={num} player={player}
                          isMe={player?.uid === user?.uid}
                          hasAnySeat={!!mySeatKey}
                          onSit={sitOnSeat} onLeave={leaveSeat} onToggleReady={toggleReady} />
                      </div>
                    ))}
                  </div>
                  {/* Mobile: grid */}
                  <div className="seats-outside"
                    style={{ gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8 }}>
                    {Object.entries(seats).map(([num, player]) => (
                      <WaitingSeat key={num} num={num} player={player}
                        isMe={player?.uid === user?.uid}
                        hasAnySeat={!!mySeatKey}
                        onSit={sitOnSeat} onLeave={leaveSeat} onToggleReady={toggleReady} />
                    ))}
                  </div>
                </>
              )}

              {/* ── En juego: slots de jugadores ── */}
              {inGame && (
                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "clamp(6px,1vw,12px)",
                  flexWrap: "wrap",
                }}>
                  {Object.entries(seats)
                    .filter(([_, p]) => p !== null)
                    .map(([key, player]) => (
                      <GameSlot key={key} seatKey={key} player={player} />
                    ))}
                </div>
              )}
            </div>
          </div>
          {/* ── FIN TAPETE ── */}

          {/* ══════════ CONTROLES HIT / STAND ══════════ */}
          {phase === "playing" && mySeatKey && (
            <div style={{ display: "flex", flexDirection: "column",
              alignItems: "center", gap: 10 }}>
              {isMyTurn ? (
                <>
                  <p style={{ margin: 0, color: "#d4af37", fontWeight: 700, fontSize: 15 }}>
                    Tu mano: <span style={{ fontSize: 22, fontWeight: 900 }}>{myPlayer?.score}</span>
                    {myPlayer?.score === 21 && <span style={{ color: "#fbbf24", marginLeft: 6 }}>¡21!</span>}
                  </p>
                  <div style={{ display: "flex", gap: 14 }}>
                    <button onClick={hit}
                      style={{ padding: "13px 44px", borderRadius: 12,
                        background: "linear-gradient(135deg,#065f46,#059669)",
                        color: "white", fontWeight: 800, fontSize: 16,
                        border: "none", cursor: "pointer",
                        boxShadow: "0 0 20px rgba(5,150,105,0.35)",
                        transition: "transform 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.06)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                      🃏 Pedir
                    </button>
                    <button onClick={stand}
                      style={{ padding: "13px 44px", borderRadius: 12,
                        background: "linear-gradient(135deg,#7f1d1d,#b91c1c)",
                        color: "white", fontWeight: 800, fontSize: 16,
                        border: "none", cursor: "pointer",
                        boxShadow: "0 0 20px rgba(185,28,28,0.3)",
                        transition: "transform 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.06)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                      ✋ Plantarse
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
                  ⏳ Esperando el turno de{" "}
                  <strong style={{ color: "white" }}>
                    {seats[activeTable?.currentTurn]?.username || "otro jugador"}
                  </strong>…
                </p>
              )}
            </div>
          )}

          {/* ══════════ RESULTADOS ══════════ */}
          {phase === "results" && (
            <div style={{ display: "flex", flexDirection: "column",
              alignItems: "center", gap: 14 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>
                  Mano terminada
                </p>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                  Dealer:{" "}
                  <span style={{
                    fontWeight: 700,
                    color: activeTable?.dealerScore > 21 ? "#f87171"
                      : activeTable?.dealerScore === 21 ? "#fbbf24" : "white" }}>
                    {activeTable?.dealerScore}
                    {activeTable?.dealerScore > 21 ? " — BUST" : ""}
                  </span>
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <button onClick={resetRound}
                  style={{ padding: "12px 40px", borderRadius: 12,
                    background: "linear-gradient(135deg,#d4af37,#f0d060)",
                    color: "#0d0d0d", fontWeight: 800, fontSize: 14,
                    border: "none", cursor: "pointer",
                    transition: "transform 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                  🔄 Nueva Mano
                </button>
                <button onClick={leaveTable}
                  style={{ padding: "12px 24px", borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.45)", fontSize: 14, cursor: "pointer" }}>
                  Salir de mesa
                </button>
              </div>
            </div>
          )}

          {/* ══════════ ESPECTADORES ══════════ */}
          <div style={{ background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 14, padding: "clamp(10px,1.5vw,16px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>
                👁 Espectadores
              </span>
              <span style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)",
                fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 99 }}>
                {spectators.length}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {spectators.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 12, margin: 0 }}>Sin espectadores</p>
              ) : spectators.map(s => (
                <div key={s.uid} style={{ display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 11px", borderRadius: 99,
                  background: s.uid === user?.uid ? "rgba(212,175,55,0.07)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${s.uid === user?.uid ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.06)"}`,
                  fontSize: 12 }}>
                  <span>{s.uid === user?.uid ? "👤" : "👁️"}</span>
                  <span style={{ color: s.uid === user?.uid ? "#d4af37" : "rgba(255,255,255,0.65)" }}>
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
