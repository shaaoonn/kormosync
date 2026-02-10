"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { ArrowLeft, Calendar, User, Clock, Edit, Trash2, FileText, Video, Download, DollarSign, Timer, CalendarDays, Play, CheckCircle, Pause, AlertTriangle, Repeat, Lock, Shield, UserCheck, Plus, X, Send } from "lucide-react";
import toast from "react-hot-toast";

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

interface Screenshot {
    id: string;
    imageUrl: string;
    activityScore: number;
    recordedAt: string;
    keyboardCount: number;
    mouseCount: number;
}

interface TimeLog {
    id: string;
    startTime: string;
    endTime: string | null;
    durationSeconds: number | null;
}

interface ChecklistItem {
    id: string;
    title: string;
    isCompleted: boolean;
    orderIndex: number;
}

interface DependencyItem {
    id: string;
    dependsOnTask?: { id: string; title: string; status: string };
    task?: { id: string; title: string; status: string };
}

interface CustomFieldValue {
    id: string;
    value: string;
    field: { id: string; name: string; type: string; options: string[] };
}

interface ReviewCommentItem {
    id: string;
    action: string;
    comment: string | null;
    createdAt: string;
    user: { id: string; name: string; email: string };
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
    reviewer?: { id: string; name: string; email: string } | null;
    // Billing
    billingType?: string;
    fixedPrice?: number;
    hourlyRate?: number;
    estimatedHours?: number;
    scheduleDays?: number[];
    startTime?: string;
    endTime?: string;
    allowOvertime?: boolean;
    subTasks?: SubTask[];
    screenshots?: Screenshot[];
    timeLogs?: TimeLog[];
    isActive?: boolean;
    pausedAt?: string | null;
    pausedReason?: string | null;
    // Phase 9: New features
    isRecurring?: boolean;
    recurringType?: string;
    recurringEndDate?: string | null;
    recurringCount?: number | null;
    maxBudget?: number | null;
    reviewerId?: string | null;
    parentTask?: { id: string; title: string } | null;
    childTasks?: { id: string; title: string; status: string; recurringIndex: number }[];
    dependencies?: DependencyItem[];
    dependedOnBy?: DependencyItem[];
    checklist?: ChecklistItem[];
    customFieldValues?: CustomFieldValue[];
    reviewComments?: ReviewCommentItem[];
}

