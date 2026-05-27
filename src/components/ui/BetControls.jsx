/**
 * components/ui/BetControls.jsx
 * Panel de apuestas reutilizable para ambos juegos.
 * Muestra el saldo apostado, chips clicables y botones de Limpiar / Confirmar.
 *
 * Props:
 *   bet          — apuesta acumulada actual
 *   onAddChip    — fn(value) al hacer click en una ficha
 *   onClear      — fn() para limpiar la apuesta
 *   onConfirm    — fn() para confirmar y comenzar
 *   confirmLabel — texto del botón de confirmación
 *   minBet       — apuesta mínima de la mesa
 *   maxBet       — límite superior (balance disponible)
 */

import PokerChip from './PokerChip'

const CHIP_VALUES = [10, 50, 100, 500]

export default function BetControls({
  bet,
  onAddChip,
  onClear,
  onConfirm,
  confirmLabel = 'Repartir',
  minBet,
  maxBet,
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Display de apuesta */}
      <div
        className="rounded-xl px-10 py-3 text-center"
        style={{
          background: 'rgba(0,0,0,0.55)',
          border:     '1px solid rgba(212,175,55,0.3)',
        }}
      >
        <p style={{ color: '#6b7280', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
          Apuesta
        </p>
        <p style={{ color: '#d4af37', fontWeight: 900, fontSize: '2rem', lineHeight: 1.1, margin: '2px 0' }}>
          ${bet.toLocaleString()}
        </p>
        <p style={{ color: '#374151', fontSize: 11, margin: 0 }}>
          Mínimo ${minBet}
        </p>
      </div>

      {/* Fichas */}
      <div className="flex gap-3 items-center">
        {CHIP_VALUES.map((v) => (
          <PokerChip
            key={v}
            value={v}
            onClick={() => onAddChip(v)}
            disabled={bet + v > maxBet}
          />
        ))}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3">
        <button
          onClick={onClear}
          disabled={bet === 0}
          className="px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 hover:bg-gray-700"
          style={{
            background: 'rgba(55,65,81,0.7)',
            color:      '#9ca3af',
            border:     '1px solid rgba(75,85,99,0.5)',
          }}
        >
          Limpiar
        </button>

        <button
          onClick={onConfirm}
          disabled={bet < minBet}
          className="px-8 py-2 rounded-lg font-bold text-sm disabled:opacity-40 transition-transform hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #d4af37, #f9e189)',
            color:      '#111827',
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
