// ============================================================
// KormoSync Desktop App - Main App Component
// New redesigned app with all features integrated
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import styled, { createGlobalStyle, ThemeProvider } from 'styled-components';
import { auth } from './firebase';
import { useAppStore } from './store/useAppStore';
import { theme } from './styles/theme';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Playlist } from './pages/Playlist';
import Login from './pages/Login';

// Components
import { ToastProvider } from './components/ui/Toast';
import { MiniWidget } from './components/widget';
import { IdleDetectionModal, ProofOfWorkModal } from './components/modals';
import type { ProofOfWorkData } from './components/modals';

// Hooks
import { useIdleDetection, useScheduleChecker } from './hooks';

// Services
import { api } from './services/api';

// ============================================================
// Global Styles
// ============================================================
const GlobalStyles = createGlobalStyle`
    @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    html, body, #root {
        height: 100%;
        width: 100%;
        overflow: hidden;
    }

    body {
        font-family: ${theme.typography.fontFamily};
        background: ${theme.colors.bg.primary};
        color: ${theme.colors.text.primary};
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }

    ::-webkit-scrollbar-track {
        background: transparent;
    }

    ::-webkit-scrollbar-thumb {
        background: ${theme.colors.border.primary};
        border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: ${theme.colors.border.hover};
    }

    /* Selection */
    ::selection {
        background: ${theme.colors.primary.main}40;
        color: ${theme.colors.text.primary};
    }

    /* Focus outline */
    :focus-visible {
        outline: 2px solid ${theme.colors.primary.main};
        outline-offset: 2px;
    }
`;

// ============================================================
// Styled Components
// ============================================================
const AppContainer = styled.div`
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    background: ${theme.colors.bg.primary};
    overflow: hidden;
`;

const LoadingScreen = styled.div`
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: ${theme.colors.bg.primary};
    gap: ${theme.spacing.md};
`;

const LoadingLogo = styled.div`
    width: 80px;
    height: 80px;
    background: ${theme.colors.primary.gradient};
    border-radius: ${theme.borderRadius.xl};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    animation: pulse 2s ease-in-out infinite;

    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
`;

const LoadingText = styled.div`
    font-size: ${theme.typography.fontSize.lg};
    color: ${theme.colors.text.secondary};
`;

// ============================================================
// App Content Component
// ============================================================
const AppContent: React.FC = () => {
    const {
        activeTimers,
        tasks,
        pauseTimer,
        stopTimer,
        fetchTasks,
        addToast,
        settings,
    } = useAppStore();

    // Idle Detection
    const { isIdle, idleSeconds, resetIdle } = useIdleDetection({
        idleThreshold: settings.idleThreshold || 5 * 60,
        enabled: settings.idleDetectionEnabled !== false,
    });

    // Schedule Checker
    useScheduleChecker();

    // Idle Modal State
    const [showIdleModal, setShowIdleModal] = useState(false);

    // Proof of Work State
    const [showProofModal, setShowProofModal] = useState(false);
    const [proofData, setProofData] = useState<{
        subTaskId: string;
        taskId: string;
        trackedTime: number;
    } | null>(null);

    // Show idle modal when idle detected
    useEffect(() => {
        if (isIdle && Object.values(activeTimers).some((t) => !t.isPaused)) {
            setShowIdleModal(true);
        }
    }, [isIdle, activeTimers]);

    // Handle idle continue
    const handleIdleContinue = useCallback(() => {
        resetIdle();
        setShowIdleModal(false);
    }, [resetIdle]);

    // Handle pause all
    const handlePauseAll = useCallback(() => {
        Object.keys(activeTimers).forEach((subTaskId) => {
            if (!activeTimers[subTaskId].isPaused) {
                pauseTimer(subTaskId);
            }
        });
        setShowIdleModal(false);
        resetIdle();
        addToast('info', 'সব টাইমার বিরতি দেওয়া হয়েছে');
    }, [activeTimers, pauseTimer, resetIdle, addToast]);

    // Handle stop all
    const handleStopAll = useCallback(() => {
        Object.keys(activeTimers).forEach((subTaskId) => {
            stopTimer(subTaskId);
        });
        setShowIdleModal(false);
        resetIdle();
        addToast('info', 'সব টাইমার বন্ধ করা হয়েছে');
    }, [activeTimers, stopTimer, resetIdle, addToast]);

    // Handle proof of work submission
    const handleProofSubmit = useCallback(async (proof: ProofOfWorkData) => {
        if (!proofData) return;

        try {
            // Send to API
            await api.post('/tasks/proof-of-work', {
                subTaskId: proofData.subTaskId,
                taskId: proofData.taskId,
                trackedTime: proofData.trackedTime,
                ...proof,
            });

            addToast('success', 'কাজের প্রমাণ জমা হয়েছে');
        } catch (error) {
            console.error('Failed to submit proof of work:', error);
            addToast('error', 'প্রমাণ জমা দিতে সমস্যা হয়েছে');
        }

        setProofData(null);
        setShowProofModal(false);
    }, [proofData, addToast]);

    // Get task and subtask for proof modal
    const proofTask = proofData ? tasks.find((t) => t.id === proofData.taskId) : null;
    const proofSubTask = proofTask?.subTasks?.find((st) => st.id === proofData?.subTaskId);

    return (
        <AppContainer>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/playlist" element={<Playlist />} />
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Toast Notifications */}
            <ToastProvider />

            {/* Mini Widget */}
            <MiniWidget />

            {/* Idle Detection Modal */}
            <IdleDetectionModal
                isOpen={showIdleModal}
                idleSeconds={idleSeconds}
                onContinue={handleIdleContinue}
                onPauseAll={handlePauseAll}
                onStopAll={handleStopAll}
            />

            {/* Proof of Work Modal */}
            <ProofOfWorkModal
                isOpen={showProofModal}
                onClose={() => setShowProofModal(false)}
                subTask={proofSubTask || null}
                task={proofTask || null}
                trackedTime={proofData?.trackedTime || 0}
                onSubmit={handleProofSubmit}
            />
        </AppContainer>
    );
};

// ============================================================
// Main App Component
// ============================================================
const App: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const { fetchTasks, setUser } = useAppStore();

    // Check authentication
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                setIsAuthenticated(true);
                setUser({
                    id: user.uid,
                    email: user.email || '',
                    name: user.displayName || '',
                    avatar: user.photoURL || '',
                });

                // Fetch tasks
                try {
                    await fetchTasks();
                } catch (error) {
                    console.error('Failed to fetch tasks:', error);
                }
            } else {
                setIsAuthenticated(false);
                setUser(null);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [fetchTasks, setUser]);

    // Request notification permission
    useEffect(() => {
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    if (isLoading) {
        return (
            <>
                <GlobalStyles />
                <LoadingScreen>
                    <LoadingLogo>⚡</LoadingLogo>
                    <LoadingText>লোড হচ্ছে...</LoadingText>
                </LoadingScreen>
            </>
        );
    }

    return (
        <>
            <GlobalStyles />
            <Router>
                {isAuthenticated ? (
                    <AppContent />
                ) : (
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                )}
            </Router>
        </>
    );
};

export default App;
