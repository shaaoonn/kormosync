"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";

interface Props {
    userId: string;
    weeklyOffDays: number[];
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function DaysOffCalendar({ userId, weeklyOffDays }: Props) {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [holidays, setHolidays] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [toggling, setToggling] = useState<string | null>(null);

    const fetchHolidays = useCallback(async () => {
        try {
            setLoading(true);
            const token = await auth.currentUser?.getIdToken();
            const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/profile/employee/${userId}/days-off?month=${monthStr}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setHolidays(res.data.holidays || []);
            }
        } catch (error) {
            console.error("Failed to fetch days off", error);
        } finally {
            setLoading(false);
        }
    }, [userId, year, month]);

    useEffect(() => {
        fetchHolidays();
    }, [fetchHolidays]);

    const toggleDay = async (dateStr: string) => {
        const isCurrentlyOff = holidays.includes(dateStr);
        setToggling(dateStr);
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/profile/employee/${userId}/days-off`,
                { date: dateStr, isOff: !isCurrentlyOff },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (isCurrentlyOff) {
                setHolidays(holidays.filter(h => h !== dateStr));
            } else {
                setHolidays([...holidays, dateStr]);
            }
        } catch (error) {
            console.error("Failed to toggle day off", error);
        } finally {
            setToggling(null);
        }
    };

    const prevMonth = () => {
        if (month === 0) { setMonth(11); setYear(year - 1); }
        else setMonth(month - 1);
    };

    const nextMonth = () => {
        if (month === 11) { setMonth(0); setYear(year + 1); }
        else setMonth(month + 1);
    };

    // Build calendar grid
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const isToday = (day: number) => {
        return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    const getDateStr = (day: number) => {
        return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };

    const getDayOfWeek = (day: number) => {
        return new Date(year, month, day).getDay();
    };

    // Calculate working days summary
    const { totalOffDays, workingDays } = useMemo(() => {
        const offDatesSet = new Set<string>();

        for (let d = 1; d <= daysInMonth; d++) {
            const dow = getDayOfWeek(d);
            const dateStr = getDateStr(d);
            if (weeklyOffDays.includes(dow)) {
                offDatesSet.add(dateStr);
            }
            if (holidays.includes(dateStr)) {
                offDatesSet.add(dateStr);
            }
        }

        return {
            totalOffDays: offDatesSet.size,
            workingDays: daysInMonth - offDatesSet.size,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [daysInMonth, weeklyOffDays, holidays, year, month]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-slate-800">Days Off Calendar</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="text-sm font-medium text-slate-700 min-w-[140px] text-center">
                        {MONTH_NAMES[month]} {year}
                    </span>
                    <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_HEADERS.map(d => (
                    <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
                {cells.map((day, idx) => {
                    if (day === null) {
                        return <div key={idx} className="h-10" />;
                    }

                    const dateStr = getDateStr(day);
                    const dow = getDayOfWeek(day);
                    const isWeeklyOff = weeklyOffDays.includes(dow);
                    const isCustomHoliday = holidays.includes(dateStr);
                    const isTodayDate = isToday(day);
                    const isToggling = toggling === dateStr;

                    let cellClass = "h-10 flex items-center justify-center rounded-lg text-sm cursor-pointer transition-all ";

                    if (isCustomHoliday) {
                        cellClass += "bg-red-100 text-red-700 font-semibold border-2 border-red-300 hover:bg-red-200";
                    } else if (isWeeklyOff) {
                        cellClass += "bg-purple-50 text-purple-600 font-medium hover:bg-purple-100";
                    } else {
                        cellClass += "bg-slate-50 text-slate-700 hover:bg-slate-100";
                    }

                    if (isTodayDate) {
                        cellClass += " ring-2 ring-indigo-500 ring-offset-1";
                    }

                    if (isToggling) {
                        cellClass += " opacity-50";
                    }

                    return (
                        <button
                            key={idx}
                            onClick={() => toggleDay(dateStr)}
                            disabled={isToggling}
                            className={cellClass}
                            title={
                                isCustomHoliday
                                    ? "Custom holiday — click to remove"
                                    : isWeeklyOff
                                    ? "Weekly off day — click to add as custom holiday"
                                    : "Working day — click to mark as holiday"
                            }
                        >
                            {day}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-purple-50 border border-purple-200 inline-block" />
                    <span>Weekly Off</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />
                    <span>Custom Holiday</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-50 border border-slate-200 inline-block" />
                    <span>Working Day</span>
                </div>
            </div>

            {/* Working Days Summary */}
            <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm font-medium text-indigo-700">
                    {totalOffDays} days off, {workingDays} working days this month
                </span>
                {loading && <span className="text-xs text-indigo-400">Loading...</span>}
            </div>
        </div>
    );
}
