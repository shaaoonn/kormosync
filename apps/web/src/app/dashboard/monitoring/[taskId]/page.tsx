"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, Camera, Monitor, Keyboard, MousePointer, Clock, FileText, AppWindow, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ==========================================
// Smart Monitoring Page
// ==========================================
export default function MonitoringPage() {
    const params = useParams();
    const router = useRouter();
    const taskId = params.taskId as string;
    const { user, token } = useAuth();

    const [monitoring, setMonitoring] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [captureLoading, setCaptureLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);

    // Fetch monitoring data
    const fetchData = async () => {
        if (!token) return;
        try {
            const { data } = await axios.get(`${API_URL}/monitoring/task/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30000, // 30s — monitoring endpoint is heavy (7 DB queries + MinIO)
            });
            if (data.success) {
                setMonitoring(data.monitoring);
            }
        } catch (err) {
            console.error('Failed to fetch monitoring data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Auto-refresh every 60s (server caches for 30s — no benefit polling faster)
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [token, taskId]);

    // Socket.IO for real-time updates
    useEffect(() => {
        if (!user?.companyId) return;
        socketRef.current = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
        socketRef.current.on('connect', () => {
            socketRef.current?.emit('join:company', user.companyId);
        });

        // Listen for new screenshots
        socketRef.current.on('screenshot:new', () => {
            fetchData(); // Refresh on new screenshot
        });

        // Listen for remote capture results
        socketRef.current.on('screenshot:remote-result', () => {
            setCaptureLoading(false);
            fetchData();
        });

        // Listen for new proofs
        socketRef.current.on('proof:submitted', () => {
            fetchData();
        });

        return () => { socketRef.current?.disconnect(); };
    }, [user?.companyId]);

    // Handle remote capture
    const handleCapture = (targetUserId: string) => {
        if (!socketRef.current || !user?.companyId) return;
        setCaptureLoading(true);
        socketRef.current.emit('screenshot:request-capture', {
            targetUserId,
            taskId,
            companyId: user.companyId,
            requestedBy: user?.name || 'Admin',
        });
        setTimeout(() => setCaptureLoading(false), 15000);
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
            </div>
        );
    }

    if (!monitoring) {
        return (
            <div className="p-6 text-center text-gray-500">
                <p>Monitoring data not found</p>
                <button onClick={() => router.back()} className="mt-4 text-blue-500 hover:underline">Go Back</button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-[#222] rounded-lg transition-colors">
                    <ArrowLeft size={20} className="text-gray-400" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-white">{monitoring.task.title}</h1>
                    <p className="text-sm text-gray-500">Smart Monitoring</p>
                </div>
                <button
                    onClick={fetchData}
                    className="p-2 hover:bg-[#222] rounded-lg transition-colors text-gray-400"
                    title="Refresh"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Section 1: Live Status */}
            <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Monitor size={20} className="text-green-400" />
                    Live Status
                </h2>
                {monitoring.liveSessions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {monitoring.liveSessions.map((session: any, i: number) => (
                            <div key={i} className="bg-[#111] border border-[#333] rounded-lg p-4 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-white">{session.userName}</p>
                                    <p className="text-xs text-green-400 font-mono">{formatTime(Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000))}</p>
                                    {session.currentApp && (
                                        <p className="text-xs text-blue-400 mt-1">🖥️ {session.currentApp}</p>
                                    )}
                                    {session.currentWindow && (
                                        <p className="text-xs text-gray-500 truncate max-w-[250px]">{session.currentWindow}</p>
                                    )}
                                </div>
                                {monitoring.task.allowRemoteCapture && (
                                    <button
                                        onClick={() => handleCapture(session.userId)}
                                        disabled={captureLoading}
                                        className="flex items-center gap-2 px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600/40 border border-yellow-600/40 text-yellow-400 text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                                    >
                                        <Camera size={14} />
                                        {captureLoading ? 'Capturing...' : 'Capture Now'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-gray-500 text-sm text-center py-4">No one is currently working on this task</div>
                )}

                {/* Assignees */}
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Assignees:</span>
                    {monitoring.assignees.map((a: any) => (
                        <div key={a.id} className="flex items-center gap-1 bg-[#222] rounded-full px-2 py-1">
                            {a.profileImage ? (
                                <img src={a.profileImage} className="w-5 h-5 rounded-full" alt="" />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-[9px] text-white font-bold">
                                    {a.name?.charAt(0)}
                                </div>
                            )}
                            <span className="text-xs text-gray-300">{a.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Section 2: Screenshots Gallery */}
            <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Camera size={20} className="text-yellow-400" />
                    Screenshots ({monitoring.screenshots.length})
                </h2>
                {monitoring.screenshots.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {monitoring.screenshots.map((ss: any) => (
                            <div
                                key={ss.id}
                                className="relative cursor-pointer group rounded-lg overflow-hidden border border-[#333] hover:border-yellow-600/60 transition-all"
                                onClick={() => setSelectedImage(ss.imageUrl)}
                            >
                                <img src={ss.imageUrl} alt="" className="w-full h-24 object-cover" loading="lazy" />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                                    <p className="text-[9px] text-gray-400">{new Date(ss.recordedAt).toLocaleTimeString('bn-BD')}</p>
                                    <div className="flex gap-2 text-[9px]">
                                        <span className="text-green-400">{ss.activityScore}%</span>
                                        <span className="text-blue-400">K:{ss.keyboardCount}</span>
                                        <span className="text-yellow-400">M:{ss.mouseCount}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-gray-500 text-sm text-center py-4">No screenshots yet</div>
                )}
            </div>

            {/* Section 3: Activity Stats */}
            <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Keyboard size={20} className="text-blue-400" />
                    Activity Stats
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: 'Last 5 min', data: monitoring.activityStats.last5min, color: 'green' },
                        { label: 'Last Hour', data: monitoring.activityStats.lastHour, color: 'blue' },
                        { label: 'Today', data: monitoring.activityStats.today, color: 'yellow' },
                    ].map(({ label, data, color }) => (
                        <div key={label} className="bg-[#111] border border-[#333] rounded-lg p-4">
                            <h3 className="text-sm font-medium text-gray-400 mb-3">{label}</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500 flex items-center gap-1"><Keyboard size={12} /> Keystrokes</span>
                                    <span className="text-white font-mono">{data.totalKeystrokes.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500 flex items-center gap-1"><MousePointer size={12} /> Mouse Clicks</span>
                                    <span className="text-white font-mono">{data.totalMouseClicks.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500 flex items-center gap-1"><Clock size={12} /> Active Time</span>
                                    <span className="text-white font-mono">{formatTime(data.totalActiveSeconds)}</span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-[#333]">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Avg Activity</span>
                                        <span className={`font-bold ${data.averageActivity >= 60 ? 'text-green-400' : data.averageActivity >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {data.averageActivity}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-[#333] rounded-full h-1.5 mt-1">
                                        <div
                                            className={`h-1.5 rounded-full ${data.averageActivity >= 60 ? 'bg-green-500' : data.averageActivity >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${Math.min(100, data.averageActivity)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* App Usage */}
                {monitoring.appUsage.length > 0 && (
                    <div className="mt-4">
                        <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-1">
                            <AppWindow size={14} /> Top Apps Today
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {monitoring.appUsage.map((app: any, i: number) => (
                                <div key={i} className="bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-xs">
                                    <span className="text-white font-medium">{app.appName}</span>
                                    <span className="text-gray-500 ml-2">{formatTime(app.totalDurationSec)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Section 4: Work Proofs */}
            <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-purple-400" />
                    Work Proofs ({monitoring.workProofs.length})
                </h2>
                {monitoring.workProofs.length > 0 ? (
                    <div className="space-y-3">
                        {monitoring.workProofs.map((proof: any) => (
                            <div key={proof.id} className="bg-[#111] border border-[#333] rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        {proof.user.profileImage ? (
                                            <img src={proof.user.profileImage} className="w-8 h-8 rounded-full" alt="" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-[10px] text-white font-bold">
                                                {proof.user.name?.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-white">{proof.user.name}</p>
                                            <p className="text-[10px] text-gray-500">{new Date(proof.createdAt).toLocaleString('bn-BD')}</p>
                                        </div>
                                    </div>
                                    {proof.subTask && (
                                        <span className="text-[10px] bg-[#222] px-2 py-1 rounded text-gray-400">{proof.subTask.title}</span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-200 mt-2">{proof.summary}</p>
                                {proof.notes && <p className="text-xs text-gray-500 mt-1">{proof.notes}</p>}
                                {proof.attachments && proof.attachments.length > 0 && (
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {proof.attachments.map((url: string, i: number) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                                className="text-[10px] bg-blue-600/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-600/40 transition-colors">
                                                Attachment {i + 1}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-gray-500 text-sm text-center py-4">No proofs submitted yet</div>
                )}
            </div>

            {/* Fullscreen Screenshot Modal */}
            {selectedImage && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
                    <button className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300">&times;</button>
                </div>
            )}
        </div>
    );
}
