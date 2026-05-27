import { CasinoProvider, useCasino } from "./context/CasinoContext";
import LoginScreen    from "./components/screens/LoginScreen";
import Dashboard      from "./components/screens/Dashboard";
import BlackjackTable from "./components/games/21";
import ViudaTable     from "./components/games/ViudaTable";
import "./index.css";

function AppContent() {
  const { user, activeTable, authChecked } = useCasino();

  if (!authChecked) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--surface-1)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        {/* Spinner animado */}
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          border: "3px solid rgba(212,175,55,0.15)",
          borderTopColor: "var(--gold)",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>
          Conectando al casino…
        </p>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (activeTable?.game === "21")    return <BlackjackTable />;
  if (activeTable?.game === "viuda") return <ViudaTable />;

  return <Dashboard />;
}

export default function App() {
  return (
    <CasinoProvider>
      <AppContent />
    </CasinoProvider>
  );
}
