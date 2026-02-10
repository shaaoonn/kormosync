"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, X, Clock, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api";

// ============================================================
// Types
// ============================================================
interface LeaveRequest {
    id: string;
    userId: string;
    type: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string | null;
    status: string;
    rejectedReason: string | null;
    createdAt: string;
    user?: { id: string; name: string; email: string; profileImage: string | null };
    approver?: { id: string; name: string };
}

interface LeaveBalance {
    paidLeave: number;
    sickLeave: number;
    unpaidLeave: number;
    paidUsed: number;
    sickUsed: number;
    unpaidUsed: number;
    paidRemaining: number;
    sickRemaining: number;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
    PAID: "Paid Leave",
    UNPAID: "Unpaid Leave",
    SICK: "Sick Leave",
    HALF_DAY: "Half Day",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: "bg-yellow-100", text: "text-yellow-700" },
    APPROVED: { bg: "bg-green-100", text: "text-green-700" },
    REJECTED: { bg: "bg-red-100", text: "text-red-700" },
    CANCELLED: { bg: "bg-gray-100", text: "text-gray-500" },
};

type TabView = "requests" | "calendar";

// ============================================================
// Main Component
// ============================================================
export default function LeavePage() {
    const { user: authUser } = useAuth();
    const isAdmin = authUser?.role === "OWNER" || authUser?.role === "ADMIN";

    const [activeTab, setActiveTab] = useState<TabView>("requests");
    const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
    const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
    const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
    const [balance, setBalance] = useState<LeaveBalance | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Calendar state
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    });
    const [calendarData, setCalendarData] = useState<any[]>([]);

    // Form state
    const [formType, setFormType] = useState("PAID");
    const [formStart, setFormStart] = useState("");
    const [formEnd, setFormEnd] = useState("");
    const [formReason, setFormReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const getToken = async () => await auth.currentUser?.getIdToken();

    // Fetch data
    useEffect(() => {
        fetchData();
    }, [authUser]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const headers = { Authorization: `Bearer ${token}` };

            if (isAdmin) {
                const [pendingRes, allRes] = await Promise.all([
                    axios.get(`${API_URL}/leave/pending`, { headers }),
                    axios.get(`${API_URL}/leave/all`, { headers }),
                ]);
                if (pendingRes.data.success) setPendingRequests(pendingRes.data.leaveRequests);
                if (allRes.data.success) setAllRequests(allRes.data.leaveRequests);
            }

            const [myRes, balRes] = await Promise.all([
                axios.get(`${API_URL}/leave/my-requests`, { headers }),
                axios.get(`${API_URL}/leave/my-balance`, { headers }),
            ]);
            if (myRes.data.success) setMyRequests(myRes.data.leaveRequests);
            if (balRes.data.success) setBalance(balRes.data.balance);
        } catch (err) {
            console.error("Failed to fetch leave data:", err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch calendar
    useEffect(() => {
        if (activeTab === "calendar" && isAdmin) {
            fetchCalendar();
        }
    }, [activeTab, calendarMonth]);

    const fetchCalendar = async () => {
        try {
            const token = await getToken();
            const res = await axios.get(
                `${API_URL}/leave/calendar?year=${calendarMonth.year}&month=${calendarMonth.month}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) setCalendarData(res.data.calendar);
        } catch (err) {
            console.error("Failed to fetch calendar:", err);
        }
    };

    // Actions
    const handleApprove = async (id: string) => {
        setActionLoading(id);
        try {
            const token = await getToken();
            await axios.put(`${API_URL}/leave/${id}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success("Leave approved");
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Approval failed");
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt("Rejection reason (optional):");
        setActionLoading(id);
        try {
            const token = await getToken();
            await axios.put(`${API_URL}/leave/${id}/reject`, { reason }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success("Leave rejected");
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Rejection failed");
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancel = async (id: string) => {
        setActionLoading(id);
        try {
            const token = await getToken();
            await axios.delete(`${API_URL}/leave/${id}/cancel`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success("Leave request cancelled");
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Cancel failed");
        } finally {
            setActionLoading(null);
        }
    };

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formStart || !formEnd) {
            toast.error("Please select start and end dates");
            return;
        }
        setSubmitting(true);
        try {
            const token = await getToken();
            await axios.post(`${API_URL}/leave/request`, {
                type: formType,
                startDate: formStart,
                endDate: formEnd,
                reason: formReason || undefined,
            }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Leave request submitted!");
            setShowForm(false);
            setFormStart("");
            setFormEnd("");
            setFormReason("");
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Request failed");
        } finally {
            setSubmitting(false);
        }
    };

    const statusBadge = (status: string) => {
        const s = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.text}`}>
                {status}
            </span>
        );
    };

    // Calendar navigation
    const prevMonth = () => {
        setCalendarMonth((prev) => {
            if (prev.month === 1) return { year: prev.year - 1, month: 12 };
            return { ...prev, month: prev.month - 1 };
        });
    };
    const nextMonth = () => {
        setCalendarMonth((prev) => {
            if (prev.month === 12) return { year: prev.year + 1, month: 1 };
            return { ...prev, month: prev.month + 1 };
        });
    };

    // ============================================================
    // Render
    // ============================================================
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <CalendarDays className="w-6 h-6 text-indigo-500" />
                    <h1 className="text-2xl font-bold text-gray-800">
                        {isAdmin ? "Leave Management" : "My Leave"}
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => setActiveTab("requests")}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === "requests"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                                Requests
                            </button>
                            <button
                                onClick={() => setActiveTab("calendar")}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === "calendar"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                                Calendar
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                    >
                        <Plus className="w-4 h-4" /> New Request
                    </button>
                </div>
            </div>

            {/* Balance Cards */}
            {balance && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-sm text-gray-500">Paid Leave</span>
                        </div>
                        <p className="text-2xl font-bold text-green-600">
                            {balance.paidRemaining ?? (balance.paidLeave - balance.paidUsed)}
                            <span className="text-sm text-gray-400 font-normal"> / {balance.paidLeave} days</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{balance.paidUsed} used</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <span className="text-sm text-gray-500">Sick Leave</span>
                        </div>
                        <p className="text-2xl font-bold text-yellow-600">
                            {balance.sickRemaining ?? (balance.sickLeave - balance.sickUsed)}
                            <span className="text-sm text-gray-400 font-normal"> / {balance.sickLeave} days</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{balance.sickUsed} used</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="text-sm text-gray-500">Unpaid Leave</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-600">{balance.unpaidUsed}</p>
                        <p className="text-xs text-gray-400 mt-1">No limit</p>
                    </div>
                </div>
            )}

            {/* New Request Form */}
            {showForm && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">New Leave Request</h3>
                    <form onSubmit={handleSubmitRequest} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Leave Type</label>
                                <select value={formType} onChange={(e) => setFormType(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                                    <option value="PAID">Paid Leave</option>
                                    <option value="SICK">Sick Leave</option>
                                    <option value="UNPAID">Unpaid Leave</option>
                                    <option value="HALF_DAY">Half Day</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Reason (optional)</label>
                                <input type="text" value={formReason} onChange={(e) => setFormReason(e.target.value)}
                                    placeholder="Why do you need leave?"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                                <input type="date" value={formStart} onChange={(e) => {
                                    setFormStart(e.target.value);
                                    if (!formEnd || e.target.value > formEnd) setFormEnd(e.target.value);
                                }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">End Date</label>
                                <input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)}
                                    min={formStart}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={submitting || !formStart || !formEnd}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
                                {submitting ? "Submitting..." : "Submit Request"}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)}
                                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Admin: Pending Requests */}
            {isAdmin && activeTab === "requests" && pendingRequests.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-500" />
                        <h3 className="font-semibold text-gray-800">Pending Approvals</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 font-bold">{pendingRequests.length}</span>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">Employee</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Dates</th>
                                <th className="px-6 py-3">Days</th>
                                <th className="px-6 py-3">Reason</th>
                                <th className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pendingRequests.map((req) => (
                                <tr key={req.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-2">
                                            {req.user?.profileImage ? (
                                                <img src={req.user.profileImage} className="w-7 h-7 rounded-full" alt="" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                                                    {req.user?.name?.charAt(0) || "?"}
                                                </div>
                                            )}
                                            <span className="font-medium text-gray-800">{req.user?.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">{LEAVE_TYPE_LABELS[req.type] || req.type}</td>
                                    <td className="px-6 py-3 text-gray-600">
                                        {new Date(req.startDate).toLocaleDateString("en", { day: "numeric", month: "short" })}
                                        {req.startDate !== req.endDate && ` - ${new Date(req.endDate).toLocaleDateString("en", { day: "numeric", month: "short" })}`}
                                    </td>
                                    <td className="px-6 py-3">{req.totalDays}</td>
                                    <td className="px-6 py-3 text-gray-500 text-xs max-w-[200px] truncate">{req.reason || "-"}</td>
                                    <td className="px-6 py-3">
                                        <div className="flex gap-2">
                                            <button onClick={() => handleApprove(req.id)} disabled={actionLoading === req.id}
                                                className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 transition disabled:opacity-50">
                                                <Check className="w-3 h-3" /> Approve
                                            </button>
                                            <button onClick={() => handleReject(req.id)} disabled={actionLoading === req.id}
                                                className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition disabled:opacity-50">
                                                <X className="w-3 h-3" /> Reject
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* All Requests / My Requests */}
            {activeTab === "requests" && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-800">
                            {isAdmin ? "All Leave Requests" : "My Leave Requests"}
                        </h3>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                            <tr>
                                {isAdmin && <th className="px-6 py-3">Employee</th>}
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Dates</th>
                                <th className="px-6 py-3">Days</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Reason</th>
                                {!isAdmin && <th className="px-6 py-3"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(isAdmin ? allRequests : myRequests).length === 0 ? (
                                <tr><td colSpan={isAdmin ? 6 : 6} className="px-6 py-8 text-center text-gray-400">No leave requests</td></tr>
                            ) : (
                                (isAdmin ? allRequests : myRequests).map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-50">
                                        {isAdmin && (
                                            <td className="px-6 py-3">
                                                <span className="font-medium text-gray-800">{req.user?.name || "Unknown"}</span>
                                            </td>
                                        )}
                                        <td className="px-6 py-3">{LEAVE_TYPE_LABELS[req.type] || req.type}</td>
                                        <td className="px-6 py-3 text-gray-600">
                                            {new Date(req.startDate).toLocaleDateString("en", { day: "numeric", month: "short" })}
                                            {req.startDate !== req.endDate && ` - ${new Date(req.endDate).toLocaleDateString("en", { day: "numeric", month: "short" })}`}
                                        </td>
                                        <td className="px-6 py-3">{req.totalDays}</td>
                                        <td className="px-6 py-3">{statusBadge(req.status)}</td>
                                        <td className="px-6 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                                            {req.rejectedReason || req.reason || "-"}
                                        </td>
                                        {!isAdmin && (
                                            <td className="px-6 py-3">
                                                {req.status === "PENDING" && (
                                                    <button onClick={() => handleCancel(req.id)} disabled={actionLoading === req.id}
                                                        className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition disabled:opacity-50">
                                                        Cancel
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Calendar Tab (Admin only) */}
            {activeTab === "calendar" && isAdmin && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h3 className="text-lg font-semibold text-gray-800">
                            {new Date(calendarMonth.year, calendarMonth.month - 1).toLocaleDateString("en", { month: "long", year: "numeric" })}
                        </h3>
                        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {calendarData.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No approved leaves this month</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {calendarData.map((entry: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                        {entry.user?.name?.charAt(0) || "?"}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800">{entry.user?.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {LEAVE_TYPE_LABELS[entry.type] || entry.type} &middot;{" "}
                                            {new Date(entry.startDate).toLocaleDateString("en", { day: "numeric", month: "short" })}
                                            {entry.startDate !== entry.endDate && ` - ${new Date(entry.endDate).toLocaleDateString("en", { day: "numeric", month: "short" })}`}
                                            &middot; {entry.totalDays}d
                                        </p>
                                    </div>
                                    {statusBadge(entry.status)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
