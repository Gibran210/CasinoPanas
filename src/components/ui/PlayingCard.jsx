/**
 * components/ui/PlayingCard.jsx
 * Carta de baraja visual con cara y reverso.
 *
 * Props:
 *   card      — { rank: string, suit: string }
 *   faceDown  — muestra el dorso azul con patrón si es true
 *   small     — tamaño reducido (w-10 h-14 vs w-16 h-24)
 *   selected  — eleva la carta con anillo dorado
 *   onClick   — handler de click opcional
 *   style     — estilos inline adicionales
 */

import { isRedSuit } from '../../utils/deck'

export default function PlayingCard({
  card,
  faceDown  = false,
  small     = false,
  selected  = false,
  onClick,
  style     = {},
}) {
  const w = small ? 40  : 64
  const h = small ? 56  : 96
  const fs = small ? 10 : 13
  const center = small ? 18 : 28

  const base = {
    width:      w,
    height:     h,
    borderRadius: 8,
    flexShrink: 0,
    cursor:     onClick ? 'pointer' : 'default',
    transition: 'transform 0.15s, box-shadow 0.15s',
    transform:  selected ? 'translateY(-14px)' : 'translateY(0)',
    outline:    selected ? '2px solid #d4af37' : 'none',
    boxShadow:  selected
      ? '0 8px 24px rgba(212,175,55,0.4)'
      : '0 3px 10px rgba(0,0,0,0.5)',
    ...style,
  }

  // ── Reverso ──
  if (faceDown) {
    return (
      <div
        style={{
          ...base,
          background:  '#1e3a5f',
          border:      '2px solid #2563eb',
          display:     'flex',
          alignItems:  'center',
          justifyContent: 'center',
        }}
        onClick={onClick}
      >
        <div
          style={{
            width: '78%', height: '78%',
            borderRadius: 5,
            border:   '1px solid rgba(96,165,250,0.5)',
            display:  'flex', alignItems: 'center', justifyContent: 'center',
            opacity:  0.6,
          }}
        >
          <span style={{ color: '#3b82f6', fontSize: small ? 14 : 20 }}>✦</span>
        </div>
      </div>
    )
  }

  const red   = isRedSuit(card.suit)
  const color = red ? '#dc2626' : '#111827'

  // ── Cara ──
  return (
    <div
      style={{
        ...base,
        background:  'white',
        border:      '1px solid #d1d5db',
        display:     'flex',
        flexDirection: 'column',
        padding:     '3px 4px',
        userSelect:  'none',
      }}
      onClick={onClick}
    >
      <div style={{ fontWeight: 900, lineHeight: 1, color, fontSize: fs }}>{card.rank}</div>
      <div style={{ lineHeight: 1,   color, fontSize: fs }}>{card.suit}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: center }}>
        {card.suit}
      </div>
      <div style={{ fontWeight: 900, lineHeight: 1, color, fontSize: fs, transform: 'rotate(180deg)' }}>
        {card.rank}
      </div>
    </div>
  )
}
