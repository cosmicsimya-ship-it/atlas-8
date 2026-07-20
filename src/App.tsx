import { HashRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import AgentCenter from './pages/AgentCenter';
import AgentDetail from './pages/AgentDetail';
import WorkflowBuilder from './pages/WorkflowBuilder';
import QueueManager from './pages/QueueManager';
import ChannelManager from './pages/ChannelManager';
import Arsenal from './pages/Arsenal';
import AssetLibrary from './pages/AssetLibrary';
import MemoryPage from './pages/MemoryPage';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import ShortsProduction from './pages/ShortsProduction';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
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
      </Routes>
    </HashRouter>
  );
}
