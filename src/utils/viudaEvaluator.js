/**
 * viudaEvaluator.js — La Viuda con comodines
 *
 * Comodines:
 *  • Jokers     : "JK1" y "JK2" — siempre comodines
 *  • De partida : wildcardRank almacenado en Firestore (ej. "A")
 *
 * Ranking (1 = mejor):
 *  1  Flor Imperial
 *  2  Repoker
 *  3  Escalera de Color
 *  4  Poker
 *  5  Full
 *  6  Color
 *  7  Escalera
 *  8  Trío
 *  9  Dobles Parejas
 * 10  Pareja
 * 11  Carta Mayor
 */

export const RANK_ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const RANK_VALS = Object.fromEntries(RANK_ORDER.map((r, i) => [r, i + 2]));
RANK_VALS['A'] = 14;

const RANK_NAMES = {
  14:'As',13:'Rey',12:'Reina',11:'Jota',10:'10',
  9:'9',8:'8',7:'7',6:'6',5:'5',4:'4',3:'3',2:'2',
};

export const rankName = (val) => RANK_NAMES[val] || String(val);

/* ── Comodines ─────────────────────────────────────── */

export const getRoundWildcardRank = (handNumber) =>
  RANK_ORDER[(handNumber - 1) % 13];

/**
 * ¿Es comodín esta carta?
 * @param {string} card            — "A♠", "JK1", etc.
 * @param {string} wildcardRank    — rango comodín de la partida, ej. "A"
 */
export const isWildcard = (card, wildcardRank) => {
  if (!card) return false;
  if (card === 'JK1' || card === 'JK2') return true;
  if (!wildcardRank) return false;
  const rank = card.slice(0, -1);   // "A♠" → "A"
  return rank === wildcardRank;
};

/* ── Helpers internos ──────────────────────────────── */

export const parseCard = (card) => {
  if (card === 'JK1' || card === 'JK2') return { rank: 'JK', suit: '★', val: 0 };
  const suit = card[card.length - 1];
  const rank = card.slice(0, -1);
  return { rank, suit, val: RANK_VALS[rank] || 0 };
};

const countRanks = (parsed) => {
  const map = {};
  parsed.forEach(c => { map[c.val] = (map[c.val] || 0) + 1; });
  return Object.entries(map)
    .map(([val, cnt]) => ({ val: +val, cnt }))
    .sort((a, b) => b.cnt - a.cnt || b.val - a.val);
};

const detectStraight = (vals) => {
  const u = [...new Set(vals)].sort((a, b) => a - b);
  if (u.length !== 5) return { is: false, high: 0 };
  if (u[4] - u[0] === 4) return { is: true, high: u[4] };
  if (u[0]===2 && u[1]===3 && u[2]===4 && u[3]===5 && u[4]===14)
    return { is: true, high: 5 };
  return { is: false, high: 0 };
};

/* ── Evaluación SIN comodines (cartas ya sustituidas) ─ */

const evaluateRealHand = (cards) => {
  if (!cards || cards.length < 5)
    return { rank: 12, name: 'Sin mano', display: '—', tiebreakers: [0] };

  const parsed   = cards.map(parseCard);
  const suits    = parsed.map(c => c.suit);
  const vals     = parsed.map(c => c.val).sort((a, b) => b - a);
  const isFlush  = suits.every(s => s === suits[0]);
  const straight = detectStraight(vals);
  const counts   = countRanks(parsed);

  if (isFlush && straight.is && straight.high === 14 && vals[vals.length-1] === 10)
    return { rank: 1, name: 'Flor Imperial', display: '♚ Flor Imperial', tiebreakers: [0] };

  if (isFlush && straight.is)
    return { rank: 3, name: 'Escalera de Color',
      display: `Escalera de Color al ${rankName(straight.high)}`,
      tiebreakers: [straight.high] };

  if (counts[0].cnt === 4)
    return { rank: 4, name: 'Poker',
      display: `Poker de ${rankName(counts[0].val)}s`,
      tiebreakers: [counts[0].val, counts[1]?.val || 0] };

  if (counts[0].cnt === 3 && counts[1]?.cnt === 2)
    return { rank: 5, name: 'Full',
      display: `Full de ${rankName(counts[0].val)}s con ${rankName(counts[1].val)}s`,
      tiebreakers: [counts[0].val, counts[1].val] };

  if (isFlush)
    return { rank: 6, name: 'Color',
      display: `Color en ${suits[0]}`, tiebreakers: vals };

  if (straight.is)
    return { rank: 7, name: 'Escalera',
      display: `Escalera al ${rankName(straight.high)}`,
      tiebreakers: [straight.high] };

  if (counts[0].cnt === 3)
    return { rank: 8, name: 'Trío',
      display: `Trío de ${rankName(counts[0].val)}s`,
      tiebreakers: [counts[0].val, counts[1]?.val || 0, counts[2]?.val || 0] };

  if (counts[0].cnt === 2 && counts[1]?.cnt === 2)
    return { rank: 9, name: 'Dobles Parejas',
      display: `Doble Pareja: ${rankName(counts[0].val)}s y ${rankName(counts[1].val)}s`,
      tiebreakers: [counts[0].val, counts[1].val, counts[2]?.val || 0] };

  if (counts[0].cnt === 2)
    return { rank: 10, name: 'Pareja',
      display: `Pareja de ${rankName(counts[0].val)}s`,
      tiebreakers: [counts[0].val, ...counts.slice(1).map(c => c.val)] };

  return { rank: 11, name: 'Carta Mayor',
    display: `Carta Mayor: ${rankName(vals[0])}`, tiebreakers: vals };
};

