# 🃏 Royal Casino

Mini casino de cartas en React con dos juegos: **21/Blackjack** y **La Viuda**.

## Stack

| Herramienta | Versión | Uso |
|-------------|---------|-----|
| React | 18 | UI con hooks funcionales |
| Vite | 5 | Bundler y dev server |
| Tailwind CSS | 3 | Estilos utilitarios |
| Context API | — | Estado global (useReducer) |

---

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Servidor de desarrollo
npm run dev

# 3. Build de producción
npm run build
```

Abre `http://localhost:5173` en el navegador.

---

## Estructura del proyecto

```
royal-casino/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx              ← Entry point
    ├── App.jsx               ← Router de pantallas
    ├── index.css             ← Estilos globales + variables CSS
    │
    ├── context/
    │   └── CasinoContext.jsx ← Estado global con useReducer
    │                            (usuario, balance, mesas, mesa activa)
    │
    ├── utils/
    │   ├── deck.js           ← createDeck, shuffle, bjTotal, bjValue
    │   └── handEvaluator.js  ← evaluateHand, botBestSwap (IA del bot)
    │
    └── components/
        ├── ui/               ← Componentes visuales reutilizables
        │   ├── PlayingCard.jsx   Carta de baraja (cara/reverso)
        │   ├── PokerChip.jsx     Ficha de casino ($10/$50/$100/$500)
        │   ├── BetControls.jsx   Panel de apuestas
        │   └── TopBar.jsx        Cabecera con balance y nav
        │
        ├── screens/          ← Pantallas de la SPA
        │   ├── LoginScreen.jsx   Acceso (login simulado, $1,000 inicial)
        │   └── Dashboard.jsx     Lobby: elegir juego + crear/unirse a mesa
        │
        └── games/            ← Tapetes de juego
            ├── BlackjackTable.jsx
            └── ViudaTable.jsx
```

---

## Flujo de la aplicación

```
LoginScreen
    ↓  (login exitoso)
Dashboard (Lobby)
    ↓  (crear o unir mesa)
BlackjackTable | ViudaTable
    ↓  (salir de mesa)
Dashboard
```

---

## Juegos

### 21 / Blackjack

- As vale **11 u 1** (se ajusta automáticamente para no pasarse)
- J, Q, K valen 10
- El dealer roba hasta llegar a **17 o más**
- **Blackjack natural** (21 en 2 cartas) paga **3:2**
- Empate devuelve la apuesta

### La Viuda

- Se reparten 5 cartas al jugador, 5 al bot y 5 a **La Viuda** (visible en el centro)
- El jugador selecciona una carta de su mano y la intercambia con:
  - Una carta de **La Viuda** (visible)
  - Una carta del **mazo** (boca abajo)
- El bot usa una **IA greedy**: prueba todos los intercambios posibles y elige el que más mejore su mano
- **"Tocar la Mesa"** termina la ronda inmediatamente y compara manos
- También termina automáticamente al agotar los 5 turnos
- Gana quien tenga la **mejor combinación de póker**

### Ranking de manos (La Viuda)

| Rank | Combinación |
|------|-------------|
| 1 | Escalera de Color |
| 2 | Póker (cuatro iguales) |
| 3 | Full House |
| 4 | Color (flush) |
| 5 | Escalera |
| 6 | Tercia |
| 7 | Dos Pares |
| 8 | Par |
| 9 | Carta Alta |

---

## Persistencia

El estado del usuario (nombre + balance) y las mesas creadas se guardan en
`localStorage` bajo las claves `rc_user_v2` y `rc_tables_v2`.

---

## Personalización

- **Fichas adicionales:** editar `CHIP_VALUES` en `BetControls.jsx` y `CHIP_CONFIG` en `PokerChip.jsx`
- **Máx. turnos en La Viuda:** cambiar `MAX_ROUNDS` en `ViudaTable.jsx`
- **Saldo inicial:** cambiar `1000` en `CasinoContext.jsx` (acción `LOGIN`)
- **Colores del tema:** variables en `src/index.css` y `tailwind.config.js`
