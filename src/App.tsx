import { useEffect } from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";

import Landing from "./pages/Landing";
import AnalysisFlow from "./pages/AnalysisFlow";
import AnalysisResult from "./pages/AnalysisResult";
import SymbolicAnalysisPage from "./pages/SymbolicAnalysisPage";
import ArchivePage from "./pages/ArchivePage";
import AboutPage from "./pages/AboutPage";
import AdminPage from "./pages/AdminPage";
import Dashboard from "./pages/Dashboard";
import AgentCenter from "./pages/AgentCenter";
import AgentDetail from "./pages/AgentDetail";
import WorkflowBuilder from "./pages/WorkflowBuilder";
import QueueManager from "./pages/QueueManager";
import ChannelManager from "./pages/ChannelManager";
import Arsenal from "./pages/Arsenal";
import AssetLibrary from "./pages/AssetLibrary";
import MemoryPage from "./pages/MemoryPage";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import ShortsProduction from "./pages/ShortsProduction";
import Chat from "./pages/Chat";
import BillingResultPage from "./pages/BillingResultPage";
import LaraPrimePage from "./pages/LaraPrimePage";

/** A new surface always opens at its beginning — unless it targets a section. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="analysis" element={<AnalysisFlow />} />
        <Route path="analysis/symbolic" element={<SymbolicAnalysisPage />} />
        <Route path="analysis/result/:id" element={<AnalysisResult />} />
        <Route path="archive" element={<ArchivePage />} />
        <Route path="atlas" element={<Chat />} />
        <Route path="chat" element={<Navigate to="/atlas" replace />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="lara-prime" element={<LaraPrimePage />} />
        <Route path="billing/result" element={<BillingResultPage />} />
        <Route path="admin" element={<AdminPage />} />

        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="agents" element={<AgentCenter />} />
          <Route path="agents/:agentId" element={<AgentDetail />} />
          <Route path="workflows" element={<WorkflowBuilder />} />
          <Route path="produce" element={<ShortsProduction />} />
          <Route path="queue" element={<QueueManager />} />
          <Route path="channels" element={<ChannelManager />} />
          <Route path="arsenal" element={<Arsenal />} />
          <Route path="assets" element={<AssetLibrary />} />
          <Route path="memory" element={<MemoryPage />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