// Alias público (usado donde no hay comodines)
export const evaluateViudaHand = evaluateRealHand;

/* ── Todas las cartas reales posibles para sustitución ─ */
const ALL_REAL_CARDS = ['♠','♥','♦','♣'].flatMap(s =>
  RANK_ORDER.map(r => r + s)
);

const compareTiebreakers = (a, b) => {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

const isBetter = (a, b) =>
  a.rank < b.rank ||
  (a.rank === b.rank && compareTiebreakers(a.tiebreakers, b.tiebreakers) > 0);

/**
 * Evalúa la MEJOR mano posible con comodines.
 *
 * @param {string[]} cards        — 5 cartas de la mano
 * @param {string}   wildcardRank — rango comodín de esta partida (ej. "A")
 *                                  Si es número de ronda, se convierte internamente.
 */
export const evaluateBestHand = (cards, wildcardRankOrRound) => {
  // Aceptar tanto wildcardRank string ("A") como handNumber numérico
  const wRank = typeof wildcardRankOrRound === 'number'
    ? getRoundWildcardRank(wildcardRankOrRound)
    : (wildcardRankOrRound || null);

  // Separar comodines de cartas reales
  const wilds     = cards.filter(c => isWildcard(c, wRank));
  const realCards = cards.filter(c => !isWildcard(c, wRank));
  const wCount    = wilds.length;

  // Sin comodines → evaluar directamente
  if (wCount === 0) return evaluateRealHand(cards);

  // 5 comodines
  if (wCount >= 5) return {
    rank: 2, name: 'Repoker',
    display: '★ Repoker (5 comodines)', tiebreakers: [14],
  };

  let best = { rank: 12, name: 'Sin mano', display: '—', tiebreakers: [0] };

  const tryHand = (hand) => {
    if (hand.length !== 5) return;
    // Comprobar Repoker (5 del mismo valor)
    const parsed = hand.map(parseCard);
    const counts = countRanks(parsed);
    if (counts[0]?.cnt === 5) {
      const rep = {
        rank: 2, name: 'Repoker',
        display: `★ Repoker de ${rankName(counts[0].val)}s`,
        tiebreakers: [counts[0].val],
      };
      if (isBetter(rep, best)) best = rep;
      return;
    }
    const ev = evaluateRealHand(hand);
    if (isBetter(ev, best)) best = ev;
  };

  if (wCount === 1) {
    for (const sub of ALL_REAL_CARDS) {
      tryHand([...realCards, sub]);
    }
  } else if (wCount === 2) {
    for (let i = 0; i < ALL_REAL_CARDS.length; i++) {
      for (let j = i; j < ALL_REAL_CARDS.length; j++) {
        tryHand([...realCards, ALL_REAL_CARDS[i], ALL_REAL_CARDS[j]]);
      }
    }
  } else {
    // 3+ comodines — triple loop O(52^3) ≈ 140k iteraciones, manejable
    if (wCount === 3) {
      for (let i = 0; i < ALL_REAL_CARDS.length; i++) {
        for (let j = i; j < ALL_REAL_CARDS.length; j++) {
          for (let k = j; k < ALL_REAL_CARDS.length; k++) {
            tryHand([...realCards, ALL_REAL_CARDS[i], ALL_REAL_CARDS[j], ALL_REAL_CARDS[k]]);
          }
        }
      }
    } else if (wCount === 4) {
      // 4 comodines + 1 real → probar cuádruple con la carta real
      const realVal = parseCard(realCards[0]).val;
      for (const s of ALL_REAL_CARDS) {
        tryHand([realCards[0], s, s.replace(/.$/, '♠'), s.replace(/.$/, '♥'), s.replace(/.$/, '♦')]);
      }
      // Simplificación: Repoker garantizado con 4 comodines
      if (best.rank > 2) best = {
        rank: 2, name: 'Repoker',
        display: `★ Repoker con 4 comodines`, tiebreakers: [14],
      };
    }
    // Fallback solo si nada funcionó
    if (best.rank === 12) {
      const parsed = realCards.map(parseCard);
      const counts = countRanks(parsed);
      const topVal = counts[0]?.val || 14;
      best = { rank: 4, name: 'Poker', display: `★ Poker de ${rankName(topVal)}s`, tiebreakers: [topVal] };
    }
  }

  return best;
};

/* ── Comparar dos manos ────────────────────────────── */

export const compareViudaHands = (cardsA, cardsB, wildcardRank) => {
  const a = evaluateBestHand(cardsA, wildcardRank);
  const b = evaluateBestHand(cardsB, wildcardRank);
  if (a.rank !== b.rank) return a.rank < b.rank ? 1 : -1;
  const c = compareTiebreakers(a.tiebreakers, b.tiebreakers);
  return c > 0 ? 1 : c < 0 ? -1 : 0;
};

/**
 * Determina los ganadores entre varios jugadores.
 * @param {{ seatKey, cards }[]} players
 * @param {string}               wildcardRank — rango comodín de la partida
 */
export const determineViudaWinners = (players, wildcardRank) => {
  if (!players.length) return [];
  let best = [players[0]];
  for (let i = 1; i < players.length; i++) {
    const cmp = compareViudaHands(players[i].cards, best[0].cards, wildcardRank);
    if (cmp > 0)        best = [players[i]];
    else if (cmp === 0) best.push(players[i]);
  }
  return best.map(p => p.seatKey);
};
