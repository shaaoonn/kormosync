"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { DollarSign, TrendingUp, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";

interface Payment {
    id: string;
    trxID: string;
    amount: number;
    status: string;
    companyName: string;
    companyId: string;
    paymentDate: string;
    createdAt: string;
}

interface MonthData {
    month: number;
    label: string;
    revenue: number;
    count: number;
}

interface RevenueChart {
    year: number;
    totalRevenue: number;
    totalTransactions: number;
    monthly: MonthData[];
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function FinancialsPage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [chart, setChart] = useState<RevenueChart | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartYear, setChartYear] = useState(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState("");

    const fetchPayments = async (page = 1) => {
        try {
            const params: any = { page, limit: 20 };
            if (statusFilter) params.status = statusFilter;
            const res = await api.get("/admin/payments", { params });
            setPayments(res.data.payments);
            setPagination(res.data.pagination);
        } catch (error) {
            console.error("Failed to fetch payments", error);
        }
    };

    const fetchChart = async (year: number) => {
        try {
            const res = await api.get("/admin/revenue/chart", { params: { year } });
            setChart(res.data);
        } catch (error) {
            console.error("Failed to fetch revenue chart", error);
        }
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchPayments(1), fetchChart(chartYear)]);
            setLoading(false);
        };
        load();
    }, []);

    useEffect(() => {
        fetchPayments(1);
    }, [statusFilter]);

    useEffect(() => {
        fetchChart(chartYear);
    }, [chartYear]);

    const maxRevenue = chart ? Math.max(...chart.monthly.map(m => m.revenue), 1) : 1;

    const statusColor = (status: string) => {
        switch (status) {
            case "SUCCESS": return "bg-green-500/20 text-green-400";
            case "PENDING": return "bg-yellow-500/20 text-yellow-400";
            case "FAILED": return "bg-red-500/20 text-red-400";
            default: return "bg-slate-500/20 text-slate-400";
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64 text-slate-400">Loading financials...</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-slate-100">Financial Reports</h1>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400">Total Revenue ({chart?.year})</p>
                                <p className="text-xl font-bold text-slate-100">BDT {chart?.totalRevenue.toLocaleString() || 0}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400">Total Transactions ({chart?.year})</p>
                                <p className="text-xl font-bold text-slate-100">{chart?.totalTransactions || 0}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400">All-Time Payments</p>
                                <p className="text-xl font-bold text-slate-100">{pagination.total}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Revenue Chart */}
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-slate-100">Monthly Revenue</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setChartYear(y => y - 1)}
                                className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-slate-300 w-12 text-center">{chartYear}</span>
                            <button
                                onClick={() => setChartYear(y => y + 1)}
                                className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-end gap-2 h-48">
                        {chart?.monthly.map((m) => (
                            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs text-slate-400">
                                    {m.revenue > 0 ? `${(m.revenue / 1000).toFixed(1)}k` : ""}
                                </span>
                                <div
                                    className="w-full rounded-t bg-primary/80 hover:bg-primary transition-all min-h-[2px]"
                                    style={{ height: `${Math.max((m.revenue / maxRevenue) * 100, m.revenue > 0 ? 5 : 1)}%` }}
                                    title={`${m.label}: BDT ${m.revenue.toLocaleString()} (${m.count} txns)`}
                                />
                                <span className="text-xs text-slate-500">{m.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment History Table */}
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-100">Payment History</h2>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="">All Status</option>
                            <option value="SUCCESS">Success</option>
                            <option value="PENDING">Pending</option>
                            <option value="FAILED">Failed</option>
                        </select>
                    </div>

                    {payments.length === 0 ? (
                        <p className="text-center py-8 text-slate-500">No payments found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                        <th className="text-left py-3 px-2 font-medium">Trx ID</th>
                                        <th className="text-left py-3 px-2 font-medium">Company</th>
                                        <th className="text-right py-3 px-2 font-medium">Amount</th>
                                        <th className="text-center py-3 px-2 font-medium">Status</th>
                                        <th className="text-right py-3 px-2 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p) => (
                                        <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                            <td className="py-3 px-2 text-slate-300 font-mono text-xs">{p.trxID || "—"}</td>
                                            <td className="py-3 px-2 text-slate-200">{p.companyName}</td>
                                            <td className="py-3 px-2 text-right text-slate-100 font-medium">
                                                BDT {p.amount.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-2 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(p.status)}`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-right text-slate-400 text-xs">
                                                {new Date(p.paymentDate).toLocaleDateString("en-US", {
                                                    year: "numeric", month: "short", day: "numeric"
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
                            <p className="text-sm text-slate-500">
                                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => fetchPayments(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => fetchPayments(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
