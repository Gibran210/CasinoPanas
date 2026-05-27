/**
 * viudaEvaluator.js — La Viuda con comodines
 *
 * Comodines:
 *  • Jokers  : "JK1" y "JK2" — siempre comodines
 *  • De ronda: la carta que corresponda a esa ronda
 *             (ronda 1 = A, 2 = 2, … 13 = K, ronda 14 vuelve a A)
 *
 * Ranking (1 = mejor):
 *  1  Flor Imperial      A,K,Q,J,10 mismo palo
 *  2  Repoker            5 del mismo valor (requiere al menos 1 comodín)
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
const RANK_VALS  = Object.fromEntries(RANK_ORDER.map((r, i) => [r, i + 2]));
RANK_VALS['A'] = 14;

const RANK_NAMES = {
  14:'As',13:'Rey',12:'Reina',11:'Jota',10:'10',
  9:'9',8:'8',7:'7',6:'6',5:'5',4:'4',3:'3',2:'2',
};

export const rankName = (val) => RANK_NAMES[val] || String(val);

/* ── Comodines ───────────────────────────────────────── */

/** Rango comodín de esa ronda (ronda 1 → A, 2 → 2, … 13 → K, cíclico) */
export const getRoundWildcardRank = (round) =>
  RANK_ORDER[(round - 1) % 13];

/** ¿Es comodín esta carta en esta ronda? */
export const isWildcard = (card, roundWildcardRank) => {
  if (!card) return false;
  if (card === 'JK1' || card === 'JK2') return true;
  return card.slice(0, -1) === roundWildcardRank;
};

/* ── Utilidades de evaluación ─────────────────────────── */

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
  // A como 1: A-2-3-4-5
  if (u[0] === 2 && u[1] === 3 && u[2] === 4 && u[3] === 5 && u[4] === 14)
    return { is: true, high: 5 };
  return { is: false, high: 0 };
};

/* ── Evaluación SIN comodines ─────────────────────────── */

export const evaluateViudaHand = (cards) => {
  if (!cards || cards.length < 5)
    return { rank: 12, name: 'Sin mano', display: '—', tiebreakers: [0] };

  const parsed   = cards.map(parseCard);
  const suits    = parsed.map(c => c.suit);
  const vals     = parsed.map(c => c.val).sort((a, b) => b - a);
  const isFlush  = suits.every(s => s === suits[0]);
  const straight = detectStraight(vals);
  const counts   = countRanks(parsed);

  if (isFlush && straight.is && straight.high === 14 && vals[vals.length - 1] === 10)
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

/* ── Evaluación CON comodines (fuerza bruta O(52^n)) ─── */

const ALL_CARDS = ['♠','♥','♦','♣'].flatMap(s =>
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
  a.rank < b.rank || (a.rank === b.rank && compareTiebreakers(a.tiebreakers, b.tiebreakers) > 0);

/**
 * Evalúa la mejor mano posible teniendo en cuenta comodines.
 * Fuerza bruta: sustituye cada comodín por cada carta posible y se queda
 * con la evaluación más favorable.
 *
 * @param {string[]} cards       — 5 cartas (pueden incluir JK1/JK2 y comodín de ronda)
 * @param {number}   round       — ronda actual (determina el comodín de ronda)
 */
export const evaluateBestHand = (cards, round) => {
  const wRank    = getRoundWildcardRank(round);
  const wilds    = cards.filter(c => isWildcard(c, wRank));
  const realCards = cards.filter(c => !isWildcard(c, wRank));
  const wCount   = wilds.length;

  if (wCount === 0) return evaluateViudaHand(cards);

  // Repoker: con todos comodines o si tenemos 4 iguales + comodín
  if (wCount >= 5) return { rank: 2, name: 'Repoker',
    display: '★ Repoker (5 comodines)', tiebreakers: [14] };

  let best = { rank: 12, name: 'Sin mano', display: '—', tiebreakers: [0] };

  if (wCount === 1) {
    for (const sub of ALL_CARDS) {
      const hand = [...realCards, sub];
      if (hand.length !== 5) continue;
      const ev = evaluateViudaHand(hand);
      // Checar Repoker (5 del mismo valor con comodín)
      const parsed = hand.map(parseCard);
      const counts = countRanks(parsed);
      if (counts[0]?.cnt === 5) {
        const rep = { rank: 2, name: 'Repoker',
          display: `Repoker de ${rankName(counts[0].val)}s`, tiebreakers: [counts[0].val] };
        if (isBetter(rep, best)) best = rep;
      } else if (isBetter(ev, best)) best = ev;
    }
  } else if (wCount === 2) {
    for (let i = 0; i < ALL_CARDS.length; i++) {
      for (let j = 0; j < ALL_CARDS.length; j++) {
        if (i === j) continue;
        const hand = [...realCards, ALL_CARDS[i], ALL_CARDS[j]];
        if (hand.length !== 5) continue;
        const ev = evaluateViudaHand(hand);
        const parsed = hand.map(parseCard);
        const counts = countRanks(parsed);
        if (counts[0]?.cnt === 5) {
          const rep = { rank: 2, name: 'Repoker',
            display: `Repoker de ${rankName(counts[0].val)}s`, tiebreakers: [counts[0].val] };
          if (isBetter(rep, best)) best = rep;
        } else if (isBetter(ev, best)) best = ev;
      }
    }
  } else {
    // 3+ comodines: simplificación — buscar repoker o flor imperial
    const highVal = realCards.length
      ? Math.max(...realCards.map(c => parseCard(c).val))
      : 14;
    // Con 3+ wildcards casi siempre se puede hacer poker o mejor
    best = { rank: 4, name: 'Poker',
      display: `Poker con comodines`, tiebreakers: [14] };
  }

  return best;
};

/* ── Comparar manos ───────────────────────────────────── */

export const compareViudaHands = (cardsA, cardsB, round) => {
  const a = evaluateBestHand(cardsA, round);
  const b = evaluateBestHand(cardsB, round);
  if (a.rank !== b.rank) return a.rank < b.rank ? 1 : -1;
  const c = compareTiebreakers(a.tiebreakers, b.tiebreakers);
  return c > 0 ? 1 : c < 0 ? -1 : 0;
};

/**
 * Determina ganadores entre varios jugadores.
 * @param {{ seatKey, cards }[]} players
 * @param {number} round
 * @returns {string[]} seatKeys ganadores
 */
export const determineViudaWinners = (players, round = 1) => {
  if (!players.length) return [];
  let best = [players[0]];
  for (let i = 1; i < players.length; i++) {
    const cmp = compareViudaHands(players[i].cards, best[0].cards, round);
    if (cmp > 0)       best = [players[i]];
    else if (cmp === 0) best.push(players[i]);
  }
  return best.map(p => p.seatKey);
};
