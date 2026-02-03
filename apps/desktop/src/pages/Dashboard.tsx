import { useEffect, useState, useRef, useMemo } from 'react';
import { auth } from '../firebase';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';

// ==========================================
// Types
// ==========================================
interface Task {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    deadline?: string;
    billingType?: string;
    fixedPrice?: number;
    hourlyRate?: number;
    estimatedHours?: number;
    scheduleDays?: number[];
    startTime?: string;
    endTime?: string;
    companyId?: string;
    screenshotInterval?: number; // Screenshot interval in minutes (1-60)
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

const formatTimeUntil = (task: Task, now: Date): { text: string; color: string; isActive: boolean } | null => {
    if (task.billingType !== 'SCHEDULED' || !task.startTime || !task.scheduleDays) return null;
    const today = now.getDay();
    if (!task.scheduleDays.includes(today)) return null;

    const [sh, sm] = task.startTime.split(':').map(Number);
    const [eh, em] = (task.endTime || '23:59').split(':').map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (nowMin >= startMin && nowMin <= endMin) {
        const remaining = (endMin - nowMin) * 60;
        return { text: `বাকি ${Math.floor(remaining / 60)} মিনিট`, color: '#22c55e', isActive: true };
    } else if (nowMin < startMin) {
        const until = startMin - nowMin;
        if (until <= 30) return { text: `${until} মিনিটে শুরু`, color: '#eab308', isActive: false };
        return { text: `${task.startTime} এ শুরু`, color: '#64748b', isActive: false };
    }
    return { text: 'সময় শেষ', color: '#ef4444', isActive: false };
};

const getDayName = (day: number): string => {
    return ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'][day];
};

// ==========================================
// Main Component
// ==========================================
const Dashboard = () => {
    // State
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [timer, setTimer] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [timeLogId, setTimeLogId] = useState<string | null>(null);
    const [todayStats, setTodayStats] = useState({ hours: 0, minutes: 0 });
    const [loading, setLoading] = useState(true);
    const [userCompanyId, setUserCompanyId] = useState<string>('');

    // Refs
    const intervalRef = useRef<any>(null);
    const screenshotIntervalRef = useRef<any>(null);
    const socketRef = useRef<Socket | null>(null);
    const trackingIdRef = useRef<string | null>(null);
    const navigate = useNavigate();

    // Current Time Update
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Socket.IO Connection
    useEffect(() => {
        socketRef.current = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

        socketRef.current.on('connect', () => console.log('🔌 Socket connected'));

        // Notification: Task Assigned
        socketRef.current.on('task:assigned', (data: { title: string }) => {
            new Notification('New Task Assigned', {
                body: `You have been assigned a new task: ${data.title}`,
            });
            // Refresh tasks
            const user = auth.currentUser;
            if (user) fetchTasks(user);
        });

        // Notification: Idle Alert
        socketRef.current.on('idle:alert', (data: { message: string }) => {
            new Notification('Idle Alert', {
                body: data.message || 'You have been idle for too long.',
                icon: '/electron-vite.svg' // optional
            });
        });

        return () => { socketRef.current?.disconnect(); };
    }, []);

    // Auth & Data Fetching
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (!user) navigate('/login');
            else {
                await fetchUserProfile(user);
                await fetchTasks(user);
                await fetchTodayStats(user);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Listen for stop from main process
    useEffect(() => {
        window.electron?.onStopTracking?.(() => { if (isTracking) stopTracking(); });
    }, [isTracking]);

    const fetchUserProfile = async (user: any) => {
        try {
            const token = await user.getIdToken();
            const res = await axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success && res.data.user) {
                const { companyId, id: userId } = res.data.user;
                setUserCompanyId(companyId);
                console.log('🏢 Company ID:', companyId);

                // Join user specific room for notifications
                if (socketRef.current) {
                    socketRef.current.emit('join:user', userId);
                    console.log('🔗 Joining user room:', userId);
                }
            }
        } catch (e) { console.error("Failed to fetch user profile", e); }
    };

    const fetchTasks = async (user: any) => {
        try {
            const token = await user.getIdToken();
            const res = await axios.get(`${API_URL}/tasks/list`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setTasks(res.data.tasks);
        } catch (e) { console.error("Failed to fetch tasks", e); }
    };

    const fetchTodayStats = async (user: any) => {
        try {
            const token = await user.getIdToken();
            const res = await axios.get(`${API_URL}/activity/today`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                setTodayStats({ hours: res.data.stats.todayHours || 0, minutes: res.data.stats.todayMinutes || 0 });
            }
        } catch (e) { console.error("Failed to fetch stats", e); }
    };

    // Screenshot capture and upload
    const captureAndUploadScreenshot = async () => {
        try {
            const user = auth.currentUser;
            if (!user || !selectedTaskId) return;

            console.log('📸 Capturing screenshot...');
            const base64Image = await window.electron?.captureScreenshot();
            if (!base64Image) {
                console.error('Screenshot capture failed');
                return;
            }

            // Get Real Activity Stats
            const activityStats = await window.electron?.getActivityStats() || { keystrokes: 0, mouseClicks: 0 };
            console.log('📊 Activity Stats:', activityStats);

            // Convert base64 to blob
            const byteChars = atob(base64Image);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteArray[i] = byteChars.charCodeAt(i);
            }
            const blob = new Blob([byteArray], { type: 'image/png' });

            // Create form data
            const formData = new FormData();
            formData.append('screenshot', blob, `screenshot_${Date.now()}.png`);
            formData.append('taskId', selectedTaskId);
            formData.append('keystrokes', activityStats.keystrokes.toString());
            formData.append('mouseClicks', activityStats.mouseClicks.toString());
            formData.append('activeSeconds', '300'); // Fixed interval for now
            formData.append('capturedAt', new Date().toISOString());

            const token = await user.getIdToken();
            const response = await axios.post(`${API_URL}/screenshots/upload`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                console.log('✅ Screenshot uploaded successfully:', response.data.screenshot.id);
            }
        } catch (error) {
            console.error('❌ Screenshot upload failed:', error);
        }
    };

    const startTracking = async () => {
        try {
            const user = auth.currentUser;
            if (!user || !selectedTaskId) return;

            // Request permission for notifications if not granted
            if (Notification.permission !== 'granted') {
                Notification.requestPermission();
            }

            const token = await user.getIdToken();
            const res = await axios.post(`${API_URL}/tasks/start`, { taskId: selectedTaskId }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                setTimeLogId(res.data.timeLog.id);
                setIsTracking(true);
                setTimer(0);

                const trackingId = `${user.uid}-${Date.now()}`;
                trackingIdRef.current = trackingId;

                const taskDetails = tasks.find(t => t.id === selectedTaskId);
                window.electron?.trackingStarted?.({
                    taskName: taskDetails?.title || 'Unknown',
                    taskId: selectedTaskId,
                    endTime: taskDetails?.endTime
                });

                socketRef.current?.emit('tracking:start', {
                    odId: trackingId,
                    userId: user.uid,
                    taskId: selectedTaskId,
                    companyId: userCompanyId
                });
                console.log('📡 Emit tracking:start with companyId:', userCompanyId);

                intervalRef.current = setInterval(() => {
                    setTimer(p => {
                        const newTime = p + 1;
                        window.electron?.trackingTick?.(newTime);
                        if (newTime % 30 === 0) {
                            socketRef.current?.emit('tracking:tick', { odId: trackingIdRef.current, elapsedSeconds: newTime });
                        }
                        return newTime;
                    });
                }, 1000);

                // Screenshot capture based on task's screenshotInterval setting
                console.log('🔍 Task Details:', JSON.stringify(taskDetails, null, 2));
                const screenshotIntervalMinutes = taskDetails?.screenshotInterval || 5;
                console.log(`📷 Screenshot interval: ${screenshotIntervalMinutes} minutes`);
                captureAndUploadScreenshot(); // First screenshot immediately
                screenshotIntervalRef.current = setInterval(() => {
                    captureAndUploadScreenshot();
                }, screenshotIntervalMinutes * 60 * 1000);
            }
        } catch (e) {
            console.error("Start failed", e);
            alert("ট্র্যাকিং শুরু করা যায়নি।");
        }
    };

    const stopTracking = async () => {
        try {
            const user = auth.currentUser;
            if (!user || !timeLogId) return;
            const token = await user.getIdToken();
            await axios.post(`${API_URL}/tasks/stop`, { timeLogId }, { headers: { Authorization: `Bearer ${token}` } });
            setIsTracking(false);
            setTimeLogId(null);
            clearInterval(intervalRef.current);
            clearInterval(screenshotIntervalRef.current);
            setTimer(0);
            window.electron?.trackingStopped?.();
            socketRef.current?.emit('tracking:stop', { odId: trackingIdRef.current });
            trackingIdRef.current = null;
            await fetchTodayStats(user);
        } catch (e) { console.error("Stop failed", e); }
    };

    // Computed
    const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);
    const activeTasks = useMemo(() => tasks.filter(t => t.status === 'IN_PROGRESS'), [tasks]);
    const pendingTasks = useMemo(() => tasks.filter(t => t.status === 'PENDING' || t.status === 'TODO'), [tasks]);

