import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { AppLayout } from './components/layout';
import Ticker from './components/Ticker';
import { ToastProvider } from './components/ui/Toast';
import { startOfflineQueueSync } from './utils/offlineQueue';
import { startSyncManager } from './services/SyncManager';
import { useAppStore } from './store/useAppStore';
import ErrorBoundary from './components/ErrorBoundary';
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
  const { setUser, setIsOffline, fetchTasks, logout, clearUserData } = useAppStore();
  const [authLoading, setAuthLoading] = useState(true);
  const [isFirebaseAuthed, setIsFirebaseAuthed] = useState(false);
  const previousUidRef = useRef<string | null>(null);

  // ── Centralized Firebase Auth Listener ──
  // This is the SINGLE source of truth for auth state in the entire app.
  // No other component should have its own onAuthStateChanged listener.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Cross-user detection: if a different user logs in, clear previous user's data
        if (previousUidRef.current && previousUidRef.current !== firebaseUser.uid) {
          console.log('Different user detected, clearing previous user data');
          clearUserData();
        }
        previousUidRef.current = firebaseUser.uid;

        // Update Zustand store with Firebase user info
        setUser({
          id: firebaseUser.uid,
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
          companyId: '',  // Will be populated by authApi.syncUser() in Dashboard
          role: 'EMPLOYEE',  // Default, will be updated by syncUser
        });
        setIsFirebaseAuthed(true);
      } else {
        // User signed out — only clean up if we previously had a user
        // (avoid clearing on initial app load when no session exists)
        if (previousUidRef.current) {
          logout();
          previousUidRef.current = null;
        }
        setIsFirebaseAuthed(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, logout, clearUserData]);

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
      console.log('Network: Back online — refreshing tasks from API');
      setIsOffline(false);
      if (isFirebaseAuthed) fetchTasks();
    };
    const handleOffline = () => {
      console.log('Network: Gone offline — using cached data');
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
  }, [setIsOffline, fetchTasks, isFirebaseAuthed]);

  // Show loading while Firebase resolves initial auth state
  if (authLoading) {
    return <PageLoader />;
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <ToastProvider />
        {isFirebaseAuthed && <Ticker />}
        <Suspense fallback={<PageLoader />}>
          {isFirebaseAuthed ? (
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/playlist" element={<Playlist />} />
                <Route path="/history" element={<History />} />
                <Route path="/leave" element={<LeaveRequest />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          )}
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
