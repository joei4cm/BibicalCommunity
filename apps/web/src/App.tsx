import { Navigate, Route, Routes } from "react-router-dom";
import { TabBar } from "./components/TabBar";
import { BibleReader } from "./features/BibleReader";
import { PlansPage } from "./features/PlansPage";
import { HomePage } from "./features/HomePage";
import { MePage } from "./features/MePage";
import { AdminConsole } from "./features/AdminConsole";
import { LandingPage } from "./features/LandingPage";

function AppShell() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route index element={<Navigate to="bible/cuvs/john/1" replace />} />
          {/* WeDevote-style: /app/bible/{tid}/{bookSlug}/{chapter} */}
          <Route path="bible/:tid/:bookSlug/:chapter" element={<BibleReader />} />
          <Route path="bible/:tid/:bookSlug" element={<BibleReader />} />
          <Route path="bible/:tid" element={<BibleReader />} />
          <Route path="bible" element={<Navigate to="bible/cuvs/john/1" replace />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="admin" element={<AdminConsole />} />
          <Route path="me" element={<MePage />} />
          <Route path="*" element={<Navigate to="/app/bible/cuvs/john/1" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app/*" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
