/**
 * utils/deck.js
 * Utilidades de baraja: creación, barajado y valores de cartas.
 */

export const SUITS = ['♠', '♥', '♦', '♣']
export const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']

/** True si el palo es rojo (corazones o diamantes) */
export const isRedSuit = (suit) => suit === '♥' || suit === '♦'

/** Crea un mazo estándar de 52 cartas con ID único por instancia */
export const createDeck = () =>
  SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      suit,
      rank,
      id: `${rank}${suit}-${Math.random().toString(36).slice(2, 6)}`,
    }))
  )

/** Algoritmo Fisher-Yates: devuelve una nueva copia barajada */
export const shuffle = (deck) => {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

// ──────────────────────────────────────────────
// Utilidades específicas de Blackjack
// ──────────────────────────────────────────────

/** Valor de una carta en Blackjack. As = 11 (se ajusta en bjTotal). */
export const bjValue = (rank) => {
  if (['J', 'Q', 'K'].includes(rank)) return 10
  if (rank === 'A') return 11
  return parseInt(rank)
}

/**
 * Suma total de una mano en Blackjack.
 * Los Ases se reducen de 11 → 1 cuando el total supera 21.
 */
export const bjTotal = (cards) => {
  let total = 0
  let aces  = 0

  for (const c of cards) {
    total += bjValue(c.rank)
    if (c.rank === 'A') aces++
  }

  // Regla del As: puede valer 1 para evitar pasarse
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }

  return total
}
