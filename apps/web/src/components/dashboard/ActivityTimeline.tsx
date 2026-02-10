"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { auth } from "@/lib/firebase";

interface ActivityInterval {
    id: string;
    intervalStart: string;
    intervalEnd: string;
    keystrokes: number;
    mouseClicks: number;
    mouseMovement: number;
    activeSeconds: number;
    user?: { id: string; name: string };
    task?: { id: string; title: string };
}

interface TimelineProps {
    taskId?: string;
    userId?: string;
    date: string; // "YYYY-MM-DD"
    activityLogs?: ActivityInterval[]; // If provided, skip API call (prevents duplicate /activity/company request)
}

function getScoreLevel(activeSeconds: number, keystrokes: number, mouseClicks: number) {
    // Simplified formula: inputs per minute (100 inputs/min = 100%)
    const intervalMinutes = Math.max(1, activeSeconds / 60);
    const totalInputs = keystrokes + mouseClicks;
    const inputsPerMinute = totalInputs / intervalMinutes;
    const score = Math.min(100, Math.round(inputsPerMinute));

    if (score >= 70) return { score, level: "HIGH", color: "bg-green-500", label: "High" };
    if (score >= 40) return { score, level: "MEDIUM", color: "bg-yellow-500", label: "Medium" };
    if (score >= 10) return { score, level: "LOW", color: "bg-red-500", label: "Low" };
    return { score, level: "IDLE", color: "bg-gray-400", label: "Idle" };
}

export default function ActivityTimeline({ taskId, userId, date, activityLogs: propLogs }: TimelineProps) {
    const [intervals, setIntervals] = useState<ActivityInterval[]>([]);
    const [loading, setLoading] = useState(!propLogs); // Not loading if data passed as props
    const [selectedInterval, setSelectedInterval] = useState<ActivityInterval | null>(null);

    // If parent passes activityLogs as props, use them directly (no API call)
    useEffect(() => {
        if (propLogs) {
            const sorted = [...propLogs].sort(
                (a, b) => new Date(a.intervalStart).getTime() - new Date(b.intervalStart).getTime()
            );
            setIntervals(sorted);
            setLoading(false);
            return;
        }

        // Fallback: fetch from API only if no props provided
        const fetchActivity = async () => {
            try {
                setLoading(true);
                const token = await auth.currentUser?.getIdToken();

                const params: any = { startDate: date, endDate: date };
                if (userId) params.userId = userId;
                if (taskId) params.taskId = taskId;

                const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/activity/company`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params,
                });

                if (res.data.success) {
                    const sorted = (res.data.activityLogs || []).sort(
                        (a: ActivityInterval, b: ActivityInterval) =>
                            new Date(a.intervalStart).getTime() - new Date(b.intervalStart).getTime()
                    );
                    setIntervals(sorted);
                }
            } catch (error) {
                console.error("Failed to fetch activity timeline:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchActivity();
    }, [taskId, userId, date, propLogs]);

    if (loading) {
        return <div className="p-4 text-center text-gray-400 text-sm">Loading timeline...</div>;
    }

    if (intervals.length === 0) {
        return (
            <div className="p-6 text-center text-gray-400">
                <p className="text-sm">No activity data for this date.</p>
            </div>
        );
    }

    // Stats summary
    const totalIntervals = intervals.length;
    const levels = intervals.map((i) => getScoreLevel(i.activeSeconds, i.keystrokes, i.mouseClicks));
    const highCount = levels.filter((l) => l.level === "HIGH").length;
    const mediumCount = levels.filter((l) => l.level === "MEDIUM").length;
    const lowCount = levels.filter((l) => l.level === "LOW").length;
    const idleCount = levels.filter((l) => l.level === "IDLE").length;
    const avgScore = Math.round(levels.reduce((s, l) => s + l.score, 0) / totalIntervals);

    return (
        <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Avg Score: <strong className="text-gray-800">{avgScore}%</strong></span>
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> High: {highCount}
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /> Medium: {mediumCount}
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Low: {lowCount}
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" /> Idle: {idleCount}
                </span>
            </div>

            {/* Timeline blocks */}
            <div className="flex gap-0.5 h-10 rounded-lg overflow-hidden">
                {intervals.map((interval, idx) => {
                    const { color, score, label } = getScoreLevel(
                        interval.activeSeconds, interval.keystrokes, interval.mouseClicks
                    );
                    const time = new Date(interval.intervalStart).toLocaleTimeString("en-US", {
                        hour: "2-digit", minute: "2-digit",
                    });

                    return (
                        <div
                            key={interval.id}
                            className={`flex-1 ${color} cursor-pointer hover:opacity-80 transition-opacity min-w-[3px]`}
                            title={`${time} — ${label} (${score}%)`}
                            onClick={() => setSelectedInterval(interval)}
                        />
                    );
                })}
            </div>

            {/* Time labels */}
            <div className="flex justify-between text-xs text-gray-400">
                <span>
                    {new Date(intervals[0].intervalStart).toLocaleTimeString("en-US", {
                        hour: "2-digit", minute: "2-digit",
                    })}
                </span>
                <span>
                    {new Date(intervals[intervals.length - 1].intervalEnd).toLocaleTimeString("en-US", {
                        hour: "2-digit", minute: "2-digit",
                    })}
                </span>
            </div>

            {/* Selected interval detail */}
            {selectedInterval && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-800">
                            {new Date(selectedInterval.intervalStart).toLocaleTimeString("en-US", {
                                hour: "2-digit", minute: "2-digit",
                            })}
                            {" — "}
                            {new Date(selectedInterval.intervalEnd).toLocaleTimeString("en-US", {
                                hour: "2-digit", minute: "2-digit",
                            })}
                        </h4>
                        <button
                            onClick={() => setSelectedInterval(null)}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                            Close
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center text-xs">
                        <div>
                            <p className="text-gray-500">Active</p>
                            <p className="font-bold text-gray-800">{selectedInterval.activeSeconds}s</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Keystrokes</p>
                            <p className="font-bold text-gray-800">{selectedInterval.keystrokes}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Clicks</p>
                            <p className="font-bold text-gray-800">{selectedInterval.mouseClicks}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Score</p>
                            <p className="font-bold text-gray-800">
                                {getScoreLevel(selectedInterval.activeSeconds, selectedInterval.keystrokes, selectedInterval.mouseClicks).score}%
                            </p>
                        </div>
                    </div>
                    {selectedInterval.user && (
                        <p className="text-xs text-gray-400 mt-2">
                            Employee: {selectedInterval.user.name}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
