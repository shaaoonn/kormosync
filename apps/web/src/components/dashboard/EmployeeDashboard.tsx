"use client";

import { useEffect, useState } from "react";
import { Download, Clock, CheckSquare, DollarSign, Monitor } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";

interface Stats {
    pendingTasks: number;
    hoursWorked: number;
    earnings: number;
}

interface Screenshot {
    id: string;
    imageUrl: string;
    createdAt: string;
}

export default function EmployeeDashboard() {
    const [stats, setStats] = useState<Stats>({ pendingTasks: 0, hoursWorked: 0, earnings: 0 });
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("Employee");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();

                // Fetch user info
                const userRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUserName(userRes.data.user?.name || "Employee");

                // For now, using placeholder data
                // TODO: Create backend endpoints for employee stats
                setStats({
                    pendingTasks: 3,
                    hoursWorked: 42.5,
                    earnings: 5200
                });

                setScreenshots([]);

            } catch (error) {
                console.error("Failed to fetch employee data", error);
            } finally {
                setLoading(false);
            }
        };

        auth.onAuthStateChanged((user) => {
            if (user) fetchData();
            else setLoading(false);
        });
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Welcome Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Welcome, {userName}!</h1>
                <p className="text-gray-500">Here's your work summary</p>
            </div>

            {/* Download Desktop App Card */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Monitor className="w-6 h-6" />
                            <h2 className="text-xl font-bold">Download KormoSync Desktop</h2>
                        </div>
                        <p className="text-indigo-100 text-sm max-w-md">
                            Install our desktop app to automatically track your work hours and take screenshots.
                        </p>
                    </div>
                    <a
                        href="/download/KormoSync-Setup.exe"
                        className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition shadow-md"
                    >
                        <Download className="w-5 h-5" />
                        Download for Windows
                    </a>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Pending Tasks */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                            <CheckSquare className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">My Pending Tasks</p>
                            <p className="text-2xl font-bold text-gray-800">{stats.pendingTasks}</p>
                        </div>
                    </div>
                </div>

                {/* Hours Worked */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Clock className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Hours This Month</p>
                            <p className="text-2xl font-bold text-gray-800">{stats.hoursWorked}h</p>
                        </div>
                    </div>
                </div>

                {/* Earnings */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">My Earnings</p>
                            <p className="text-2xl font-bold text-gray-800">{stats.earnings.toLocaleString()} BDT</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Screenshots */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">My Recent Activity</h2>

                {screenshots.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No screenshots yet. Download the desktop app to start tracking!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {screenshots.slice(0, 8).map((ss) => (
                            <div key={ss.id} className="rounded-lg overflow-hidden border">
                                <img src={ss.imageUrl} alt="Screenshot" className="w-full h-24 object-cover" />
                                <div className="p-2 text-xs text-gray-500 bg-gray-50">
                                    {new Date(ss.createdAt).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
