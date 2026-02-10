"use client";

import { useState, useEffect } from "react";
import { Clock, Save, RotateCcw, CheckCircle } from "lucide-react";

interface WorkScheduleData {
    overrideOvertimeRate: number | null;
    workStartTime: string | null;
    workEndTime: string | null;
    breakStartTime: string | null;
    breakEndTime: string | null;
    weeklyOffDays: number[];
}

interface CompanyDefaults {
    overtimeRate: number;
}

interface Props {
    data: WorkScheduleData;
    companyDefaults: CompanyDefaults;
    onSave: (data: Partial<WorkScheduleData>) => Promise<void>;
    saving?: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WorkScheduleEditor({ data, companyDefaults, onSave, saving }: Props) {
    const [form, setForm] = useState<WorkScheduleData>({ ...data });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setForm({ ...data });
    }, [data]);

    const handleSave = async () => {
        await onSave(form);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const toggleOffDay = (day: number) => {
        const current = form.weeklyOffDays || [];
        if (current.includes(day)) {
            setForm({ ...form, weeklyOffDays: current.filter(d => d !== day) });
        } else {
            setForm({ ...form, weeklyOffDays: [...current, day].sort() });
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-slate-800">Work Schedule & Overrides</h3>
            </div>

            {/* Overtime Rate Override */}
            <div className="space-y-4 mb-6">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Overtime Rate Override</p>
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <label className="text-sm font-medium text-slate-600">Overtime Rate (multiplier)</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="number"
                                min={1.0}
                                max={5.0}
                                step={0.1}
                                value={form.overrideOvertimeRate ?? ""}
                                placeholder={`${companyDefaults.overtimeRate}x (default)`}
                                onChange={e => setForm({
                                    ...form,
                                    overrideOvertimeRate: e.target.value ? parseFloat(e.target.value) : null
                                })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            {form.overrideOvertimeRate !== null && (
                                <button
                                    onClick={() => setForm({ ...form, overrideOvertimeRate: null })}
                                    className="text-slate-400 hover:text-slate-600"
                                    title="Reset to company default"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <hr className="my-5 border-slate-200" />

            {/* Work Hours */}
            <div className="space-y-4 mb-6">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Work Hours</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-slate-600">Start Time</label>
                        <input
                            type="time"
                            value={form.workStartTime || "09:00"}
                            onChange={e => setForm({ ...form, workStartTime: e.target.value || null })}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600">End Time</label>
                        <input
                            type="time"
                            value={form.workEndTime || "18:00"}
                            onChange={e => setForm({ ...form, workEndTime: e.target.value || null })}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>
            </div>

            {/* Break Hours */}
            <div className="space-y-4 mb-6">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Break Time</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-slate-600">Break Start</label>
                        <input
                            type="time"
                            value={form.breakStartTime || "13:00"}
                            onChange={e => setForm({ ...form, breakStartTime: e.target.value || null })}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600">Break End</label>
                        <input
                            type="time"
                            value={form.breakEndTime || "14:00"}
                            onChange={e => setForm({ ...form, breakEndTime: e.target.value || null })}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>
            </div>

            <hr className="my-5 border-slate-200" />

            {/* Weekly Off Days */}
            <div className="mb-6">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Weekly Off Days</p>
                <div className="flex gap-2">
                    {DAY_NAMES.map((name, idx) => (
                        <button
                            key={idx}
                            onClick={() => toggleOffDay(idx)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                (form.weeklyOffDays || []).includes(idx)
                                    ? "bg-red-100 text-red-700 border-2 border-red-300"
                                    : "bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200"
                            }`}
                        >
                            {name}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    Selected days are weekly holidays for this employee
                </p>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
            >
                {saved ? (
                    <>
                        <CheckCircle className="w-4 h-4" />
                        Saved!
                    </>
                ) : saving ? (
                    "Saving..."
                ) : (
                    <>
                        <Save className="w-4 h-4" />
                        Save Schedule
                    </>
                )}
            </button>
        </div>
    );
}
