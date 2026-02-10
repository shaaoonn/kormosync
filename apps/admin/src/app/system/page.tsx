"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Activity, Clock, Camera, FileText, Wallet, HardDrive, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

interface SystemHealth {
    health: {
        status: string;
        serverTime: string;
        uptimeSeconds: number;
        memoryMB: number;
    };
    lastHour: {
        activityLogs: number;
        screenshots: number;
        timeLogs: number;
    };
    last24Hours: {
        activityLogs: number;
        screenshots: number;
        auditLogs: number;
    };
    payroll: {
        totalPayPeriods: number;
        openPayPeriods: number;
        pendingInvoices: number;
    };
    recentAuditEntries: Array<{
        id: string;
        action: string;
        field: string | null;
        oldValue: string | null;
        newValue: string | null;
        userName: string;
        taskTitle: string;
        createdAt: string;
    }>;
}

export default function SystemPage() {
    const [data, setData] = useState<SystemHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const res = await api.get("/admin/system-health");
            if (res.data.success) setData(res.data);
        } catch (err) {
            console.error("Failed to fetch system health", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const formatUptime = (seconds: number) => {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return `${d}d ${h}h ${m}m`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const actionColor = (action: string) => {
        switch (action) {
            case "CREATED": return "bg-green-500/20 text-green-400";
            case "UPDATED": case "STATUS_CHANGED": return "bg-blue-500/20 text-blue-400";
            case "DELETED": return "bg-red-500/20 text-red-400";
            case "ASSIGNED": return "bg-purple-500/20 text-purple-400";
            default: return "bg-gray-500/20 text-gray-400";
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64 text-slate-400">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mr-3" />
                    Loading system status...
                </div>
            </DashboardLayout>
        );
    }

    if (!data) {
        return (
            <DashboardLayout>
                <div className="text-center text-slate-400 py-20">Failed to load system health</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="w-6 h-6 text-green-400" />
                        <h1 className="text-2xl font-bold text-slate-100">System Health</h1>
                    </div>
                    <button onClick={handleRefresh} disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 text-sm transition">
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>

                {/* Server Status */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-sm text-slate-400">Status</span>
                        </div>
                        <p className="text-xl font-bold text-green-400 capitalize">{data.health.status}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-slate-400">Uptime</span>
                        </div>
                        <p className="text-xl font-bold text-blue-400">{formatUptime(data.health.uptimeSeconds)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <HardDrive className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-slate-400">Memory</span>
                        </div>
                        <p className="text-xl font-bold text-purple-400">{data.health.memoryMB} MB</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-400">Server Time</span>
                        </div>
                        <p className="text-sm font-mono text-slate-300">{new Date(data.health.serverTime).toLocaleString()}</p>
                    </div>
                </div>

                {/* Activity Volume */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Last Hour */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Last Hour</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-300 flex items-center gap-2"><Activity className="w-4 h-4 text-green-400" /> Activity Logs</span>
                                <span className="font-bold text-slate-100">{data.lastHour.activityLogs}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-300 flex items-center gap-2"><Camera className="w-4 h-4 text-blue-400" /> Screenshots</span>
                                <span className="font-bold text-slate-100">{data.lastHour.screenshots}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-300 flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-400" /> Time Logs</span>
                                <span className="font-bold text-slate-100">{data.lastHour.timeLogs}</span>
                            </div>
                        </div>
                    </div>

                    {/* Last 24 Hours */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Last 24 Hours</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-300 flex items-center gap-2"><Activity className="w-4 h-4 text-green-400" /> Activity Logs</span>
                                <span className="font-bold text-slate-100">{data.last24Hours.activityLogs}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-300 flex items-center gap-2"><Camera className="w-4 h-4 text-blue-400" /> Screenshots</span>
                                <span className="font-bold text-slate-100">{data.last24Hours.screenshots}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-300 flex items-center gap-2"><FileText className="w-4 h-4 text-purple-400" /> Audit Logs</span>
                                <span className="font-bold text-slate-100">{data.last24Hours.auditLogs}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payroll Status */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Wallet className="w-5 h-5 text-green-400" />
                        <h3 className="font-semibold text-slate-200">Payroll Status</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-slate-100">{data.payroll.totalPayPeriods}</p>
                            <p className="text-xs text-slate-500">Total Pay Periods</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-blue-400">{data.payroll.openPayPeriods}</p>
                            <p className="text-xs text-slate-500">Open Periods</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-yellow-400">{data.payroll.pendingInvoices}</p>
                            <p className="text-xs text-slate-500">Pending Invoices</p>
                        </div>
                    </div>
                </div>

                {/* Audit Log */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800">
                        <h3 className="font-semibold text-slate-200">Recent Audit Log</h3>
                    </div>
                    <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
                        {data.recentAuditEntries.length === 0 ? (
                            <div className="px-6 py-8 text-center text-slate-500">No recent audit entries</div>
                        ) : (
                            data.recentAuditEntries.map((entry) => (
                                <div key={entry.id} className="px-6 py-3 flex items-start gap-4 hover:bg-slate-800/50">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 ${actionColor(entry.action)}`}>
                                        {entry.action}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-200 truncate">
                                            <span className="text-slate-400">{entry.userName}</span>
                                            {entry.field && <span className="text-slate-500"> changed <span className="text-slate-300">{entry.field}</span></span>}
                                            {" on "}
                                            <span className="text-slate-300">{entry.taskTitle}</span>
                                        </p>
                                        {entry.oldValue && entry.newValue && (
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                <span className="text-red-400/70 line-through">{entry.oldValue.slice(0, 50)}</span>
                                                {" → "}
                                                <span className="text-green-400/70">{entry.newValue.slice(0, 50)}</span>
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-600 whitespace-nowrap">
                                        {new Date(entry.createdAt).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
