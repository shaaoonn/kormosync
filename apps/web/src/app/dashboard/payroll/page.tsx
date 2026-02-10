"use client";

import { useEffect, useState } from "react";
import { DollarSign, Calendar, Download, Clock, TrendingUp, FileText, CreditCard, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api";

// ============================================================
// Types
// ============================================================
interface EmployeePayroll {
    userId: string;
    name: string;
    email: string | null;
    role: string;
    profileImage: string | null;
    hourlyRate: number;
    currency: string;
    totalHours: number;
    grossPay: number;
    avgActivity: number;
    logCount: number;
}

interface PayrollSummary {
    totalEmployees: number;
    totalHours: number;
    totalGrossPay: number;
}

interface PayrollData {
    period: { start: string; end: string; label: string };
    summary: PayrollSummary;
    employees: EmployeePayroll[];
}

interface PayPeriod {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    totalAmount: number;
    currency: string;
    invoiceCount: number;
    paidCount: number;
    draftCount: number;
    approvedCount: number;
}

interface Invoice {
    id: string;
    userId: string;
    totalHours: number;
    hourlyRate: number;
    grossAmount: number;
    deductions: number;
    bonuses: number;
    netAmount: number;
    currency: string;
    status: string;
    paidAt: string | null;
    user: { name: string; email: string | null; profileImage: string | null };
}

interface WalletData {
    balance: number;
    totalEarned: number;
    totalWithdrawn: number;
    currency: string;
    transactions: Array<{
        id: string;
        type: string;
        amount: number;
        description: string | null;
        createdAt: string;
    }>;
}

type TabView = "summary" | "periods" | "wallet";

// ============================================================
// Main Component
// ============================================================
export default function PayrollPage() {
    const [activeTab, setActiveTab] = useState<TabView>("summary");
    const [data, setData] = useState<PayrollData | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string>("EMPLOYEE");
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });

    // Pay Periods state
    const [periods, setPeriods] = useState<PayPeriod[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<PayPeriod | null>(null);
    const [periodInvoices, setPeriodInvoices] = useState<Invoice[]>([]);
    const [periodsLoading, setPeriodsLoading] = useState(false);

    // Wallet state
    const [wallet, setWallet] = useState<WalletData | null>(null);
    const [walletLoading, setWalletLoading] = useState(false);

    // Helper
    const getToken = async () => await auth.currentUser?.getIdToken();

    // Use role from AuthContext — no duplicate /auth/sync call
    const { user: authUser } = useAuth();
    useEffect(() => {
        if (authUser?.role) {
            setRole(authUser.role);
        }
    }, [authUser?.role]);

    const isAdmin = role === "OWNER" || role === "ADMIN";

    // ============================================================
    // Tab: Summary - fetch payroll summary
    // ============================================================
    useEffect(() => {
        if (activeTab !== "summary") return;
        fetchPayroll();
    }, [selectedMonth, activeTab]);

    const fetchPayroll = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await axios.get(`${API_URL}/payroll/summary?month=${selectedMonth}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) setData(res.data);
        } catch (error: any) {
            console.error("Failed to fetch payroll:", error);
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // Tab: Periods
    // ============================================================
    useEffect(() => {
        if (activeTab !== "periods" || !isAdmin) return;
        fetchPeriods();
    }, [activeTab]);

    const fetchPeriods = async () => {
        setPeriodsLoading(true);
        try {
            const token = await getToken();
            const res = await axios.get(`${API_URL}/invoices/periods`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) setPeriods(res.data.periods);
        } catch (error: any) {
            console.error("Failed to fetch periods:", error);
        } finally {
            setPeriodsLoading(false);
        }
    };

    const handleGeneratePeriod = async () => {
        try {
            const token = await getToken();
            const [year, month] = selectedMonth.split("-").map(Number);
            await axios.post(
                `${API_URL}/invoices/periods/create`,
                { year, month },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("Pay period created & invoices generated");
            fetchPeriods();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to generate");
        }
    };

    const handleSelectPeriod = async (period: PayPeriod) => {
        setSelectedPeriod(period);
        try {
            const token = await getToken();
            const res = await axios.get(`${API_URL}/invoices/period/${period.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) setPeriodInvoices(res.data.invoices);
        } catch { setPeriodInvoices([]); }
    };

    const handlePayAll = async (periodId: string) => {
        if (!confirm("Process payment for all invoices in this period? This will credit employee wallets.")) return;
        try {
            const token = await getToken();
            await axios.post(
                `${API_URL}/invoices/periods/${periodId}/pay-all`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("All invoices paid & wallets credited");
            fetchPeriods();
            if (selectedPeriod?.id === periodId) handleSelectPeriod({ ...selectedPeriod!, status: "PAID" });
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Payment failed");
        }
    };

    const handlePaySingle = async (invoiceId: string) => {
        try {
            const token = await getToken();
            await axios.post(
                `${API_URL}/invoices/${invoiceId}/pay`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("Invoice paid successfully");
            if (selectedPeriod) handleSelectPeriod(selectedPeriod);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Payment failed");
        }
    };

    // ============================================================
    // Tab: Wallet
    // ============================================================
    useEffect(() => {
        if (activeTab !== "wallet") return;
        fetchWallet();
    }, [activeTab]);

    const fetchWallet = async () => {
        setWalletLoading(true);
        try {
            const token = await getToken();
            const res = await axios.get(`${API_URL}/invoices/wallet`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) setWallet(res.data.wallet);
        } catch { }
        finally { setWalletLoading(false); }
    };

    // ============================================================
    // CSV Export
    // ============================================================
    const exportCSV = () => {
        if (!data) return;
        const headers = "Name,Email,Role,Hourly Rate,Total Hours,Gross Pay,Avg Activity %\n";
        const rows = data.employees
            .map((e) => `"${e.name}","${e.email}","${e.role}",${e.hourlyRate},${e.totalHours},${e.grossPay},${e.avgActivity}`)
            .join("\n");
        const blob = new Blob([headers + rows], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll-${selectedMonth}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV downloaded");
    };

    // ============================================================
    // Status badge
    // ============================================================
    const statusBadge = (status: string) => {
        const map: Record<string, { bg: string; text: string }> = {
            OPEN: { bg: "bg-blue-100", text: "text-blue-600" },
            LOCKED: { bg: "bg-yellow-100", text: "text-yellow-700" },
            PAID: { bg: "bg-green-100", text: "text-green-700" },
            DRAFT: { bg: "bg-gray-100", text: "text-gray-500" },
            APPROVED: { bg: "bg-indigo-100", text: "text-indigo-600" },
            CANCELLED: { bg: "bg-red-100", text: "text-red-600" },
        };
        const s = map[status] || map.DRAFT;
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.text}`}>
                {status}
            </span>
        );
    };

    // ============================================================
    // Render
    // ============================================================
    return (
        <div className="space-y-6">
            {/* Header + Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <DollarSign className="w-6 h-6 text-green-500" />
                    <h1 className="text-2xl font-bold text-gray-800">Payroll</h1>
                </div>

                <div className="flex items-center gap-2">
                    {(["summary", ...(isAdmin ? ["periods"] : []), "wallet"] as TabView[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab
                                ? "bg-indigo-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                        >
                            {tab === "summary" ? "Summary" : tab === "periods" ? "Pay Periods" : "Wallet"}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB: Summary */}
            {activeTab === "summary" && (
                <>
                    <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button onClick={exportCSV} disabled={!data || data.employees.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm transition disabled:opacity-50">
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                    </div>

                    {data && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                    <span className="text-sm text-gray-500">Total Payable</span>
                                </div>
                                <p className="text-2xl font-bold text-green-600">{data.summary.totalGrossPay.toLocaleString()} BDT</p>
                            </div>
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm text-gray-500">Total Hours</span>
                                </div>
                                <p className="text-2xl font-bold text-blue-600">{data.summary.totalHours.toLocaleString()}h</p>
                            </div>
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="w-4 h-4 text-purple-500" />
                                    <span className="text-sm text-gray-500">Employees</span>
                                </div>
                                <p className="text-2xl font-bold text-purple-600">{data.summary.totalEmployees}</p>
                            </div>
                        </div>
                    )}

                    {/* Employee Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Rate/hr</th>
                                    <th className="px-6 py-4">Hours</th>
                                    <th className="px-6 py-4">Gross Pay</th>
                                    <th className="px-6 py-4">Activity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                            <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                                            Loading...
                                        </td>
                                    </tr>
                                ) : !data || data.employees.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No payroll data for this month</td></tr>
                                ) : (
                                    data.employees.map((emp) => (
                                        <tr key={emp.userId} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {emp.profileImage ? (
                                                        <img src={emp.profileImage} className="w-8 h-8 rounded-full" alt="" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                                            {emp.name?.charAt(0) || "?"}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-gray-800">{emp.name}</p>
                                                        <p className="text-xs text-gray-400">{emp.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{emp.hourlyRate} {emp.currency}/hr</td>
                                            <td className="px-6 py-4 text-gray-600">{emp.totalHours}h</td>
                                            <td className="px-6 py-4 font-semibold text-green-600">{emp.grossPay.toLocaleString()} {emp.currency}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className={`h-2 rounded-full ${emp.avgActivity >= 70 ? "bg-green-500" : emp.avgActivity >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                                                            style={{ width: `${Math.min(emp.avgActivity, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-400">{emp.avgActivity}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* TAB: Pay Periods */}
            {activeTab === "periods" && isAdmin && (
                <div className="space-y-6">
                    {/* Generate period controls */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={handleGeneratePeriod}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                            <FileText className="w-4 h-4" /> Generate Invoices
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Periods list */}
                        <div className="lg:col-span-1 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pay Periods</h3>
                            {periodsLoading ? (
                                <div className="text-center py-8 text-gray-400">Loading...</div>
                            ) : periods.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">No pay periods yet. Generate one above.</div>
                            ) : (
                                periods.map((p) => (
                                    <div key={p.id} onClick={() => handleSelectPeriod(p)}
                                        className={`p-4 rounded-xl border cursor-pointer transition ${selectedPeriod?.id === p.id
                                            ? "bg-indigo-50 border-indigo-300"
                                            : "bg-white border-gray-200 hover:bg-gray-50"
                                            }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-800">
                                                {new Date(p.startDate).toLocaleDateString("en", { month: "short", year: "numeric" })}
                                            </span>
                                            {statusBadge(p.status)}
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            <span>{p.invoiceCount} invoices</span>
                                            <span className="font-semibold text-green-600">{p.totalAmount.toLocaleString()} {p.currency}</span>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            {p.draftCount > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{p.draftCount} draft</span>}
                                            {p.paidCount > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded">{p.paidCount} paid</span>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Invoices detail */}
                        <div className="lg:col-span-2">
                            {selectedPeriod ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-gray-800">
                                            Invoices - {new Date(selectedPeriod.startDate).toLocaleDateString("en", { month: "long", year: "numeric" })}
                                        </h3>
                                        {selectedPeriod.status !== "PAID" && role === "OWNER" && (
                                            <button onClick={() => handlePayAll(selectedPeriod.id)}
                                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
                                                <CreditCard className="w-4 h-4" /> Pay All
                                            </button>
                                        )}
                                    </div>

                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                                <tr>
                                                    <th className="px-4 py-3">Employee</th>
                                                    <th className="px-4 py-3">Hours</th>
                                                    <th className="px-4 py-3">Gross</th>
                                                    <th className="px-4 py-3">Deductions</th>
                                                    <th className="px-4 py-3">Net</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {periodInvoices.length === 0 ? (
                                                    <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No invoices</td></tr>
                                                ) : (
                                                    periodInvoices.map((inv) => (
                                                        <tr key={inv.id} className="hover:bg-gray-50">
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    {inv.user.profileImage ? (
                                                                        <img src={inv.user.profileImage} className="w-7 h-7 rounded-full" alt="" />
                                                                    ) : (
                                                                        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                                                                            {inv.user.name?.charAt(0) || "?"}
                                                                        </div>
                                                                    )}
                                                                    <span className="text-gray-800 font-medium text-sm">{inv.user.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-600">{inv.totalHours}h</td>
                                                            <td className="px-4 py-3 text-gray-600">{inv.grossAmount.toLocaleString()}</td>
                                                            <td className="px-4 py-3 text-red-500">{inv.deductions > 0 ? `-${inv.deductions}` : "0"}</td>
                                                            <td className="px-4 py-3 font-semibold text-green-600">{inv.netAmount.toLocaleString()} {inv.currency}</td>
                                                            <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                                                            <td className="px-4 py-3">
                                                                {inv.status !== "PAID" && role === "OWNER" && (
                                                                    <button onClick={() => handlePaySingle(inv.id)}
                                                                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition">
                                                                        Pay
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-64 text-gray-400">
                                    <div className="text-center">
                                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                        <p>Select a pay period to view invoices</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Wallet */}
            {activeTab === "wallet" && (
                <div className="space-y-6">
                    {walletLoading ? (
                        <div className="text-center py-16 text-gray-400">
                            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
                            Loading wallet...
                        </div>
                    ) : wallet ? (
                        <>
                            {/* Wallet Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                                    <div className="flex items-center gap-2 mb-2 opacity-80">
                                        <Wallet className="w-4 h-4" />
                                        <span className="text-sm">Current Balance</span>
                                    </div>
                                    <p className="text-3xl font-bold">{wallet.balance.toLocaleString()} {wallet.currency}</p>
                                </div>
                                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowDownRight className="w-4 h-4 text-green-500" />
                                        <span className="text-sm text-gray-500">Total Earned</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-600">{wallet.totalEarned.toLocaleString()} {wallet.currency}</p>
                                </div>
                                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowUpRight className="w-4 h-4 text-orange-500" />
                                        <span className="text-sm text-gray-500">Total Withdrawn</span>
                                    </div>
                                    <p className="text-2xl font-bold text-orange-600">{wallet.totalWithdrawn.toLocaleString()} {wallet.currency}</p>
                                </div>
                            </div>

                            {/* Transaction History */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100">
                                    <h3 className="font-semibold text-gray-800">Recent Transactions</h3>
                                </div>
                                {wallet.transactions.length === 0 ? (
                                    <div className="px-6 py-12 text-center text-gray-400">
                                        <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No transactions yet</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {wallet.transactions.map((tx) => (
                                            <div key={tx.id} className="px-6 py-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === "CREDIT"
                                                        ? "bg-green-100 text-green-600"
                                                        : tx.type === "WITHDRAWAL"
                                                            ? "bg-orange-100 text-orange-600"
                                                            : "bg-red-100 text-red-600"
                                                        }`}>
                                                        {tx.type === "CREDIT" ? (
                                                            <ArrowDownRight className="w-4 h-4" />
                                                        ) : (
                                                            <ArrowUpRight className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800">{tx.description || tx.type}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {new Date(tx.createdAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`font-semibold ${tx.type === "CREDIT" ? "text-green-600" : "text-red-500"}`}>
                                                    {tx.type === "CREDIT" ? "+" : "-"}{tx.amount.toLocaleString()} {wallet.currency}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-16 text-gray-400">
                            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No wallet data available</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
