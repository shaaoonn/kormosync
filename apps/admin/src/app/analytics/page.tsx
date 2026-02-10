"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import Link from "next/link";
import { TrendingUp, Users, Building2, CheckCircle, Clock, Camera, DollarSign, UserPlus, Activity } from "lucide-react";

interface Analytics {
    overview: {
        totalCompanies: number;
        activeCompanies: number;
        inactiveCompanies: number;
        totalUsers: number;
        totalTasks: number;
        completedTasks: number;
        totalScreenshots: number;
        totalHoursTracked: number;
        recentSignups: number;
        weeklyActiveUsers: number;
        totalRevenue: number;
        monthlyRevenue: number;
    };
    signupsByDay: Record<string, number>;
    topCompanies: Array<{
        id: string;
        name: string;
        employeeCount: number;
        taskCount: number;
    }>;
}

export default function AnalyticsPage() {
    const [data, setData] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get("/admin/analytics");
                if (res.data.success) setData(res.data);
            } catch (err) {
                console.error("Failed to fetch analytics", err);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64 text-slate-400">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mr-3" />
                    Loading analytics...
                </div>
            </DashboardLayout>
        );
    }

    if (!data) {
        return (
            <DashboardLayout>
                <div className="text-center text-slate-400 py-20">Failed to load analytics</div>
            </DashboardLayout>
        );
    }

    const o = data.overview;

    const statCards = [
        { label: "Total Companies", value: o.totalCompanies, icon: Building2, color: "text-blue-400", sub: `${o.activeCompanies} active` },
        { label: "Total Users", value: o.totalUsers, icon: Users, color: "text-purple-400", sub: `${o.recentSignups} new (30d)` },
        { label: "Weekly Active", value: o.weeklyActiveUsers, icon: Activity, color: "text-green-400", sub: "last 7 days" },
        { label: "Total Tasks", value: o.totalTasks, icon: CheckCircle, color: "text-yellow-400", sub: `${o.completedTasks} completed` },
        { label: "Hours Tracked", value: `${o.totalHoursTracked.toLocaleString()}h`, icon: Clock, color: "text-cyan-400", sub: "all time" },
        { label: "Screenshots", value: o.totalScreenshots.toLocaleString(), icon: Camera, color: "text-pink-400", sub: "total captured" },
        { label: "Total Revenue", value: `${o.totalRevenue.toLocaleString()} BDT`, icon: DollarSign, color: "text-green-400", sub: "all time" },
        { label: "Monthly Revenue", value: `${o.monthlyRevenue.toLocaleString()} BDT`, icon: TrendingUp, color: "text-emerald-400", sub: "current month" },
    ];

    // Signup chart (last 30 days)
    const sortedDays = Object.entries(data.signupsByDay).sort(([a], [b]) => a.localeCompare(b));
    const maxSignups = Math.max(...sortedDays.map(([, v]) => v), 1);

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-100">Global Analytics</h1>
                    <span className="text-xs text-slate-500">Platform-wide metrics</span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {statCards.map((card) => (
                        <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <card.icon className={`w-5 h-5 ${card.color}`} />
                                <span className="text-sm text-slate-400">{card.label}</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-100">{card.value}</p>
                            <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Signup Chart + Top Companies */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Signup Trend */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <UserPlus className="w-5 h-5 text-blue-400" />
                            <h3 className="font-semibold text-slate-200">New Signups (30 days)</h3>
                        </div>
                        {sortedDays.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-8">No signups in the last 30 days</p>
                        ) : (
                            <div className="flex items-end gap-1 h-32">
                                {sortedDays.map(([day, count]) => (
                                    <div key={day} className="flex-1 flex flex-col items-center group relative">
                                        <div
                                            className="w-full bg-blue-500/80 rounded-t transition-all hover:bg-blue-400 min-h-[2px]"
                                            style={{ height: `${(count / maxSignups) * 100}%` }}
                                        />
                                        <div className="absolute -top-6 hidden group-hover:block bg-slate-700 text-xs text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                                            {day.slice(5)}: {count}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Top Companies */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 className="w-5 h-5 text-purple-400" />
                            <h3 className="font-semibold text-slate-200">Top Companies</h3>
                        </div>
                        <div className="space-y-3">
                            {data.topCompanies.map((company, idx) => (
                                <Link key={company.id} href={`/companies/${company.id}`}
                                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-slate-500 w-5">#{idx + 1}</span>
                                        <span className="text-sm font-medium text-slate-200">{company.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-400">
                                        <span>{company.employeeCount} users</span>
                                        <span>{company.taskCount} tasks</span>
                                    </div>
                                </Link>
                            ))}
                            {data.topCompanies.length === 0 && (
                                <p className="text-slate-500 text-sm text-center py-4">No active companies</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