export default function TaskDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const taskId = params.taskId as string;

    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [currentUserId, setCurrentUserId] = useState('');

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
            setCurrentUserId(userRes.data.user?.id || '');

        } catch (error) {
            console.error("Failed to fetch task", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        auth.onAuthStateChanged((user) => {
            if (user) fetchTask();
            else setLoading(false);
        });
    }, [taskId]);

    const handleToggleActive = async () => {
        setToggling(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}/toggle-active`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Refetch task data to reflect new state
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTask(res.data.task);
            toast.success(res.data.task.isActive ? 'টাস্ক চালু করা হয়েছে' : 'টাস্ক বন্ধ করা হয়েছে');
        } catch (error) {
            console.error("Failed to toggle task active status", error);
            toast.error("টাস্কের স্ট্যাটাস পরিবর্তন করা যায়নি");
        } finally {
            setToggling(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this task?")) return;
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            router.push("/dashboard/tasks");
        } catch (error) {
            toast.error("Failed to delete task");
        }
    };

    // Checklist helpers
    const addChecklistItem = async () => {
        if (!newChecklistItem.trim()) return;
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/checklist/${taskId}`, { title: newChecklistItem.trim() }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewChecklistItem('');
            fetchTask();
        } catch { toast.error('চেকলিস্ট আইটেম যোগ ব্যর্থ'); }
    };

    const toggleChecklistItem = async (itemId: string) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/checklist/item/${itemId}/toggle`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTask();
        } catch { toast.error('আপডেট ব্যর্থ'); }
    };

    const deleteChecklistItem = async (itemId: string) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/checklist/item/${itemId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTask();
        } catch { toast.error('ডিলিট ব্যর্থ'); }
    };

    // Review helpers
    const submitForReview = async () => {
        setSubmittingReview(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/review/${taskId}/submit`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(res.data.message || 'রিভিউতে পাঠানো হয়েছে');
            fetchTask();
        } catch (err: any) { toast.error(err.response?.data?.error || 'রিভিউ পাঠানো ব্যর্থ'); }
        finally { setSubmittingReview(false); }
    };

    const handleReviewAction = async (action: 'APPROVED' | 'REQUEST_CHANGES') => {
        setSubmittingReview(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/review/${taskId}/review`, {
                action,
                comment: reviewComment || null,
            }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(action === 'APPROVED' ? 'টাস্ক অনুমোদিত ✅' : 'পরিবর্তন অনুরোধ পাঠানো হয়েছে');
            setReviewComment('');
            fetchTask();
        } catch (err: any) { toast.error(err.response?.data?.error || 'রিভিউ ব্যর্থ'); }
        finally { setSubmittingReview(false); }
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
                        <button
                            onClick={handleToggleActive}
                            disabled={toggling}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 ${
                                task?.isActive === false
                                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                        >
                            {toggling ? (
                                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : task?.isActive === false ? (
                                <Play className="w-4 h-4" />
                            ) : (
                                <Pause className="w-4 h-4" />
                            )}
                            {toggling
                                ? 'অপেক্ষা করুন...'
                                : task?.isActive === false
                                    ? 'চালু করুন'
                                    : 'বন্ধ করুন'}
                        </button>
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

            {/* Paused Warning Banner */}
            {task.isActive === false && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-amber-800 font-medium">
                            এই টাস্ক বর্তমানে বন্ধ আছে। কর্মীরা এই টাস্কে কাজ করতে পারবে না।
                        </p>
                        {task.pausedAt && (
                            <p className="text-amber-600 text-sm mt-1">
                                বন্ধ করা হয়েছে: {new Date(task.pausedAt).toLocaleDateString('bn-BD')} {new Date(task.pausedAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                        {task.pausedReason && (
                            <p className="text-amber-600 text-sm mt-1">
                                কারণ: {task.pausedReason}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Main Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Title Section */}
                <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-gray-800">{task.title}</h1>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor(task.priority)}`}>
                            {task.priority}
                        </span>
                        {task.isDraft && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Draft</span>
                        )}
                        {task.isRecurring && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1">
                                <Repeat className="w-3 h-3" /> পুনরাবৃত্তি ({task.recurringType === 'DAILY' ? 'দৈনিক' : task.recurringType === 'WEEKLY' ? 'সাপ্তাহিক' : 'মাসিক'})
                            </span>
                        )}
                        {task.parentTask && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                🔗 {task.parentTask.title}
                            </span>
                        )}
                        {task.allowOvertime && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                ⏰ ওভারটাইম
                            </span>
                        )}
                        {task.status === 'REVIEW' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                                🔍 রিভিউ
                            </span>
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

                        {/* Budget Progress for Hourly Tasks */}
                        {task.billingType === 'HOURLY' && task.estimatedHours && task.timeLogs && (
                            <div className="mt-4 p-4 bg-white rounded-lg border shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                        <Timer className="w-4 h-4" /> বাজেট ব্যবহার
                                    </span>
                                    <span className="text-sm font-medium">
                                        {(() => {
                                            const totalSeconds = task.timeLogs.reduce((sum, log) => sum + (log.durationSeconds || 0), 0);
                                            const usedHours = totalSeconds / 3600;
                                            const percentage = Math.min(100, (usedHours / task.estimatedHours) * 100);
                                            return `${usedHours.toFixed(1)} / ${task.estimatedHours} ঘন্টা (${percentage.toFixed(0)}%)`;
                                        })()}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                    {(() => {
                                        const totalSeconds = task.timeLogs.reduce((sum, log) => sum + (log.durationSeconds || 0), 0);
                                        const percentage = Math.min(100, (totalSeconds / 3600 / task.estimatedHours) * 100);
                                        const color = percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500';
                                        return (
                                            <div
                                                className={`h-full ${color} transition-all duration-500`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        );
                                    })()}
                                </div>
                                {(() => {
                                    const totalSeconds = task.timeLogs.reduce((sum, log) => sum + (log.durationSeconds || 0), 0);
                                    const usedHours = totalSeconds / 3600;
                                    const estimatedCost = task.hourlyRate ? usedHours * task.hourlyRate : 0;
                                    const budgetCost = task.hourlyRate ? task.estimatedHours * task.hourlyRate : 0;
                                    return (
                                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                                            <span>খরচ: ৳{estimatedCost.toFixed(0)}</span>
                                            <span>বাজেট: ৳{budgetCost.toFixed(0)}</span>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

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

                {/* 🔗 Dependencies Panel */}
                {((task.dependencies && task.dependencies.length > 0) || (task.dependedOnBy && task.dependedOnBy.length > 0)) && (
                    <div className="p-6 border-b">
                        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-red-500" /> নির্ভরশীলতা
                        </h2>
                        <div className="space-y-3">
                            {task.dependencies && task.dependencies.length > 0 && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-2">🚫 এই টাস্ক ব্লক করা আছে:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {task.dependencies.map(dep => (
                                            <Link key={dep.id} href={`/dashboard/tasks/${dep.dependsOnTask?.id}`}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                                                    dep.dependsOnTask?.status === 'DONE'
                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                        : 'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                {dep.dependsOnTask?.status === 'DONE' ? '✅' : '🔒'} {dep.dependsOnTask?.title}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {task.dependedOnBy && task.dependedOnBy.length > 0 && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-2">⏳ এই টাস্ক ব্লক করছে:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {task.dependedOnBy.map(dep => (
                                            <Link key={dep.id} href={`/dashboard/tasks/${dep.task?.id}`}
                                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                ⏳ {dep.task?.title}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 💰 Budget Progress Bar */}
                {task.maxBudget && task.maxBudget > 0 && (
                    <div className="p-6 border-b">
                        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-600" /> বাজেট
                        </h2>
                        {(() => {
                            const totalSeconds = (task.timeLogs || []).reduce((sum, log) => sum + (log.durationSeconds || 0), 0);
                            const usedHours = totalSeconds / 3600;
                            const rate = task.hourlyRate || 0;
                            const spent = rate > 0 ? usedHours * rate : 0;
                            const percentage = Math.min(100, (spent / task.maxBudget!) * 100);
                            const color = percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500';
                            return (
                                <div className="p-4 bg-gray-50 rounded-lg border">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-600">খরচ: ৳{spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        <span className="font-bold text-gray-800">বাজেট: ৳{task.maxBudget!.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(0)}% ব্যবহৃত</p>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* ✅ Checklist */}
                {(task.checklist || []).length > 0 || isAdmin ? (
                    <div className="p-6 border-b">
                        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-teal-600" /> চেকলিস্ট
                            {task.checklist && task.checklist.length > 0 && (
                                <span className="text-xs text-gray-400">
                                    ({task.checklist.filter(c => c.isCompleted).length}/{task.checklist.length})
                                </span>
                            )}
                        </h2>

                        {/* Checklist Progress */}
                        {task.checklist && task.checklist.length > 0 && (
                            <>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
                                    <div
                                        className="h-full bg-teal-500 transition-all duration-500"
                                        style={{ width: `${(task.checklist.filter(c => c.isCompleted).length / task.checklist.length) * 100}%` }}
                                    />
                                </div>
                                <div className="space-y-2 mb-4">
                                    {task.checklist.map(item => (
                                        <div key={item.id} className="flex items-center gap-3 group">
                                            <input
                                                type="checkbox"
                                                checked={item.isCompleted}
                                                onChange={() => toggleChecklistItem(item.id)}
                                                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                                            />
                                            <span className={`flex-1 text-sm ${item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                                {item.title}
                                            </span>
                                            <button
                                                onClick={() => deleteChecklistItem(item.id)}
                                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Add new item */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="নতুন আইটেম যোগ করুন..."
                                className="flex-1 p-2 border rounded-lg text-sm"
                                value={newChecklistItem}
                                onChange={e => setNewChecklistItem(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
                            />
                            <button
                                onClick={addChecklistItem}
                                className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" /> যোগ
                            </button>
                        </div>
                    </div>
                ) : null}

                {/* 🏷️ Custom Fields */}
                {task.customFieldValues && task.customFieldValues.length > 0 && (
                    <div className="p-6 border-b">
                        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-600" /> কাস্টম ফিল্ড
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            {task.customFieldValues.map(cfv => (
                                <div key={cfv.id} className="p-3 bg-gray-50 rounded-lg border">
                                    <p className="text-xs text-gray-500 mb-1">{cfv.field.name}</p>
                                    <p className="text-sm font-medium text-gray-800">
                                        {cfv.field.type === 'DATE' && cfv.value
                                            ? new Date(cfv.value).toLocaleDateString('bn-BD')
                                            : cfv.value || '—'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 🔍 Review / QA Section */}
                {(task.reviewerId || task.reviewer || (task.reviewComments && task.reviewComments.length > 0)) && (
                    <div className="p-6 border-b">
                        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-purple-600" /> রিভিউ / QA
                        </h2>

                        {/* Reviewer Info */}
                        {task.reviewer && (
                            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200 mb-4">
                                <UserCheck className="w-5 h-5 text-purple-600" />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">রিভিউয়ার: {task.reviewer.name || task.reviewer.email}</p>
                                    <p className="text-xs text-gray-500">
                                        {task.status === 'REVIEW' ? '🔍 রিভিউর অপেক্ষায়' : task.status === 'DONE' ? '✅ অনুমোদিত' : '⏳ কাজ চলছে'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Submit for Review Button (for assignees when task is IN_PROGRESS) */}
                        {task.status === 'IN_PROGRESS' && task.reviewerId && !isAdmin && (
                            <button
                                onClick={submitForReview}
                                disabled={submittingReview}
                                className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" /> রিভিউতে পাঠান
                            </button>
                        )}

                        {/* Review Actions (for reviewer/admin when task is in REVIEW) */}
                        {task.status === 'REVIEW' && (isAdmin || currentUserId === task.reviewerId) && (
                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-4 space-y-3">
                                <p className="text-sm font-medium text-yellow-800">📝 রিভিউ অ্যাকশন</p>
                                <textarea
                                    placeholder="মন্তব্য (ঐচ্ছিক)..."
                                    className="w-full p-2 border rounded-lg text-sm"
                                    rows={2}
                                    value={reviewComment}
                                    onChange={e => setReviewComment(e.target.value)}
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleReviewAction('APPROVED')}
                                        disabled={submittingReview}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <CheckCircle className="w-4 h-4" /> অনুমোদন
                                    </button>
                                    <button
                                        onClick={() => handleReviewAction('REQUEST_CHANGES')}
                                        disabled={submittingReview}
                                        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50"
                                    >
                                        ↩️ পরিবর্তন প্রয়োজন
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Review History */}
                        {task.reviewComments && task.reviewComments.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs text-gray-500 mb-2">রিভিউ ইতিহাস:</p>
                                {task.reviewComments.map(rc => (
                                    <div key={rc.id} className={`p-3 rounded-lg border text-sm ${
                                        rc.action === 'APPROVED' ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-gray-700">
                                                {rc.action === 'APPROVED' ? '✅ অনুমোদিত' : '↩️ পরিবর্তন অনুরোধ'}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(rc.createdAt).toLocaleDateString('bn-BD')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {rc.user.name || rc.user.email}
                                        </p>
                                        {rc.comment && <p className="text-gray-600 mt-1">{rc.comment}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Recurring Children */}
                {task.childTasks && task.childTasks.length > 0 && (
                    <div className="p-6 border-b">
                        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                            <Repeat className="w-4 h-4 text-indigo-600" /> পুনরাবৃত্তি টাস্ক ({task.childTasks.length})
                        </h2>
                        <div className="space-y-2">
                            {task.childTasks.map(child => (
                                <Link key={child.id} href={`/dashboard/tasks/${child.id}`}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-indigo-50 transition">
                                    <span className="text-sm text-gray-700">{child.title}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        child.status === 'DONE' ? 'bg-green-100 text-green-700' :
                                        child.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-500'
                                    }`}>{child.status}</span>
                                </Link>
                            ))}
                        </div>
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
                        <div className="relative bg-black rounded-lg overflow-hidden">
                            <video
                                controls
                                src={task.videoUrl}
                                className="w-full rounded-lg max-h-[500px]"
                                preload="metadata"
                                onError={(e) => {
                                    console.error("Video load error:", e);
                                    const target = e.target as HTMLVideoElement;
                                    target.style.display = 'none';
                                    target.parentElement?.querySelector('.video-error')?.classList.remove('hidden');
                                }}
                            >
                                Your browser does not support video playback.
                            </video>
                            <div className="video-error hidden absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-6">
                                <Video className="w-12 h-12 text-gray-400 mb-3" />
                                <p className="text-gray-300 text-center">ভিডিও লোড করা যায়নি</p>
                                <a
                                    href={task.videoUrl}
                                    download
                                    className="mt-3 px-4 py-2 bg-indigo-600 rounded-lg text-sm hover:bg-indigo-500 flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" /> ডাউনলোড করুন
                                </a>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-gray-500">WebM ফরম্যাট</span>
                            <a
                                href={task.videoUrl}
                                download
                                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                            >
                                <Download className="w-3 h-3" /> ডাউনলোড
                            </a>
                        </div>
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

                {/* Activity Timeline & Screenshots */}
                {task.timeLogs && task.timeLogs.length > 0 && (
                    <div className="p-6 border-b">
                        <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" /> কাজের সময়সূচী
                        </h2>
                        <div className="space-y-3">
                            {task.timeLogs.slice(0, 10).map((log, idx) => {
                                const duration = log.durationSeconds
                                    ? `${Math.floor(log.durationSeconds / 3600)}ঘ ${Math.floor((log.durationSeconds % 3600) / 60)}মি`
                                    : 'চলমান';
                                return (
                                    <div key={log.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-700">
                                                {new Date(log.startTime).toLocaleDateString('bn-BD')}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(log.startTime).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                                                {log.endTime && ` - ${new Date(log.endTime).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}`}
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${log.endTime ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {duration}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {task.timeLogs.length > 10 && (
                            <p className="text-xs text-gray-500 mt-3 text-center">
                                আরো {task.timeLogs.length - 10}টি সেশন আছে
                            </p>
                        )}
                    </div>
                )}

                {/* Screenshot Gallery */}
                {task.screenshots && task.screenshots.length > 0 && (
                    <div className="p-6">
                        <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
                            📸 স্ক্রিনশট ({task.screenshots.length})
                        </h2>
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {task.screenshots.slice(0, 20).map((ss) => (
                                <a
                                    key={ss.id}
                                    href={ss.imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group relative aspect-video bg-gray-100 rounded-lg overflow-hidden border hover:border-indigo-400 transition"
                                >
                                    <img
                                        src={ss.imageUrl}
                                        alt="Screenshot"
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white p-2">
                                        <div className="text-xs font-medium">
                                            {new Date(ss.recordedAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="text-xs mt-1">
                                            ⌨️ {ss.keyboardCount} 🖱️ {ss.mouseCount}
                                        </div>
                                        <div className={`mt-1 px-2 py-0.5 rounded text-xs ${ss.activityScore >= 70 ? 'bg-green-500' : ss.activityScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                            {ss.activityScore}% Active
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                        {task.screenshots.length > 20 && (
                            <p className="text-xs text-gray-500 mt-3 text-center">
                                আরো {task.screenshots.length - 20}টি স্ক্রিনশট আছে
                            </p>
                        )}
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
