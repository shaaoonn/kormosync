"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { Clock, MousePointer, Keyboard, X, ChevronDown, ChevronUp, Layers, CheckCircle, Circle, Calendar } from 'lucide-react';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ==========================================
// Types
// ==========================================
interface LiveSession {
    odId: string;
    userId: string;
    userName: string;
    userEmail: string;
    userImage: string | null;
    taskId: string;
    taskTitle: string;
    startTime: string;
    elapsedSeconds: number;
}

interface Screenshot {
    id: string;
    recordedAt: string;
    imageUrl: string;
    activityScore: number;
    keyboardCount: number;
    mouseCount: number;
    user: { id: string; name: string; email: string; profileImage: string | null };
    task: { id: string; title: string };
    taskId: string | null;
}

interface SubTask {
    id: string;
    title: string;
    status: string;
}

interface Task {
    id: string;
    title: string;
    status: string;
    subTasks: SubTask[];
    assignees: { id: string; name: string; profileImage: string | null }[];
}

interface Employee {
    id: string;
    name: string;
    email: string;
    profileImage: string | null;
    role: string;
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

const formatHour = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
};

const groupScreenshotsByHour = (screenshots: Screenshot[]): Map<string, Screenshot[]> => {
    const groups = new Map<string, Screenshot[]>();
    screenshots.forEach(ss => {
        const date = new Date(ss.recordedAt);
        const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
        if (!groups.has(hourKey)) groups.set(hourKey, []);
        groups.get(hourKey)!.push(ss);
    });
    return groups;
};

