/**
 * components/ui/TopBar.jsx
 * Cabecera compartida por todas las pantallas post-login.
 *
 * Props:
 *   title   — texto central (ej. "21 / BLACKJACK")
 *   onBack  — si se pasa, muestra "← Salir de Mesa" en lugar del logo
 */

import { useCasino } from '../../context/CasinoContext'

export default function TopBar({ title, onBack }) {
  const { user, logout } = useCasino()

  return (
    <header
      className="flex items-center justify-between px-5 py-3 flex-shrink-0"
      style={{
        background:   'rgba(3,3,3,0.97)',
        borderBottom: '1px solid rgba(212,175,55,0.18)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Izquierda: logo o botón de salida */}
      <div style={{ minWidth: 100 }}>
        {onBack ? (
          <button
            onClick={onBack}
            className="text-sm transition-colors hover:text-white flex items-center gap-1"
            style={{ color: '#6b7280' }}
          >
            ← Salir de Mesa
          </button>
        ) : (
          <span
            className="text-lg font-black"
            style={{ fontFamily: 'Georgia, serif', color: '#d4af37' }}
          >
            🃏 ROYAL
          </span>
        )}
      </div>

      {/* Centro: título de la sección */}
      <span
        className="font-bold text-sm tracking-widest"
        style={{ color: '#d4af37' }}
      >
        {title}
      </span>

      {/* Derecha: perfil + balance */}
      <div className="flex items-center gap-4" style={{ minWidth: 100, justifyContent: 'flex-end' }}>
        <div className="text-right">
          <p style={{ color: '#6b7280', fontSize: 11, margin: 0 }}>{user?.name}</p>
          <p style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 14, margin: 0 }}>
            ${user?.balance?.toLocaleString()}
          </p>
        </div>

        {!onBack && (
          <button
            onClick={logout}
            className="text-xs px-2 py-1 rounded border transition-colors hover:text-red-400 hover:border-red-800"
            style={{ color: '#6b7280', border: '1px solid rgba(55,65,81,0.8)' }}
          >
            Salir
          </button>
        )}
      </div>
    </header>
  )
}
