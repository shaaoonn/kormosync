"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, Video, StopCircle, CheckCircle, Save, Send, Plus, Clock, Calendar, AlertTriangle, Trash2, GripVertical, Users, User, Layers, FileText, Link2, ChevronUp, ChevronDown } from "lucide-react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

// ============================================================
// Task Item Interface (No "Sub" prefix)
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
            {/* Hours */}
            <div className="flex flex-col items-center">
                <button type="button" onClick={incrementHour} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                </button>
                <input
                    type="number"
                    value={displayHour}
                    onChange={handleHourInput}
                    className="w-10 text-center text-lg font-bold border-0 focus:ring-0 p-0"
                    min={0}
                    max={23}
                />
                <button type="button" onClick={decrementHour} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
            </div>

            <span className="text-xl font-bold text-gray-400">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center">
                <button type="button" onClick={incrementMinute} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                </button>
                <input
                    type="number"
                    value={minutes.toString().padStart(2, '0')}
                    onChange={handleMinuteInput}
                    className="w-10 text-center text-lg font-bold border-0 focus:ring-0 p-0"
                    min={0}
                    max={59}
                />
                <button type="button" onClick={decrementMinute} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
            </div>

            {/* AM/PM */}
            <button
                type="button"
                onClick={() => {
                    const newH = (hours + 12) % 24;
                    setHours(newH);
                    updateTime(newH, minutes);
                }}
                className="px-2 py-1 text-sm font-bold bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition"
            >
                {period}
            </button>
        </div>
    );
}

