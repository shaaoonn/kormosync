"use client";

import { useEffect, useState, useRef } from "react";
import { Download, Clock, CheckSquare, DollarSign, Monitor, CalendarDays, Briefcase, TrendingUp } from "lucide-react";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface Stats {
    pendingTasks: number;
    hoursWorked: number;
    earnings: number;
    currency: string;
}

interface CurrentEarnings {
    periodStart: string;
    periodEnd: string;
    workedHours: number;
    workedAmount: number;
    paidLeaveDays: number;
    leaveHours: number;
    leavePay: number;
    overtimeHours: number;
    overtimePay: number;
    overtimeRate: number;
    penaltyAmount: number;
    salaryType: string;
    monthlySalary: number;
    workedDays: number;
    totalWorkingDays: number;
    grossAmount: number;
    netAmount: number;
    currency: string;
}

interface LeaveBalanceData {
    paidLeave: number;
    sickLeave: number;
    paidUsed: number;
    sickUsed: number;
    paidRemaining: number;
    sickRemaining: number;
}

interface Screenshot {
    id: string;
    imageUrl: string;
    createdAt: string;
}

export default function EmployeeDashboard() {
    const { user, token, loading: authLoading } = useAuth();
    const [stats, setStats] = useState<Stats>({ pendingTasks: 0, hoursWorked: 0, earnings: 0, currency: 'BDT' });
    const [currentEarnings, setCurrentEarnings] = useState<CurrentEarnings | null>(null);
    const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceData | null>(null);
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [loading, setLoading] = useState(true);

    // Use name from AuthContext — no duplicate /auth/sync call
    const userName = user?.name || "Employee";
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    useEffect(() => {
        if (authLoading || !token) return;

        const fetchData = async () => {
            try {
                // Fetch all data in parallel
                const [statsRes, earningsRes, leaveRes] = await Promise.all([
                    axios.get(`${API_URL}/dashboard/employee-stats`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axios.get(`${API_URL}/payroll/current-earnings`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).catch(() => null),
                    axios.get(`${API_URL}/leave/my-balance`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).catch(() => null),
                ]);

                if (statsRes.data.success) {
                    const s = statsRes.data.stats;
                    setStats({
                        pendingTasks: s.pendingTasks,
                        hoursWorked: s.hoursThisMonth,
                        earnings: s.earningsThisMonth,
                        currency: s.currency || 'BDT',
                    });
                }

                if (earningsRes?.data?.success) {
                    setCurrentEarnings(earningsRes.data.earnings);
                }

                if (leaveRes?.data?.success) {
                    setLeaveBalance(leaveRes.data.balance);
                }

                setScreenshots([]);
            } catch (error) {
                console.error("Failed to fetch employee data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, authLoading]);

    // Socket.IO: real-time earnings update on screenshot upload
    useEffect(() => {
        if (!token || authLoading) return;
        const API_BASE = (API_URL || '').replace('/api', '');
        const socket: Socket = io(API_BASE, { transports: ['websocket'], auth: { token } });

        socket.on('earnings:updated', () => {
            // Immediate refresh after screenshot upload on desktop
            axios.get(`${API_URL}/payroll/current-earnings`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                if (res?.data?.success) setCurrentEarnings(res.data.earnings);
            }).catch(() => {});
        });

        return () => { socket.disconnect(); };
    }, [token, authLoading]);

    // Fallback poll: refresh earnings every 2 minutes
    useEffect(() => {
        if (!token || authLoading) return;
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                axios.get(`${API_URL}/payroll/current-earnings`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).then(res => {
                    if (res?.data?.success) setCurrentEarnings(res.data.earnings);
                }).catch(() => {});
            }
        }, 120000); // 2 minutes fallback
        return () => clearInterval(interval);
    }, [token, authLoading]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Welcome Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Welcome, {userName}!</h1>
                <p className="text-gray-500">Here&apos;s your work summary</p>
            </div>

            {/* Real-Time Earnings Card */}
            {currentEarnings && (
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
                    <div className="relative z-10">
                        <p className="text-sm text-green-100 mb-1 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Since last pay period
                        </p>
                        <p className="text-4xl font-bold mb-3">
                            {currentEarnings.currency === 'BDT' ? '৳' : '$'}
                            {currentEarnings.netAmount?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
                        </p>
                        <div className="flex gap-4 text-sm text-green-100 flex-wrap">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {(currentEarnings.workedHours || 0).toFixed(1)}h worked
                            </span>
                            {currentEarnings.paidLeaveDays > 0 && (
                                <span className="flex items-center gap-1">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    {currentEarnings.paidLeaveDays}d leave
                                </span>
                            )}
                            {currentEarnings.overtimeHours > 0 && (
                                <span className="flex items-center gap-1">
                                    <Briefcase className="w-3.5 h-3.5" />
                                    {currentEarnings.overtimeHours.toFixed(1)}h overtime
                                </span>
                            )}
                            {currentEarnings.penaltyAmount > 0 && (
                                <span className="text-red-200">
                                    -{currentEarnings.currency === 'BDT' ? '৳' : '$'}{currentEarnings.penaltyAmount.toLocaleString()} penalty
                                </span>
                            )}
                        </div>
                        {leaveBalance && (
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/20">
                                <div className="flex gap-4 text-sm text-green-100">
                                    <span>Paid leave: {leaveBalance.paidRemaining ?? (leaveBalance.paidLeave - leaveBalance.paidUsed)}d left</span>
                                    <span>Sick: {leaveBalance.sickRemaining ?? (leaveBalance.sickLeave - leaveBalance.sickUsed)}d left</span>
                                </div>
                                <Link href="/dashboard/leave"
                                    className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-full text-xs font-semibold hover:bg-white/30 transition">
                                    Request Leave
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                            <p className="text-2xl font-bold text-gray-800">{stats.earnings.toLocaleString()} {stats.currency}</p>
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
