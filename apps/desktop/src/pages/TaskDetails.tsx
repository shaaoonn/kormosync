import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import axios from 'axios';
import ProofOfWorkModal from '../components/ProofOfWorkModal';
import { noteApi } from '../services/api';
import type { TaskNote } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

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
    scheduleStatus?: 'locked' | 'active' | 'starting_soon' | 'ended' | 'no_schedule';
    scheduleLabel?: string;
    scheduleCountdown?: string;
    canStart?: boolean;
    endsInSeconds?: number;
    startTime?: string;
    endTime?: string;
    estimatedHours?: number;
    budgetSeconds?: number | null;
    remainingBudgetSeconds?: number | null;
}

interface TaskChecklist {
    id: string;
    title: string;
    isCompleted: boolean;
    orderIndex: number;
}

interface Task {
    id: string;
    title: string;
    description?: string;
    screenshotInterval?: number;
    subTasks: SubTask[];
    maxBudget?: number;
    allowOvertime?: boolean;
    isRecurring?: boolean;
    recurringType?: string;
    checklist?: TaskChecklist[];
    status?: string;
    // Phase 10
    employeeCanComplete?: boolean;
    breakReminderEnabled?: boolean;
    breakAfterHours?: number;
    attachments?: string[];
    resourceLinks?: string[];
    videoUrl?: string;
    deadline?: string;
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

const getFileIcon = (url: string): string => {
    const ext = url.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['zip', 'rar', '7z'].includes(ext)) return '📦';
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return '🎬';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return '🎵';
    return '📎';
};