export default function CreateTaskForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Task Type Settings
    const [workerType, setWorkerType] = useState<'EMPLOYEE' | 'FREELANCER'>('EMPLOYEE');
    const [taskType, setTaskType] = useState<'SINGLE' | 'BUNDLE'>('SINGLE');

    // Form States
    const [title, setTitle] = useState("");
    const [priority, setPriority] = useState("MEDIUM");
    const [deadline, setDeadline] = useState("");
    const [description, setDescription] = useState("");

    // Single Task Billing (for SINGLE mode)
    const [singleBillingType, setSingleBillingType] = useState<'FIXED_PRICE' | 'HOURLY' | 'SCHEDULED'>('HOURLY');
    const [singleFixedPrice, setSingleFixedPrice] = useState<number | undefined>();
    const [singleHourlyRate, setSingleHourlyRate] = useState<number | undefined>();
    const [singleEstimatedHours, setSingleEstimatedHours] = useState<number | undefined>();
    const [singleScheduleDays, setSingleScheduleDays] = useState<number[]>([]);
    const [singleStartTime, setSingleStartTime] = useState('');
    const [singleEndTime, setSingleEndTime] = useState('');
    const [screenshotInterval, setScreenshotInterval] = useState(5); // Default 5 min

    // Task Items State (for BUNDLE mode, max 10)
    const [taskItems, setTaskItems] = useState<TaskItem[]>([]);
    const [overlapWarnings, setOverlapWarnings] = useState<{ [id: string]: string }>({});

    // Media States
    const [attachments, setAttachments] = useState<string[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [videoInfo, setVideoInfo] = useState<{ name: string; size: number } | null>(null);

    // Assignment
    const [freelancerEmail, setFreelancerEmail] = useState("");
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

    // Drag state
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const token = await auth.currentUser?.getIdToken();
            if (token) {
                try {
                    const empRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/company/employees`, { headers: { Authorization: `Bearer ${token}` } });
                    if (empRes.data.success) setEmployees(empRes.data.employees);
                } catch (e) { console.error(e); }
            }
        };
        const unsubscribe = auth.onAuthStateChanged(u => u && fetchData());
        return () => unsubscribe();
    }, []);

    // ============================================================
    // Task Item Management (for Bundle)
    // ============================================================
    const addTaskItem = () => {
        if (taskItems.length >= 10) {
            alert("সর্বোচ্চ ১০টা টাস্ক যুক্ত করা যাবে!");
            return;
        }
        const newItem: TaskItem = {
            id: `ti-${Date.now()}`,
            title: "",
            description: "",
            billingType: "HOURLY",
            scheduleDays: [],
            forceSchedule: false
        };
        setTaskItems([...taskItems, newItem]);
    };

    const updateTaskItem = (id: string, field: keyof TaskItem, value: any) => {
        const updated = taskItems.map(ti => ti.id === id ? { ...ti, [field]: value } : ti);
        setTaskItems(updated);
        if (field === 'startTime' || field === 'endTime' || field === 'scheduleDays') {
            checkOverlapForTask(id, updated);
        }
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
        const newDays = ti.scheduleDays.includes(day)
            ? ti.scheduleDays.filter(d => d !== day)
            : [...ti.scheduleDays, day];
        updateTaskItem(taskId, 'scheduleDays', newDays);
    };

    const toggleSingleScheduleDay = (day: number) => {
        setSingleScheduleDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    // ============================================================
    // Drag & Drop
    // ============================================================
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

    // ============================================================
    // Overlap Check
    // ============================================================
    const checkOverlapForTask = (targetId: string, tasks: TaskItem[]) => {
        const target = tasks.find(t => t.id === targetId);
        if (!target || target.billingType !== 'SCHEDULED' || !target.startTime || !target.endTime || target.scheduleDays.length === 0) {
            const newWarnings = { ...overlapWarnings };
            delete newWarnings[targetId];
            setOverlapWarnings(newWarnings);
            return;
        }
        const scheduledTasks = tasks.filter(t => t.id !== targetId && t.billingType === 'SCHEDULED' && t.startTime && t.endTime && t.scheduleDays.length > 0);
        for (const other of scheduledTasks) {
            const daysOverlap = target.scheduleDays.some(d => other.scheduleDays.includes(d));
            if (!daysOverlap) continue;
            const tStart = parseTime(target.startTime);
            const tEnd = parseTime(target.endTime);
            const oStart = parseTime(other.startTime!);
            const oEnd = parseTime(other.endTime!);
            if (tStart < oEnd && tEnd > oStart) {
                setOverlapWarnings({ ...overlapWarnings, [targetId]: `"${other.title || 'অন্য টাস্ক'}" এর সাথে সময় ওভারল্যাপ` });
                return;
            }
        }
        const newWarnings = { ...overlapWarnings };
        delete newWarnings[targetId];
        setOverlapWarnings(newWarnings);
    };

    const parseTime = (time: string): number => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const forceSchedule = (id: string) => {
        updateTaskItem(id, 'forceSchedule', true);
        const newWarnings = { ...overlapWarnings };
        delete newWarnings[id];
        setOverlapWarnings(newWarnings);
    };

    // ============================================================
    // File Upload
    // ============================================================
    const handleMainFileUpload = async (files: FileList | null) => {
        if (!files) return;
        const file = files[0];
        if (file.size > MAX_MAIN_FILE_SIZE) {
            alert("ফাইল সাইজ 100MB এর বেশি! Google Drive লিংক ব্যবহার করুন।");
            return;
        }
        const formData = new FormData();
        formData.append("file", file);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload`, formData, {
                headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` }
            });
            setAttachments(prev => [...prev, res.data.url]);
        } catch (error: any) {
            alert(error.response?.data?.error || "আপলোড ব্যর্থ");
        }
    };

    const handleTaskFileUpload = async (files: FileList | null, taskId: string) => {
        if (!files) return;
        const file = files[0];
        if (file.size > MAX_SUBTASK_FILE_SIZE) {
            alert("টাস্কের ফাইল সাইজ 20MB এর বেশি!\n\n💡 বড় ফাইল: মূল টাস্কে আপলোড করুন বা Google Drive লিংক দিন");
            return;
        }
        setUploadingTaskId(taskId);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload`, formData, {
                headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` }
            });
            updateTaskItem(taskId, 'attachment', res.data.url);
        } catch (error: any) {
            alert(error.response?.data?.error || "আপলোড ব্যর্থ");
        } finally {
            setUploadingTaskId(null);
        }
    };

    // ============================================================
    // Recording
    // ============================================================
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
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => { if (prev >= 300) { stopRecording(); return prev; } return prev + 1; });
            }, 1000);
        } catch (err) { alert("রেকর্ডিং বাতিল বা ত্রুটি"); }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    // ============================================================
    // Save/Publish
    // ============================================================
    const handleSave = async (publishStatus: 'DRAFT' | 'PUBLISHED') => {
        if (!title.trim()) { alert("টাস্কের নাম দিন!"); return; }
        const unresolvedOverlaps = Object.keys(overlapWarnings).filter(id => {
            const ti = taskItems.find(t => t.id === id);
            return ti && !ti.forceSchedule;
        });
        if (unresolvedOverlaps.length > 0) { alert("সময় ওভারল্যাপ ঠিক করুন!"); return; }
        if (publishStatus === 'PUBLISHED' && selectedAssignees.length === 0 && workerType === 'EMPLOYEE') {
            alert("পাবলিশ করতে কমপক্ষে একজন কর্মী নির্বাচন করুন!");
            return;
        }

        setLoading(true);
        try {
            let videoUrl = null;
            if (recordedBlob) {
                const file = new File([recordedBlob], videoInfo?.name || "screen-recording.webm", { type: "video/webm" });
                const formData = new FormData();
                formData.append("file", file);
                const token = await auth.currentUser?.getIdToken();
                const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload`, formData, { headers: { Authorization: `Bearer ${token}` } });
                videoUrl = res.data.url;
            }

            const token = await auth.currentUser?.getIdToken();

            if (taskType === 'BUNDLE' && taskItems.length > 0) {
                await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/task-bundle/bundle`, {
                    title, description, priority, deadline,
                    subTasks: taskItems.map((ti, idx) => ({
                        title: ti.title, description: ti.description, billingType: ti.billingType,
                        fixedPrice: ti.fixedPrice, hourlyRate: ti.hourlyRate, estimatedHours: ti.estimatedHours,
                        scheduleType: ti.scheduleType, scheduleDays: ti.scheduleDays,
                        startTime: ti.startTime, endTime: ti.endTime, orderIndex: idx
                    }))
                }, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/tasks/create`, {
                    title, priority, deadline, descriptionRaw: description, attachments, videoUrl,
                    status: publishStatus,
                    billingType: singleBillingType,
                    fixedPrice: singleFixedPrice, hourlyRate: singleHourlyRate, estimatedHours: singleEstimatedHours,
                    scheduleDays: singleScheduleDays, startTime: singleStartTime, endTime: singleEndTime,
                    screenshotInterval,
                    assigneeIds: workerType === 'EMPLOYEE' ? selectedAssignees : undefined,
                    freelancerEmail: workerType === 'FREELANCER' ? freelancerEmail : undefined
                }, { headers: { Authorization: `Bearer ${token}` } });
            }

            alert(publishStatus === 'DRAFT' ? "ড্রাফটে সেভ হয়েছে!" : "টাস্ক পাবলিশ হয়েছে!");
            router.push("/dashboard/tasks");
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.error || "সেভ ব্যর্থ");
        } finally {
            setLoading(false);
        }
    };

    const formatRecordTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    // ============================================================
    // Billing Type UI (Reusable)
    // ============================================================
    const renderBillingFields = (
        billingType: string,
        onBillingChange: (v: string) => void,
        fixedPrice: number | undefined,
        onFixedChange: (v: number | undefined) => void,
        hourlyRate: number | undefined,
        onHourlyChange: (v: number | undefined) => void,
        estimatedHours: number | undefined,
        onEstimatedChange: (v: number | undefined) => void,
        scheduleDays: number[],
        onDayToggle: (day: number) => void,
        startTime: string,
        onStartChange: (v: string) => void,
        endTime: string,
        onEndChange: (v: string) => void
    ) => (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
            <div>
                <label className="text-xs text-gray-500 block mb-2">বিলিং টাইপ</label>
                <div className="flex gap-2 flex-wrap">
                    {[
                        { value: 'FIXED_PRICE', label: '🏷️ ফিক্সড প্রাইস' },
                        { value: 'HOURLY', label: '⏱️ আওয়ারলি' },
                        { value: 'SCHEDULED', label: '📅 সিডিউল' }
                    ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => onBillingChange(opt.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billingType === opt.value ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'
                                }`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {billingType === 'FIXED_PRICE' && (
                <div>
                    <label className="text-xs text-gray-500">ফিক্সড প্রাইস (৳)</label>
                    <input type="number" placeholder="5000" className="w-full p-2 border rounded-lg mt-1"
                        value={fixedPrice || ''} onChange={e => onFixedChange(parseFloat(e.target.value) || undefined)} />
                </div>
            )}

            {billingType === 'HOURLY' && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-500">আওয়ারলি রেট (৳)</label>
                        <input type="number" placeholder="500" className="w-full p-2 border rounded-lg mt-1"
                            value={hourlyRate || ''} onChange={e => onHourlyChange(parseFloat(e.target.value) || undefined)} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">আনুমানিক ঘন্টা</label>
                        <input type="number" placeholder="10" className="w-full p-2 border rounded-lg mt-1"
                            value={estimatedHours || ''} onChange={e => onEstimatedChange(parseFloat(e.target.value) || undefined)} />
                    </div>
                </div>
            )}

            {billingType === 'SCHEDULED' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">শুরুর সময়</label>
                            <TimePicker value={startTime} onChange={onStartChange} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">শেষের সময়</label>
                            <TimePicker value={endTime} onChange={onEndChange} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-2">কোন কোন দিন</label>
                        <div className="flex gap-2 flex-wrap">
                            {DAYS_OF_WEEK.map((day, idx) => (
                                <button key={idx} type="button" onClick={() => onDayToggle(idx)}
                                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${scheduleDays.includes(idx) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}>
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
            <h1 className="text-3xl font-bold text-gray-800">টাস্ক তৈরি করুন</h1>

            {/* Task Settings */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 space-y-4">
                <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">টাস্ক সেটিংস</h2>
                <div className="flex flex-wrap gap-6">
                    <div>
                        <label className="text-xs text-gray-500 block mb-2">কার জন্য?</label>
                        <div className="flex bg-white rounded-lg p-1 shadow-sm border">
                            <button type="button" onClick={() => setWorkerType('EMPLOYEE')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${workerType === 'EMPLOYEE' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
                                    }`}>
                                <Users className="w-4 h-4" /> কর্মী
                            </button>
                            <button type="button" onClick={() => setWorkerType('FREELANCER')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${workerType === 'FREELANCER' ? 'bg-purple-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
                                    }`}>
                                <User className="w-4 h-4" /> ফ্রিল্যান্সার
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-2">টাস্কের ধরন</label>
                        <div className="flex bg-white rounded-lg p-1 shadow-sm border">
                            <button type="button" onClick={() => { setTaskType('SINGLE'); setTaskItems([]); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${taskType === 'SINGLE' ? 'bg-green-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
                                    }`}>
                                <FileText className="w-4 h-4" /> সিঙ্গেল
                            </button>
                            <button type="button" onClick={() => setTaskType('BUNDLE')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${taskType === 'BUNDLE' ? 'bg-orange-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
                                    }`}>
                                <Layers className="w-4 h-4" /> বান্ডেল
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 space-y-6">
                {/* Title & Basic */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">টাস্কের নাম *</label>
                        <input type="text" required className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                            value={title} onChange={e => setTitle(e.target.value)} placeholder="যেমন: Q1 মার্কেটিং রিপোর্ট" />
                    </div>
                    {workerType === 'FREELANCER' && (
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">ফ্রিল্যান্সার ইমেইল</label>
                            <input type="email" className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                value={freelancerEmail} onChange={e => setFreelancerEmail(e.target.value)} placeholder="freelancer@email.com" />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">প্রায়োরিটি</label>
                        <select className="mt-1 w-full p-2 border rounded-lg" value={priority} onChange={e => setPriority(e.target.value)}>
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">ডেডলাইন</label>
                        <input type="date" className="mt-1 w-full p-2 border rounded-lg" value={deadline} onChange={e => setDeadline(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">📷 স্ক্রিনশট ইন্টারভাল</label>
                        <select
                            className="mt-1 w-full p-2 border rounded-lg"
                            value={screenshotInterval}
                            onChange={e => setScreenshotInterval(parseInt(e.target.value))}
                        >
                            {[1, 2, 3, 5, 10, 15, 20, 30, 45, 60].map(min => (
                                <option key={min} value={min}>{min} মিনিট</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">বিবরণ</label>
                    <textarea rows={4} className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="বিস্তারিত নির্দেশনা..." value={description} onChange={e => setDescription(e.target.value)} />
                </div>

                {/* SINGLE TASK BILLING */}
                {taskType === 'SINGLE' && (
                    <div className="border-t pt-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">💰 বিলিং ও সময়সূচী</h2>
                        {renderBillingFields(
                            singleBillingType, (v) => setSingleBillingType(v as any),
                            singleFixedPrice, setSingleFixedPrice,
                            singleHourlyRate, setSingleHourlyRate,
                            singleEstimatedHours, setSingleEstimatedHours,
                            singleScheduleDays, toggleSingleScheduleDay,
                            singleStartTime, setSingleStartTime,
                            singleEndTime, setSingleEndTime
                        )}
                    </div>
                )}

                {/* BUNDLE TASKS */}
                {taskType === 'BUNDLE' && (
                    <div className="border-t pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                📋 টাস্ক সমূহ <span className="text-sm font-normal text-gray-500">({taskItems.length}/10)</span>
                            </h2>
                            <p className="text-xs text-gray-400">ড্র্যাগ করে সিকোয়েন্স পরিবর্তন করুন</p>
                        </div>

                        <div className="space-y-4">
                            {taskItems.map((ti, index) => (
                                <div key={ti.id} draggable onDragStart={() => handleDragStart(index)}
                                    onDragOver={(e) => handleDragOver(e, index)} onDragEnd={handleDragEnd}
                                    className={`p-4 bg-gray-50 border rounded-lg space-y-4 cursor-move transition-all ${draggedIndex === index ? 'opacity-50 border-indigo-400' : ''
                                        }`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <GripVertical className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-bold text-indigo-600">
                                                টাস্ক #{index + 1} {ti.title && <span className="text-gray-600">— {ti.title}</span>}
                                            </span>
                                        </div>
                                        <button onClick={() => removeTaskItem(ti.id)} className="text-red-500 hover:bg-red-100 p-1 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <input type="text" placeholder="টাস্কের নাম" className="w-full p-2 border rounded-lg"
                                        value={ti.title} onChange={e => updateTaskItem(ti.id, 'title', e.target.value)} />

                                    {renderBillingFields(
                                        ti.billingType,
                                        (v) => updateTaskItem(ti.id, 'billingType', v),
                                        ti.fixedPrice, (v) => updateTaskItem(ti.id, 'fixedPrice', v),
                                        ti.hourlyRate, (v) => updateTaskItem(ti.id, 'hourlyRate', v),
                                        ti.estimatedHours, (v) => updateTaskItem(ti.id, 'estimatedHours', v),
                                        ti.scheduleDays, (day) => toggleScheduleDay(ti.id, day),
                                        ti.startTime || '', (v) => updateTaskItem(ti.id, 'startTime', v),
                                        ti.endTime || '', (v) => updateTaskItem(ti.id, 'endTime', v)
                                    )}

                                    {/* Overlap Warning */}
                                    {overlapWarnings[ti.id] && !ti.forceSchedule && (
                                        <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <div className="flex items-center gap-2 text-yellow-700">
                                                <AlertTriangle className="w-4 h-4" />
                                                <span className="text-sm">{overlapWarnings[ti.id]}</span>
                                            </div>
                                            <button type="button" onClick={() => forceSchedule(ti.id)}
                                                className="px-3 py-1 bg-yellow-600 text-white text-xs font-bold rounded hover:bg-yellow-700">
                                                Force Schedule
                                            </button>
                                        </div>
                                    )}
                                    {ti.forceSchedule && (
                                        <div className="text-xs text-orange-600 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Force Schedule সক্রিয়
                                        </div>
                                    )}

                                    <textarea placeholder="টাস্কের বিবরণ..." className="w-full p-2 border rounded-lg text-sm" rows={2}
                                        value={ti.description} onChange={e => updateTaskItem(ti.id, 'description', e.target.value)} />

                                    <div className="flex items-center gap-3">
                                        <input type="file" className="hidden" id={`task-file-${ti.id}`}
                                            onChange={(e) => handleTaskFileUpload(e.target.files, ti.id)} />
                                        <label htmlFor={`task-file-${ti.id}`}
                                            className="px-3 py-1.5 text-xs border rounded-lg cursor-pointer hover:bg-gray-100 flex items-center gap-1">
                                            <Upload className="w-3 h-3" /> ফাইল (20MB)
                                        </label>
                                        {uploadingTaskId === ti.id && <span className="text-xs text-gray-400">আপলোড হচ্ছে...</span>}
                                        {ti.attachment && (
                                            <span className="text-xs text-green-600 flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" /> {ti.attachment.split('/').pop()?.slice(0, 20)}...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button type="button" onClick={addTaskItem} disabled={taskItems.length >= 10}
                            className="mt-4 w-full py-4 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 font-bold hover:bg-indigo-50 hover:border-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            <Plus className="w-6 h-6" /> <span className="text-lg">টাস্ক যুক্ত করুন</span>
                        </button>
                    </div>
                )}

                {/* Attachments */}
                <div className="border-t pt-6 space-y-4">
                    <label className="block text-sm font-medium text-gray-700">মূল টাস্কের অ্যাটাচমেন্ট (100MB)</label>
                    <div className="flex gap-4 flex-wrap">
                        <div>
                            <input type="file" ref={fileInputRef} onChange={e => handleMainFileUpload(e.target.files)} className="hidden" />
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2 font-medium text-gray-700">
                                <Upload className="w-4 h-4" /> ফাইল
                            </button>
                        </div>
                        {!isRecording && !recordedBlob ? (
                            <button type="button" onClick={startRecording} className="px-4 py-2 border border-red-200 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2 font-medium hover:bg-red-100">
                                <Video className="w-4 h-4" /> স্ক্রিন রেকর্ড
                            </button>
                        ) : isRecording ? (
                            <button type="button" onClick={stopRecording} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm animate-pulse font-medium">
                                <StopCircle className="w-4 h-4 inline mr-2" /> বন্ধ ({formatRecordTime(recordingTime)})
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <div className="text-sm">
                                    <span className="font-medium text-green-700">{videoInfo?.name}</span>
                                    <span className="text-green-600 ml-2">({videoInfo?.size} MB)</span>
                                </div>
                                <button onClick={() => { setRecordedBlob(null); setVideoInfo(null); }} className="ml-2 text-gray-400 hover:text-red-500">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                    {attachments.length > 0 && (
                        <div className="text-xs text-gray-500 space-y-1">
                            {attachments.map((a, i) => <div key={i}>📎 {a.split('/').pop()}</div>)}
                        </div>
                    )}
                </div>

                {/* Assignees */}
                {workerType === 'EMPLOYEE' && employees.length > 0 && (
                    <div className="border-t pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">কর্মী নির্বাচন</label>
                        <div className="flex flex-wrap gap-2">
                            {employees.map(emp => (
                                <button key={emp.id} type="button"
                                    onClick={() => setSelectedAssignees(prev =>
                                        prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                                    )}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedAssignees.includes(emp.id) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}>
                                    {emp.name || emp.email}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="pt-6 border-t flex justify-end gap-4">
                    <button onClick={() => handleSave('DRAFT')} disabled={loading}
                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2">
                        <Save className="w-4 h-4" /> ড্রাফট
                    </button>
                    <button onClick={() => handleSave('PUBLISHED')} disabled={loading}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md">
                        <Send className="w-4 h-4" /> পাবলিশ
                    </button>
                </div>
            </div>
        </div>
    );
}
