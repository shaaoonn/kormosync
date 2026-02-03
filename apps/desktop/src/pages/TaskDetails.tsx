import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import axios from 'axios';
import ProofOfWorkModal from '../components/ProofOfWorkModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// ==========================================
// Types
// ==========================================
interface SubTask {
    id: string;
    title: string;
    description?: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    totalSeconds: number;
    isActive: boolean;
    currentSessionSeconds: number;
    orderIndex: number;
    // Schedule info from backend
    scheduleStatus?: 'locked' | 'active' | 'starting_soon' | 'ended' | 'no_schedule';
    scheduleLabel?: string;
    scheduleCountdown?: string;
    canStart?: boolean;
    endsInSeconds?: number;
    startTime?: string;
    endTime?: string;
    // Budget info
    estimatedHours?: number;
    budgetSeconds?: number | null;
    remainingBudgetSeconds?: number | null;
}

interface Task {
    id: string;
    title: string;
    description?: string;
    screenshotInterval?: number;
    subTasks: SubTask[];
}

// ==========================================
// Utility Functions
// ==========================================
const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const formatBudget = (seconds: number | null | undefined): string => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};


// ==========================================
// Main Component
// ==========================================
export default function TaskDetails() {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();

    const [task, setTask] = useState<Task | null>(null);
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [activeSubTaskId, setActiveSubTaskId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Auto-stop modal state
    const [showProofOfWorkModal, setShowProofOfWorkModal] = useState(false);
    const [autoStopSubTaskId, setAutoStopSubTaskId] = useState<string | null>(null);
    const [autoStopSubTaskTitle, setAutoStopSubTaskTitle] = useState('');

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ==========================================
    // Fetch Task & Sub-tasks
    // ==========================================
    useEffect(() => {
        const fetchData = async () => {
            try {
                const user = auth.currentUser;
                if (!user || !taskId) return;

                const token = await user.getIdToken();

                // Fetch task details
                const taskRes = await axios.get(`${API_URL}/tasks/${taskId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (taskRes.data.success) {
                    setTask(taskRes.data.task);
                }

                // Fetch sub-tasks with time info
                const subTasksRes = await axios.get(`${API_URL}/subtasks/task/${taskId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (subTasksRes.data.success) {
                    setSubTasks(subTasksRes.data.subTasks);
                    setActiveSubTaskId(subTasksRes.data.activeSubTaskId);
                }

                setLoading(false);
            } catch (error) {
                console.error('Failed to fetch task:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [taskId]);

    // ==========================================
    // Poll for Active Sub-Task (Sync with Web Dashboard)
    // ==========================================
    useEffect(() => {
        const pollActiveSubTask = async () => {
            try {
                const user = auth.currentUser;
                if (!user || !taskId) return;

                const token = await user.getIdToken();

                // Fetch current active sub-task for this user
                const res = await axios.get(`${API_URL}/subtasks/active`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.success) {
                    const serverActiveSubTask = res.data.activeSubTask;

                    // Check if active sub-task changed (started from web)
                    if (serverActiveSubTask && serverActiveSubTask.task?.id === taskId) {
                        // Web started a sub-task in this task
                        if (serverActiveSubTask.id !== activeSubTaskId) {
                            console.log('Web sync: Sub-task started from web dashboard');
                            setActiveSubTaskId(serverActiveSubTask.id);
                            setSubTasks(prev => prev.map(st => ({
                                ...st,
                                isActive: st.id === serverActiveSubTask.id,
                                currentSessionSeconds: st.id === serverActiveSubTask.id
                                    ? serverActiveSubTask.currentSessionSeconds
                                    : 0
                            })));

                            // Notify main process
                            window.electron?.trackingStarted?.({
                                taskName: task?.title || 'Unknown',
                                taskId: taskId,
                                subTaskId: serverActiveSubTask.id,
                                subTaskName: serverActiveSubTask.title,
                                endTime: serverActiveSubTask.endTime
                            });
                        }
                    } else if (!serverActiveSubTask && activeSubTaskId) {
                        // Web stopped the sub-task
                        const wasActiveInThisTask = subTasks.some(st => st.id === activeSubTaskId);
                        if (wasActiveInThisTask) {
                            console.log('Web sync: Sub-task stopped from web dashboard');
                            setActiveSubTaskId(null);
                            setSubTasks(prev => prev.map(st => ({
                                ...st,
                                isActive: false,
                                totalSeconds: st.id === activeSubTaskId
                                    ? st.totalSeconds + st.currentSessionSeconds
                                    : st.totalSeconds,
                                currentSessionSeconds: 0
                            })));
                            window.electron?.trackingStopped?.();
                        }
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        };

        // Poll every 30 seconds
        const pollInterval = setInterval(pollActiveSubTask, 30000);

        return () => clearInterval(pollInterval);
    }, [taskId, activeSubTaskId, subTasks, task]);

    // ==========================================
    // Timer Tick (for active sub-task)
    // ==========================================
    useEffect(() => {
        if (activeSubTaskId) {
            timerRef.current = setInterval(() => {
                setSubTasks(prev => prev.map(st => {
                    if (st.id === activeSubTaskId) {
                        return { ...st, currentSessionSeconds: st.currentSessionSeconds + 1 };
                    }
                    return st;
                }));
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [activeSubTaskId]);

    // ==========================================
    // Screenshot Interval Logic
    // ==========================================
    useEffect(() => {
        let screenshotTimer: ReturnType<typeof setInterval> | null = null;

        const captureAndUpload = async () => {
            if (!activeSubTaskId || !task) return;

            try {
                console.log('📸 Capturing screenshot...');

                // 1. Get Activity Stats (and reset counters in main process)
                const stats = await window.electron.getActivityStats();

                // 2. Capture Screenshot (Base64)
                const base64Image = await window.electron.captureScreenshot();

                // 3. Convert Base64 to Blob
                const byteCharacters = atob(base64Image);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });

                // 4. Upload to API
                const formData = new FormData();
                formData.append('image', blob, 'screenshot.png');
                formData.append('taskId', taskId!);
                formData.append('keystrokes', stats.keystrokes.toString());
                formData.append('mouseClicks', stats.mouseClicks.toString());
                formData.append('activeSeconds', (task.screenshotInterval ? task.screenshotInterval * 60 : 300).toString());

                // Get current subTask ID? Controller uses taskId to link. 
                // We might want to link subTask too if DB supports it, but controller uses taskId.

                const user = auth.currentUser;
                if (!user) return;
                const token = await user.getIdToken();

                await axios.post(`${API_URL}/upload/screenshot`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });

                console.log('✅ Screenshot uploaded successfully');

            } catch (error) {
                console.error('❌ Failed to upload screenshot:', error);
            }
        };

        if (activeSubTaskId && task) {
            const intervalMinutes = task.screenshotInterval || 10;
            // First capture immediately? No, wait for interval.
            // Or maybe randomize? For now, strict interval.
            console.log(`⏱️ Screenshot timer set for ${intervalMinutes} minutes`);
            screenshotTimer = setInterval(captureAndUpload, intervalMinutes * 60 * 1000);
        }

        return () => {
            if (screenshotTimer) clearInterval(screenshotTimer);
        };
    }, [activeSubTaskId, task, taskId]);

    // ==========================================
    // Listen for Schedule Auto-Stop from Main Process
    // ==========================================
    useEffect(() => {
        const handleAutoStop = (data: { taskName: string; reason: string }) => {
            console.log('Schedule auto-stop received:', data);
            // Find the active sub-task and trigger the modal
            if (activeSubTaskId) {
                const activeSubTask = subTasks.find(st => st.id === activeSubTaskId);
                if (activeSubTask) {
                    setAutoStopSubTaskId(activeSubTaskId);
                    setAutoStopSubTaskTitle(activeSubTask.title);
                    setShowProofOfWorkModal(true);
                }
            }
        };

        // Register listener
        window.electron?.onScheduleAutoStop?.(handleAutoStop);

        // Cleanup is handled by the IPC listener mechanism
    }, [activeSubTaskId, subTasks]);

    // ==========================================
    // Handle Proof of Work Submission (Auto-Stop)
    // ==========================================
    const handleProofOfWorkSubmit = async (proofOfWork: string) => {
        if (!autoStopSubTaskId) return;

        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();

            // Call auto-stop API
            await axios.post(
                `${API_URL}/subtasks/${autoStopSubTaskId}/auto-stop`,
                { proofOfWork },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local state - stop the sub-task
            setSubTasks(prev => prev.map(st => {
                if (st.id === autoStopSubTaskId) {
                    return {
                        ...st,
                        isActive: false,
                        status: 'PENDING',
                        totalSeconds: st.totalSeconds + st.currentSessionSeconds,
                        currentSessionSeconds: 0
                    };
                }
                return st;
            }));
            setActiveSubTaskId(null);

            // Notify main process
            window.electron?.trackingStopped?.();

            // Close modal
            setShowProofOfWorkModal(false);
            setAutoStopSubTaskId(null);
            setAutoStopSubTaskTitle('');
        } catch (error) {
            console.error('Failed to auto-stop sub-task:', error);
            // Still close the modal on error
            setShowProofOfWorkModal(false);
        }
    };

    // ==========================================
    // Actions
    // ==========================================
    const startSubTask = async (subTaskId: string) => {
        try {
            setActionLoading(subTaskId);
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const res = await axios.post(
                `${API_URL}/subtasks/${subTaskId}/start`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                // Update local state
                setSubTasks(prev => prev.map(st => ({
                    ...st,
                    isActive: st.id === subTaskId,
                    status: st.id === subTaskId ? 'IN_PROGRESS' : (st.isActive ? 'PENDING' : st.status),
                    currentSessionSeconds: st.id === subTaskId ? 0 : st.currentSessionSeconds,
                    // If was active, add current session to total
                    totalSeconds: st.isActive && st.id !== subTaskId
                        ? st.totalSeconds + st.currentSessionSeconds
                        : st.totalSeconds
                })));
                setActiveSubTaskId(subTaskId);

                // Notify main process
                window.electron?.trackingStarted?.({
                    taskName: task?.title || 'Unknown',
                    taskId: taskId!,
                    subTaskId,
                    subTaskName: subTasks.find(st => st.id === subTaskId)?.title
                });
            }
        } catch (error) {
            console.error('Failed to start sub-task:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const stopSubTask = async (subTaskId: string) => {
        try {
            setActionLoading(subTaskId);
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const res = await axios.post(
                `${API_URL}/subtasks/${subTaskId}/stop`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                setSubTasks(prev => prev.map(st => {
                    if (st.id === subTaskId) {
                        return {
                            ...st,
                            isActive: false,
                            status: 'PENDING',
                            totalSeconds: st.totalSeconds + st.currentSessionSeconds,
                            currentSessionSeconds: 0
                        };
                    }
                    return st;
                }));
                setActiveSubTaskId(null);

                window.electron?.trackingStopped?.();
            }
        } catch (error) {
            console.error('Failed to stop sub-task:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const completeSubTask = async (subTaskId: string) => {
        try {
            setActionLoading(subTaskId);
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const res = await axios.post(
                `${API_URL}/subtasks/${subTaskId}/complete`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                setSubTasks(prev => prev.map(st => {
                    if (st.id === subTaskId) {
                        return {
                            ...st,
                            isActive: false,
                            status: 'COMPLETED',
                            totalSeconds: st.totalSeconds + st.currentSessionSeconds,
                            currentSessionSeconds: 0
                        };
                    }
                    return st;
                }));
                if (activeSubTaskId === subTaskId) {
                    setActiveSubTaskId(null);
                    window.electron?.trackingStopped?.();
                }
            }
        } catch (error) {
            console.error('Failed to complete sub-task:', error);
        } finally {
            setActionLoading(null);
        }
    };

    // Calculate global timer (sum of all sub-tasks)
    const globalTime = subTasks.reduce((acc, st) => {
        return acc + st.totalSeconds + (st.isActive ? st.currentSessionSeconds : 0);
    }, 0);

    // ==========================================
    // Render
    // ==========================================
    if (loading) {
        return (
            <div className="h-screen bg-[#0f172a] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-gray-600 border-t-yellow-400 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-screen bg-[#0f172a] text-white flex flex-col">
            {/* Header */}
            <header className="p-6 border-b border-gray-800 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="text-gray-400 hover:text-white text-sm mb-2"
                        >
                            ← ড্যাশবোর্ডে ফিরুন
                        </button>
                        <h1 className="text-2xl font-bold">{task?.title || 'টাস্ক'}</h1>
                    </div>

                    <div className="text-right">
                        <p className="text-sm text-gray-400 mb-1">মোট সময়</p>
                        <p className="text-4xl font-mono font-bold text-yellow-400">
                            {formatTime(globalTime)}
                        </p>
                    </div>
                </div>

                {/* Finish Project Button */}
                <button
                    className="mt-4 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold w-full text-lg"
                    onClick={() => navigate('/dashboard')}
                >
                    প্রজেক্ট শেষ করুন
                </button>
            </header>

            {/* Sub-task List */}
            <main className="flex-1 overflow-y-auto p-6 space-y-4">
                {subTasks.length === 0 ? (
                    <div className="text-center text-gray-400 py-10">
                        <p>কোনো সাব-টাস্ক নেই</p>
                    </div>
                ) : (
                    subTasks.map((st, idx) => (
                        <div
                            key={st.id}
                            className={`p-4 rounded-xl transition-all ${st.isActive
                                ? 'bg-[#1e293b] border-2 border-yellow-500 shadow-lg shadow-yellow-500/20'
                                : st.status === 'COMPLETED'
                                    ? 'bg-[#1e293b]/50 border border-green-800'
                                    : st.canStart === false
                                        ? 'bg-[#1e293b]/70 border border-gray-600'
                                        : 'bg-[#1e293b] border border-gray-700'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                {/* Left: Status + Title + Schedule Badge */}
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* Status Indicator */}
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${st.status === 'COMPLETED'
                                        ? 'bg-green-500'
                                        : st.isActive
                                            ? 'bg-yellow-400 animate-pulse'
                                            : st.canStart === false
                                                ? 'bg-gray-600'
                                                : 'bg-gray-500'
                                        }`} />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`font-medium truncate ${st.status === 'COMPLETED' ? 'line-through text-gray-400' : ''}`}>
                                                {idx + 1}. {st.title}
                                            </p>
                                            {/* Schedule Badge */}
                                            {st.scheduleStatus && st.scheduleStatus !== 'no_schedule' && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${st.scheduleStatus === 'active' ? 'bg-green-900/50 text-green-400' :
                                                    st.scheduleStatus === 'starting_soon' ? 'bg-yellow-900/50 text-yellow-400' :
                                                        st.scheduleStatus === 'locked' ? 'bg-gray-800 text-gray-400' :
                                                            'bg-red-900/50 text-red-400'
                                                    }`}>
                                                    {st.scheduleStatus === 'locked' && '🔒'}
                                                    {st.scheduleStatus === 'active' && '🟢'}
                                                    {st.scheduleStatus === 'starting_soon' && '⏰'}
                                                    {' '}{st.scheduleLabel}
                                                </span>
                                            )}
                                        </div>
                                        {/* Budget Info */}
                                        {st.budgetSeconds && (
                                            <div className="flex items-center gap-3 mt-1 text-xs">
                                                <span className="text-gray-500">
                                                    বাজেট: <span className="text-blue-400">{formatBudget(st.budgetSeconds)}</span>
                                                </span>
                                                <span className="text-gray-500">
                                                    বাকি: <span className={st.remainingBudgetSeconds && st.remainingBudgetSeconds < 3600 ? 'text-red-400' : 'text-gray-400'}>
                                                        {formatBudget(st.remainingBudgetSeconds)}
                                                    </span>
                                                </span>
                                            </div>
                                        )}
                                        {st.description && !st.budgetSeconds && (
                                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                                                {st.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Timer + Controls */}
                                <div className="flex items-center gap-4 flex-shrink-0">
                                    {/* Timer */}
                                    <div className={`font-mono text-lg ${st.isActive ? 'text-yellow-400' : 'text-gray-400'}`}>
                                        {formatTime(st.totalSeconds + (st.isActive ? st.currentSessionSeconds : 0))}
                                    </div>

                                    {/* Controls */}
                                    <div className="flex items-center gap-2">
                                        {st.status !== 'COMPLETED' && (
                                            <>
                                                {st.isActive ? (
                                                    <button
                                                        onClick={() => stopSubTask(st.id)}
                                                        disabled={actionLoading === st.id}
                                                        className="w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-full text-white disabled:opacity-50"
                                                    >
                                                        ⏹
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => startSubTask(st.id)}
                                                        disabled={actionLoading === st.id || st.canStart === false}
                                                        className={`w-10 h-10 flex items-center justify-center rounded-full text-white disabled:opacity-50 ${st.canStart === false
                                                            ? 'bg-gray-600 cursor-not-allowed'
                                                            : 'bg-green-600 hover:bg-green-700'
                                                            }`}
                                                        title={st.canStart === false ? st.scheduleLabel || 'সময়সূচীর বাইরে' : 'শুরু করুন'}
                                                    >
                                                        {st.canStart === false ? '🔒' : '▶'}
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => completeSubTask(st.id)}
                                                    disabled={actionLoading === st.id}
                                                    className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full text-white disabled:opacity-50"
                                                    title="সম্পন্ন করুন"
                                                >
                                                    ✓
                                                </button>
                                            </>
                                        )}

                                        {st.status === 'COMPLETED' && (
                                            <span className="px-3 py-1 bg-green-900/50 text-green-400 text-sm rounded-full">
                                                ✓ সম্পন্ন
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </main>

            {/* Proof of Work Modal for Auto-Stop */}
            <ProofOfWorkModal
                isOpen={showProofOfWorkModal}
                subTaskTitle={autoStopSubTaskTitle}
                onSubmit={handleProofOfWorkSubmit}
                onClose={() => setShowProofOfWorkModal(false)}
            />
        </div>
    );
}

