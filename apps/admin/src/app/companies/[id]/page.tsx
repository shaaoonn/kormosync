"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────
interface EmployeeStats {
    total: number;
    completed: number;
    active: number;
    pending: number;
}

interface Employee {
    id: string;
    name: string;
    email: string;
    role: string;
    profileImage: string | null;
    stats: EmployeeStats;
}

interface CompanyDetails {
    id: string;
    name: string;
    totalTasks: number;
    subscriptionStatus: string;
    enabledFeatures: string[];
    createdAt: string;
    employees: Employee[];
}

interface PayPeriod {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    totalAmount: number;
    invoiceCount: number;
    paidAmount: number;
}

interface ActivityData {
    totalHoursTracked: number;
    monthlyHours: number;
    totalScreenshots: number;
    avgActivityScore: number;
}

type Tab = "overview" | "activity" | "payroll";

// ─── Helpers ────────────────────────────────────────────────
const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    BLOCKED: "bg-red-100 text-red-700",
    INACTIVE: "bg-gray-100 text-gray-600",
    TRIAL: "bg-blue-100 text-blue-700",
    FROZEN: "bg-yellow-100 text-yellow-700",
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status] || "bg-gray-100 text-gray-600"}`}
        >
            {status}
        </span>
    );
}

function StatCard({ label, value, color = "text-gray-900" }: { label: string; value: string | number; color?: string }) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
    );
}

// ─── Page ───────────────────────────────────────────────────
export default function CompanyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const companyId = params.id as string;

    const [company, setCompany] = useState<CompanyDetails | null>(null);
    const [activity, setActivity] = useState<ActivityData | null>(null);
    const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [loading, setLoading] = useState(true);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!companyId) return;

        const fetchData = async () => {
            setLoading(true);
            setError("");
            try {
                const [detailsRes, activityRes] = await Promise.all([
                    api.get(`/admin/companies/${companyId}`),
                    api.get(`/admin/companies/${companyId}/activity`),
                ]);
                setCompany(detailsRes.data);
                setActivity(activityRes.data.activity);
                setPayPeriods(activityRes.data.payPeriods || []);
            } catch (err: any) {
                console.error("Failed to fetch company data:", err);
                setError(err.response?.data?.error || "Failed to load company data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [companyId]);

    const handleStatusChange = async (newStatus: string) => {
        if (!company || statusUpdating) return;
        setStatusUpdating(true);
        try {
            await api.patch(`/admin/companies/${companyId}/status`, { status: newStatus });
            setCompany((prev) => prev ? { ...prev, subscriptionStatus: newStatus } : prev);
        } catch (err: any) {
            console.error("Failed to update status:", err);
            alert(err.response?.data?.error || "Failed to update company status");
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleFeatureToggle = async (feature: string, enabled: boolean) => {
        if (!company) return;
        const current = company.enabledFeatures || [];
        const updated = enabled
            ? [...current, feature]
            : current.filter((f) => f !== feature);
        try {
            const res = await api.put(`/admin/companies/${companyId}/features`, { enabledFeatures: updated });
            setCompany((prev) => prev ? { ...prev, enabledFeatures: res.data.enabledFeatures } : prev);
        } catch (err: any) {
            console.error("Failed to update features:", err);
            alert(err.response?.data?.error || "Failed to update features");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to remove this company? This action is irreversible.")) return;
        try {
            await api.delete(`/admin/companies/${companyId}`);
            router.push("/companies");
        } catch (err: any) {
            console.error("Failed to delete company:", err);
            alert(err.response?.data?.error || "Failed to delete company");
        }
    };

    const tabs: { key: Tab; label: string }[] = [
        { key: "overview", label: "Overview" },
        { key: "activity", label: "Activity" },
        { key: "payroll", label: "Payroll" },
    ];

    // ─── Loading / Error States ─────────────────────────────
    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500" />
                </div>
            </DashboardLayout>
        );
    }

    if (error || !company) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-96 gap-4">
                    <p className="text-red-500 text-lg">{error || "Company not found"}</p>
                    <button
                        onClick={() => router.push("/companies")}
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
                    >
                        ← Back to Companies
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* ─── Header ─────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <button
                            onClick={() => router.push("/companies")}
                            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
                        >
                            ← Back to Companies
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            {company.name}
                            <StatusBadge status={company.subscriptionStatus} />
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Created {new Date(company.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                            {" · "}
                            {company.employees.length} member{company.employees.length !== 1 ? "s" : ""}
                        </p>
                    </div>

                    {/* Status Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {company.subscriptionStatus !== "ACTIVE" && (
                            <button
                                onClick={() => handleStatusChange("ACTIVE")}
                                disabled={statusUpdating}
                                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                Activate
                            </button>
                        )}
                        {company.subscriptionStatus !== "BLOCKED" && (
                            <button
                                onClick={() => handleStatusChange("BLOCKED")}
                                disabled={statusUpdating}
                                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                Block
                            </button>
                        )}
                        {company.subscriptionStatus !== "FROZEN" && (
                            <button
                                onClick={() => handleStatusChange("FROZEN")}
                                disabled={statusUpdating}
                                className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                            >
                                Freeze
                            </button>
                        )}
                        <button
                            onClick={handleDelete}
                            disabled={statusUpdating}
                            className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                            Remove
                        </button>
                    </div>
                </div>

                {/* ─── Tabs ───────────────────────────────────── */}
                <div className="border-b border-gray-200">
                    <nav className="flex gap-6">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.key
                                        ? "border-blue-600 text-blue-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* ─── Tab Content ────────────────────────────── */}
                {activeTab === "overview" && (
                    <OverviewTab company={company} activity={activity} onFeatureToggle={handleFeatureToggle} />
                )}
                {activeTab === "activity" && (
                    <ActivityTab employees={company.employees} activity={activity} />
                )}
                {activeTab === "payroll" && (
                    <PayrollTab payPeriods={payPeriods} />
                )}
            </div>
        </DashboardLayout>
    );
}

// ─── Feature Definitions ────────────────────────────────────
const ALL_FEATURES = [
    { key: "tasks", label: "Task Management", description: "Create, assign, and track tasks" },
    { key: "screenshots", label: "Screenshots", description: "Automatic screenshot capture" },
    { key: "activity", label: "Activity Tracking", description: "Keyboard/mouse activity monitoring" },
    { key: "payroll", label: "Payroll", description: "Salary calculation and invoicing" },
    { key: "reports", label: "Reports", description: "Advanced analytics and reports" },
    { key: "integrations", label: "Integrations", description: "Third-party app integrations" },
];

// ─── Tab 1: Overview ────────────────────────────────────────
function OverviewTab({ company, activity, onFeatureToggle }: { company: CompanyDetails; activity: ActivityData | null; onFeatureToggle: (feature: string, enabled: boolean) => void }) {
    const totalEmployees = company.employees.length;
    const admins = company.employees.filter((e) => e.role === "ADMIN" || e.role === "OWNER").length;
    const members = totalEmployees - admins;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Employees" value={totalEmployees} />
                <StatCard label="Admins / Owners" value={admins} />
                <StatCard label="Members" value={members} />
                <StatCard label="Total Tasks" value={company.totalTasks} />
            </div>

            {activity && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Hours Tracked" value={`${activity.totalHoursTracked}h`} color="text-blue-600" />
                    <StatCard label="Monthly Hours" value={`${activity.monthlyHours}h`} color="text-blue-600" />
                    <StatCard label="Screenshots" value={activity.totalScreenshots.toLocaleString()} />
                    <StatCard label="Avg. Activity Score" value={`${activity.avgActivityScore}%`} color={activity.avgActivityScore >= 60 ? "text-green-600" : "text-orange-500"} />
                </div>
            )}

            {/* Employee Roster */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Employee Roster</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                            <tr>
                                <th className="px-5 py-3 text-left">Name</th>
                                <th className="px-5 py-3 text-left">Email</th>
                                <th className="px-5 py-3 text-left">Role</th>
                                <th className="px-5 py-3 text-center">Tasks</th>
                                <th className="px-5 py-3 text-center">Completed</th>
                                <th className="px-5 py-3 text-center">Active</th>
                                <th className="px-5 py-3 text-center">Pending</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {company.employees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 font-medium text-gray-900">
                                        <div className="flex items-center gap-2">
                                            {emp.profileImage ? (
                                                <img src={emp.profileImage} alt="" className="w-7 h-7 rounded-full object-cover" />
                                            ) : (
                                                <span className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                                    {emp.name?.charAt(0)?.toUpperCase() || "?"}
                                                </span>
                                            )}
                                            {emp.name || "Unnamed"}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-gray-600">{emp.email}</td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            emp.role === "OWNER" ? "bg-purple-100 text-purple-700" :
                                            emp.role === "ADMIN" ? "bg-blue-100 text-blue-700" :
                                            "bg-gray-100 text-gray-600"
                                        }`}>
                                            {emp.role}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-center">{emp.stats.total}</td>
                                    <td className="px-5 py-3 text-center text-green-600 font-medium">{emp.stats.completed}</td>
                                    <td className="px-5 py-3 text-center text-blue-600 font-medium">{emp.stats.active}</td>
                                    <td className="px-5 py-3 text-center text-orange-500 font-medium">{emp.stats.pending}</td>
                                </tr>
                            ))}
                            {company.employees.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400">No employees found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Feature Toggles */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Feature Gates</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Enable or disable features for this company</p>
                </div>
                <div className="divide-y divide-gray-100">
                    {ALL_FEATURES.map((feat) => {
                        const enabled = (company.enabledFeatures || []).includes(feat.key);
                        return (
                            <div key={feat.key} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{feat.label}</p>
                                    <p className="text-xs text-gray-500">{feat.description}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onFeatureToggle(feat.key, !enabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        enabled ? "bg-blue-600" : "bg-gray-300"
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            enabled ? "translate-x-6" : "translate-x-1"
                                        }`}
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Tab 2: Activity ────────────────────────────────────────
function ActivityTab({ employees, activity }: { employees: Employee[]; activity: ActivityData | null }) {
    const sorted = [...employees].sort((a, b) => b.stats.completed - a.stats.completed);
    const maxTasks = Math.max(...employees.map((e) => e.stats.total), 1);

    return (
        <div className="space-y-6">
            {activity && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Hours" value={`${activity.totalHoursTracked}h`} color="text-blue-600" />
                    <StatCard label="This Month" value={`${activity.monthlyHours}h`} color="text-indigo-600" />
                    <StatCard label="Screenshots" value={activity.totalScreenshots.toLocaleString()} />
                    <StatCard
                        label="Avg. Activity"
                        value={`${activity.avgActivityScore}%`}
                        color={activity.avgActivityScore >= 60 ? "text-green-600" : "text-orange-500"}
                    />
                </div>
            )}

            {/* Employee Activity Bars */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Task Distribution</h3>
                <div className="space-y-3">
                    {sorted.map((emp) => {
                        const completedPct = maxTasks > 0 ? (emp.stats.completed / maxTasks) * 100 : 0;
                        const activePct = maxTasks > 0 ? (emp.stats.active / maxTasks) * 100 : 0;
                        const pendingPct = maxTasks > 0 ? (emp.stats.pending / maxTasks) * 100 : 0;

                        return (
                            <div key={emp.id}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">{emp.name || emp.email}</span>
                                    <span className="text-xs text-gray-500">
                                        {emp.stats.completed}/{emp.stats.total} done
                                    </span>
                                </div>
                                <div className="flex h-5 rounded-full overflow-hidden bg-gray-100">
                                    <div
                                        className="bg-green-500 transition-all"
                                        style={{ width: `${completedPct}%` }}
                                        title={`Completed: ${emp.stats.completed}`}
                                    />
                                    <div
                                        className="bg-blue-500 transition-all"
                                        style={{ width: `${activePct}%` }}
                                        title={`Active: ${emp.stats.active}`}
                                    />
                                    <div
                                        className="bg-orange-400 transition-all"
                                        style={{ width: `${pendingPct}%` }}
                                        title={`Pending: ${emp.stats.pending}`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {employees.length === 0 && (
                        <p className="text-center text-gray-400 py-8">No employee data</p>
                    )}
                </div>
                {employees.length > 0 && (
                    <div className="flex items-center gap-5 mt-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Completed</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Active</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" /> Pending</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Tab 3: Payroll ─────────────────────────────────────────
function PayrollTab({ payPeriods }: { payPeriods: PayPeriod[] }) {
    const payStatusColors: Record<string, string> = {
        OPEN: "bg-blue-100 text-blue-700",
        CLOSED: "bg-gray-100 text-gray-600",
        PAID: "bg-green-100 text-green-700",
        PROCESSING: "bg-yellow-100 text-yellow-700",
    };

    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Pay Period History</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Showing the last 6 pay periods</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                            <tr>
                                <th className="px-5 py-3 text-left">Period</th>
                                <th className="px-5 py-3 text-left">Status</th>
                                <th className="px-5 py-3 text-right">Total Amount</th>
                                <th className="px-5 py-3 text-right">Paid Amount</th>
                                <th className="px-5 py-3 text-center">Invoices</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {payPeriods.map((pp) => (
                                <tr key={pp.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 text-gray-900 font-medium">
                                        {new Date(pp.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        {" – "}
                                        {new Date(pp.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${payStatusColors[pp.status] || "bg-gray-100 text-gray-600"}`}>
                                            {pp.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                                        ৳{pp.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-right text-green-600 font-medium">
                                        ৳{pp.paidAmount.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-center">{pp.invoiceCount}</td>
                                </tr>
                            ))}
                            {payPeriods.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                                        No pay periods found for this company
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
