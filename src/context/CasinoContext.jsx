import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef
} from "react";

import { auth, db } from "../lib/firebase";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";

import { determineViudaWinners, getRoundWildcardRank, isWildcard, evaluateBestHand } from "../utils/viudaEvaluator";


// ═══════════════════════════════════════════════════════
// UTILIDADES DE BARAJA — usadas en las acciones de juego
// ═══════════════════════════════════════════════════════

const _SUITS  = ['♠','♥','♦','♣'];
const _RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

/** Baraja Fisher-Yates de 52 cartas (strings "A♠", "10♥", etc.) */
const createDeck = () => {
  const deck = _SUITS.flatMap(s => _RANKS.map(r => r + s));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

/** Mazo de La Viuda: 52 cartas + 2 jokers (JK1, JK2), barajado */
const createViudaDeck = () => {
  const deck = createDeck();
  deck.push('JK1', 'JK2');
  // Fisher-Yates sobre el nuevo mazo
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

/** Valor blackjack de una carta */
const cardValue = (card) => {
  const rank = card.slice(0, -1);
  if (['J','Q','K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
};

/** Total de la mano — Ases se reducen de 11→1 si hay bust */
const handScore = (cards) => {
  let total = 0, aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.startsWith('A')) aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
};

/** Siguiente asiento activo (no bust, no stand) después de currentKey */
const nextActiveSeat = (seats, currentKey) => {
  const sorted = Object.keys(seats).sort((a, b) => +a - +b);
  const idx = sorted.indexOf(String(currentKey));
  for (let i = idx + 1; i < sorted.length; i++) {
    const p = seats[sorted[i]];
    if (p && !p.stand && !p.busted) return sorted[i];
  }
  return null;
};

const CasinoContext = createContext();
export const useCasino = () => useContext(CasinoContext);

export const CasinoProvider = ({ children }) => {
  const [user,          setUser]          = useState(null);
  const [userData,      setUserData]      = useState(null);
  const [tables,        setTables]        = useState([]);
  const [activeTable,   setActiveTable]   = useState(null);
  const [activeTableId, setActiveTableId] = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [authChecked,   setAuthChecked]   = useState(false);
  const [error,         setError]         = useState(null);

  // Ref que guarda la apuesta confirmada por el jugador en el modal.
  // Al usar useRef en lugar de useState evitamos problemas de stale closure
  // en dealCards (que puede estar capturado en un closure antiguo).
  const pendingBetRef = useRef(null);

  // =====================================================
  // AUTH — restaurar sesión al recargar
  // =====================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setUserData(null);
          setAuthChecked(true);
          return;
        }

        setUser(firebaseUser);

        const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userSnap.exists()) setUserData(userSnap.data());

        setAuthChecked(true);
      } catch (err) {
        console.error("Auth error:", err);
        setAuthChecked(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // =====================================================
  // REALTIME — lista de mesas (solo cuando hay sesión)
  // =====================================================

  useEffect(() => {
    if (!user) { setTables([]); return; }

    const unsubscribe = onSnapshot(
      collection(db, "tables"),
      (snapshot) => {
        setTables(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("Tables listener error:", err)
    );

    return () => unsubscribe();
  }, [user]);

  // =====================================================
  // REALTIME — mesa activa (asientos en tiempo real)
  // Cuando alguien se sienta o se levanta, este listener
  // actualiza activeTable para TODOS los que están en la mesa.
  // =====================================================

  useEffect(() => {
    if (!activeTableId) return;

    const unsubscribe = onSnapshot(
      doc(db, "tables", activeTableId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setActiveTable(null);
          return;
        }
        setActiveTable({ id: snapshot.id, ...snapshot.data() });
      },
      (err) => console.error("Table listener error:", err)
    );

    return () => unsubscribe();
  }, [activeTableId]);

  // =====================================================
  // REGISTER
  // =====================================================

  const register = async (username, password) => {
    try {
      setLoading(true);
      setError(null);

      const email    = `${username.trim().toLowerCase()}@royalcasino.app`;
      const response = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser   = response.user;

      const profile = { uid: fbUser.uid, username: username.trim(), balance: 5000, createdAt: Date.now() };
      await setDoc(doc(db, "users", fbUser.uid), profile);

      setUser(fbUser);
      setUserData(profile);

      return { success: true };
    } catch (err) {
      const msg = getAuthError(err.code);
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // LOGIN
  // =====================================================

  const login = async (username, password) => {
    try {
      setLoading(true);
      setError(null);

      const email    = `${username.trim().toLowerCase()}@royalcasino.app`;
      const response = await signInWithEmailAndPassword(auth, email, password);
      const fbUser   = response.user;

      const userSnap = await getDoc(doc(db, "users", fbUser.uid));
      if (userSnap.exists()) setUserData(userSnap.data());

      return { success: true };
    } catch (err) {
      const msg = getAuthError(err.code);
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
      setActiveTable(null);
      setActiveTableId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // =====================================================
  // CREATE TABLE
  // =====================================================

  const createTable = async ({ game, minBet }) => {
    try {
      setLoading(true);
      setError(null);
      if (!user) throw new Error("Usuario no autenticado");

      const code = generateTableCode();

      const tableData = {
        code,
        game,
        minBet,
        phase:       "waiting",
        createdAt:   Date.now(),
        createdBy:   user.uid,
        dealerCards: [],
        dealerScore: 0,
        currentTurn: null,
        maxPlayers:  5,
        // Seats: objeto con 5 slots, todos vacíos
        seats: { 1: null, 2: null, 3: null, 4: null, 5: null },
        // El creador entra como espectador hasta que se siente
        spectators: [{ uid: user.uid, username: userData?.username || "Jugador" }]
      };

      const ref      = await addDoc(collection(db, "tables"), tableData);
      const newTable = { id: ref.id, ...tableData };

      // Activar listener en esta mesa
      setActiveTableId(ref.id);
      setActiveTable(newTable);

      return { success: true, table: newTable };
    } catch (err) {
      console.error(err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // JOIN TABLE — busca por código, agrega al usuario
  //              como espectador y activa el listener RT
  // =====================================================

  const joinTable = async (code) => {
    try {
      setLoading(true);
      setError(null);
      if (!user) throw new Error("Usuario no autenticado");

      // Buscar la mesa por código
      const q        = query(collection(db, "tables"), where("code", "==", code.toUpperCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("Mesa no encontrada. Verifica el código.");
        return { success: false };
      }

      const tableDoc  = snapshot.docs[0];
      const tableData = tableDoc.data();
      const tableId   = tableDoc.id;

      // Verificar si el usuario ya está sentado o es espectador
      const yaEsEspectador = (tableData.spectators || []).some(s => s.uid === user.uid);
      const yaEstaSentado  = Object.values(tableData.seats || {}).some(s => s?.uid === user.uid);

      // Si no está en ninguna lista, agregarlo como espectador
      if (!yaEsEspectador && !yaEstaSentado) {
        await updateDoc(doc(db, "tables", tableId), {
          spectators: arrayUnion({ uid: user.uid, username: userData?.username || "Jugador" })
        });
      }

      // Activar listener en tiempo real para esta mesa
      setActiveTableId(tableId);

      return { success: true };
    } catch (err) {
      console.error(err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // LEAVE TABLE — limpia el listener y quita al usuario
  // =====================================================

  const leaveTable = async () => {
    try {
      if (!activeTable || !user) return;

      const tableRef = doc(db, "tables", activeTable.id);

      // ── Calcular el estado resultante sin este usuario ──
      // Quitar de asientos
      const updatedSeats = { ...activeTable.seats };
      Object.keys(updatedSeats).forEach(key => {
        if (updatedSeats[key]?.uid === user.uid) updatedSeats[key] = null;
      });

      // Quitar de espectadores
      const updatedSpectators = (activeTable.spectators || [])
        .filter(s => s.uid !== user.uid);

      // ── ¿La mesa queda vacía? → eliminarla ──
      const quedanJugadores   = Object.values(updatedSeats).some(Boolean);
      const quedanEspectadores = updatedSpectators.length > 0;

      if (!quedanJugadores && !quedanEspectadores) {
        // Nadie más queda: borrar la mesa completa
        await deleteDoc(tableRef);
      } else {
        // Todavía hay gente: solo actualizar
        await updateDoc(tableRef, {
          seats:      updatedSeats,
          spectators: updatedSpectators,
        });
      }
    } catch (err) {
      console.error("leaveTable error:", err);
    } finally {
      setActiveTable(null);
      setActiveTableId(null);
    }
  };

  // =====================================================
  // SIT ON SEAT
  // =====================================================

  const sitOnSeat = async (seatNumber) => {
    try {
      if (!activeTable || !user) return;

      const tableRef = doc(db, "tables", activeTable.id);

      // Evitar sentarse doble
      const yaEstaSentado = Object.values(activeTable.seats || {}).some(
        s => s?.uid === user.uid
      );
      if (yaEstaSentado) throw new Error("Ya estás sentado en esta mesa");

      // Verificar que el asiento esté libre
      if (activeTable.seats[seatNumber]) throw new Error("Ese asiento está ocupado");

      const playerData = {
        uid:      user.uid,
        username: userData?.username || "Jugador",
        ready:    false,
        cards:    [],
        score:    0,
        stand:    false,
        busted:   false,
        finished: false,
        bet:      0
      };

      // Quitar de espectadores y ocupar el asiento
      const spectatorEntry = (activeTable.spectators || []).find(s => s.uid === user.uid);

      const updates = {
        [`seats.${seatNumber}`]: playerData   // actualización parcial del mapa
      };
      if (spectatorEntry) {
        updates.spectators = arrayRemove(spectatorEntry);
      }

      await updateDoc(tableRef, updates);

    } catch (err) {
      console.error("sitOnSeat error:", err);
      setError(err.message);
    }
  };

  // =====================================================
  // LEAVE SEAT — FIX: el bug era que usaba `seatNumber`
  //              antes de encontrarlo en el forEach
  // =====================================================

  const leaveSeat = async () => {
    try {
      if (!activeTable || !user) return;

      const tableRef    = doc(db, "tables", activeTable.id);
      const updatedSeats = { ...activeTable.seats };

      // Encontrar en qué asiento está el jugador
      let seatKey      = null;
      let removedPlayer = null;

      Object.keys(updatedSeats).forEach((key) => {
        if (updatedSeats[key]?.uid === user.uid) {
          seatKey       = key;
          removedPlayer = updatedSeats[key];
        }
      });

      if (!seatKey) return; // No estaba sentado

      // Vaciar el asiento
      updatedSeats[seatKey] = null;

      // Volver a la lista de espectadores
      const spectatorEntry = { uid: user.uid, username: removedPlayer.username };

      await updateDoc(tableRef, {
        seats:      updatedSeats,
        spectators: arrayUnion(spectatorEntry)
      });

    } catch (err) {
      console.error("leaveSeat error:", err);
      setError(err.message);
    }
  };

  // =====================================================
  // TOGGLE READY
  // =====================================================

  const toggleReady = async () => {
    try {
      if (!activeTable || !user) return;

      const tableRef = doc(db, "tables", activeTable.id);

      // Encontrar el asiento del jugador
      const entry = Object.entries(activeTable.seats || {}).find(
        ([_, p]) => p?.uid === user.uid
      );
      if (!entry) return;

      const [seatKey, player] = entry;

      await updateDoc(tableRef, {
        [`seats.${seatKey}.ready`]: !player.ready
      });

    } catch (err) {
      console.error("toggleReady error:", err);
      setError(err.message);
    }
  };

  // =====================================================
  // START GAME — inicia cuando todos los sentados están listos.
  // No requiere mesa llena: 1, 2 o 3 jugadores basta.
  // =====================================================

  const startGame = async () => {
    try {
      if (!activeTable || !user) return;

      const seatedPlayers = Object.values(activeTable.seats || {}).filter(Boolean);

      if (seatedPlayers.length === 0) {
        setError("Necesitas sentarte antes de iniciar.");
        return;
      }

      // Todos los sentados deben haber dado Listo
      if (!seatedPlayers.every(p => p.ready)) {
        setError("Todos los jugadores sentados deben dar ¡Listo!");
        return;
      }

      await updateDoc(doc(db, "tables", activeTable.id), { phase: "playing" });
    } catch (err) {
      console.error("startGame error:", err);
      setError(err.message);
    }
  };


  // =====================================================
  // START COUNTDOWN — muestra modal con timer de 5s
  // =====================================================

  const startCountdown = async () => {
    try {
      if (!activeTable || !user) return;

      const seatedPlayers = Object.values(activeTable.seats || {}).filter(Boolean);
      if (seatedPlayers.length === 0) { setError("Necesitas sentarte primero."); return; }
      if (!seatedPlayers.every(p => p.ready)) { setError("Todos los sentados deben dar ¡Listo!"); return; }

      await updateDoc(doc(db, "tables", activeTable.id), {
        phase: "countdown",
        countdownStartedAt: Date.now(),
      });
    } catch (err) {
      console.error("startCountdown:", err);
      setError(err.message);
    }
  };

  // =====================================================
  // UPDATE SEAT BET — cada jugador actualiza su apuesta
  // durante el countdown antes de que se repartan las cartas
  // =====================================================

  const updateSeatBet = async (bet) => {
    // Guardar en ref inmediatamente — accesible por dealCards sin stale closure
    pendingBetRef.current = bet;
    try {
      if (!activeTable || !user) return;
      const entry = Object.entries(activeTable.seats || {})
        .find(([_, p]) => p?.uid === user.uid);
      if (!entry) return;
      const [seatKey] = entry;
      await updateDoc(doc(db, "tables", activeTable.id), {
        [`seats.${seatKey}.bet`]: bet,
      });
    } catch (err) {
      console.error("updateSeatBet:", err);
    }
  };

  // =====================================================
  // DEAL CARDS — reparte al inicio (llama el creador)
  // =====================================================

  const dealCards = async () => {
    try {
      if (!activeTable) return;

      const tableRef = doc(db, "tables", activeTable.id);

      // ── Leer datos FRESCOS de Firestore para evitar race condition:
      //    el bet que el usuario eligió en el modal pudo no haberse
      //    propagado aún al estado local de React via onSnapshot.
      const freshSnap = await getDoc(tableRef);
      if (!freshSnap.exists()) return;
      const freshData = freshSnap.data();

      const deck  = createDeck();
      const seats = { ...freshData.seats };

      // Repartir 2 cartas a cada jugador sentado
      const sortedKeys = Object.keys(seats).sort((a, b) => +a - +b);
      sortedKeys.forEach(key => {
        if (!seats[key]) return;
        const cards = [deck.pop(), deck.pop()];
        const score = handScore(cards);
        // Blackjack natural en el reparto inicial → se planta automático
        const naturalBJ = score === 21;
        seats[key] = {
          ...seats[key],
          cards,
          score,
          // Prioridad de apuesta:
          // 1. pendingBetRef (valor del modal, sin stale closure)
          // 2. valor en Firestore (jugadores que no son el creador)
          // 3. apuesta mínima de la mesa
          bet: (pendingBetRef.current !== null && seats[key].uid === user?.uid)
            ? pendingBetRef.current
            : (seats[key].bet || freshData.minBet || activeTable.minBet),
          stand:         naturalBJ, // si tiene 21, ya está plantado
          busted:        false,
          reached21:     naturalBJ,
          naturalBJ,
          result:        null,
          betDeducted:   false,
          balancePaid:   false,
        };
      });

      // 2 cartas al dealer
      const dealerCards = [deck.pop(), deck.pop()];

      // Primer turno = primer jugador que NO tiene blackjack natural
      const firstSeat = sortedKeys.find(k => seats[k] !== null && !seats[k].stand) || null;

      // Si todos tienen BJ natural, pasar directo al turno del dealer
      const initialPhase = firstSeat ? "playing" : "dealer_turn";

      await updateDoc(tableRef, {
        phase:       initialPhase,
        deck,
        dealerCards,
        dealerHidden: true,
        currentTurn:  firstSeat,
        seats,
      });

      // Limpiar ref después de repartir
      pendingBetRef.current = null;
    } catch (err) {
      console.error("dealCards:", err);
      setError(err.message);
    }
  };

  // =====================================================
  // HIT — el jugador pide carta
  // =====================================================

  const hit = async () => {
    try {
      if (!activeTable || !user) return;

      const entry = Object.entries(activeTable.seats || {})
        .find(([_, p]) => p?.uid === user.uid);
      if (!entry) return;
      const [seatKey, player] = entry;

      // Solo actuar en el propio turno
      if (activeTable.currentTurn !== seatKey) return;

      const deck     = [...activeTable.deck];
      const newCard  = deck.pop();
      const newCards = [...player.cards, newCard];
      const newScore = handScore(newCards);
      const busted   = newScore > 21;

      const updatedSeats = { ...activeTable.seats };
      // Auto-stand en bust Y en 21 exacto
      const autoStand  = busted || newScore === 21;
      const reached21  = newScore === 21 && !busted;
      updatedSeats[seatKey] = {
        ...player, cards: newCards, score: newScore,
        busted, stand: autoStand, reached21: reached21 || false,
      };

      const updates = { deck, seats: updatedSeats };

      if (autoStand) {
        // Buscar siguiente jugador activo (no bust, no stand)
        const next = nextActiveSeat(updatedSeats, seatKey);
        updates.currentTurn = next;
        if (!next) updates.phase = "dealer_turn";
      }

      await updateDoc(doc(db, "tables", activeTable.id), updates);
    } catch (err) {
      console.error("hit:", err);
    }
  };

  // =====================================================
  // STAND — el jugador se planta
  // =====================================================

  const stand = async () => {
    try {
      if (!activeTable || !user) return;

      const entry = Object.entries(activeTable.seats || {})
        .find(([_, p]) => p?.uid === user.uid);
      if (!entry) return;
      const [seatKey, player] = entry;

      if (activeTable.currentTurn !== seatKey) return;

      const updatedSeats = { ...activeTable.seats };
      updatedSeats[seatKey] = { ...player, stand: true };

      const next = nextActiveSeat(updatedSeats, seatKey);

      await updateDoc(doc(db, "tables", activeTable.id), {
        seats:       updatedSeats,
        currentTurn: next,
        phase:       next ? "playing" : "dealer_turn",
      });
    } catch (err) {
      console.error("stand:", err);
    }
  };

  // =====================================================
  // RESET ROUND — vuelve a "waiting" para otra mano
  // =====================================================

  const resetRound = async () => {
    try {
      if (!activeTable) return;

      const seats = { ...activeTable.seats };
      // Mantener jugadores pero limpiar estado de mano
      Object.keys(seats).forEach(key => {
        if (!seats[key]) return;
        seats[key] = {
          uid:      seats[key].uid,
          username: seats[key].username,
          ready:    false,
          cards:    [],
          score:    0,
          bet:      0,
          stand:    false,
          busted:   false,
          result:   null,
          betDeducted:  false,
          balancePaid:  false,
        };
      });

      await updateDoc(doc(db, "tables", activeTable.id), {
        phase:        "waiting",
        deck:         [],
        dealerCards:  [],
        dealerHidden: true,
        currentTurn:  null,
        seats,
      });
    } catch (err) {
      console.error("resetRound:", err);
    }
  };

  // =====================================================
  // DEALER TURN — corre en el cliente del creador
  // =====================================================

  useEffect(() => {
    if (activeTable?.phase !== "dealer_turn") return;
    if (!user) return;

    // El creador es responsable de correr la lógica del dealer
    const seatedPlayers = Object.values(activeTable.seats || {}).filter(Boolean);
    const isResponsible =
      activeTable.createdBy === user.uid ||
      seatedPlayers[0]?.uid === user.uid;

    if (!isResponsible) return;

    const timer = setTimeout(async () => {
      try {
        let dealerCards = [...activeTable.dealerCards];
        let deck        = [...(activeTable.deck || [])];

        // Dealer saca hasta 17+
        while (handScore(dealerCards) < 17 && deck.length > 0) {
          dealerCards.push(deck.pop());
        }

        const dScore       = handScore(dealerCards);
        const updatedSeats = { ...activeTable.seats };

        // Comparar cada jugador con el dealer
        Object.keys(updatedSeats).forEach(key => {
          const p = updatedSeats[key];
          if (!p) return;

          let result, balanceChange;

          if (p.busted) {
            result = "lose"; balanceChange = -p.bet;
          } else if (dScore > 21 || p.score > dScore) {
            // Blackjack natural (21 en 2 cartas, dealer no tiene BJ)
            const dealerBJ = dScore === 21 && dealerCards.length === 2;
            if (p.score === 21 && p.cards.length === 2 && !dealerBJ) {
              result = "blackjack"; balanceChange = Math.floor(p.bet * 1.5);
            } else {
              result = "win"; balanceChange = p.bet;
            }
          } else if (p.score === dScore) {
            result = "push"; balanceChange = 0;
          } else {
            result = "lose"; balanceChange = -p.bet;
          }

          updatedSeats[key] = { ...p, result, balanceChange };
        });

        await updateDoc(doc(db, "tables", activeTable.id), {
          phase:        "results",
          dealerCards,
          dealerScore:  dScore,
          dealerHidden: false,
          deck,
          seats:        updatedSeats,
        });
      } catch (err) {
        console.error("Dealer turn error:", err);
      }
    }, 1800); // pequeña pausa antes del dealer

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable?.phase]);

  // =====================================================
  // BALANCE — cada jugador actualiza el suyo propio
  // al entrar en "playing" (descuento) y "results" (pago)
  // =====================================================

  useEffect(() => {
    if (!activeTable || !user || !userData) return;

    const phase = activeTable.phase;
    if (phase !== "playing" && phase !== "dealer_turn" && phase !== "results") return;

    const entry = Object.entries(activeTable.seats || {})
      .find(([_, p]) => p?.uid === user.uid);
    if (!entry) return;
    const [seatKey, player] = entry;
    if (!player) return;

    // ── DESCONTAR APUESTA ──
    // Se descuenta cuando empieza el juego (playing o dealer_turn si todos
    // tuvieron BJ natural y se saltó la fase playing)
    const isGamePhase = phase === "playing" || phase === "dealer_turn";
    if (isGamePhase && player.bet && !player.betDeducted) {
      const newBal = Math.max(0, userData.balance - player.bet);
      updateBalance(newBal);
      updateDoc(doc(db, "tables", activeTable.id), {
        [`seats.${seatKey}.betDeducted`]: true,
      });
      return; // evitar doble escritura en el mismo tick
    }

    // ── PAGAR RESULTADO ──
    if (phase === "results" && player.result && !player.balancePaid) {
      let payout = 0;
      if (player.result === "win")            payout = player.bet * 2;
      else if (player.result === "push")      payout = player.bet;
      else if (player.result === "blackjack") payout = Math.floor(player.bet * 2.5);
      // lose → payout = 0 (ya se descontó)

      if (payout > 0) updateBalance(userData.balance + payout);

      updateDoc(doc(db, "tables", activeTable.id), {
        [`seats.${seatKey}.balancePaid`]: true,
      });
    }
  // Disparar cuando cambia la fase O cuando betDeducted/result cambian
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable?.phase,
      // Key del jugador actual para detectar cambios en su slot
      JSON.stringify(Object.values(activeTable?.seats || {}).find(p => p?.uid === user?.uid))
  ]);


  // =====================================================
  // DEAL VIUDA CARDS
  // Reparte 5 cartas a cada jugador y 5 al centro boca abajo.
  // =====================================================

  const dealViudaCards = async () => {
    try {
      if (!activeTable) return;
      const tableRef  = doc(db, "tables", activeTable.id);
      const freshSnap = await getDoc(tableRef);
      if (!freshSnap.exists()) return;
      const freshData = freshSnap.data();

      // Mazo con jokers
      const deck  = createViudaDeck();
      let seats   = { ...freshData.seats };
      const allKeys = Object.keys(seats).sort((a, b) => +a - +b);

      // ── Si solo hay 1 jugador, agregar bot ──
      const humanSeats = allKeys.filter(k => seats[k] !== null);
      if (humanSeats.length === 1) {
        // Buscar primer slot vacío
        const emptySlot = allKeys.find(k => seats[k] === null);
        if (emptySlot) {
          seats[emptySlot] = {
            uid:         'bot_' + emptySlot,
            username:    '🤖 Bot',
            isBot:       true,
            ready:       true,
            cards:       [],
            bet:         freshData.minBet || 100,
            result:      null,
            payout:      0,
            betDeducted: false,
            balancePaid: false,
          };
        }
      }

      allKeys.forEach(key => {
        if (!seats[key]) return;
        const bet = (pendingBetRef.current !== null && seats[key].uid === user?.uid)
          ? pendingBetRef.current
          : seats[key].bet || freshData.minBet || activeTable.minBet;
        seats[key] = {
          ...seats[key],
          cards:       [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()],
          bet,
          result:      null,
          payout:      0,
          betDeducted: false,
          balancePaid: false,
        };
      });

      // 5 cartas en el centro, todas boca abajo
      const centerCards = Array.from({ length: 5 }, () => ({
        card: deck.pop(), revealed: false,
      }));

      const firstSeat = sorted.find(k => seats[k] !== null) || null;
      pendingBetRef.current = null;

      // handNumber: contador de manos jugadas en esta mesa
      const handNumber = (freshData.handNumber || 0) + 1;
      // Comodín de la partida: aleatorio entre A,2..K (excluyendo jokers)
      const RANKS_POOL  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
      const wildcardRank = RANKS_POOL[Math.floor(Math.random() * RANKS_POOL.length)];

      await updateDoc(tableRef, {
        phase:              "playing",
        round:              1,
        handNumber,
        wildcardRank,        // guardado en Firestore para que todos lo vean igual
        round1Phase:        "choose_all",
        currentTurn:        firstSeat,
        actedThisRound:     [],
        touchedBy:          null,
        finalTurnRemaining: [],
        round1Swapped:      false,
        centerCards,
        deck,
        seats,
      });
    } catch (err) {
      console.error("dealViudaCards:", err);
      setError(err.message);
    }
  };

  // =====================================================
  // HELPERS
  // =====================================================

  const _viudaNextTurn = async (seats, centerCards, seatKey, extraUpdates = {}) => {
    const tableRef  = doc(db, "tables", activeTable.id);
    const phase     = activeTable.phase;

    // Usar playOrder (aleatorio) si existe, si no generar orden numérico
    const playOrder = activeTable.playOrder ||
      Object.keys(seats).filter(k => seats[k]).sort((a, b) => +a - +b);

    // Solo los jugadores activos (sentados) en el orden de juego
    const order = playOrder.filter(k => seats[k]);

    // ── Fase final_round ──
    if (phase === "final_round") {
      const remaining = [...(activeTable.finalTurnRemaining || [])];
      if (remaining.length === 0) {
        await updateDoc(tableRef, { seats, centerCards, ...extraUpdates });
        await _viudaResolve(seats);
      } else {
        await updateDoc(tableRef, {
          seats, centerCards,
          currentTurn:        remaining[0],
          finalTurnRemaining: remaining.slice(1),
          ...extraUpdates,
        });
      }
      return;
    }

    const acted    = [...(activeTable.actedThisRound || []), seatKey];
    const allActed = order.every(k => acted.includes(k));

    // ── Ronda 0 — fase "choose_all": oferta de cartas boca abajo ──
    if (activeTable.round === 1 && activeTable.round1Phase === "choose_all") {
      const justSwapped = extraUpdates.round1Swapped === true;

      // ¿Todos en la oferta han actuado (aceptado o rechazado)?
      const offerOrder    = playOrder.filter(k => seats[k]);
      const allOffered    = offerOrder.every(k => acted.includes(k));
      const anyoneSwapped = activeTable.round1Swapped || justSwapped;

      if (anyoneSwapped) {
        // Alguien aceptó → ronda 1 empieza desde round1StartSeat (playOrder[1])
        const round1Start = activeTable.round1StartSeat || order[1] || order[0];
        await updateDoc(tableRef, {
          seats, centerCards,
          round:             1,
          round1Phase:       "individual",
          currentTurn:       round1Start,
          actedThisRound:    [],
          swapperSeat:       seatKey,
          ...extraUpdates,
        });
      } else if (allOffered) {
        // Nadie aceptó → firstOfferedSeat (playOrder[0]) recibe las cartas automáticamente
        const firstSeat   = activeTable.firstOfferedSeat || order[0];
        const firstPlayer = seats[firstSeat];
        const newCenter   = firstPlayer.cards.map(card => ({ card, revealed: true }));
        seats[firstSeat]  = { ...firstPlayer, cards: centerCards.map(cc => cc.card) };

        const round1Start = activeTable.round1StartSeat || order[1] || order[0];
        await updateDoc(tableRef, {
          seats,
          centerCards:    newCenter,
          round:          1,
          round1Phase:    "individual",
          currentTurn:    round1Start,
          actedThisRound: [],
          ...extraUpdates,
        });
      } else {
        // Siguiente jugador en la oferta
        const idx  = offerOrder.indexOf(seatKey);
        const next = offerOrder[idx + 1]; // si no hay siguiente, allOffered sería true
        await updateDoc(tableRef, {
          seats, centerCards,
          currentTurn:    next,
          actedThisRound: acted,
          ...extraUpdates,
        });
      }
      return;
    }

    // ── Rondas individuales (ronda 1 tras aceptación + rondas 2, 3…) ──

    // Detectar si firstOfferedSeat acaba de actuar (habilita canTouch)
    const firstOfferedSeat    = activeTable.firstOfferedSeat || order[0];
    const justActedFirstOffer = seatKey === firstOfferedSeat;
    const newFirstOfferedActed = activeTable.firstOfferedActed || justActedFirstOffer;

    if (allActed) {
      // Todos actuaron → nueva ronda, empieza desde round1StartSeat si es ronda 1
      // o desde el inicio del orden en rondas posteriores
      const nextRound   = (activeTable.round || 1) + 1;
      const nextStarter = nextRound === 2
        ? (activeTable.round1StartSeat || order[0])
        : order[0];

      await updateDoc(tableRef, {
        seats, centerCards,
        round:             nextRound,
        currentTurn:       nextStarter,
        actedThisRound:    [],
        firstOfferedActed: newFirstOfferedActed,
        ...extraUpdates,
      });
    } else {
      const idx  = order.indexOf(seatKey);
      const next = sorted[idx + 1] || sorted[0];
      await updateDoc(tableRef, {
        seats, centerCards,
        currentTurn:    next,
        actedThisRound: acted,
        ...extraUpdates,
      });
    }
  };

  const _viudaResolve = async (seats) => {
    const tableRef   = doc(db, "tables", activeTable.id);
    const round      = activeTable?.handNumber || 1;
    const players    = Object.entries(seats)
      .filter(([_, p]) => p !== null)
      .map(([key, p]) => ({ seatKey: key, cards: p.cards }));
    const winnerKeys = determineViudaWinners(players, round);
    const totalPot   = players.reduce((sum, p) => sum + (seats[p.seatKey].bet || 0), 0);
    const payout     = winnerKeys.length ? Math.floor(totalPot / winnerKeys.length) : 0;

    const updatedSeats = { ...seats };
    Object.keys(updatedSeats).forEach(key => {
      if (!updatedSeats[key]) return;
      updatedSeats[key] = {
        ...updatedSeats[key],
        result: winnerKeys.includes(key) ? "win" : "lose",
        payout: winnerKeys.includes(key) ? payout : 0,
      };
    });
    await updateDoc(tableRef, { phase: "results", seats: updatedSeats });
  };

  // =====================================================
  // VIUDA: CAMBIAR UNA CARTA (solo rondas 2+)
  // =====================================================

  const viudaSwapCard = async (myCardIdx, centerCardIdx) => {
    try {
      if (!activeTable || !user) return;
      // Solo disponible cuando ya hay cartas reveladas (individual)
      if (activeTable.round1Phase === "choose_all") return;

      const entry = Object.entries(activeTable.seats || {})
        .find(([_, p]) => p?.uid === user.uid);
      if (!entry) return;
      const [seatKey, player] = entry;
      if (activeTable.currentTurn !== seatKey) return;

      const seats       = { ...activeTable.seats };
      const centerCards = activeTable.centerCards.map(c => ({ ...c }));
      const myCard      = player.cards[myCardIdx];
      const newCards    = [...player.cards];
      newCards[myCardIdx] = centerCards[centerCardIdx].card;
      centerCards[centerCardIdx] = { card: myCard, revealed: true };
      seats[seatKey] = { ...player, cards: newCards };

      await _viudaNextTurn(seats, centerCards, seatKey);
    } catch (err) {
      console.error("viudaSwapCard:", err);
    }
  };

  // =====================================================
  // VIUDA: CAMBIAR TODA LA MANO
  // En ronda 1: el jugador toma las 5 del centro (boca abajo).
  // En rondas 2+: las 5 del jugador van al centro reveladas.
  // =====================================================

  const viudaSwapAll = async () => {
    try {
      if (!activeTable || !user) return;
      const entry = Object.entries(activeTable.seats || {})
        .find(([_, p]) => p?.uid === user.uid);
      if (!entry) return;
      const [seatKey, player] = entry;
      if (activeTable.currentTurn !== seatKey) return;

      const seats      = { ...activeTable.seats };
      const oldCenter  = activeTable.centerCards.map(c => ({ ...c }));
      // Las cartas descartadas del jugador van al centro reveladas
      const newCenter  = player.cards.map(card => ({ card, revealed: true }));
      const newMyCards = oldCenter.map(cc => cc.card);
      seats[seatKey]   = { ...player, cards: newMyCards };

      await _viudaNextTurn(seats, newCenter, seatKey, {
        round1Swapped: true,
      });
    } catch (err) {
      console.error("viudaSwapAll:", err);
    }
  };

  // =====================================================
  // VIUDA: NO CAMBIAR (ronda 1 únicamente)
  // El jugador decide no tomar las cartas del centro.
  // =====================================================

  const viudaSkipAll = async () => {
    try {
      if (!activeTable || !user) return;
      if (activeTable.round1Phase !== "choose_all") return;
      const entry = Object.entries(activeTable.seats || {})
        .find(([_, p]) => p?.uid === user.uid);
      if (!entry) return;
      const [seatKey] = entry;
      if (activeTable.currentTurn !== seatKey) return;

      await _viudaNextTurn(activeTable.seats, activeTable.centerCards, seatKey);
    } catch (err) {
      console.error("viudaSkipAll:", err);
    }
  };

  // =====================================================
  // VIUDA: PASAR — SOLO durante final_round
  // =====================================================

  const viudaPass = async () => {
    try {
      if (!activeTable || !user) return;
      // Pasar solo está disponible en la última ronda (tras un toque)
      if (activeTable.phase !== "final_round") return;
      const entry = Object.entries(activeTable.seats || {})
        .find(([_, p]) => p?.uid === user.uid);
      if (!entry) return;
      const [seatKey] = entry;
      if (activeTable.currentTurn !== seatKey) return;

      await _viudaNextTurn(activeTable.seats, activeTable.centerCards, seatKey);
    } catch (err) {
      console.error("viudaPass:", err);
    }
  };

  // =====================================================
  // VIUDA: TOCAR LA MESA — solo desde ronda 2
  // =====================================================

  const viudaTouch = async () => {
    try {
      if (!activeTable || !user) return;
      if (activeTable.round < 2) return;
      const entry = Object.entries(activeTable.seats || {})
        .find(([_, p]) => p?.uid === user.uid);
      if (!entry) return;
      const [seatKey] = entry;
      if (activeTable.currentTurn !== seatKey) return;

      const playOrder   = activeTable.playOrder ||
        Object.keys(activeTable.seats).filter(k => activeTable.seats[k]).sort((a,b) => +a - +b);
      const order       = playOrder.filter(k => activeTable.seats[k]);
      const toucherIdx  = order.indexOf(seatKey);
      const finalTurnRemaining = [
        ...order.slice(toucherIdx + 1),
        ...order.slice(0, toucherIdx),
      ];

      if (finalTurnRemaining.length === 0) {
        await _viudaResolve(activeTable.seats);
      } else {
        await updateDoc(doc(db, "tables", activeTable.id), {
          phase:              "final_round",
          touchedBy:          seatKey,
          currentTurn:        finalTurnRemaining[0],
          finalTurnRemaining: finalTurnRemaining.slice(1),
          actedThisRound:     [...(activeTable.actedThisRound || []), seatKey],
        });
      }
    } catch (err) {
      console.error("viudaTouch:", err);
    }
  };

  // =====================================================
  // VIUDA: NUEVA MANO
  // =====================================================

  const resetViudaRound = async () => {
    try {
      if (!activeTable) return;
      const seats = { ...activeTable.seats };

      Object.keys(seats).forEach(key => {
        const p = seats[key];
        if (!p) return;

        if (p.isBot) {
          // Eliminar bot — solo existe durante la partida
          seats[key] = null;
        } else {
          // Resetear estado del jugador humano
          seats[key] = {
            uid: p.uid, username: p.username,
            ready: false, cards: [], bet: 0,
            result: null, payout: 0, betDeducted: false, balancePaid: false,
          };
        }
      });

      await updateDoc(doc(db, "tables", activeTable.id), {
        phase: "waiting", round: 0, round1Phase: null, currentTurn: null,
        actedThisRound: [], touchedBy: null, round1Swapped: false,
        finalTurnRemaining: [], centerCards: [], deck: [],
        wildcardRank: null, playOrder: [], firstOfferedSeat: null,
        round1StartSeat: null, firstOfferedActed: false, swapperSeat: null,
        seats,
      });
    } catch (err) {
      console.error("resetViudaRound:", err);
    }
  };


  // =====================================================
  // BOT TURN — La Viuda
  // Cuando el turno es de un bot, ejecuta automáticamente
  // la mejor acción con un delay de 1.5s para realismo.
  // =====================================================

  useEffect(() => {
    if (!activeTable || !user) return;
    if (activeTable.game !== "viuda") return;

    const phase = activeTable.phase;
    if (!["playing", "final_round"].includes(phase)) return;

    const currentSeatKey = activeTable.currentTurn;
    if (!currentSeatKey) return;

    const currentPlayer = activeTable.seats?.[currentSeatKey];
    if (!currentPlayer?.isBot) return;

    // Calcular turno del bot con delay
    const timer = setTimeout(async () => {
      try {
        const round       = activeTable.round || 1;
        const wildRank    = activeTable.wildcardRank || getRoundWildcardRank(1);
        const seats       = { ...activeTable.seats };
        const centerCards = (activeTable.centerCards || []).map(c => ({ ...c }));
        const botCards    = [...(currentPlayer.cards || [])];

        // ── Ronda 1: decide si cambia toda la mano ──
        if (activeTable.round1Phase === "choose_all") {
          // Evalúa su mano actual
          const myEval  = evaluateBestHand(botCards, round);
          const cCards  = centerCards.map(cc => cc.card);
          const cEval   = evaluateBestHand(cCards, round);

          // Cambia si el centro es mejor o si su mano es peor que Trío
          if (cEval.rank < myEval.rank || myEval.rank >= 8) {
            // viudaSwapAll internamente
            const newCenter = botCards.map(card => ({ card, revealed: true }));
            const newBotCards = cCards;
            seats[currentSeatKey] = { ...currentPlayer, cards: newBotCards };
            await _viudaNextTurn(seats, newCenter, currentSeatKey, { round1Swapped: true });
          } else {
            await _viudaNextTurn(seats, centerCards, currentSeatKey);
          }
          return;
        }

        // ── Rondas 2+: intercambio individual o tocar ──

        // Evaluar mano actual
        let bestEval = evaluateBestHand(botCards, round);
        let bestAction = null; // { type: "swap", myIdx, centerIdx } | { type: "swapAll" } | { type: "pass" }

        // Probar intercambio de cada carta con cada carta del centro
        for (let mi = 0; mi < botCards.length; mi++) {
          for (let ci = 0; ci < centerCards.length; ci++) {
            if (!centerCards[ci].revealed && phase !== "final_round") continue;
            const testCards = [...botCards];
            testCards[mi] = centerCards[ci].card;
            const testEval = evaluateBestHand(testCards, round);
            if (testEval.rank < bestEval.rank ||
               (testEval.rank === bestEval.rank &&
                JSON.stringify(testEval.tiebreakers) > JSON.stringify(bestEval.tiebreakers))) {
              bestEval   = testEval;
              bestAction = { type: "swap", myIdx: mi, centerIdx: ci };
            }
          }
        }

        // Probar cambiar toda la mano
        const centerAllCards = centerCards.map(cc => cc.card);
        const swapAllEval    = evaluateBestHand(centerAllCards, round);
        if (swapAllEval.rank < bestEval.rank) {
          bestEval   = swapAllEval;
          bestAction = { type: "swapAll" };
        }

        // Tocar si tiene buena mano (Full o mejor) y es ronda 3+
        if (round >= 3 && bestEval.rank <= 5 && phase === "playing") {
          const sorted      = Object.keys(seats).filter(k => seats[k]).sort((a,b) => +a - +b);
          const toucherIdx  = sorted.indexOf(currentSeatKey);
          const finalTurnRemaining = [
            ...sorted.slice(toucherIdx + 1),
            ...sorted.slice(0, toucherIdx),
          ];
          if (finalTurnRemaining.length === 0) {
            await _viudaResolve(seats);
          } else {
            const { updateDoc: _u, doc: _d } = { updateDoc, doc };
            await updateDoc(doc(db, "tables", activeTable.id), {
              phase:              "final_round",
              touchedBy:          currentSeatKey,
              currentTurn:        finalTurnRemaining[0],
              finalTurnRemaining: finalTurnRemaining.slice(1),
              actedThisRound:     [...(activeTable.actedThisRound || []), currentSeatKey],
            });
          }
          return;
        }

        // Ejecutar la mejor acción encontrada
        if (bestAction?.type === "swap") {
          const myCard   = botCards[bestAction.myIdx];
          const newCards = [...botCards];
          newCards[bestAction.myIdx] = centerCards[bestAction.centerIdx].card;
          centerCards[bestAction.centerIdx] = { card: myCard, revealed: true };
          seats[currentSeatKey] = { ...currentPlayer, cards: newCards };
          await _viudaNextTurn(seats, centerCards, currentSeatKey);
        } else if (bestAction?.type === "swapAll") {
          const newCenter    = botCards.map(card => ({ card, revealed: true }));
          const newBotCards  = centerAllCards;
          seats[currentSeatKey] = { ...currentPlayer, cards: newBotCards };
          await _viudaNextTurn(seats, newCenter, currentSeatKey);
        } else {
          // Pasar o no hacer nada
          await _viudaNextTurn(seats, centerCards, currentSeatKey);
        }
      } catch (err) {
        console.error("Bot viuda turn error:", err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable?.currentTurn, activeTable?.phase]);

  // =====================================================
  // BALANCE — La Viuda (descontar apuesta / pagar bote)
  // =====================================================

  useEffect(() => {
    if (!activeTable || !user || !userData) return;
    if (activeTable.game !== "viuda") return;

    const phase = activeTable.phase;
    if (!["playing","final_round","results"].includes(phase)) return;

    const entry = Object.entries(activeTable.seats || {})
      .find(([_, p]) => p?.uid === user.uid);
    if (!entry) return;
    const [seatKey, player] = entry;
    if (!player) return;

    // Descontar apuesta al iniciar
    if (["playing","final_round"].includes(phase) && player.bet && !player.betDeducted) {
      updateBalance(Math.max(0, userData.balance - player.bet));
      updateDoc(doc(db, "tables", activeTable.id), {
        [`seats.${seatKey}.betDeducted`]: true,
      });
      return;
    }

    // Pagar bote al ganador
    if (phase === "results" && player.result && !player.balancePaid) {
      if (player.payout > 0) updateBalance(userData.balance + player.payout);
      updateDoc(doc(db, "tables", activeTable.id), {
        [`seats.${seatKey}.balancePaid`]: true,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable?.game, activeTable?.phase,
      JSON.stringify(Object.values(activeTable?.seats || {}).find(p => p?.uid === user?.uid))
  ]);

  // =====================================================
  // UPDATE BALANCE
  // =====================================================

  const updateBalance = async (newBalance) => {
    try {
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid), { balance: newBalance });
      setUserData(prev => ({ ...prev, balance: newBalance }));
    } catch (err) {
      console.error(err);
    }
  };

  // =====================================================
  // HELPERS
  // =====================================================

  const generateTableCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  };

  const getAuthError = (code) => {
    const map = {
      "auth/invalid-credential":    "Usuario o contraseña incorrectos",
      "auth/user-not-found":        "El usuario no existe",
      "auth/wrong-password":        "Contraseña incorrecta",
      "auth/email-already-in-use":  "Ese usuario ya existe",
      "auth/weak-password":         "La contraseña es muy débil (mínimo 6 caracteres)",
      "auth/network-request-failed":"Error de conexión",
    };
    return map[code] || "Ocurrió un error inesperado";
  };

  // =====================================================
  // CONTEXT VALUE
  // =====================================================

  return (
    <CasinoContext.Provider value={{
      user, userData, tables,
      activeTable, activeTableId,
      loading, authChecked, error,
      register, login, logout,
      createTable, joinTable, leaveTable,
      sitOnSeat, leaveSeat, toggleReady,
      startCountdown, dealCards, hit, stand, resetRound, updateSeatBet,
      dealViudaCards, viudaSwapCard, viudaSwapAll, viudaSkipAll, viudaPass, viudaTouch, resetViudaRound,
      updateBalance, setActiveTable,
    }}>
      {children}
    </CasinoContext.Provider>
  );
};