    if (loading) {
        return (
            <div style={{ background: '#0a0e1a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eab308' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
                    <div style={{ fontSize: 18, fontFamily: "'Hind Siliguri', sans-serif" }}>লোড হচ্ছে...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f2e 100%)',
            minHeight: '100vh',
            fontFamily: "'Hind Siliguri', 'Inter', sans-serif",
            color: '#f1f5f9',
            display: 'flex'
        }}>
            {/* ==================== LEFT SIDEBAR ==================== */}
            <div style={{
                width: 320,
                background: 'rgba(15, 23, 42, 0.8)',
                borderRight: '1px solid rgba(71, 85, 105, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                backdropFilter: 'blur(20px)'
            }}>
                {/* Header */}
                <div style={{ padding: 24, borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{
                            width: 44, height: 44,
                            background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                            borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 24
                        }}>⚡</div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 18 }}>KormoSync</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>টাইম ট্র্যাকার</div>
                        </div>
                    </div>

                    {/* Current Time Display */}
                    <div style={{
                        background: 'rgba(234, 179, 8, 0.1)',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        borderRadius: 12,
                        padding: 16,
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>বর্তমান সময়</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'monospace', color: '#eab308' }}>
                            {currentTime.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                            {getDayName(currentTime.getDay())}, {currentTime.toLocaleDateString('bn-BD')}
                        </div>
                    </div>
                </div>

                {/* Today Stats */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>আজকের কাজ</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1, background: 'rgba(34, 197, 94, 0.1)', padding: 12, borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>{todayStats.hours}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>ঘন্টা</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(59, 130, 246, 0.1)', padding: 12, borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{todayStats.minutes}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>মিনিট</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(168, 85, 247, 0.1)', padding: 12, borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#a855f7' }}>{activeTasks.length}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>চলমান</div>
                        </div>
                    </div>
                </div>

                {/* Task List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, paddingLeft: 8 }}>কাজের তালিকা ({tasks.length})</div>

                    {tasks.map(task => {
                        const timeInfo = formatTimeUntil(task, currentTime);
                        const isSelected = selectedTaskId === task.id;

                        return (
                            <div
                                key={task.id}
                                onClick={() => setSelectedTaskId(task.id)}
                                style={{
                                    padding: 14,
                                    marginBottom: 8,
                                    borderRadius: 12,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    background: isSelected
                                        ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(234, 179, 8, 0.1))'
                                        : 'rgba(30, 41, 59, 0.5)',
                                    border: isSelected
                                        ? '2px solid rgba(234, 179, 8, 0.5)'
                                        : '1px solid rgba(71, 85, 105, 0.2)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 10, height: 10, borderRadius: '50%',
                                        background: task.status === 'IN_PROGRESS' ? '#22c55e' : task.status === 'DONE' ? '#64748b' : '#eab308'
                                    }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: 600,
                                            fontSize: 14,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            color: isSelected ? '#eab308' : '#f1f5f9'
                                        }}>{task.title}</div>
                                        {timeInfo && (
                                            <div style={{ fontSize: 11, color: timeInfo.color, marginTop: 2 }}>
                                                {timeInfo.isActive && '🟢 '}{timeInfo.text}
                                            </div>
                                        )}
                                    </div>
                                    {task.startTime && (
                                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                                            {task.startTime}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ==================== MAIN CONTENT ==================== */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 32 }}>

                {!selectedTask ? (
                    /* No Task Selected */
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: 80, marginBottom: 24, opacity: 0.3 }}>📋</div>
                        <div style={{ fontSize: 24, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                            কোনো কাজ নির্বাচিত নেই
                        </div>
                        <div style={{ fontSize: 14, color: '#475569' }}>
                            বাম পাশের তালিকা থেকে একটি কাজ নির্বাচন করুন
                        </div>
                    </div>
                ) : (
                    /* Task Selected */
                    <>
                        {/* Task Title */}
                        <div style={{ marginBottom: 32 }}>
                            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>নির্বাচিত কাজ</div>
                            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#f1f5f9' }}>
                                {selectedTask.title}
                            </h1>
                            {selectedTask.description && (
                                <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
                                    {selectedTask.description}
                                </p>
                            )}
                        </div>

                        {/* Timer Display */}
                        <div style={{
                            background: isTracking
                                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))'
                                : 'rgba(30, 41, 59, 0.5)',
                            borderRadius: 24,
                            padding: 48,
                            textAlign: 'center',
                            marginBottom: 32,
                            border: isTracking ? '2px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(71, 85, 105, 0.3)'
                        }}>
                            {isTracking && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    marginBottom: 16
                                }}>
                                    <div style={{
                                        width: 12, height: 12, borderRadius: '50%',
                                        background: '#ef4444',
                                        animation: 'pulse 1.5s infinite'
                                    }} />
                                    <span style={{ fontSize: 14, color: '#ef4444', fontWeight: 600 }}>রেকর্ডিং চলছে</span>
                                </div>
                            )}

                            <div style={{
                                fontSize: 72,
                                fontWeight: 700,
                                fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                                color: isTracking ? '#ef4444' : '#64748b',
                                letterSpacing: 4,
                                textShadow: isTracking ? '0 0 40px rgba(239, 68, 68, 0.3)' : 'none'
                            }}>
                                {formatTime(timer)}
                            </div>

                            <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 16 }}>
                                {isTracking ? 'কাজ চলছে...' : 'ট্র্যাকিং শুরু করতে নিচের বাটনে ক্লিক করুন'}
                            </div>
                        </div>

                        {/* BIG START/STOP BUTTON */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
                            <button
                                onClick={isTracking ? stopTracking : startTracking}
                                style={{
                                    width: 280,
                                    height: 80,
                                    borderRadius: 20,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 22,
                                    fontWeight: 700,
                                    fontFamily: "'Hind Siliguri', sans-serif",
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 16,
                                    transition: 'all 0.3s',
                                    background: isTracking
                                        ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                                        : 'linear-gradient(135deg, #22c55e, #16a34a)',
                                    color: 'white',
                                    boxShadow: isTracking
                                        ? '0 10px 40px rgba(220, 38, 38, 0.4)'
                                        : '0 10px 40px rgba(34, 197, 94, 0.4)',
                                }}
                            >
                                {isTracking ? (
                                    <>
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                            <rect x="6" y="6" width="12" height="12" rx="2" />
                                        </svg>
                                        বন্ধ করুন
                                    </>
                                ) : (
                                    <>
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                        শুরু করুন
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Task Info Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                            {/* Schedule */}
                            {selectedTask.startTime && (
                                <div style={{
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    borderRadius: 16,
                                    padding: 20,
                                    border: '1px solid rgba(71, 85, 105, 0.3)'
                                }}>
                                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>সময়সূচী</div>
                                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: '#eab308' }}>
                                        {selectedTask.startTime} - {selectedTask.endTime || 'N/A'}
                                    </div>
                                    {selectedTask.scheduleDays && (
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                                            {selectedTask.scheduleDays.map(d => getDayName(d)).join(', ')}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Billing */}
                            <div style={{
                                background: 'rgba(30, 41, 59, 0.5)',
                                borderRadius: 16,
                                padding: 20,
                                border: '1px solid rgba(71, 85, 105, 0.3)'
                            }}>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>বিলিং</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>
                                    {selectedTask.billingType === 'HOURLY' && selectedTask.hourlyRate
                                        ? `৳${selectedTask.hourlyRate}/ঘন্টা`
                                        : selectedTask.fixedPrice
                                            ? `৳${selectedTask.fixedPrice}`
                                            : 'N/A'}
                                </div>
                            </div>

                            {/* Status */}
                            <div style={{
                                background: 'rgba(30, 41, 59, 0.5)',
                                borderRadius: 16,
                                padding: 20,
                                border: '1px solid rgba(71, 85, 105, 0.3)'
                            }}>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>অবস্থা</div>
                                <div style={{
                                    display: 'inline-block',
                                    padding: '6px 14px',
                                    borderRadius: 20,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    background: selectedTask.status === 'IN_PROGRESS' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                                    color: selectedTask.status === 'IN_PROGRESS' ? '#22c55e' : '#eab308'
                                }}>
                                    {selectedTask.status === 'IN_PROGRESS' ? 'চলমান' : selectedTask.status === 'DONE' ? 'সম্পন্ন' : 'অপেক্ষমাণ'}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* CSS Animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.1); }
                }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.5); border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(71, 85, 105, 0.8); }
            `}</style>
        </div>
    );
};

export default Dashboard;
