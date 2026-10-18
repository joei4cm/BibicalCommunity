import { Navigate, Route, Routes } from "react-router-dom";
import { AuthGate } from "./components/AuthGate";
import { TabBar } from "./components/TabBar";
import { BibleReader } from "./features/BibleReader";
import { CallProvider } from "./features/CallProvider";
import { PlansPage } from "./features/PlansPage";
import { HomePage } from "./features/HomePage";
import { ChatPage } from "./features/ChatPage";
import { MePage } from "./features/MePage";
import { AdminConsole } from "./features/AdminConsole";
import { LandingPage } from "./features/LandingPage";
import { LoginPage } from "./features/LoginPage";
import { readerHomePath } from "./lib/reader-place";

function ReaderEntry() {
  const path = readerHomePath().replace(/^\/app\//, "");
  return <Navigate to={path} replace />;
}

/** Consumer app: Bible / Plans / Chat / Community / Me + bottom tabs. */
function AppShell() {
  return (
    <AuthGate>
      <CallProvider>
        <div className="app-shell">
          <main className="app-main">
            <Routes>
              <Route index element={<ReaderEntry />} />
              <Route path="bible/:tid/:bookSlug/:chapter" element={<BibleReader />} />
              <Route path="bible/:tid/:bookSlug" element={<BibleReader />} />
              <Route path="bible/:tid" element={<BibleReader />} />
              <Route path="bible" element={<ReaderEntry />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="home" element={<HomePage />} />
              <Route path="me" element={<MePage />} />
              <Route path="*" element={<Navigate to="/app/bible/cuvs/john/1" replace />} />
            </Routes>
          </main>
          <TabBar />
        </div>
      </CallProvider>
    </AuthGate>
  );
}

/** Desktop ops console: no consumer TabBar; full-width workbench. */
function AdminShell() {
  return (
    <AuthGate>
      <div className="admin-shell" data-testid="admin-shell">
        <AdminConsole />
      </div>
    </AuthGate>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app/login" element={<LoginPage />} />
      <Route path="/app/admin/*" element={<AdminShell />} />
      <Route path="/app/admin" element={<AdminShell />} />
      <Route path="/app/*" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
