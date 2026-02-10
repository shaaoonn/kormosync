"use client";

interface Props {
    workStartTime: string;
    workEndTime: string;
    breakStartTime: string;
    breakEndTime: string;
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

function minutesToLabel(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function WorkingHoursVisual({ workStartTime, workEndTime, breakStartTime, breakEndTime }: Props) {
    const totalMinutesInDay = 24 * 60;
    const startMin = timeToMinutes(workStartTime || "09:00");
    const endMin = timeToMinutes(workEndTime || "18:00");
    const breakStartMin = timeToMinutes(breakStartTime || "13:00");
    const breakEndMin = timeToMinutes(breakEndTime || "14:00");

    const workDuration = endMin - startMin;
    const breakDuration = breakEndMin - breakStartMin;
    const effectiveHours = ((workDuration - breakDuration) / 60).toFixed(1);

    const startPercent = (startMin / totalMinutesInDay) * 100;
    const endPercent = (endMin / totalMinutesInDay) * 100;
    const workWidth = endPercent - startPercent;

    const breakStartPercent = ((breakStartMin - startMin) / (endMin - startMin)) * 100;
    const breakWidth = ((breakEndMin - breakStartMin) / (endMin - startMin)) * 100;

    const markers = [0, 6, 12, 18, 24];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-slate-700">Working Hours Timeline</h4>
                <span className="text-sm text-indigo-600 font-medium">{effectiveHours}h effective</span>
            </div>

            <div className="relative h-10 bg-slate-100 rounded-lg overflow-hidden mb-2">
                <div
                    className="absolute top-0 h-full bg-indigo-500 rounded"
                    style={{ left: `${startPercent}%`, width: `${workWidth}%` }}
                >
                    <div
                        className="absolute top-0 h-full bg-slate-300"
                        style={{
                            left: `${breakStartPercent}%`,
                            width: `${breakWidth}%`,
                            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)"
                        }}
                    />
                </div>
            </div>

            <div className="relative h-5">
                {markers.map(hour => (
                    <span
                        key={hour}
                        className="absolute text-[10px] text-slate-400 -translate-x-1/2"
                        style={{ left: `${(hour / 24) * 100}%` }}
                    >
                        {hour === 0 ? "12AM" : hour === 12 ? "12PM" : hour === 24 ? "12AM" : hour > 12 ? `${hour - 12}PM` : `${hour}AM`}
                    </span>
                ))}
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
                    <span>Work: {minutesToLabel(startMin)} - {minutesToLabel(endMin)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded inline-block" style={{
                        backgroundImage: "repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 2px, #e2e8f0 2px, #e2e8f0 4px)"
                    }} />
                    <span>Break: {minutesToLabel(breakStartMin)} - {minutesToLabel(breakEndMin)}</span>
                </div>
            </div>
        </div>
    );
}
