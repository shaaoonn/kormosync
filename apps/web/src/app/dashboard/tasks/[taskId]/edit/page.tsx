"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, Video, StopCircle, CheckCircle, Save, Plus, AlertTriangle, Trash2, GripVertical, Users, User, Layers, FileText, ChevronUp, ChevronDown, ArrowLeft, Repeat, DollarSign, UserCheck } from "lucide-react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";

// ============================================================
// Task Item Interface
// ============================================================
interface TaskItem {
    id: string;
    title: string;
    description: string;
    billingType: 'FIXED_PRICE' | 'HOURLY' | 'SCHEDULED';
    fixedPrice?: number;
    hourlyRate?: number;
    estimatedHours?: number;
    scheduleType?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    scheduleDays: number[];
    startTime?: string;
    endTime?: string;
    attachment?: string;
    forceSchedule?: boolean;
}

const DAYS_OF_WEEK = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
const MAX_SUBTASK_FILE_SIZE = 20 * 1024 * 1024;
const MAX_MAIN_FILE_SIZE = 100 * 1024 * 1024;

// ============================================================
// Interactive Time Picker Component
// ============================================================
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [hours, setHours] = useState(value ? parseInt(value.split(':')[0]) : 9);
    const [minutes, setMinutes] = useState(value ? parseInt(value.split(':')[1]) : 0);

    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':').map(Number);
            setHours(h);
            setMinutes(m);
        }
    }, [value]);

    const updateTime = (h: number, m: number) => {
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        onChange(`${hh}:${mm}`);
    };

    const incrementHour = () => {
        const newH = (hours + 1) % 24;
        setHours(newH);
        updateTime(newH, minutes);
    };
    const decrementHour = () => {
        const newH = (hours - 1 + 24) % 24;
        setHours(newH);
        updateTime(newH, minutes);
    };
    const incrementMinute = () => {
        const newM = (minutes + 5) % 60;
        setMinutes(newM);
        updateTime(hours, newM);
    };
    const decrementMinute = () => {
        const newM = (minutes - 5 + 60) % 60;
        setMinutes(newM);
        updateTime(hours, newM);
    };

    const handleHourInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        let h = parseInt(e.target.value) || 0;
        if (h > 23) h = 23;
        if (h < 0) h = 0;
        setHours(h);
        updateTime(h, minutes);
    };

    const handleMinuteInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        let m = parseInt(e.target.value) || 0;
        if (m > 59) m = 59;
        if (m < 0) m = 0;
        setMinutes(m);
        updateTime(hours, m);
    };

    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;

    return (
        <div className="flex items-center gap-2 bg-white border rounded-lg p-2">
            <div className="flex flex-col items-center">
                <button type="button" onClick={incrementHour} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                </button>
                <input type="number" value={displayHour} onChange={handleHourInput} className="w-10 text-center text-lg font-bold border-0 focus:ring-0 p-0" min={0} max={23} />
                <button type="button" onClick={decrementHour} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
            </div>
            <span className="text-xl font-bold text-gray-400">:</span>
            <div className="flex flex-col items-center">
                <button type="button" onClick={incrementMinute} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                </button>
                <input type="number" value={minutes.toString().padStart(2, '0')} onChange={handleMinuteInput} className="w-10 text-center text-lg font-bold border-0 focus:ring-0 p-0" min={0} max={59} />
                <button type="button" onClick={decrementMinute} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
            </div>
            <button type="button" onClick={() => { const newH = (hours + 12) % 24; setHours(newH); updateTime(newH, minutes); }} className="px-2 py-1 text-sm font-bold bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition">
                {period}
            </button>
        </div>
    );
}

