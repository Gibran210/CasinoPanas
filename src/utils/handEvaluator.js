/**
 * utils/handEvaluator.js
 * Evaluación de manos de póker para "La Viuda".
 * Retorna { name, rank } donde rank más bajo = mano más fuerte.
 */

import { RANKS } from './deck'

/**
 * Evalúa una mano de 5 cartas.
 *
 * Ranking (de mejor a peor):
 *   1 — Escalera de Color
 *   2 — Póker (cuatro iguales)
 *   3 — Full House
 *   4 — Color (flush)
 *   5 — Escalera (straight)
 *   6 — Tercia (trío)
 *   7 — Dos Pares
 *   8 — Par
 *   9 — Carta Alta
 */
export const evaluateHand = (cards) => {
  if (!cards || cards.length < 5) return { name: 'Carta Alta', rank: 9 }

  const rankIdxs = cards.map((c) => RANKS.indexOf(c.rank))
  const suits    = cards.map((c) => c.suit)

  // Conteo de repeticiones por valor
  const rankCount = {}
  rankIdxs.forEach((r) => (rankCount[r] = (rankCount[r] || 0) + 1))
  const counts = Object.values(rankCount).sort((a, b) => b - a)

  const isFlush    = suits.every((s) => s === suits[0])
  const uniqueSorted = [...new Set(rankIdxs)].sort((a, b) => a - b)
  const isStraight = uniqueSorted.length === 5 && uniqueSorted[4] - uniqueSorted[0] === 4

  if (isFlush && isStraight)                     return { name: 'Escalera de Color', rank: 1 }
  if (counts[0] === 4)                           return { name: 'Póker',             rank: 2 }
  if (counts[0] === 3 && counts[1] === 2)        return { name: 'Full House',        rank: 3 }
  if (isFlush)                                   return { name: 'Color',             rank: 4 }
  if (isStraight)                                return { name: 'Escalera',          rank: 5 }
  if (counts[0] === 3)                           return { name: 'Tercia',            rank: 6 }
  if (counts[0] === 2 && counts[1] === 2)        return { name: 'Dos Pares',         rank: 7 }
  if (counts[0] === 2)                           return { name: 'Par',               rank: 8 }
  return                                                { name: 'Carta Alta',         rank: 9 }
}

/**
 * Lógica greedy del bot:
 * Prueba todos los intercambios posibles (mano del bot × cartas disponibles)
 * y devuelve el swap que más mejore la mano. Si ninguno mejora, no hace nada.
 *
 * @param {Card[]} botHand      — mano actual del bot
 * @param {Card[]} available    — cartas disponibles para intercambiar (ej. La Viuda)
 * @returns {{ newBotHand: Card[], newAvailable: Card[] }}
 */
export const botBestSwap = (botHand, available) => {
  const bh = [...botHand]
  const av = [...available]
  let bestScore = evaluateHand(bh).rank
  let bestSwap  = null

  for (let bi = 0; bi < bh.length; bi++) {
    for (let ai = 0; ai < av.length; ai++) {
      const testHand = [...bh]
      testHand[bi] = av[ai]
      const score = evaluateHand(testHand).rank
      if (score < bestScore) {
        bestScore = score
        bestSwap  = { bi, ai }
      }
    }
  }

  if (bestSwap) {
    const temp        = bh[bestSwap.bi]
    bh[bestSwap.bi]   = av[bestSwap.ai]
    av[bestSwap.ai]   = temp
  }

  return { newBotHand: bh, newAvailable: av }
}
