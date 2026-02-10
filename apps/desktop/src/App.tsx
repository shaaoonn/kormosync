import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout';
import Ticker from './components/Ticker';
import { ToastProvider } from './components/ui/Toast';
import { startOfflineQueueSync } from './utils/offlineQueue';
import { startSyncManager } from './services/SyncManager';
import { useAppStore } from './store/useAppStore';
import './App.css';

// Lazy load ALL pages — only loads when navigated to (saves ~100-200KB initial memory)
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Playlist = lazy(() => import('./pages/Playlist'));
const History = lazy(() => import('./pages/History'));
const Settings = lazy(() => import('./pages/Settings'));
const LeaveRequest = lazy(() => import('./pages/LeaveRequest'));

// Minimal loading fallback — tiny memory footprint
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#94a3b8' }}>
    লোড হচ্ছে...
  </div>
);

function App() {
  const { setIsOffline, fetchTasks } = useAppStore();

  // Start offline queue sync — flushes queued screenshots when back online
  // Start SyncManager — handles timelogs, activity logs, and periodic sync
  useEffect(() => {
    const cleanupOffline = startOfflineQueueSync();
    const cleanupSync = startSyncManager();
    return () => {
      cleanupOffline();
      cleanupSync();
    };
  }, []);

  // Online/Offline detection — auto-refresh tasks when back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network: Back online — refreshing tasks from API');
      setIsOffline(false);
      fetchTasks(); // Re-fetch from API & update cache
    };
    const handleOffline = () => {
      console.log('📴 Network: Gone offline — using cached data');
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setIsOffline, fetchTasks]);

  return (
    <HashRouter>
      <ToastProvider />
      <Ticker />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/playlist" element={<Playlist />} />
            <Route path="/history" element={<History />} />
            <Route path="/leave" element={<LeaveRequest />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default App;