// ==========================================
// Main Component
// ==========================================
export default function ActivityMonitorPage() {
    const { user, token, loading: authLoading } = useAuth();

    // State
    const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
    const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

    const socketRef = useRef<Socket | null>(null);

    // Fetch Data on Date Change
    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch members only once if not loaded? typically fine to refetch or separate useEffect
                // optimizing to fetch activity on date change, context on mount
                const [empRes, activityRes] = await Promise.all([
                    axios.get(`${API_URL}/company/members`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axios.get(`${API_URL}/activity/company?startDate=${selectedDate}&endDate=${selectedDate}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                ]);

                if (empRes.data.success) setEmployees(empRes.data.members);
                if (activityRes.data.success) {
                    setScreenshots(activityRes.data.screenshots || []);
                    setTasks(activityRes.data.tasks || []);
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, selectedDate]);

    // Socket.IO for live tracking
    useEffect(() => {
        if (!user?.companyId) return;

        socketRef.current = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

        socketRef.current.on('connect', () => {
            console.log('🔌 Activity Monitor connected');
            socketRef.current?.emit('join:company', user.companyId);
        });

        socketRef.current.on('tracking:active-sessions', (sessions: LiveSession[]) => {
            setLiveSessions(sessions.map(s => ({
                ...s,
                elapsedSeconds: Math.floor((Date.now() - new Date(s.startTime).getTime()) / 1000)
            })));
        });

        socketRef.current.on('tracking:started', (session: any) => {
            setLiveSessions(prev => [...prev.filter(s => s.odId !== session.odId), { ...session, elapsedSeconds: 0 }]);
        });

        socketRef.current.on('tracking:tick', (data: { odId: string; elapsedSeconds: number }) => {
            setLiveSessions(prev => prev.map(s => s.odId === data.odId ? { ...s, elapsedSeconds: data.elapsedSeconds } : s));
        });

        socketRef.current.on('tracking:stopped', (data: { odId: string }) => {
            setLiveSessions(prev => prev.filter(s => s.odId !== data.odId));
        });

        socketRef.current.on('screenshot:new', (data: any) => {
            setScreenshots(prev => [data, ...prev].slice(0, 100));
        });

        return () => { socketRef.current?.disconnect(); };
    }, [user?.companyId]);

    // Timer Tick
    useEffect(() => {
        const interval = setInterval(() => {
            setLiveSessions(prev => prev.map(s => ({ ...s, elapsedSeconds: s.elapsedSeconds + 1 })));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Filter Logic
    const filteredTasks = tasks.filter(task => {
        // If employee selected, only show tasks relevant to them
        if (!selectedEmployee) return true;
        // Check if employee has screenshots for this task
        const hasScreenshots = screenshots.some(ss => ss.taskId === task.id && ss.user.id === selectedEmployee);
        return hasScreenshots;
    });

    const getTaskScreenshots = (taskId: string) => {
        return screenshots
            .filter(ss => ss.taskId === taskId && (!selectedEmployee || ss.user.id === selectedEmployee))
            .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    };

    if (authLoading) return <div className="p-8 text-center text-white">Authenticating...</div>;
    if (loading) return <div className="p-8 text-center text-white">Loading activity data...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 min-h-screen bg-[#0F0F0F]">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">
                        Activity Monitor
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Real-time tracking & screenshots</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-[#1A1A1A] px-3 py-1.5 rounded-lg border border-[#333]">
                        <Calendar size={16} className="text-gray-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-white text-sm focus:outline-none font-medium"
                        />
                    </div>

                    <span className="text-sm text-gray-500">Live Status:</span>
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-sm font-medium border border-green-500/20">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Online
                    </span>
                </div>
            </div>

            {/* Live Employees */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {liveSessions.map(session => (
                    <div key={session.odId} className="bg-[#1A1A1A] border border-[#333] p-4 rounded-xl flex items-center gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                            <Clock size={48} />
                        </div>
                        {session.userImage ? (
                            <img src={session.userImage} className="w-12 h-12 rounded-full border-2 border-green-500" alt="" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center font-bold text-white text-lg">
                                {session.userName.charAt(0)}
                            </div>
                        )}
                        <div>
                            <h3 className="font-bold text-white leading-tight">{session.userName}</h3>
                            <p className="text-xs text-green-400 font-mono mt-1">{formatTime(session.elapsedSeconds)}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5 max-w-[150px]">{session.taskTitle}</p>
                        </div>
                    </div>
                ))}
                {liveSessions.length === 0 && (
                    <div className="col-span-full bg-[#1A1A1A] border border-dashed border-[#333] p-6 rounded-xl text-center text-gray-500">
                        No one is currently active
                    </div>
                )}
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                    onClick={() => setSelectedEmployee(null)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${!selectedEmployee ? 'bg-white text-black' : 'bg-[#1A1A1A] text-gray-400 border border-[#333] hover:border-gray-500'}`}
                >
                    All Employees
                </button>
                {employees.map(emp => (
                    <button
                        key={emp.id}
                        onClick={() => setSelectedEmployee(emp.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${selectedEmployee === emp.id ? 'bg-white text-black' : 'bg-[#1A1A1A] text-gray-400 border border-[#333] hover:border-gray-500'}`}
                    >
                        {emp.profileImage ? (
                            <img src={emp.profileImage} className="w-5 h-5 rounded-full" alt="" />
                        ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-[10px] text-white">
                                {emp.name.charAt(0)}
                            </div>
                        )}
                        {emp.name}
                    </button>
                ))}
            </div>

            {/* Tasks List */}
            <div className="space-y-6">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4 opacity-20">📂</div>
                        <h3 className="text-xl font-bold text-gray-600">No activity found for this filter</h3>
                    </div>
                ) : (
                    filteredTasks.map(task => {
                        const taskScreenshots = getTaskScreenshots(task.id);
                        const hourGroups = groupScreenshotsByHour(taskScreenshots);
                        const isExpanded = expandedTasks.has(task.id) || true; // Default expanded for now

                        return (
                            <div key={task.id} className="bg-[#151515] border border-[#252525] rounded-2xl overflow-hidden transition-all hover:border-[#333]">
                                {/* Task Header */}
                                <div className="p-5 border-b border-[#252525] flex items-start justify-between bg-[#1A1A1A]">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mt-1">
                                            <Layers size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-white leading-tight">{task.title}</h2>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${task.status === 'DONE' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {task.status.replace('_', ' ')}
                                                </span>
                                                <span className="text-xs text-gray-500">•</span>
                                                <div className="flex -space-x-2">
                                                    {task.assignees?.map(a => (
                                                        <div key={a.id} title={a.name}>
                                                            {a.profileImage ? (
                                                                <img src={a.profileImage} className="w-5 h-5 rounded-full border border-[#1A1A1A]" alt={a.name} />
                                                            ) : (
                                                                <div className="w-5 h-5 rounded-full bg-gray-600 border border-[#1A1A1A]" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Stats Summary */}
                                    <div className="flex items-center gap-6 text-right">
                                        <div>
                                            <div className="text-2xl font-bold text-white">{taskScreenshots.length}</div>
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Screenshots</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Content Body */}
                                <div className="p-5 grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    {/* Subtasks Sidebar */}
                                    <div className="lg:col-span-1 border-r border-[#252525] pr-6">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Subtasks</h3>
                                        <div className="space-y-3">
                                            {task.subTasks && task.subTasks.length > 0 ? (
                                                task.subTasks.map(st => (
                                                    <div key={st.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#202020] transition-colors">
                                                        {st.status === 'COMPLETED' ? (
                                                            <CheckCircle size={16} className="text-green-500" />
                                                        ) : (
                                                            <Circle size={16} className="text-gray-600" />
                                                        )}
                                                        <span className={`text-sm ${st.status === 'COMPLETED' ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                                            {st.title}
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-sm text-gray-600 italic">No subtasks defined.</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Activity Feed */}
                                    <div className="lg:col-span-3">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Activity Screenshots</h3>

                                        {taskScreenshots.length === 0 ? (
                                            <div className="p-8 border border-dashed border-[#333] rounded-xl text-center">
                                                <p className="text-gray-500">No screenshots recorded on {new Date(selectedDate).toLocaleDateString()}.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {Array.from(hourGroups.entries()).map(([hourKey, shots]) => (
                                                    <div key={hourKey}>
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                            <span className="text-sm font-medium text-white">{formatHour(shots[0].recordedAt)}</span>
                                                            <div className="flex-1 h-px bg-[#252525]" />
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                            {shots.map(ss => (
                                                                <div
                                                                    key={ss.id}
                                                                    onClick={() => setSelectedScreenshot(ss)}
                                                                    className="group relative aspect-video bg-black rounded-lg overflow-hidden border border-[#333] hover:border-indigo-500 cursor-pointer transition-all hover:shadow-lg hover:shadow-indigo-500/10"
                                                                >
                                                                    <img
                                                                        src={ss.imageUrl}
                                                                        alt="Screenshot"
                                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                                    />
                                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-end">
                                                                        <div className="flex items-center gap-2 text-[10px] text-gray-300">
                                                                            <span className="flex items-center gap-0.5"><Keyboard size={10} /> {ss.keyboardCount}</span>
                                                                            <span className="flex items-center gap-0.5"><MousePointer size={10} /> {ss.mouseCount}</span>
                                                                        </div>
                                                                        <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ss.activityScore > 70 ? 'bg-green-500 text-black' : ss.activityScore > 40 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'}`}>
                                                                            {ss.activityScore}%
                                                                        </div>
                                                                    </div>
                                                                    {/* User Avatar Overlay */}
                                                                    <div className="absolute top-2 left-2">
                                                                        {ss.user.profileImage ? (
                                                                            <img src={ss.user.profileImage} className="w-6 h-6 rounded-full border border-black/50" title={ss.user.name} />
                                                                        ) : (
                                                                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-[10px] flex items-center justify-center text-white border border-black/50" title={ss.user.name}>
                                                                                {ss.user.name.charAt(0)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Screenshot Modal */}
            {selectedScreenshot && (
                <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedScreenshot(null)}>
                    <div className="relative max-w-7xl w-full max-h-[90vh] bg-[#111] border border-[#333] rounded-2xl overflow-hidden flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
                        <div className="flex-1 bg-black flex items-center justify-center p-4 relative group">
                            <img src={selectedScreenshot.imageUrl} className="max-w-full max-h-[80vh] object-contain shadow-2xl" alt="" />
                            <a
                                href={selectedScreenshot.imageUrl}
                                target='_blank'
                                className="absolute bottom-6 right-6 px-4 py-2 bg-white text-black rounded-full text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200"
                            >
                                Open Full Image
                            </a>
                        </div>
                        <div className="w-full md:w-80 border-l border-[#333] p-6 flex flex-col h-full bg-[#151515]">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-white">Details</h3>
                                <button onClick={() => setSelectedScreenshot(null)} className="p-2 hover:bg-[#333] rounded-full transition-colors"><X size={20} className="text-gray-400" /></button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider font-bold">User</label>
                                    <div className="flex items-center gap-3 mt-2">
                                        {selectedScreenshot.user.profileImage ?
                                            <img src={selectedScreenshot.user.profileImage} className="w-10 h-10 rounded-full" /> :
                                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">{selectedScreenshot.user.name.charAt(0)}</div>
                                        }
                                        <div>
                                            <div className="text-white font-medium">{selectedScreenshot.user.name}</div>
                                            <div className="text-xs text-gray-400">{selectedScreenshot.user.email}</div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider font-bold">Task</label>
                                    <div className="mt-2 p-3 bg-[#202020] rounded-lg border border-[#333]">
                                        <div className="text-sm text-gray-200 font-medium">{selectedScreenshot.task.title}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-[#202020] rounded-lg border border-[#333] text-center">
                                        <Keyboard size={20} className="mx-auto text-green-500 mb-1" />
                                        <div className="text-xl font-bold text-white">{selectedScreenshot.keyboardCount}</div>
                                        <div className="text-[10px] text-gray-500 uppercase">Keystrokes</div>
                                    </div>
                                    <div className="p-3 bg-[#202020] rounded-lg border border-[#333] text-center">
                                        <MousePointer size={20} className="mx-auto text-blue-500 mb-1" />
                                        <div className="text-xl font-bold text-white">{selectedScreenshot.mouseCount}</div>
                                        <div className="text-[10px] text-gray-500 uppercase">Clicks</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider font-bold">Captured At</label>
                                    <div className="mt-1 text-2xl font-mono text-white">
                                        {new Date(selectedScreenshot.recordedAt).toLocaleTimeString('bn-BD')}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {new Date(selectedScreenshot.recordedAt).toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
