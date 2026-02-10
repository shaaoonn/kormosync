"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, User, Calendar, Clock, UserPlus, X, Check } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";

interface Assignee {
    id: string;
    name: string | null;
    profileImage: string | null;
    email: string | null;
}

interface Task {
    id: string;
    title: string;
    priority: string;
    status: string;
    isDraft: boolean;
    isActive?: boolean;
    deadline: string | null;
    createdAt: string;
    creator: { name: string | null; email: string | null };
    assignees: Assignee[];
    // Phase 9 fields
    isRecurring?: boolean;
    recurringType?: string;
    maxBudget?: number | null;
    allowOvertime?: boolean;
    reviewerId?: string | null;
}

interface Member {
    id: string;
    name: string | null;
    email: string;
    profileImage: string | null;
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isFreelancer, setIsFreelancer] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
    const [assigning, setAssigning] = useState(false);

    const fetchTasks = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/tasks/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTasks(res.data.tasks || []);
            setIsAdmin(res.data.isAdmin || false);
            setIsFreelancer(res.data.role === 'FREELANCER');
        } catch (error) {
            console.error("Failed to fetch tasks", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/company/members`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMembers(res.data.members || []);
        } catch (error) {
            console.error("Failed to fetch members", error);
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchTasks();
                fetchMembers();
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const priorityColor = (p: string) => {
        if (p === 'HIGH') return 'bg-red-100 text-red-700';
        if (p === 'LOW') return 'bg-green-100 text-green-700';
        return 'bg-yellow-100 text-yellow-700';
    };

    const getAvatar = (assignee: Assignee | Member) => {
        if (assignee.profileImage) return assignee.profileImage;
        const name = assignee.name || assignee.email || "U";
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=40`;
    };

    const openAssignModal = (task: Task) => {
        setSelectedTask(task);
        setSelectedAssignees(task.assignees.map(a => a.id));
        setShowAssignModal(true);
    };

    const toggleAssignee = (memberId: string) => {
        if (selectedAssignees.includes(memberId)) {
            setSelectedAssignees(selectedAssignees.filter(id => id !== memberId));
        } else {
            setSelectedAssignees([...selectedAssignees, memberId]);
        }
    };

    const handleAssign = async () => {
        if (!selectedTask) return;
        setAssigning(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${selectedTask.id}`, {
                assigneeIds: selectedAssignees
            }, { headers: { Authorization: `Bearer ${token}` } });

            setShowAssignModal(false);
            fetchTasks();
        } catch (error) {
            toast.error("Failed to assign employees");
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">
                    {isAdmin ? "Tasks" : "My Tasks"}
                </h1>
                {(isAdmin || isFreelancer) && (
                    <Link
                        href="/dashboard/tasks/create"
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Create Task
                    </Link>
                )}
            </div>

            {loading ? (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
                    <p>Loading tasks...</p>
                </div>
            ) : tasks.length === 0 ? (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
                    <p>{isAdmin ? "No tasks found. Create one to get started!" : "No tasks assigned to you yet."}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {tasks.map(task => (
                        <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        {/* Assignee Avatars - Stacked */}
                                        {task.assignees && task.assignees.length > 0 && (
                                            <div className="flex -space-x-2">
                                                {task.assignees.slice(0, 4).map((assignee, idx) => (
                                                    <img
                                                        key={assignee.id}
                                                        src={getAvatar(assignee)}
                                                        alt={assignee.name || "Assignee"}
                                                        title={assignee.name || assignee.email || ""}
                                                        className="w-8 h-8 rounded-full border-2 border-white object-cover"
                                                        style={{ zIndex: task.assignees.length - idx }}
                                                    />
                                                ))}
                                                {task.assignees.length > 4 && (
                                                    <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                        +{task.assignees.length - 4}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <h3 className="font-semibold text-gray-800">{task.title}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor(task.priority)}`}>
                                            {task.priority}
                                        </span>
                                        {task.isDraft && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Draft</span>
                                        )}
                                        {task.isActive === false && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                                                বন্ধ
                                            </span>
                                        )}
                                        {task.isRecurring && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                                🔄 {task.recurringType === 'DAILY' ? 'দৈনিক' : task.recurringType === 'WEEKLY' ? 'সাপ্তাহিক' : 'মাসিক'}
                                            </span>
                                        )}
                                        {task.maxBudget && task.maxBudget > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                                💰 ৳{task.maxBudget.toLocaleString()}
                                            </span>
                                        )}
                                        {task.allowOvertime && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                                ⏰ OT
                                            </span>
                                        )}
                                        {task.status === 'REVIEW' && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                                                🔍 রিভিউ
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 ml-12">
                                        <span className="flex items-center gap-1">
                                            <User className="w-3 h-3" /> {task.creator?.name || task.creator?.email || 'Unknown'}
                                        </span>
                                        {task.deadline && (
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> {new Date(task.deadline).toLocaleDateString()}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {new Date(task.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isAdmin && (
                                        <button
                                            onClick={() => openAssignModal(task)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-sm font-medium"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            Assign
                                        </button>
                                    )}
                                    <Link href={`/dashboard/tasks/${task.id}`} className="text-indigo-600 text-sm font-medium hover:underline">
                                        View →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Assign Employee Modal */}
            {showAssignModal && selectedTask && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800">Assign Employees</h2>
                            <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-gray-500">
                            Select employees to assign to <strong>{selectedTask.title}</strong>
                        </p>

                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {members.map(member => (
                                <div
                                    key={member.id}
                                    onClick={() => toggleAssignee(member.id)}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${selectedAssignees.includes(member.id)
                                        ? 'bg-indigo-50 border-2 border-indigo-400'
                                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    <img
                                        src={getAvatar(member)}
                                        alt={member.name || ""}
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800">{member.name || "Unnamed"}</p>
                                        <p className="text-xs text-gray-500">{member.email}</p>
                                    </div>
                                    {selectedAssignees.includes(member.id) && (
                                        <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                                            <Check className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssign}
                                disabled={assigning}
                                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
                            >
                                {assigning ? "Saving..." : `Assign (${selectedAssignees.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
