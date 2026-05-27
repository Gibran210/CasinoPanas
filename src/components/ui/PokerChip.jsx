/**
 * components/ui/PokerChip.jsx
 * Ficha de casino circular con borde punteado estilo poker real.
 *
 * Colores estándar de casino:
 *   $10  → Azul
 *   $50  → Rojo
 *   $100 → Verde
 *   $500 → Negro con borde dorado
 *
 * Props:
 *   value    — 10 | 50 | 100 | 500
 *   onClick  — handler de click
 *   disabled — atenúa la ficha
 *   size     — 'md' (56px) | 'sm' (42px)
 */

const CHIP_CONFIG = {
  10:  { bg: '#1d4ed8', border: '#93c5fd', text: '#bfdbfe', label: '$10'  },
  50:  { bg: '#b91c1c', border: '#fca5a5', text: '#fee2e2', label: '$50'  },
  100: { bg: '#065f46', border: '#6ee7b7', text: '#d1fae5', label: '$100' },
  500: { bg: '#1c1917', border: '#fbbf24', text: '#fef3c7', label: '$500' },
}

export default function PokerChip({ value, onClick, disabled = false, size = 'md' }) {
  const cfg = CHIP_CONFIG[value]
  const dim = size === 'sm' ? 42 : 56

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`Apostar ${cfg.label}`}
      style={{
        width:          dim,
        height:         dim,
        borderRadius:   '50%',
        background:     cfg.bg,
        border:         `4px dashed ${cfg.border}`,
        color:          cfg.text,
        fontWeight:     'bold',
        fontSize:       size === 'sm' ? 9 : 11,
        cursor:         disabled ? 'not-allowed' : 'pointer',
        opacity:        disabled ? 0.4 : 1,
        transition:     'transform 0.12s, box-shadow 0.12s',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        userSelect:     'none',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(1.18)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseDown={(e)  => { if (!disabled) e.currentTarget.style.transform = 'scale(0.95)' }}
      onMouseUp={(e)    => { if (!disabled) e.currentTarget.style.transform = 'scale(1.18)' }}
    >
      {cfg.label}
    </button>
  )
}