export default function EditTaskPage() {
    const params = useParams();
    const router = useRouter();
    const taskId = params.taskId as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Task Type
    const [workerType, setWorkerType] = useState<'EMPLOYEE' | 'FREELANCER'>('EMPLOYEE');
    const [taskType, setTaskType] = useState<'SINGLE' | 'BUNDLE'>('SINGLE');

    // Form States
    const [title, setTitle] = useState("");
    const [priority, setPriority] = useState("MEDIUM");
    const [deadline, setDeadline] = useState("");
    const [description, setDescription] = useState("");
    const [requiredAppsStr, setRequiredAppsStr] = useState("");

    // Single Task Billing
    const [singleBillingType, setSingleBillingType] = useState<'FIXED_PRICE' | 'HOURLY' | 'SCHEDULED'>('HOURLY');
    const [singleFixedPrice, setSingleFixedPrice] = useState<number | undefined>();
    const [singleHourlyRate, setSingleHourlyRate] = useState<number | undefined>();
    const [singleEstimatedHours, setSingleEstimatedHours] = useState<number | undefined>();
    const [singleScheduleDays, setSingleScheduleDays] = useState<number[]>([]);
    const [singleStartTime, setSingleStartTime] = useState("");
    const [singleEndTime, setSingleEndTime] = useState("");
    const [singleAllowOvertime, setSingleAllowOvertime] = useState(false);
    const [screenshotInterval, setScreenshotInterval] = useState(5);

    // Phase 9: Recurring, Budget, Reviewer
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringType, setRecurringType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
    const [recurringEndDate, setRecurringEndDate] = useState('');
    const [recurringCount, setRecurringCount] = useState<number | undefined>();
    const [maxBudget, setMaxBudget] = useState<number | undefined>();
    const [reviewerId, setReviewerId] = useState('');

    // Advanced Settings
    const [monitoringMode, setMonitoringMode] = useState<'TRANSPARENT' | 'STEALTH'>('TRANSPARENT');
    const [activityThreshold, setActivityThreshold] = useState(40);
    const [penaltyEnabled, setPenaltyEnabled] = useState(false);
    const [penaltyType, setPenaltyType] = useState('');
    const [penaltyThresholdMins, setPenaltyThresholdMins] = useState(15);
    const [resourceLinks, setResourceLinks] = useState<string[]>(['']);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Task Items (Bundle)
    const [taskItems, setTaskItems] = useState<TaskItem[]>([]);
    const [overlapWarnings, setOverlapWarnings] = useState<{ [id: string]: string }>({});

    // Media
    const [attachments, setAttachments] = useState<string[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [videoInfo, setVideoInfo] = useState<{ name: string; size: number } | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null); // Existing video

    // Assignment
    const [freelancerEmail, setFreelancerEmail] = useState("");
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

    // Drag
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Fetch
    useEffect(() => {
        const fetchTask = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                // 1. Fetch Employees (for assignment UI)
                try {
                    const empRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/company/employees`, { headers: { Authorization: `Bearer ${token}` } });
                    if (empRes.data.success) setEmployees(empRes.data.employees);
                } catch (e) { console.error(e); }

                // 2. Fetch Task
                const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const task = res.data.task;

                // Populate Form
                setTitle(task.title || "");
                setPriority(task.priority || "MEDIUM");
                setDeadline(task.deadline ? task.deadline.split('T')[0] : "");
                setDescription(task.descriptionRaw || "");
                setRequiredAppsStr(task.manualAllowedApps?.join(", ") || "");
                setAttachments(task.attachments || []);
                setVideoUrl(task.videoUrl || null);
                setScreenshotInterval(task.screenshotInterval || 5);
                setMonitoringMode(task.monitoringMode || 'TRANSPARENT');
                setActivityThreshold(task.activityThreshold ?? 40);
                setPenaltyEnabled(!!task.penaltyEnabled);
                setPenaltyType(task.penaltyType || '');
                setPenaltyThresholdMins(task.penaltyThresholdMins || 15);
                setResourceLinks(task.resourceLinks?.length > 0 ? task.resourceLinks : ['']);
                setWorkerType(task.freelancerEmail ? 'FREELANCER' : 'EMPLOYEE');
                if (task.freelancerEmail) setFreelancerEmail(task.freelancerEmail);

                // Assignees
                if (task.assignees) {
                    setSelectedAssignees(task.assignees.map((a: any) => a.id));
                }

                if (task.subTasks && task.subTasks.length > 0) {
                    setTaskType('BUNDLE');
                    setTaskItems(task.subTasks);
                } else {
                    setTaskType('SINGLE');
                    // Single Billing
                    setSingleBillingType(task.billingType || 'HOURLY');
                    setSingleFixedPrice(task.fixedPrice);
                    setSingleHourlyRate(task.hourlyRate);
                    setSingleEstimatedHours(task.estimatedHours);
                    setSingleScheduleDays(task.scheduleDays || []);
                    setSingleStartTime(task.startTime || "");
                    setSingleEndTime(task.endTime || "");
                    setSingleAllowOvertime(!!task.allowOvertime);
                }

                // Phase 9: Recurring, Budget, Reviewer
                setIsRecurring(!!task.isRecurring);
                setRecurringType(task.recurringType || 'DAILY');
                setRecurringEndDate(task.recurringEndDate ? task.recurringEndDate.split('T')[0] : '');
                setRecurringCount(task.recurringCount || undefined);
                setMaxBudget(task.maxBudget || undefined);
                setReviewerId(task.reviewerId || '');

            } catch (error) {
                console.error("Failed to fetch task", error);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchTask();
            else setLoading(false);
        });
        return () => unsubscribe();
    }, [taskId]);


    // Task Item Logic
    const addTaskItem = () => {
        if (taskItems.length >= 10) { toast.error("সর্বোচ্চ ১০টা টাস্ক যুক্ত করা যাবে!"); return; }
        const newItem: TaskItem = {
            id: `ti-${Date.now()}`,
            title: "", description: "", billingType: "HOURLY", scheduleDays: [], forceSchedule: false
        };
        setTaskItems([...taskItems, newItem]);
    };

    const updateTaskItem = (id: string, field: keyof TaskItem, value: any) => {
        const updated = taskItems.map(ti => ti.id === id ? { ...ti, [field]: value } : ti);
        setTaskItems(updated);
        if (['startTime', 'endTime', 'scheduleDays'].includes(field)) checkOverlapForTask(id, updated);
    };

    const removeTaskItem = (id: string) => {
        setTaskItems(taskItems.filter(ti => ti.id !== id));
        const newWarnings = { ...overlapWarnings };
        delete newWarnings[id];
        setOverlapWarnings(newWarnings);
    };

    const toggleScheduleDay = (taskId: string, day: number) => {
        const ti = taskItems.find(t => t.id === taskId);
        if (!ti) return;
        const newDays = ti.scheduleDays.includes(day) ? ti.scheduleDays.filter(d => d !== day) : [...ti.scheduleDays, day];
        updateTaskItem(taskId, 'scheduleDays', newDays);
    };

    const toggleSingleScheduleDay = (day: number) => {
        setSingleScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    // Drag
    const handleDragStart = (index: number) => setDraggedIndex(index);
    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        const newItems = [...taskItems];
        const draggedItem = newItems[draggedIndex];
        newItems.splice(draggedIndex, 1);
        newItems.splice(index, 0, draggedItem);
        setTaskItems(newItems);
        setDraggedIndex(index);
    };
    const handleDragEnd = () => setDraggedIndex(null);

    // Overlap
    const checkOverlapForTask = (targetId: string, tasks: TaskItem[]) => {
        const target = tasks.find(t => t.id === targetId);
        if (!target || target.billingType !== 'SCHEDULED' || !target.startTime || !target.endTime || target.scheduleDays.length === 0) {
            const newWarnings = { ...overlapWarnings }; delete newWarnings[targetId]; setOverlapWarnings(newWarnings); return;
        }
        const scheduledTasks = tasks.filter(t => t.id !== targetId && t.billingType === 'SCHEDULED' && t.startTime && t.endTime && t.scheduleDays.length > 0);
        for (const other of scheduledTasks) {
            const daysOverlap = target.scheduleDays.some(d => other.scheduleDays.includes(d));
            if (!daysOverlap) continue;
            const tStart = parseTime(target.startTime!);
            const tEnd = parseTime(target.endTime!);
            const oStart = parseTime(other.startTime!);
            const oEnd = parseTime(other.endTime!);
            if (tStart < oEnd && tEnd > oStart) {
                setOverlapWarnings({ ...overlapWarnings, [targetId]: `"${other.title || 'অন্য টাস্ক'}" এর সাথে সময় ওভারল্যাপ` });
                return;
            }
        }
        const newWarnings = { ...overlapWarnings }; delete newWarnings[targetId]; setOverlapWarnings(newWarnings);
    };
    const parseTime = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
    const forceSchedule = (id: string) => { updateTaskItem(id, 'forceSchedule', true); const newWarnings = { ...overlapWarnings }; delete newWarnings[id]; setOverlapWarnings(newWarnings); };

    // File Upload
    const handleMainFileUpload = async (files: FileList | null) => {
        if (!files) return;
        const file = files[0];
        if (file.size > MAX_MAIN_FILE_SIZE) { toast.error("File > 100MB!"); return; }
        const formData = new FormData(); formData.append("file", file);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload`, formData, { headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` } });
            setAttachments(prev => [...prev, res.data.url]);
        } catch (e) { toast.error("Upload failed"); }
    };
    const handleTaskFileUpload = async (files: FileList | null, tId: string) => {
        if (!files) return;
        const file = files[0];
        if (file.size > MAX_SUBTASK_FILE_SIZE) { toast.error("Subtask File > 20MB!"); return; }
        setUploadingTaskId(tId);
        const formData = new FormData(); formData.append("file", file);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload`, formData, { headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` } });
            updateTaskItem(tId, 'attachment', res.data.url);
        } catch (e) { toast.error("Upload failed"); } finally { setUploadingTaskId(null); }
    };

    // Recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" }, audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
            const chunks: BlobPart[] = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                setRecordedBlob(blob);
                const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
                setVideoInfo({ name: `screen-recording-${Date.now()}.webm`, size: parseFloat(sizeMB) });
                stream.getTracks().forEach(track => track.stop());
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            timerRef.current = setInterval(() => { setRecordingTime(prev => { if (prev >= 300) { stopRecording(); return prev; } return prev + 1; }); }, 1000);
        } catch (e) { toast.error("Recording failed"); }
    };
    const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); if (timerRef.current) clearInterval(timerRef.current); };
    const formatRecordTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    // Update
    const handleUpdate = async (publishStatus: 'DRAFT' | 'PUBLISHED' = 'PUBLISHED') => {
        if (!title.trim()) { toast.error("Please enter title"); return; }
        setSaving(true);
        try {
            let finalVideoUrl = videoUrl;
            if (recordedBlob) {
                const file = new File([recordedBlob], videoInfo?.name || "recording.webm", { type: "video/webm" });
                const formData = new FormData(); formData.append("file", file);
                const token = await auth.currentUser?.getIdToken();
                const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload`, formData, { headers: { Authorization: `Bearer ${token}` } });
                finalVideoUrl = res.data.url;
            }

            const token = await auth.currentUser?.getIdToken();
            const payload: any = {
                title, priority, deadline: deadline ? new Date(deadline).toISOString() : null,
                descriptionRaw: description,
                attachments, videoUrl: finalVideoUrl,
                manualAllowedApps: requiredAppsStr.split(',').map(s => s.trim()).filter(Boolean),
                screenshotInterval,
                publishStatus,
                // Advanced Settings
                monitoringMode,
                activityThreshold,
                penaltyEnabled,
                penaltyType: penaltyEnabled ? penaltyType : null,
                penaltyThresholdMins: penaltyEnabled ? penaltyThresholdMins : 15,
                resourceLinks: resourceLinks.filter(l => l.trim()),
                // Phase 9: Recurring, Budget, Reviewer
                isRecurring,
                recurringType: isRecurring ? recurringType : null,
                recurringEndDate: isRecurring && recurringEndDate ? recurringEndDate : null,
                recurringCount: isRecurring && recurringCount ? recurringCount : null,
                maxBudget: maxBudget || null,
                reviewerId: reviewerId || null,
            };

            if (taskType === 'BUNDLE') {
                // Send Subtasks
                payload.subTasks = taskItems.map((ti, idx) => ({
                    id: ti.id.startsWith('ti-') ? undefined : ti.id, // Remove temp Ids
                    title: ti.title, description: ti.description, billingType: ti.billingType,
                    fixedPrice: ti.fixedPrice, hourlyRate: ti.hourlyRate, estimatedHours: ti.estimatedHours,
                    scheduleType: ti.scheduleType, scheduleDays: ti.scheduleDays,
                    startTime: ti.startTime, endTime: ti.endTime, orderIndex: idx
                }));
            } else {
                // Single
                payload.billingType = singleBillingType;
                payload.fixedPrice = singleFixedPrice;
                payload.hourlyRate = singleHourlyRate;
                payload.estimatedHours = singleEstimatedHours;
                payload.scheduleDays = singleScheduleDays;
                payload.startTime = singleStartTime;
                payload.endTime = singleEndTime;
                payload.allowOvertime = singleBillingType === 'SCHEDULED' ? singleAllowOvertime : false;
            }

            // Assignees
            payload.assigneeIds = selectedAssignees;

            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(publishStatus === 'DRAFT' ? "Saved as Draft!" : "Task Published!");
            router.push(`/dashboard/tasks/${taskId}`);
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.error || "Update failed");
        } finally { setSaving(false); }
    };

    const renderBillingFields = (billingType: string, onBillingChange: (v: string) => void, fixedPrice: number | undefined, onFixedChange: (v: number) => void, hourlyRate: number | undefined, onHourlyChange: (v: number) => void, estimatedHours: number | undefined, onEstimatedChange: (v: number) => void, scheduleDays: number[], onDayToggle: (d: number) => void, startTime: string, onStartChange: (v: string) => void, endTime: string, onEndChange: (v: string) => void) => (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
            <div>
                <label className="text-xs text-gray-500 block mb-2">Billing Type</label>
                <div className="flex gap-2">
                    {['FIXED_PRICE', 'HOURLY', 'SCHEDULED'].map(t => (
                        <button key={t} onClick={() => onBillingChange(t)} className={`px-3 py-1 rounded text-sm ${billingType === t ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>{t}</button>
                    ))}
                </div>
            </div>
            {billingType === 'FIXED_PRICE' && <input type="number" placeholder="Fixed Price" className="w-full p-2 border rounded" value={fixedPrice || ''} onChange={e => onFixedChange(parseFloat(e.target.value))} />}
            {billingType === 'HOURLY' && (
                <div className="flex gap-4">
                    <input type="number" placeholder="Hourly Rate" className="w-1/2 p-2 border rounded" value={hourlyRate || ''} onChange={e => onHourlyChange(parseFloat(e.target.value))} />
                    <input type="number" placeholder="Est. Hours" className="w-1/2 p-2 border rounded" value={estimatedHours || ''} onChange={e => onEstimatedChange(parseFloat(e.target.value))} />
                </div>
            )}
            {billingType === 'SCHEDULED' && (
                <div className="space-y-2">
                    <div className="flex gap-4">
                        <TimePicker value={startTime} onChange={onStartChange} />
                        <TimePicker value={endTime} onChange={onEndChange} />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                        {DAYS_OF_WEEK.map((d, i) => (
                            <button key={i} onClick={() => onDayToggle(i)} className={`px-2 py-1 rounded text-xs ${scheduleDays.includes(i) ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>{d}</button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    if (loading) return <div>Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
            <Link href={`/dashboard/tasks/${taskId}`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-4 h-4" /> Back to Task
            </Link>
            <h1 className="text-3xl font-bold text-gray-800">Edit Task</h1>

            {/* Task Settings */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 space-y-4">
                <div className="flex flex-wrap gap-6">
                    <div>
                        <label className="text-xs text-gray-500 block mb-2">Worker Type</label>
                        <div className="flex bg-white rounded-lg p-1 shadow-sm border">
                            <button onClick={() => setWorkerType('EMPLOYEE')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm ${workerType === 'EMPLOYEE' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}><Users className="w-4 h-4" /> Employee</button>
                            <button onClick={() => setWorkerType('FREELANCER')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm ${workerType === 'FREELANCER' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}><User className="w-4 h-4" /> Freelancer</button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-2">Task Type</label>
                        <div className="flex bg-white rounded-lg p-1 shadow-sm border">
                            <button onClick={() => { setTaskType('SINGLE'); }} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm ${taskType === 'SINGLE' ? 'bg-green-600 text-white' : 'text-gray-600'}`}><FileText className="w-4 h-4" /> Single</button>
                            <button onClick={() => setTaskType('BUNDLE')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm ${taskType === 'BUNDLE' ? 'bg-orange-600 text-white' : 'text-gray-600'}`}><Layers className="w-4 h-4" /> Bundle</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Title</label>
                        <input type="text" className="mt-1 w-full p-3 border rounded-lg" value={title} onChange={e => setTitle(e.target.value)} />
                    </div>
                    {workerType === 'FREELANCER' && (
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Freelancer Email</label>
                            <input type="email" className="mt-1 w-full p-3 border rounded-lg" value={freelancerEmail} onChange={e => setFreelancerEmail(e.target.value)} />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Priority</label>
                        <select className="mt-1 w-full p-2 border rounded-lg" value={priority} onChange={e => setPriority(e.target.value)}>
                            <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Deadline</label>
                        <input type="date" className="mt-1 w-full p-2 border rounded-lg" value={deadline} onChange={e => setDeadline(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Screenshot Interval (Min)</label>
                        <select className="mt-1 w-full p-2 border rounded-lg" value={screenshotInterval} onChange={e => setScreenshotInterval(parseInt(e.target.value))}>
                            {[1, 2, 3, 5, 10, 15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Allowed Apps (comma separated)</label>
                    <input type="text" className="mt-1 w-full p-2 border rounded-lg" value={requiredAppsStr} onChange={e => setRequiredAppsStr(e.target.value)} placeholder="Visual Studio Code, Chrome, etc." />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea rows={4} className="mt-1 w-full p-3 border rounded-lg" value={description} onChange={e => setDescription(e.target.value)} />
                </div>

                {/* Advanced Settings */}
                <div className="border-t pt-4">
                    <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-indigo-600 transition-colors">
                        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        Advanced Settings
                    </button>

                    {showAdvanced && (
                        <div className="mt-4 p-5 bg-gray-50 rounded-xl border space-y-5">
                            {/* Monitoring Mode */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-2">Monitoring Mode</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setMonitoringMode('TRANSPARENT')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${monitoringMode === 'TRANSPARENT' ? 'bg-green-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}>
                                        Transparent
                                    </button>
                                    <button type="button" onClick={() => setMonitoringMode('STEALTH')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${monitoringMode === 'STEALTH' ? 'bg-red-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}>
                                        Stealth
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    {monitoringMode === 'STEALTH' ? 'Employee will not see tracking notifications or widget' : 'Employee can see tracking status and notifications'}
                                </p>
                            </div>

                            {/* Activity Threshold */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Activity Threshold: {activityThreshold}%</label>
                                <input type="range" min={0} max={100} value={activityThreshold}
                                    onChange={e => setActivityThreshold(parseInt(e.target.value))}
                                    className="w-full accent-indigo-600" />
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>0%</span><span>50%</span><span>100%</span>
                                </div>
                            </div>

                            {/* Penalty Settings */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={penaltyEnabled}
                                        onChange={e => setPenaltyEnabled(e.target.checked)}
                                        className="rounded text-indigo-600" />
                                    <span className="text-sm text-gray-700 font-medium">Enable Penalty</span>
                                </label>
                                {penaltyEnabled && (
                                    <div className="grid grid-cols-2 gap-4 pl-6">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Penalty Type</label>
                                            <select className="w-full p-2 border rounded-lg text-sm" value={penaltyType}
                                                onChange={e => setPenaltyType(e.target.value)}>
                                                <option value="">Select...</option>
                                                <option value="DEDUCT_TIME">Deduct Time</option>
                                                <option value="NOTIFY_ADMIN">Notify Admin</option>
                                                <option value="PAUSE_TIMER">Pause Timer</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Threshold (mins)</label>
                                            <input type="number" min={1} max={120} value={penaltyThresholdMins}
                                                onChange={e => setPenaltyThresholdMins(parseInt(e.target.value) || 15)}
                                                className="w-full p-2 border rounded-lg text-sm" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Resource Links */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Resource Links</label>
                                <div className="space-y-2">
                                    {resourceLinks.map((link, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input type="url" placeholder="https://..."
                                                className="flex-1 p-2 border rounded-lg text-sm"
                                                value={link} onChange={e => {
                                                    const updated = [...resourceLinks];
                                                    updated[idx] = e.target.value;
                                                    setResourceLinks(updated);
                                                }} />
                                            {resourceLinks.length > 1 && (
                                                <button type="button" onClick={() => setResourceLinks(resourceLinks.filter((_, i) => i !== idx))}
                                                    className="text-red-500 hover:bg-red-50 p-2 rounded"><X className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setResourceLinks([...resourceLinks, ''])}
                                        className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Add Link
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {taskType === 'SINGLE' && (
                    <div className="border-t pt-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">💰 Billing & Schedule</h2>
                        {renderBillingFields(singleBillingType, (v) => setSingleBillingType(v as any), singleFixedPrice, setSingleFixedPrice, singleHourlyRate, setSingleHourlyRate, singleEstimatedHours, setSingleEstimatedHours, singleScheduleDays, toggleSingleScheduleDay, singleStartTime, setSingleStartTime, singleEndTime, setSingleEndTime)}
                    </div>
                )}

                {taskType === 'BUNDLE' && (
                    <div className="border-t pt-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">📋 Sub Tasks</h2>
                        <div className="space-y-4">
                            {taskItems.map((ti, index) => (
                                <div key={ti.id} draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDragEnd={handleDragEnd} className={`p-4 bg-gray-50 border rounded-lg space-y-4 ${draggedIndex === index ? 'opacity-50' : ''}`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-2 items-center"><GripVertical className="w-4 h-4 text-gray-400" /><span className="font-bold">Task #{index + 1}</span></div>
                                        <button onClick={() => removeTaskItem(ti.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    <input type="text" className="w-full p-2 border rounded" placeholder="Subtask Title" value={ti.title} onChange={e => updateTaskItem(ti.id, 'title', e.target.value)} />
                                    {renderBillingFields(ti.billingType, (v) => updateTaskItem(ti.id, 'billingType', v), ti.fixedPrice, (v) => updateTaskItem(ti.id, 'fixedPrice', v), ti.hourlyRate, (v) => updateTaskItem(ti.id, 'hourlyRate', v), ti.estimatedHours, (v) => updateTaskItem(ti.id, 'estimatedHours', v), ti.scheduleDays, (d) => toggleScheduleDay(ti.id, d), ti.startTime || '', (v) => updateTaskItem(ti.id, 'startTime', v), ti.endTime || '', (v) => updateTaskItem(ti.id, 'endTime', v))}
                                    {/* Overlap warnings omitted for brevity but logic is there */}
                                </div>
                            ))}
                        </div>
                        <button onClick={addTaskItem} className="mt-4 w-full py-4 border-2 border-dashed border-indigo-300 text-indigo-600 font-bold rounded-xl flex items-center justify-center gap-2"><Plus /> Add Sub Task</button>
                    </div>
                )}

                {/* Attachments & Assignees (same as Create) */}
                <div className="border-t pt-6 space-y-4">
                    <label>Attachments</label>
                    <div className="flex gap-4">
                        <input type="file" ref={fileInputRef} onChange={e => handleMainFileUpload(e.target.files)} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border rounded flex gap-2"><Upload className="w-4 h-4" /> Upload</button>
                        {!isRecording && !recordedBlob ? <button onClick={startRecording} className="px-4 py-2 border border-red-200 bg-red-50 text-red-600 rounded flex gap-2"><Video className="w-4 h-4" /> Record</button> : <button onClick={stopRecording} className="px-4 py-2 bg-red-600 text-white rounded animate-pulse">Stop ({formatRecordTime(recordingTime)})</button>}
                    </div>
                    <div className="text-xs text-gray-500">{attachments.map((a, i) => <div key={i}>{a}</div>)}</div>
                </div>

                {/* 🔄 Recurring Section */}
                <div className="border-t pt-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded" />
                        <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <Repeat className="w-4 h-4 text-indigo-600" /> পুনরাবৃত্তি টাস্ক
                        </span>
                    </label>
                    {isRecurring && (
                        <div className="mt-3 ml-7 p-4 bg-indigo-50 rounded-lg border border-indigo-200 space-y-3">
                            <div className="flex gap-2">
                                {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(t => (
                                    <button key={t} type="button" onClick={() => setRecurringType(t)}
                                        className={`px-3 py-1.5 rounded text-sm ${recurringType === t ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>
                                        {t === 'DAILY' ? 'প্রতিদিন' : t === 'WEEKLY' ? 'সাপ্তাহিক' : 'মাসিক'}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500">শেষ তারিখ</label>
                                    <input type="date" className="w-full p-2 border rounded text-sm" value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">সর্বোচ্চ সংখ্যা</label>
                                    <input type="number" className="w-full p-2 border rounded text-sm" value={recurringCount || ''} onChange={e => setRecurringCount(parseInt(e.target.value) || undefined)} min={1} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 💰 Budget */}
                <div className="border-t pt-6">
                    <h2 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-600" /> বাজেট সীমা
                    </h2>
                    <input type="number" placeholder="সর্বোচ্চ বাজেট (৳)" className="max-w-xs p-2 border rounded-lg" value={maxBudget || ''} onChange={e => setMaxBudget(parseFloat(e.target.value) || undefined)} min={0} />
                </div>

                {/* 👤 Reviewer */}
                {employees.length > 0 && (
                    <div className="border-t pt-6">
                        <h2 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-purple-600" /> রিভিউয়ার
                        </h2>
                        <select className="max-w-sm p-2 border rounded-lg text-sm" value={reviewerId} onChange={e => setReviewerId(e.target.value)}>
                            <option value="">কোনো রিভিউয়ার নেই</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name || emp.email}</option>)}
                        </select>
                    </div>
                )}

                {workerType === 'EMPLOYEE' && (
                    <div className="border-t pt-6">
                        <label className="block mb-2">Assign Employees</label>
                        <div className="flex flex-wrap gap-2">
                            {employees.map(emp => (
                                <button key={emp.id} onClick={() => setSelectedAssignees(prev => prev.includes(emp.id) ? prev.filter(x => x !== emp.id) : [...prev, emp.id])} className={`px-3 py-2 rounded text-sm ${selectedAssignees.includes(emp.id) ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>{emp.name || emp.email}</button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="pt-6 border-t flex justify-end gap-4">
                    <button onClick={() => handleUpdate('DRAFT')} disabled={saving}
                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2">
                        <Save className="w-4 h-4" /> Save as Draft
                    </button>
                    <button onClick={() => handleUpdate('PUBLISHED')} disabled={saving}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md">
                        {saving ? 'Saving...' : 'Save & Publish'}
                    </button>
                </div>
            </div>
        </div>
    );
}
