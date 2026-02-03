"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { ArrowLeft, Calendar, User, Clock, Edit, Trash2, FileText, Video, Download, DollarSign, Timer, CalendarDays, Play, CheckCircle } from "lucide-react";

const DAYS_OF_WEEK = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

interface SubTask {
    id: string;
    title: string;
    description: string;
    billingType: string;
    fixedPrice?: number;
    hourlyRate?: number;
    estimatedHours?: number;
    scheduleDays: number[];
    startTime?: string;
    endTime?: string;
    status: string;
}

interface Task {
    id: string;
    title: string;
    descriptionRaw: string;
    priority: string;
    status: string;
    isDraft: boolean;
    deadline: string | null;
    createdAt: string;
    attachments: string[];
    videoUrl: string | null;
    requiredApps: string[];
    customFields: Record<string, string>;
    creator: { id: string; name: string; email: string };
    assignees: { id: string; name: string; email: string }[];
    // New fields
    billingType?: string;
    fixedPrice?: number;
    hourlyRate?: number;
    estimatedHours?: number;
    scheduleDays?: number[];
    startTime?: string;
    endTime?: string;
    subTasks?: SubTask[];
}

export default function TaskDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const taskId = params.taskId as string;

    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const fetchTask = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();

                // Fetch task
                const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTask(res.data.task);

                // Fetch user role
                const userRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const role = userRes.data.user?.role;
                setIsAdmin(role === 'OWNER' || role === 'ADMIN');

            } catch (error) {
                console.error("Failed to fetch task", error);
            } finally {
                setLoading(false);
            }
        };

        auth.onAuthStateChanged((user) => {
            if (user) fetchTask();
            else setLoading(false);
        });
    }, [taskId]);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this task?")) return;
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            router.push("/dashboard/tasks");
        } catch (error) {
            alert("Failed to delete task");
        }
    };

    const priorityColor = (p: string) => {
        if (p === 'HIGH') return 'bg-red-100 text-red-700';
        if (p === 'LOW') return 'bg-green-100 text-green-700';
        return 'bg-yellow-100 text-yellow-700';
    };

    const billingTypeLabel = (type: string) => {
        if (type === 'FIXED_PRICE') return { label: 'ফিক্সড প্রাইস', icon: '🏷️', color: 'bg-blue-100 text-blue-700' };
        if (type === 'SCHEDULED') return { label: 'সিডিউল আওয়ার', icon: '📅', color: 'bg-purple-100 text-purple-700' };
        return { label: 'আওয়ারলি', icon: '⏱️', color: 'bg-green-100 text-green-700' };
    };

    const formatTime = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading task details...</div>;
    }

    if (!task) {
        return <div className="p-8 text-center text-red-500">Task not found.</div>;
    }

    const billing = task.billingType ? billingTypeLabel(task.billingType) : null;

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Link href="/dashboard/tasks" className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="w-4 h-4" /> Back to Tasks
                </Link>
                {isAdmin && (
                    <div className="flex gap-2">
                        <Link href={`/dashboard/tasks/${taskId}/edit`}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-medium">
                            <Edit className="w-4 h-4" /> Edit
                        </Link>
                        <button onClick={handleDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium">
                            <Trash2 className="w-4 h-4" /> Delete
                        </button>
                    </div>
                )}
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Title Section */}
                <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-3 mb-3">
                        <h1 className="text-2xl font-bold text-gray-800">{task.title}</h1>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor(task.priority)}`}>
                            {task.priority}
                        </span>
                        {task.isDraft && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Draft</span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {task.creator?.name || task.creator?.email}
                        </span>
                        {task.deadline && (
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> ডেডলাইন: {new Date(task.deadline).toLocaleDateString('bn-BD')}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> তৈরি: {new Date(task.createdAt).toLocaleDateString('bn-BD')}
                        </span>
                    </div>
                </div>

                {/* Billing Info Card */}
                {billing && (
                    <div className="p-6 border-b bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
                        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" /> বিলিং তথ্য
                        </h2>
                        <div className="flex flex-wrap gap-4">
                            <div className={`px-4 py-2 rounded-lg ${billing.color} font-medium`}>
                                {billing.icon} {billing.label}
                            </div>

                            {task.billingType === 'FIXED_PRICE' && task.fixedPrice && (
                                <div className="px-4 py-2 bg-white rounded-lg border shadow-sm">
                                    <span className="text-gray-500 text-sm">মূল্য:</span>
                                    <span className="ml-2 font-bold text-lg text-green-600">৳{task.fixedPrice.toLocaleString()}</span>
                                </div>
                            )}

                            {task.billingType === 'HOURLY' && (
                                <>
                                    {task.hourlyRate && (
                                        <div className="px-4 py-2 bg-white rounded-lg border shadow-sm">
                                            <span className="text-gray-500 text-sm">রেট:</span>
                                            <span className="ml-2 font-bold text-green-600">৳{task.hourlyRate}/ঘন্টা</span>
                                        </div>
                                    )}
                                    {task.estimatedHours && (
                                        <div className="px-4 py-2 bg-white rounded-lg border shadow-sm">
                                            <span className="text-gray-500 text-sm">আনুমানিক:</span>
                                            <span className="ml-2 font-bold">{task.estimatedHours} ঘন্টা</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Schedule Display */}
                        {task.billingType === 'SCHEDULED' && task.startTime && task.endTime && (
                            <div className="mt-4 p-4 bg-white rounded-lg border shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <CalendarDays className="w-4 h-4 text-purple-600" />
                                    <span className="font-medium text-gray-700">সময়সূচী</span>
                                </div>
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500">শুরু</div>
                                        <div className="text-lg font-bold text-indigo-600">{formatTime(task.startTime)}</div>
                                    </div>
                                    <div className="text-gray-300">→</div>
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500">শেষ</div>
                                        <div className="text-lg font-bold text-indigo-600">{formatTime(task.endTime)}</div>
                                    </div>
                                </div>
                                {task.scheduleDays && task.scheduleDays.length > 0 && (
                                    <div className="flex gap-2 flex-wrap">
                                        {DAYS_OF_WEEK.map((day, idx) => (
                                            <span
                                                key={idx}
                                                className={`px-3 py-1 rounded-full text-sm font-medium ${task.scheduleDays!.includes(idx)
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 text-gray-400'
                                                    }`}
                                            >
                                                {day}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Description */}
                <div className="p-6 border-b">
                    <h2 className="text-sm font-semibold text-gray-600 mb-2">বিবরণ</h2>
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                        {task.descriptionRaw || <span className="text-gray-400 italic">কোনো বিবরণ দেওয়া হয়নি।</span>}
                    </div>
                </div>

                {/* SubTasks */}
                {task.subTasks && task.subTasks.length > 0 && (
                    <div className="p-6 border-b">
                        <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
                            📋 টাস্ক সমূহ ({task.subTasks.length})
                        </h2>
                        <div className="space-y-3">
                            {task.subTasks.map((st, idx) => {
                                const stBilling = billingTypeLabel(st.billingType);
                                return (
                                    <div key={st.id} className="p-4 bg-gray-50 rounded-lg border">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-indigo-600">#{idx + 1}</span>
                                                <span className="font-medium text-gray-800">{st.title || 'টাস্ক'}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${stBilling.color}`}>
                                                    {stBilling.icon} {stBilling.label}
                                                </span>
                                            </div>
                                            {st.status === 'COMPLETED' && (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            )}
                                        </div>

                                        {st.description && (
                                            <p className="text-sm text-gray-600 mb-2">{st.description}</p>
                                        )}

                                        <div className="flex flex-wrap gap-3 text-sm">
                                            {st.billingType === 'FIXED_PRICE' && st.fixedPrice && (
                                                <span className="text-green-600 font-medium">৳{st.fixedPrice.toLocaleString()}</span>
                                            )}
                                            {st.billingType === 'HOURLY' && st.hourlyRate && (
                                                <span className="text-green-600 font-medium">৳{st.hourlyRate}/ঘন্টা</span>
                                            )}
                                            {st.billingType === 'SCHEDULED' && st.startTime && st.endTime && (
                                                <span className="text-purple-600 font-medium">
                                                    🕐 {formatTime(st.startTime)} - {formatTime(st.endTime)}
                                                </span>
                                            )}
                                            {st.scheduleDays && st.scheduleDays.length > 0 && (
                                                <span className="text-gray-500">
                                                    ({st.scheduleDays.map(d => DAYS_OF_WEEK[d]).join(', ')})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Assignees */}
                {task.assignees && task.assignees.length > 0 && (
                    <div className="p-6 border-b">
                        <h2 className="text-sm font-semibold text-gray-600 mb-2">অ্যাসাইনি</h2>
                        <div className="flex flex-wrap gap-2">
                            {task.assignees.map(a => (
                                <span key={a.id} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
                                    {a.name || a.email}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Video Recording */}
                {task.videoUrl && (
                    <div className="p-6 border-b">
                        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                            <Video className="w-4 h-4 text-red-500" /> স্ক্রিন রেকর্ডিং
                        </h2>
                        <video
                            controls
                            src={task.videoUrl}
                            className="w-full rounded-lg border shadow-sm max-h-96"
                        >
                            Your browser does not support video playback.
                        </video>
                    </div>
                )}

                {/* Attachments */}
                {task.attachments && task.attachments.length > 0 && (
                    <div className="p-6">
                        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" /> অ্যাটাচমেন্ট ({task.attachments.length})
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            {task.attachments.map((url, i) => {
                                // Mask filename for privacy/cleanliness
                                const ext = url.split('.').pop() || 'file';
                                const displayName = `Attachment ${i + 1}.${ext}`;
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(ext);

                                return (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition">
                                        {isImage ? (
                                            <img src={url} alt="" className="w-12 h-12 object-cover rounded" />
                                        ) : (
                                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-gray-400" />
                                            </div>
                                        )}
                                        <div className="flex-1 truncate text-sm text-gray-700 font-medium">{displayName}</div>
                                        <Download className="w-4 h-4 text-gray-400" />
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Start Button for Employees */}
            {!isAdmin && (
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-xl text-white text-center shadow-lg">
                    <p className="text-sm opacity-80 mb-2">কাজ শুরু করতে</p>
                    <p className="font-bold text-lg mb-4">KormoSync Desktop App ব্যবহার করুন</p>
                    <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-lg font-bold hover:bg-gray-100 transition">
                        <Play className="w-5 h-5" /> Download Desktop App
                    </a>
                </div>
            )}
        </div>
    );
}
