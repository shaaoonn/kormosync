"use client";

import { useSearchParams } from "next/navigation";
import { Users, CheckSquare, ListTodo, HardDrive, X, Clock, Loader2 } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";

interface DashboardStats {
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    pendingTasks: number;
    totalEmployees: number;
    maxEmployees: number;
    storageUsed: number;
    storageLimit: number;
    recentTasks: Array<{
        id: string;
        title: string;
        status: string;
        priority: string;
        createdAt: string;
    }>;
}

function AdminDashboard({ showSuccess, setShowSuccess }: { showSuccess: boolean, setShowSuccess: (v: boolean) => void }) {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;

                const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/stats`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(res.data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchStats();
            else setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const statCards = [
        {
            title: "Total Employees",
            value: stats?.totalEmployees || 0,
            subtitle: `of ${stats?.maxEmployees || 0} max`,
            icon: Users,
            color: "bg-blue-100 text-blue-600"
        },
        {
            title: "Active Tasks",
            value: stats?.activeTasks || 0,
            subtitle: `${stats?.pendingTasks || 0} pending`,
            icon: CheckSquare,
            color: "bg-green-100 text-green-600"
        },
        {
            title: "Total Tasks",
            value: stats?.totalTasks || 0,
            subtitle: `${stats?.completedTasks || 0} completed`,
            icon: ListTodo,
            color: "bg-purple-100 text-purple-600"
        },
        {
            title: "Storage Used",
            value: `${((stats?.storageUsed || 0) / 1024).toFixed(1)} GB`,
            subtitle: `of ${((stats?.storageLimit || 0) / 1024).toFixed(0)} GB`,
            icon: HardDrive,
            color: "bg-orange-100 text-orange-600"
        },
    ];

    return (
        <div className="space-y-6">
            {showSuccess && (
                <div className="bg-green-500 text-white p-4 rounded-xl shadow-lg flex items-center justify-between animate-bounce-short">
                    <div>
                        <h3 className="font-bold text-lg">🎉 Subscription Activated!</h3>
                        <p className="text-sm opacity-90">Thank you for upgrading. All features are now unlocked.</p>
                    </div>
                    <button onClick={() => setShowSuccess(false)} className="p-2 hover:bg-green-600 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            <h1 className="text-2xl font-bold text-gray-800">Workspace Overview</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.title} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-lg ${stat.color}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="mt-4 text-sm text-gray-400">
                                {stat.subtitle}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Recent Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-600" /> Recent Tasks
                    </h3>
                    {stats?.recentTasks && stats.recentTasks.length > 0 ? (
                        <div className="space-y-3">
                            {stats.recentTasks.map((task) => (
                                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">{task.title}</p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(task.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                            task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {task.status.replace('_', ' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-8">
                            <ListTodo className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No tasks yet. Create your first task!</p>
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-purple-600" /> Storage Usage
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600">Used</span>
                                <span className="font-medium text-gray-800">
                                    {((stats?.storageUsed || 0) / 1024).toFixed(2)} GB / {((stats?.storageLimit || 0) / 1024).toFixed(0)} GB
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-gradient-to-r from-purple-500 to-indigo-600 h-3 rounded-full transition-all"
                                    style={{ width: `${Math.min(((stats?.storageUsed || 0) / (stats?.storageLimit || 1)) * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400">
                            {(((stats?.storageLimit || 0) - (stats?.storageUsed || 0)) / 1024).toFixed(2)} GB remaining
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DashboardContent() {
    const searchParams = useSearchParams();
    const [showSuccess, setShowSuccess] = useState(false);
    const { user, loading } = useAuth();

    useEffect(() => {
        if (searchParams.get("payment") === "success") {
            setShowSuccess(true);
            window.history.replaceState(null, "", "/dashboard");
        }
    }, [searchParams]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;
    }

    const role = user?.role || "EMPLOYEE";
    const isAdmin = role === "OWNER" || role === "ADMIN";

    if (isAdmin) {
        return <AdminDashboard showSuccess={showSuccess} setShowSuccess={setShowSuccess} />;
    }

    return <EmployeeDashboard />;
}

export default function Dashboard() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
            <DashboardContent />
        </Suspense>
    );
}
