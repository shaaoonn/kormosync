"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Edit2, Monitor, Plus, X, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { auth } from "@/lib/firebase";

interface TaskItem {
    id: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    scheduleType: string | null;
    scheduleDays: number[];
    startTime: string | null;
    endTime: string | null;
}

interface Props {
    userId: string;
}

const STATUS_COLORS: Record<string, string> = {
    TODO: "bg-slate-100 text-slate-700",
    IN_PROGRESS: "bg-green-100 text-green-700",
    REVIEW: "bg-amber-100 text-amber-700",
    DONE: "bg-red-100 text-red-700",
};

const PRIORITY_COLORS: Record<string, string> = {
    LOW: "bg-slate-100 text-slate-600",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    HIGH: "bg-red-100 text-red-700",
};

const DAY_NAMES_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function AssignedTasksList({ userId }: Props) {
    const router = useRouter();
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [availableTasks, setAvailableTasks] = useState<{ id: string; title: string }[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [assigning, setAssigning] = useState(false);
    const [loadingTasks, setLoadingTasks] = useState(false);

    const fetchTasks = useCallback(async () => {
        try {
            setLoading(true);
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/profile/employee/${userId}/assigned-tasks`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setTasks(res.data.tasks || []);
            }
        } catch (error) {
            console.error("Failed to fetch assigned tasks", error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const fetchAvailableTasks = async () => {
        setLoadingTasks(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/tasks`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                const assignedIds = new Set(tasks.map(t => t.id));
                const filtered = (res.data.tasks || []).filter(
                    (t: any) => !assignedIds.has(t.id) && t.status !== 'DONE'
                );
                setAvailableTasks(filtered.map((t: any) => ({ id: t.id, title: t.title })));
            }
        } catch (error) {
            console.error("Failed to fetch available tasks", error);
        } finally {
            setLoadingTasks(false);
        }
    };

    const openAssignModal = () => {
        setShowAssignModal(true);
        setSearchQuery("");
        fetchAvailableTasks();
    };

    const assignTask = async (taskId: string) => {
        setAssigning(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            // Create assignment and connect the user
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}/assign`,
                { userId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setShowAssignModal(false);
            fetchTasks();
        } catch (error) {
            console.error("Failed to assign task", error);
        } finally {
            setAssigning(false);
        }
    };

    const formatSchedule = (task: TaskItem): string => {
        const parts: string[] = [];
        if (task.scheduleType) parts.push(task.scheduleType);
        if (task.scheduleDays?.length) {
            parts.push(`(${task.scheduleDays.map(d => DAY_NAMES_SHORT[d]).join(", ")})`);
        }
        if (task.startTime && task.endTime) {
            parts.push(`${task.startTime}-${task.endTime}`);
        }
        return parts.length > 0 ? parts.join(" ") : "No schedule";
    };

    const filteredAvailable = availableTasks.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-slate-800">Assigned Tasks</h3>
                </div>
                <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-slate-100 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-slate-800">Assigned Tasks</h3>
                    <span className="text-sm text-slate-500">({tasks.length})</span>
                </div>
                <button
                    onClick={openAssignModal}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Assign Task
                </button>
            </div>

            {tasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tasks assigned</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {tasks.map(task => (
                        <div
                            key={task.id}
                            className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status] || "bg-slate-100 text-slate-600"}`}>
                                            {task.status.replace("_", " ")}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority] || "bg-slate-100 text-slate-600"}`}>
                                            {task.priority}
                                        </span>
                                        {task.deadline && (
                                            <span className="text-[10px] text-slate-400">
                                                Due: {new Date(task.deadline).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => router.push(`/dashboard/tasks/${task.id}/edit`)}
                                        className="text-slate-400 hover:text-indigo-600 p-1.5 rounded transition-colors"
                                        title="Edit task"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => router.push(`/dashboard/monitoring/${task.id}`)}
                                        className="text-slate-400 hover:text-green-600 p-1.5 rounded transition-colors"
                                        title="Monitor task"
                                    >
                                        <Monitor className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Schedule display */}
                            <div className="mt-2 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                                {formatSchedule(task)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Assign Task Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h4 className="text-base font-semibold text-slate-800">Assign Task</h4>
                            <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search tasks..."
                                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
                            {loadingTasks ? (
                                <div className="text-center py-6 text-slate-400 text-sm">Loading tasks...</div>
                            ) : filteredAvailable.length === 0 ? (
                                <div className="text-center py-6 text-slate-400 text-sm">No available tasks found</div>
                            ) : (
                                filteredAvailable.map(task => (
                                    <button
                                        key={task.id}
                                        onClick={() => assignTask(task.id)}
                                        disabled={assigning}
                                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-indigo-50 text-sm text-slate-700 transition-colors disabled:opacity-50"
                                    >
                                        {task.title}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