const getFileName = (url: string): string => {
    const parts = url.split('/');
    return decodeURIComponent(parts[parts.length - 1] || 'file');
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

    // Notes state
    const [notes, setNotes] = useState<TaskNote[]>([]);
    const [newNote, setNewNote] = useState('');
    const [notesLoading, setNotesLoading] = useState(false);

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

                // Fetch notes
                try {
                    const taskNotes = await noteApi.getByTask(taskId);
                    setNotes(taskNotes);
                } catch {
                    console.error('Failed to fetch notes');
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
    // Poll for Active Sub-Task
    // ==========================================
    useEffect(() => {
        const pollActiveSubTask = async () => {
            try {
                const user = auth.currentUser;
                if (!user || !taskId) return;

                const token = await user.getIdToken();
                const res = await axios.get(`${API_URL}/subtasks/active`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.success) {
                    const serverActiveSubTask = res.data.activeSubTask;

                    if (serverActiveSubTask && serverActiveSubTask.task?.id === taskId) {
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

                            window.electron?.trackingStarted?.({
                                taskName: task?.title || 'Unknown',
                                taskId: taskId,
                                subTaskId: serverActiveSubTask.id,
                                subTaskName: serverActiveSubTask.title,
                                endTime: serverActiveSubTask.endTime
                            });
                        }
                    } else if (!serverActiveSubTask && activeSubTaskId) {
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

        const pollInterval = setInterval(pollActiveSubTask, 30000);
        return () => clearInterval(pollInterval);
    }, [taskId, activeSubTaskId, subTasks, task]);

    // ==========================================
    // Timer Tick
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
                console.log('Capturing screenshot...');
                const stats = await window.electron.getActivityStats();
                const base64Image = await window.electron.captureScreenshot();

                const byteCharacters = atob(base64Image);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });

                const formData = new FormData();
                formData.append('image', blob, 'screenshot.png');
                formData.append('taskId', taskId!);
                formData.append('keystrokes', stats.keystrokes.toString());
                formData.append('mouseClicks', stats.mouseClicks.toString());
                formData.append('activeSeconds', (task.screenshotInterval ? task.screenshotInterval * 60 : 300).toString());

                const user = auth.currentUser;
                if (!user) return;
                const token = await user.getIdToken();

                await axios.post(`${API_URL}/upload/screenshot`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });

                console.log('Screenshot uploaded successfully');
                await window.electron.resetActivityStats();
            } catch (error) {
                console.error('Failed to upload screenshot:', error);
            }
        };

        if (activeSubTaskId && task) {
            const intervalMinutes = task.screenshotInterval || 10;
            console.log(`Screenshot timer set for ${intervalMinutes} minutes`);
            screenshotTimer = setInterval(captureAndUpload, intervalMinutes * 60 * 1000);
        }

        return () => {
            if (screenshotTimer) clearInterval(screenshotTimer);
        };
    }, [activeSubTaskId, task, taskId]);

    // ==========================================
    // Listen for Schedule Auto-Stop
    // ==========================================
    useEffect(() => {
        const handleAutoStop = (data: { taskName: string; reason: string }) => {
            console.log('Schedule auto-stop received:', data);
            if (activeSubTaskId) {
                const activeSubTask = subTasks.find(st => st.id === activeSubTaskId);
                if (activeSubTask) {
                    setAutoStopSubTaskId(activeSubTaskId);
                    setAutoStopSubTaskTitle(activeSubTask.title);
                    setShowProofOfWorkModal(true);
                }
            }
        };

        window.electron?.onScheduleAutoStop?.(handleAutoStop);
    }, [activeSubTaskId, subTasks]);

    // ==========================================
    // Handle Proof of Work Submission
    // ==========================================
    const handleProofOfWorkSubmit = async (proofOfWork: string) => {
        if (!autoStopSubTaskId) return;

        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            await axios.post(
                `${API_URL}/subtasks/${autoStopSubTaskId}/auto-stop`,
                { proofOfWork },
                { headers: { Authorization: `Bearer ${token}` } }
            );

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
            window.electron?.trackingStopped?.();
            setShowProofOfWorkModal(false);
            setAutoStopSubTaskId(null);
            setAutoStopSubTaskTitle('');
        } catch (error) {
            console.error('Failed to auto-stop sub-task:', error);
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
                setSubTasks(prev => prev.map(st => ({
                    ...st,
                    isActive: st.id === subTaskId,
                    status: st.id === subTaskId ? 'IN_PROGRESS' : (st.isActive ? 'PENDING' : st.status),
                    currentSessionSeconds: st.id === subTaskId ? 0 : st.currentSessionSeconds,
                    totalSeconds: st.isActive && st.id !== subTaskId
                        ? st.totalSeconds + st.currentSessionSeconds
                        : st.totalSeconds
                })));
                setActiveSubTaskId(subTaskId);

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

    // ==========================================
    // Notes Actions
    // ==========================================
    const handleAddNote = async () => {
        if (!newNote.trim() || !taskId) return;
        setNotesLoading(true);
        try {
            const note = await noteApi.create(taskId, newNote.trim());
            setNotes(prev => [note, ...prev]);
            setNewNote('');
        } catch (error) {
            console.error('Failed to add note:', error);
        } finally {
            setNotesLoading(false);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        try {
            await noteApi.delete(noteId);
            setNotes(prev => prev.filter(n => n.id !== noteId));
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    };

    // ==========================================
    // File Download
    // ==========================================
    const handleDownload = async (url: string) => {
        const fullUrl = url.startsWith('http') ? url : `${API_URL.replace('/api', '')}/${url}`;

        // Try native Electron download first (shows save dialog)
        if (window.electron?.downloadFile) {
            const ext = url.split('.').pop()?.split('?')[0] || 'file';
            const filename = `attachment-${Date.now()}.${ext}`;
            try {
                const result = await window.electron.downloadFile({ url: fullUrl, filename });
                if (result.success) {
                    console.log('File downloaded to:', result.path);
                    return;
                }
                if (result.canceled) return; // User cancelled — do nothing
                // Download failed — fallback to browser
            } catch (err) {
                console.error('Download failed, opening in browser:', err);
            }
        }

        // Fallback: open in browser
        window.electron?.openExternal?.(fullUrl);
    };

    // Calculate global timer
    const globalTime = subTasks.reduce((acc, st) => {
        return acc + st.totalSeconds + (st.isActive ? st.currentSessionSeconds : 0);
    }, 0);

    // Check if task is DONE
    const isDone = task?.status === 'DONE';
    const canEmployeeComplete = task?.employeeCanComplete !== false;

    // ==========================================
    // Render
    // ==========================================
    if (loading) {
        return (
            <div className="h-screen bg-[#111827] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-gray-600 border-t-yellow-400 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-screen bg-[#111827] text-white flex flex-col">
            {/* Header */}
            <header className="p-6 border-b border-gray-700 flex-shrink-0 bg-[#1e293b]">
                <div className="flex items-center justify-between">
                    <div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="text-gray-400 hover:text-white text-sm mb-2"
                        >
                            &larr; ড্যাশবোর্ডে ফিরুন
                        </button>
                        <h1 className="text-2xl font-bold">{task?.title || 'টাস্ক'}</h1>
                        <div className="flex gap-2 mt-1 flex-wrap">
                            {task?.allowOvertime && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">⏰ ওভারটাইম</span>
                            )}
                            {task?.isRecurring && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">🔄 {task.recurringType === 'DAILY' ? 'দৈনিক' : task.recurringType === 'WEEKLY' ? 'সাপ্তাহিক' : 'মাসিক'}</span>
                            )}
                            {task?.maxBudget && task.maxBudget > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/40">💰 ৳{task.maxBudget.toLocaleString()}</span>
                            )}
                            {task?.status === 'REVIEW' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40">🔍 রিভিউ</span>
                            )}
                            {isDone && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/40">✅ সম্পন্ন</span>
                            )}
                            {task?.breakReminderEnabled && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40">🧘 বিরতি: {task.breakAfterHours || 2}ঘ পর</span>
                            )}
                            {task?.deadline && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40">📅 ডেডলাইন: {new Date(task.deadline).toLocaleDateString('bn-BD')}</span>
                            )}
                        </div>
                    </div>

                    <div className="text-right">
                        <p className="text-sm text-gray-400 mb-1">মোট সময়</p>
                        <p className="text-4xl font-mono font-bold text-yellow-400">
                            {formatTime(globalTime)}
                        </p>
                    </div>
                </div>

                {/* Complete Button — only if admin allows AND task is not done */}
                {canEmployeeComplete && !isDone && (
                    <button
                        className="mt-4 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold w-full text-lg"
                        onClick={() => navigate('/dashboard')}
                    >
                        প্রজেক্ট শেষ করুন
                    </button>
                )}
                {!canEmployeeComplete && !isDone && (
                    <div className="mt-4 px-6 py-3 bg-gray-700 rounded-lg text-center text-gray-400 text-sm">
                        🔒 এই কাজ শুধু এডমিন শেষ করতে পারবে
                    </div>
                )}
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Attachments Section */}
                {task?.attachments && task.attachments.length > 0 && (
                    <div className="p-4 bg-[#1e293b] rounded-xl border border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-400 mb-3">📎 ফাইলসমূহ ({task.attachments.length})</h3>
                        <div className="space-y-2">
                            {task.attachments.map((url, i) => {
                                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url.split('?')[0]);
                                return (
                                    <div key={i} className="flex items-center justify-between p-2 bg-[#334155] rounded-lg hover:bg-[#475569] transition-colors">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {isImage ? (
                                                <img src={url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                            ) : (
                                                <span className="text-lg">{getFileIcon(url)}</span>
                                            )}
                                            <span className="text-sm text-gray-300 truncate">{getFileName(url)}</span>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => handleDownload(url)}
                                                className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/40 rounded-md text-xs font-medium hover:bg-blue-600/30"
                                            >
                                                ⬇️ ডাউনলোড
                                            </button>
                                            <button
                                                onClick={() => window.electron?.openExternal?.(url.startsWith('http') ? url : `${API_URL.replace('/api', '')}/${url}`)}
                                                className="px-2 py-1 bg-gray-600/20 text-gray-400 border border-gray-500/40 rounded-md text-xs hover:bg-gray-600/30"
                                                title="ব্রাউজারে খুলুন"
                                            >
                                                🔗
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {task.videoUrl && (
                            <div className="mt-2 flex items-center justify-between p-2 bg-[#334155] rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🎬</span>
                                    <span className="text-sm text-gray-300">ভিডিও</span>
                                </div>
                                <button
                                    onClick={() => handleDownload(task.videoUrl!)}
                                    className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/40 rounded-md text-xs font-medium hover:bg-blue-600/30"
                                >
                                    ▶️ দেখুন
                                </button>
                            </div>
                        )}
                        {task.resourceLinks && task.resourceLinks.length > 0 && (
                            <div className="mt-3">
                                <h4 className="text-xs text-gray-500 mb-1">🔗 রিসোর্স লিংক</h4>
                                {task.resourceLinks.map((link, i) => (
                                    <button
                                        key={i}
                                        onClick={() => window.electron?.openExternal?.(link)}
                                        className="block text-sm text-blue-400 hover:text-blue-300 truncate mb-1"
                                    >
                                        {link}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Read-Only Checklist */}
                {task?.checklist && task.checklist.length > 0 && (
                    <div className="p-4 bg-[#1e293b] rounded-xl border border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-400 mb-3">✅ চেকলিস্ট ({task.checklist.filter(c => c.isCompleted).length}/{task.checklist.length})</h3>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3 overflow-hidden">
                            <div className="h-full bg-teal-500 transition-all" style={{ width: `${(task.checklist.filter(c => c.isCompleted).length / task.checklist.length) * 100}%` }} />
                        </div>
                        <div className="space-y-1.5">
                            {task.checklist.map(item => (
                                <div key={item.id} className="flex items-center gap-2 text-sm">
                                    <span className={item.isCompleted ? 'text-green-400' : 'text-gray-500'}>
                                        {item.isCompleted ? '✅' : '⬜'}
                                    </span>
                                    <span className={item.isCompleted ? 'line-through text-gray-500' : 'text-gray-300'}>
                                        {item.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sub-task List */}
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
                                    <div className={`font-mono text-lg ${st.isActive ? 'text-yellow-400' : 'text-gray-400'}`}>
                                        {formatTime(st.totalSeconds + (st.isActive ? st.currentSessionSeconds : 0))}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {st.status !== 'COMPLETED' && !isDone && (
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

                                                {canEmployeeComplete && (
                                                    <button
                                                        onClick={() => completeSubTask(st.id)}
                                                        disabled={actionLoading === st.id}
                                                        className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full text-white disabled:opacity-50"
                                                        title="সম্পন্ন করুন"
                                                    >
                                                        ✓
                                                    </button>
                                                )}
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

                {/* Work Journal / Notes Section */}
                <div className="p-4 bg-[#1e293b] rounded-xl border border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">📝 ওয়ার্ক জার্নাল</h3>

                    {/* Add Note */}
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                            placeholder="নোট লিখুন..."
                            className="flex-1 bg-[#334155] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                        />
                        <button
                            onClick={handleAddNote}
                            disabled={notesLoading || !newNote.trim()}
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex-shrink-0"
                        >
                            {notesLoading ? '...' : 'যোগ করুন'}
                        </button>
                    </div>

                    {/* Notes List */}
                    {notes.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-2">কোনো নোট নেই</p>
                    ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {notes.map(note => (
                                <div key={note.id} className="flex items-start justify-between p-2 bg-[#334155] rounded-lg">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-gray-300">{note.content}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {note.user?.name || 'Unknown'} &middot; {new Date(note.createdAt).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteNote(note.id)}
                                        className="text-gray-500 hover:text-red-400 text-sm ml-2 flex-shrink-0"
                                        title="মুছুন"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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
