"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, ChevronLeft, ChevronRight, Clock, TrendingUp, Users } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api";

// ============================================================
// Types
// ============================================================
interface CalendarDay {
    status: string;
    workedHours: number;
    overtimeHours: number;
    earnings: number;
}

interface CalendarRow {
    userId: string;
    userName: string;
    profileImage: string | null;
    days: Record<string, CalendarDay>;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    PRESENT: { bg: "bg-green-100", text: "text-green-700", label: "P" },
    ON_LEAVE: { bg: "bg-blue-100", text: "text-blue-700", label: "L" },
    ABSENT: { bg: "bg-red-100", text: "text-red-700", label: "A" },
    PARTIAL: { bg: "bg-yellow-100", text: "text-yellow-700", label: "H" },
    HOLIDAY: { bg: "bg-gray-100", text: "text-gray-400", label: "-" },
};

// ============================================================
// Main Component
// ============================================================
export default function AttendancePage() {
    const { user: authUser } = useAuth();
    const isAdmin = authUser?.role === "OWNER" || authUser?.role === "ADMIN";

    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    });
    const [calendarData, setCalendarData] = useState<Record<string, Record<string, CalendarDay>>>({});
    const [employees, setEmployees] = useState<Array<{ userId: string; name: string; profileImage: string | null }>>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCell, setSelectedCell] = useState<{ userId: string; date: string; data: CalendarDay } | null>(null);

    // My summary (for employee view)
    const [mySummary, setMySummary] = useState<any>(null);

    const getToken = async () => await auth.currentUser?.getIdToken();

    // Get days in month
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month, 0).getDate();
    const dates = Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(calendarMonth.year, calendarMonth.month - 1, i + 1);
        return {
            day: i + 1,
            dateStr: d.toISOString().split("T")[0],
            dayOfWeek: d.getDay(),
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
        };
    });

    useEffect(() => {
        if (isAdmin) {
            fetchCalendar();
        } else {
            fetchMySummary();
        }
    }, [calendarMonth, authUser]);

    const fetchCalendar = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await axios.get(
                `${API_URL}/attendance/calendar?year=${calendarMonth.year}&month=${calendarMonth.month}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setCalendarData(res.data.calendar);
                // Extract employee list from calendar keys
                const empList = Object.entries(res.data.calendar).map(([userId, days]: any) => {
                    // Try to find name from any day entry
                    const firstDay = Object.values(days)[0] as any;
                    return {
                        userId,
                        name: firstDay?.userName || userId.slice(0, 8),
                        profileImage: null,
                    };
                });
                setEmployees(empList);
            }
        } catch (err) {
            console.error("Failed to fetch attendance calendar:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMySummary = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const startDate = new Date(calendarMonth.year, calendarMonth.month - 1, 1).toISOString();
            const endDate = new Date(calendarMonth.year, calendarMonth.month, 0, 23, 59, 59).toISOString();
            const res = await axios.get(
                `${API_URL}/attendance/my-summary?startDate=${startDate}&endDate=${endDate}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) setMySummary(res.data);
        } catch (err) {
            console.error("Failed to fetch my summary:", err);
        } finally {
            setLoading(false);
        }
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

    const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // ============================================================
    // Render
    // ============================================================
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <ClipboardCheck className="w-6 h-6 text-indigo-500" />
                <h1 className="text-2xl font-bold text-gray-800">Attendance</h1>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm p-4">
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

            {/* Legend */}
            <div className="flex gap-4 flex-wrap text-xs">
                {Object.entries(STATUS_COLORS).map(([status, style]) => (
                    <div key={status} className="flex items-center gap-1.5">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${style.bg} ${style.text} font-bold text-[10px]`}>
                            {style.label}
                        </div>
                        <span className="text-gray-600">{status.replace("_", " ")}</span>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-16 text-gray-400">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
                    Loading...
                </div>
            ) : isAdmin ? (
                /* Admin Calendar Grid */
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                    <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-gray-500 font-medium min-w-[150px] z-10">
                                    Employee
                                </th>
                                {dates.map((d) => (
                                    <th key={d.day}
                                        className={`px-1 py-3 text-center font-medium min-w-[36px] ${d.isWeekend ? "bg-gray-100 text-gray-400" : "text-gray-500"}`}>
                                        <div>{d.day}</div>
                                        <div className="text-[9px] font-normal">{DAY_ABBR[d.dayOfWeek]}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {Object.entries(calendarData).length === 0 ? (
                                <tr>
                                    <td colSpan={daysInMonth + 1} className="px-6 py-12 text-center text-gray-400">
                                        No attendance data. Attendance is auto-generated daily.
                                    </td>
                                </tr>
                            ) : (
                                Object.entries(calendarData).map(([userId, days]) => (
                                    <tr key={userId} className="hover:bg-gray-50/50">
                                        <td className="sticky left-0 bg-white px-4 py-2 font-medium text-gray-800 z-10 border-r border-gray-100">
                                            {(days as any)[Object.keys(days)[0]]?.userName || userId.slice(0, 8)}
                                        </td>
                                        {dates.map((d) => {
                                            const dayData = (days as any)[d.dateStr];
                                            const style = dayData ? STATUS_COLORS[dayData.status] || STATUS_COLORS.ABSENT : null;
                                            return (
                                                <td key={d.day}
                                                    className={`px-1 py-2 text-center cursor-pointer transition ${d.isWeekend ? "bg-gray-50" : ""}`}
                                                    onClick={() => dayData && setSelectedCell({ userId, date: d.dateStr, data: dayData })}
                                                    title={dayData ? `${dayData.status} | ${dayData.workedHours.toFixed(1)}h` : ""}>
                                                    {style ? (
                                                        <div className={`w-7 h-7 mx-auto rounded flex items-center justify-center ${style.bg} ${style.text} font-bold text-[10px]`}>
                                                            {style.label}
                                                        </div>
                                                    ) : (
                                                        <div className="w-7 h-7 mx-auto rounded bg-gray-50" />
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* Employee Summary View */
                mySummary && (
                    <div className="space-y-6">
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <Users className="w-4 h-4 text-green-500" />
                                    <span className="text-sm text-gray-500">Present Days</span>
                                </div>
                                <p className="text-2xl font-bold text-green-600">{mySummary.summary?.presentDays || 0}</p>
                            </div>
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm text-gray-500">Total Hours</span>
                                </div>
                                <p className="text-2xl font-bold text-blue-600">{(mySummary.summary?.totalWorkedHours || 0).toFixed(1)}h</p>
                            </div>
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="w-4 h-4 text-purple-500" />
                                    <span className="text-sm text-gray-500">Overtime Hours</span>
                                </div>
                                <p className="text-2xl font-bold text-purple-600">{(mySummary.summary?.totalOvertimeHours || 0).toFixed(1)}h</p>
                            </div>
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    <span className="text-sm text-gray-500">Total Earnings</span>
                                </div>
                                <p className="text-2xl font-bold text-emerald-600">{(mySummary.summary?.totalEarnings || 0).toLocaleString()} BDT</p>
                            </div>
                        </div>

                        {/* Daily records */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-semibold text-gray-800">Daily Breakdown</h3>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Worked</th>
                                        <th className="px-6 py-3">Overtime</th>
                                        <th className="px-6 py-3">Earnings</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(mySummary.records || []).length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No attendance records</td></tr>
                                    ) : (
                                        (mySummary.records || []).map((rec: any) => {
                                            const style = STATUS_COLORS[rec.status] || STATUS_COLORS.ABSENT;
                                            return (
                                                <tr key={rec.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-3 text-gray-800">
                                                        {new Date(rec.date).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
                                                            {rec.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-600">{((rec.totalWorkedSeconds || 0) / 3600).toFixed(1)}h</td>
                                                    <td className="px-6 py-3 text-purple-600">{((rec.overtimeSeconds || 0) / 3600).toFixed(1)}h</td>
                                                    <td className="px-6 py-3 font-semibold text-green-600">{(rec.earningsToday || 0).toLocaleString()} BDT</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {/* Cell Detail Modal */}
            {selectedCell && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setSelectedCell(null)}>
                    <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-4">
                            {new Date(selectedCell.date).toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })}
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Status</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${STATUS_COLORS[selectedCell.data.status]?.bg || "bg-gray-100"} ${STATUS_COLORS[selectedCell.data.status]?.text || "text-gray-500"}`}>
                                    {selectedCell.data.status}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Worked</span>
                                <span className="font-medium">{selectedCell.data.workedHours.toFixed(1)}h</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Overtime</span>
                                <span className="font-medium text-purple-600">{selectedCell.data.overtimeHours.toFixed(1)}h</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Earnings</span>
                                <span className="font-bold text-green-600">{selectedCell.data.earnings?.toLocaleString() || 0} BDT</span>
                            </div>
                        </div>
                        <button onClick={() => setSelectedCell(null)}
                            className="mt-4 w-full py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
