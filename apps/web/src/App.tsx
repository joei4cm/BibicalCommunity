import { Navigate, Route, Routes } from "react-router-dom";
import { TabBar } from "./components/TabBar";
import { BibleReader } from "./features/BibleReader";
import { PlansPage } from "./features/PlansPage";
import { HomePage } from "./features/HomePage";
import { MePage } from "./features/MePage";

export function App() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<BibleReader />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}
