// ============================================================
// KormoSync Desktop App - Task Details Page (Phase 12 Redesign)
// styled-components + theme tokens — consistent with Dashboard
// ============================================================

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled, { css, keyframes } from 'styled-components';
import { auth } from '../firebase';
import axios from 'axios';
import ProofOfWorkModal from '../components/ProofOfWorkModal';
import { noteApi } from '../services/api';
import { theme } from '../styles/theme';
import type { TaskNote } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

// ==========================================
// Types
// ==========================================
interface SubTask {
    id: string;
    title: string;
    description?: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    totalSeconds: number;
    isActive: boolean;
    currentSessionSeconds: number;
    orderIndex: number;
    scheduleStatus?: 'locked' | 'active' | 'starting_soon' | 'ended' | 'no_schedule';
    scheduleLabel?: string;
    scheduleCountdown?: string;
    canStart?: boolean;
    endsInSeconds?: number;
    startTime?: string;
    endTime?: string;
    estimatedHours?: number;
    budgetSeconds?: number | null;
    remainingBudgetSeconds?: number | null;
}

interface TaskChecklist {
    id: string;
    title: string;
    isCompleted: boolean;
    orderIndex: number;
}

interface Task {
    id: string;
    title: string;
    description?: string;
    screenshotInterval?: number;
    subTasks: SubTask[];
    maxBudget?: number;
    allowOvertime?: boolean;
    isRecurring?: boolean;
    recurringType?: string;
    checklist?: TaskChecklist[];
    status?: string;
    employeeCanComplete?: boolean;
    breakReminderEnabled?: boolean;
    breakAfterHours?: number;
    attachments?: string[];
    resourceLinks?: string[];
    videoUrl?: string;
    deadline?: string;
}

// ==========================================
// Utility Functions
// ==========================================
const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const formatBudget = (seconds: number | null | undefined): string => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

const getFileIcon = (url: string): string => {
    const ext = url.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['zip', 'rar', '7z'].includes(ext)) return '📦';
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return '🎬';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return '🎵';
    return '📎';
};

const getFileName = (url: string): string => {
    const parts = url.split('/');
    return decodeURIComponent(parts[parts.length - 1] || 'file');
};

// ==========================================
// Animations
// ==========================================
const pulse = keyframes`
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
`;

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
    to { transform: rotate(360deg); }
`;

// ==========================================
// Styled Components
// ==========================================
const PageWrapper = styled.div`
    height: 100vh;
    background: ${theme.colors.bg.primary};
    color: ${theme.colors.text.primary};
    display: flex;
    flex-direction: column;
    font-family: ${theme.typography.fontFamily};
`;

const HeaderSection = styled.header`
    padding: ${theme.spacing.xl};
    border-bottom: 1px solid ${theme.colors.border.primary};
    flex-shrink: 0;
    background: ${theme.colors.bg.secondary};
`;

const BackButton = styled.button`
    color: ${theme.colors.text.muted};
    font-size: ${theme.typography.fontSize.sm};
    background: none;
    border: none;
    cursor: pointer;
    margin-bottom: ${theme.spacing.sm};
    transition: color ${theme.animation.duration.fast};
    &:hover { color: ${theme.colors.text.primary}; }
`;

const HeaderRow = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
`;

const TaskTitle = styled.h1`
    font-size: ${theme.typography.fontSize.xl};
    font-weight: ${theme.typography.fontWeight.bold};
    margin: 0;
`;

const BadgeRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: ${theme.spacing.sm};
`;

const TagBadge = styled.span<{ $color: string; $bg: string; $border: string }>`
    font-size: ${theme.typography.fontSize.xs};
    padding: 2px 8px;
    border-radius: ${theme.borderRadius.full};
    background: ${p => p.$bg};
    color: ${p => p.$color};
    border: 1px solid ${p => p.$border};
`;

const TimerBlock = styled.div`
    text-align: right;
`;

const TimerLabel = styled.p`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.muted};
    margin: 0 0 4px 0;
`;

const TimerValue = styled.p`
    font-size: ${theme.typography.fontSize['3xl']};
    font-family: ${theme.typography.fontFamilyMono};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.primary.main};
    margin: 0;
`;

const CompleteTaskBtn = styled.button`
    margin-top: ${theme.spacing.lg};
    padding: 12px ${theme.spacing.xl};
    background: ${theme.colors.status.error};
    border: none;
    border-radius: ${theme.borderRadius.lg};
    font-weight: ${theme.typography.fontWeight.bold};
    width: 100%;
    font-size: ${theme.typography.fontSize.md};
    cursor: pointer;
    color: white;
    transition: background ${theme.animation.duration.fast};
    &:hover { background: #dc2626; }
`;

const AdminOnlyNote = styled.div`
    margin-top: ${theme.spacing.lg};
    padding: 12px ${theme.spacing.xl};
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.lg};
    text-align: center;
    color: ${theme.colors.text.muted};
    font-size: ${theme.typography.fontSize.sm};
`;

const ScrollContent = styled.main`
    flex: 1;
    overflow-y: auto;
    padding: ${theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.lg};
`;

const SectionCard = styled.div<{ $accent?: string }>`
    padding: ${theme.spacing.lg};
    background: ${theme.colors.bg.secondary};
    border-radius: ${theme.borderRadius.xl};
    border: 1px solid ${theme.colors.border.primary};
    animation: ${fadeIn} 0.3s ease;
    ${p => p.$accent && css`border-left: 3px solid ${p.$accent};`}
`;

const SectionTitle = styled.h3`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.secondary};
    margin: 0 0 ${theme.spacing.md} 0;
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
`;

const CountBadge = styled.span`
    padding: 1px 6px;
    background: ${theme.colors.bg.tertiary};
    color: ${theme.colors.text.secondary};
    border-radius: ${theme.borderRadius.sm};
    font-size: ${theme.typography.fontSize.xs};
`;

const DescriptionText = styled.p`
    font-size: ${theme.typography.fontSize.base};
    color: ${theme.colors.text.secondary};
    white-space: pre-wrap;
    line-height: 1.6;
    margin: 0;
`;

const PlaceholderText = styled.p`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.disabled};
    text-align: center;
    padding: ${theme.spacing.sm} 0;
    margin: 0;
`;

const VideoCard = styled.div`
    padding: ${theme.spacing.lg};
    background: ${theme.colors.bg.secondary};
    border-radius: ${theme.borderRadius.xl};
    border: 1px solid rgba(99, 102, 241, 0.3);
    animation: ${fadeIn} 0.3s ease;
`;

const VideoRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.lg};
`;

const VideoIcon = styled.div`
    width: 48px;
    height: 48px;
    border-radius: ${theme.borderRadius.lg};
    background: rgba(99, 102, 241, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
`;

const VideoInfo = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
`;

const VideoName = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
    display: block;
`;

const VideoFileName = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const ActionBtn = styled.button<{ $variant?: 'primary' | 'indigo' | 'danger' | 'success' | 'ghost' }>`
    padding: 6px 12px;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.xs};
    font-weight: ${theme.typography.fontWeight.medium};
    cursor: pointer;
    transition: all ${theme.animation.duration.fast};
    border: 1px solid transparent;

    ${p => p.$variant === 'primary' && css`
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        border-color: rgba(59, 130, 246, 0.3);
        &:hover { background: rgba(59, 130, 246, 0.25); }
    `}
    ${p => p.$variant === 'indigo' && css`
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
        border-color: rgba(99, 102, 241, 0.3);
        &:hover { background: rgba(99, 102, 241, 0.25); }
    `}
    ${p => p.$variant === 'ghost' && css`
        background: rgba(100, 116, 139, 0.1);
        color: ${theme.colors.text.muted};
        border-color: rgba(100, 116, 139, 0.3);
        &:hover { background: rgba(100, 116, 139, 0.2); }
    `}
`;

const FileItem = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing.sm};
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.lg};
    transition: background ${theme.animation.duration.fast};
    &:hover { background: ${theme.colors.bg.hover}; }
`;

const FileLeft = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    min-width: 0;
    flex: 1;
`;

const FileThumb = styled.img`
    width: 40px;
    height: 40px;
    border-radius: ${theme.borderRadius.sm};
    object-fit: cover;
    flex-shrink: 0;
`;

const FileIconText = styled.span`
    font-size: 18px;
`;

const FileName = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const FileBtnGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
`;

const ResourceLink = styled.button`
    display: block;
    font-size: ${theme.typography.fontSize.sm};
    color: #60a5fa;
    background: none;
    border: none;
    cursor: pointer;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    margin-bottom: 4px;
    text-align: left;
    &:hover { color: #93bbfc; }
`;

const ChecklistBar = styled.div`
    width: 100%;
    height: 6px;
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.full};
    overflow: hidden;
    margin-bottom: ${theme.spacing.md};
`;

const ChecklistBarFill = styled.div<{ $pct: number }>`
    height: 100%;
    width: ${p => p.$pct}%;
    background: ${theme.colors.status.success};
    transition: width 0.4s ease;
`;

const ChecklistItem = styled.div<{ $done: boolean }>`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    font-size: ${theme.typography.fontSize.sm};
    color: ${p => p.$done ? theme.colors.text.muted : theme.colors.text.secondary};
    ${p => p.$done && css`text-decoration: line-through;`}
`;

// Sub-task styled components
const SubTaskCard = styled.div<{ $active: boolean; $completed: boolean; $locked: boolean }>`
    padding: ${theme.spacing.lg};
    border-radius: ${theme.borderRadius.xl};
    transition: all ${theme.animation.duration.normal};
    animation: ${fadeIn} 0.3s ease;

    ${p => p.$active && css`
        background: ${theme.colors.bg.secondary};
        border: 2px solid ${theme.colors.primary.main};
        box-shadow: ${theme.shadows.glow.yellow};
    `}
    ${p => p.$completed && !p.$active && css`
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(34, 197, 94, 0.3);
    `}
    ${p => p.$locked && !p.$active && !p.$completed && css`
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid ${theme.colors.border.primary};
        opacity: 0.7;
    `}
    ${p => !p.$active && !p.$completed && !p.$locked && css`
        background: ${theme.colors.bg.secondary};
        border: 1px solid ${theme.colors.border.primary};
    `}
`;

const SubTaskRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const SubTaskLeft = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    flex: 1;
    min-width: 0;
`;

const StatusDot = styled.div<{ $color: string; $pulse?: boolean }>`
    width: 10px;
    height: 10px;
    border-radius: ${theme.borderRadius.full};
    background: ${p => p.$color};
    flex-shrink: 0;
    ${p => p.$pulse && css`animation: ${pulse} 1.5s ease-in-out infinite;`}
`;

const SubTaskTitle = styled.p<{ $completed: boolean }>`
    font-weight: ${theme.typography.fontWeight.medium};
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    ${p => p.$completed && css`
        text-decoration: line-through;
        color: ${theme.colors.text.muted};
    `}
`;

const ScheduleBadge = styled.span<{ $type: string }>`
    font-size: ${theme.typography.fontSize.xs};
    padding: 2px 8px;
    border-radius: ${theme.borderRadius.full};
    flex-shrink: 0;
    ${p => p.$type === 'active' && css`background: rgba(34, 197, 94, 0.15); color: #4ade80;`}
    ${p => p.$type === 'starting_soon' && css`background: rgba(234, 179, 8, 0.15); color: #facc15;`}
    ${p => p.$type === 'locked' && css`background: rgba(100, 116, 139, 0.2); color: ${theme.colors.text.muted};`}
    ${p => p.$type === 'ended' && css`background: rgba(239, 68, 68, 0.15); color: #f87171;`}
`;

const BudgetInfo = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    margin-top: 4px;
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const SubTaskDesc = styled.p`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    margin: 6px 0 0;
    white-space: pre-wrap;
    line-height: 1.5;
`;

const SubTaskRight = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.lg};
    flex-shrink: 0;
`;

const SubTaskTimer = styled.div<{ $active: boolean }>`
    font-family: ${theme.typography.fontFamilyMono};
    font-size: ${theme.typography.fontSize.lg};
    color: ${p => p.$active ? theme.colors.primary.main : theme.colors.text.muted};
`;

const CircleBtn = styled.button<{ $color: string }>`
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${theme.borderRadius.full};
    background: ${p => p.$color};
    border: none;
    cursor: pointer;
    color: white;
    font-size: 14px;
    transition: all ${theme.animation.duration.fast};
    &:hover { filter: brightness(1.1); transform: scale(1.05); }
    &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const CompletedTag = styled.span`
    padding: 4px 12px;
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    font-size: ${theme.typography.fontSize.sm};
    border-radius: ${theme.borderRadius.full};
`;

// Notes
const NoteInput = styled.input`
    flex: 1;
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
    padding: 8px 12px;
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.primary};
    outline: none;
    &::placeholder { color: ${theme.colors.text.disabled}; }
    &:focus { border-color: ${theme.colors.primary.main}; }
`;

const NoteSubmitBtn = styled.button`
    padding: 8px 16px;
    background: ${theme.colors.primary.main};
    border: none;
    border-radius: ${theme.borderRadius.lg};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.inverse};
    cursor: pointer;
    flex-shrink: 0;
    &:hover { background: ${theme.colors.primary.light}; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const NoteItem = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.lg};
    border-left: 3px solid ${theme.colors.primary.muted};
`;

const NoteContent = styled.p`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
    margin: 0;
`;

const NoteMeta = styled.p`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    margin: 4px 0 0;
`;

const NoteDeleteBtn = styled.button`
    color: ${theme.colors.text.disabled};
    background: none;
    border: none;
    cursor: pointer;
    font-size: ${theme.typography.fontSize.sm};
    margin-left: ${theme.spacing.sm};
    flex-shrink: 0;
    &:hover { color: ${theme.colors.status.error}; }
`;

const LoadingWrapper = styled.div`
    height: 100vh;
    background: ${theme.colors.bg.primary};
    display: flex;
    align-items: center;
    justify-content: center;
`;

const Spinner = styled.div`
    width: 40px;
    height: 40px;
    border: 4px solid ${theme.colors.border.primary};
    border-top-color: ${theme.colors.primary.main};
    border-radius: 50%;
    animation: ${spin} 0.8s linear infinite;
`;

const EmptyState = styled.div`
    text-align: center;
    color: ${theme.colors.text.muted};
    padding: ${theme.spacing['2xl']} 0;
`;

// ==========================================
// Main Component
// ==========================================
export default function TaskDetails() {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();

    const [task, setTask] = useState<Task | null>(null);
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [activeSubTaskId, setActiveSubTaskId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Auto-stop modal state
    const [showProofOfWorkModal, setShowProofOfWorkModal] = useState(false);
    const [autoStopSubTaskId, setAutoStopSubTaskId] = useState<string | null>(null);
    const [autoStopSubTaskTitle, setAutoStopSubTaskTitle] = useState('');

    // Notes state
    const [notes, setNotes] = useState<TaskNote[]>([]);
    const [newNote, setNewNote] = useState('');
    const [notesLoading, setNotesLoading] = useState(false);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ==========================================
    // Fetch Task & Sub-tasks
    // ==========================================
    useEffect(() => {
        const fetchData = async () => {
            try {
                const user = auth.currentUser;
                if (!user || !taskId) return;

                const token = await user.getIdToken();

                // Fetch task details
                const taskRes = await axios.get(`${API_URL}/tasks/${taskId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (taskRes.data.success) {
                    setTask(taskRes.data.task);
                }

                // Fetch sub-tasks with time info
                const subTasksRes = await axios.get(`${API_URL}/subtasks/task/${taskId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (subTasksRes.data.success) {
                    setSubTasks(subTasksRes.data.subTasks);
                    setActiveSubTaskId(subTasksRes.data.activeSubTaskId);
                }

                // Fetch notes
                try {
                    const taskNotes = await noteApi.getByTask(taskId);
                    setNotes(taskNotes);
                } catch {
                    // Notes feature optional
                }
            } catch (error) {
                console.error('Failed to fetch task data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [taskId]);

    // ==========================================
    // Timer Effect — update active sub-task time
    // ==========================================
    useEffect(() => {
        if (activeSubTaskId) {
            timerRef.current = setInterval(() => {
                setSubTasks(prev => prev.map(st => {
                    if (st.id === activeSubTaskId) {
                        return { ...st, currentSessionSeconds: st.currentSessionSeconds + 1 };
                    }
                    return st;
                }));
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [activeSubTaskId]);

    // ==========================================
    // Screenshot is handled by the global tick system in useAppStore.ts
    // No duplicate screenshot logic needed here
    // ==========================================

    // ==========================================
    // Listen for Schedule Auto-Stop
    // ==========================================
    useEffect(() => {
        const handleAutoStop = (data: { taskName: string; reason: string }) => {
            if (activeSubTaskId) {
                const activeSubTask = subTasks.find(st => st.id === activeSubTaskId);
                if (activeSubTask) {
                    setAutoStopSubTaskId(activeSubTaskId);
                    setAutoStopSubTaskTitle(activeSubTask.title);
                    setShowProofOfWorkModal(true);
                }
            }
        };

        window.electron?.onScheduleAutoStop?.(handleAutoStop);
    }, [activeSubTaskId, subTasks]);

    // ==========================================
    // Handle Proof of Work Submission
    // ==========================================
    const handleProofOfWorkSubmit = async (proofOfWork: string) => {
        if (!autoStopSubTaskId) return;

        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            await axios.post(
                `${API_URL}/subtasks/${autoStopSubTaskId}/auto-stop`,
                { proofOfWork },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSubTasks(prev => prev.map(st => {
                if (st.id === autoStopSubTaskId) {
                    return {
                        ...st,
                        isActive: false,
                        status: 'PENDING',
                        totalSeconds: st.totalSeconds + st.currentSessionSeconds,
                        currentSessionSeconds: 0
                    };
                }
                return st;
            }));
            setActiveSubTaskId(null);
            window.electron?.trackingStopped?.();
            setShowProofOfWorkModal(false);
            setAutoStopSubTaskId(null);
            setAutoStopSubTaskTitle('');
        } catch (error) {
            console.error('Failed to auto-stop sub-task:', error);
            setShowProofOfWorkModal(false);
        }
    };

    // ==========================================
    // Actions
    // ==========================================
    const startSubTask = async (subTaskId: string) => {
        try {
            setActionLoading(subTaskId);
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const res = await axios.post(
                `${API_URL}/subtasks/${subTaskId}/start`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                setSubTasks(prev => prev.map(st => ({
                    ...st,
                    isActive: st.id === subTaskId,
                    status: st.id === subTaskId ? 'IN_PROGRESS' : (st.isActive ? 'PENDING' : st.status),
                    currentSessionSeconds: st.id === subTaskId ? 0 : st.currentSessionSeconds,
                    totalSeconds: st.isActive && st.id !== subTaskId
                        ? st.totalSeconds + st.currentSessionSeconds
                        : st.totalSeconds
                })));
                setActiveSubTaskId(subTaskId);

                window.electron?.trackingStarted?.({
                    taskName: task?.title || 'Unknown',
                    taskId: taskId!,
                    subTaskId,
                    subTaskName: subTasks.find(st => st.id === subTaskId)?.title
                });
            }
        } catch (error) {
            console.error('Failed to start sub-task:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const stopSubTask = async (subTaskId: string) => {
        try {
            setActionLoading(subTaskId);
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const res = await axios.post(
                `${API_URL}/subtasks/${subTaskId}/stop`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                setSubTasks(prev => prev.map(st => {
                    if (st.id === subTaskId) {
                        return {
                            ...st,
                            isActive: false,
                            status: 'PENDING',
                            totalSeconds: st.totalSeconds + st.currentSessionSeconds,
                            currentSessionSeconds: 0
                        };
                    }
                    return st;
                }));
                setActiveSubTaskId(null);
                window.electron?.trackingStopped?.();
            }
        } catch (error) {
            console.error('Failed to stop sub-task:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const completeSubTask = async (subTaskId: string) => {
        try {
            setActionLoading(subTaskId);
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const res = await axios.post(
                `${API_URL}/subtasks/${subTaskId}/complete`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                setSubTasks(prev => prev.map(st => {
                    if (st.id === subTaskId) {
                        return {
                            ...st,
                            isActive: false,
                            status: 'COMPLETED',
                            totalSeconds: st.totalSeconds + st.currentSessionSeconds,
                            currentSessionSeconds: 0
                        };
                    }
                    return st;
                }));
                if (activeSubTaskId === subTaskId) {
                    setActiveSubTaskId(null);
                    window.electron?.trackingStopped?.();
                }
            }
        } catch (error) {
            console.error('Failed to complete sub-task:', error);
        } finally {
            setActionLoading(null);
        }
    };

    // ==========================================
    // Notes Actions
    // ==========================================
    const handleAddNote = async () => {
        if (!newNote.trim() || !taskId) return;
        setNotesLoading(true);
        try {
            const note = await noteApi.create(taskId, newNote.trim());
            setNotes(prev => [note, ...prev]);
            setNewNote('');
        } catch (error) {
            console.error('Failed to add note:', error);
        } finally {
            setNotesLoading(false);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        try {
            await noteApi.delete(noteId);
            setNotes(prev => prev.filter(n => n.id !== noteId));
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    };

    // ==========================================
    // File Download
    // ==========================================
    const handleDownload = async (url: string) => {
        const fullUrl = url.startsWith('http') ? url : `${API_URL.replace('/api', '')}/${url}`;

        if (window.electron?.downloadFile) {
            const ext = url.split('.').pop()?.split('?')[0] || 'file';
            const filename = `attachment-${Date.now()}.${ext}`;
            try {
                const result = await window.electron.downloadFile({ url: fullUrl, filename });
                if (result.success) return;
                if (result.canceled) return;
            } catch (err) {
                console.error('Download failed, opening in browser:', err);
            }
        }

        window.electron?.openExternal?.(fullUrl);
    };

    // Calculate global timer
    const globalTime = subTasks.reduce((acc, st) => {
        return acc + st.totalSeconds + (st.isActive ? st.currentSessionSeconds : 0);
    }, 0);

    const isDone = task?.status === 'DONE';
    const canEmployeeComplete = task?.employeeCanComplete !== false;

    // ==========================================
    // Render
    // ==========================================
    if (loading) {
        return (
            <LoadingWrapper>
                <Spinner />
            </LoadingWrapper>
        );
    }

    return (
        <PageWrapper>
            {/* Header */}
            <HeaderSection>
                <BackButton onClick={() => navigate('/dashboard')}>
                    &larr; ড্যাশবোর্ডে ফিরুন
                </BackButton>
                <HeaderRow>
                    <div>
                        <TaskTitle>{task?.title || 'টাস্ক'}</TaskTitle>
                        <BadgeRow>
                            {task?.allowOvertime && (
                                <TagBadge $color="#fbbf24" $bg="rgba(245, 158, 11, 0.15)" $border="rgba(245, 158, 11, 0.3)">⏰ ওভারটাইম</TagBadge>
                            )}
                            {task?.isRecurring && (
                                <TagBadge $color="#818cf8" $bg="rgba(99, 102, 241, 0.15)" $border="rgba(99, 102, 241, 0.3)">🔄 {task.recurringType === 'DAILY' ? 'দৈনিক' : task.recurringType === 'WEEKLY' ? 'সাপ্তাহিক' : 'মাসিক'}</TagBadge>
                            )}
                            {task?.maxBudget && task.maxBudget > 0 && (
                                <TagBadge $color="#4ade80" $bg="rgba(34, 197, 94, 0.15)" $border="rgba(34, 197, 94, 0.3)">💰 ৳{task.maxBudget.toLocaleString()}</TagBadge>
                            )}
                            {task?.status === 'REVIEW' && (
                                <TagBadge $color="#fb923c" $bg="rgba(249, 115, 22, 0.15)" $border="rgba(249, 115, 22, 0.3)">🔍 রিভিউ</TagBadge>
                            )}
                            {isDone && (
                                <TagBadge $color="#4ade80" $bg="rgba(34, 197, 94, 0.15)" $border="rgba(34, 197, 94, 0.3)">✅ সম্পন্ন</TagBadge>
                            )}
                            {task?.breakReminderEnabled && (
                                <TagBadge $color="#c084fc" $bg="rgba(168, 85, 247, 0.15)" $border="rgba(168, 85, 247, 0.3)">🧘 বিরতি: {task.breakAfterHours || 2}ঘ পর</TagBadge>
                            )}
                            {task?.deadline && (
                                <TagBadge $color="#60a5fa" $bg="rgba(59, 130, 246, 0.15)" $border="rgba(59, 130, 246, 0.3)">📅 ডেডলাইন: {new Date(task.deadline).toLocaleDateString('bn-BD')}</TagBadge>
                            )}
                        </BadgeRow>
                    </div>

                    <TimerBlock>
                        <TimerLabel>মোট সময়</TimerLabel>
                        <TimerValue>{formatTime(globalTime)}</TimerValue>
                    </TimerBlock>
                </HeaderRow>

                {canEmployeeComplete && !isDone && (
                    <CompleteTaskBtn onClick={() => navigate('/dashboard')}>
                        প্রজেক্ট শেষ করুন
                    </CompleteTaskBtn>
                )}
                {!canEmployeeComplete && !isDone && (
                    <AdminOnlyNote>🔒 এই কাজ শুধু এডমিন শেষ করতে পারবে</AdminOnlyNote>
                )}
            </HeaderSection>

            {/* Scrollable Content */}
            <ScrollContent>

                {/* Task Description — always visible */}
                <SectionCard $accent={theme.colors.primary.main}>
                    <SectionTitle>📝 কাজের বিবরণ</SectionTitle>
                    {task?.description && task.description.trim() ? (
                        <DescriptionText>{task.description}</DescriptionText>
                    ) : (
                        <PlaceholderText>কোনো বিবরণ দেওয়া হয়নি</PlaceholderText>
                    )}
                </SectionCard>

                {/* Screen Recording */}
                {task?.videoUrl && (
                    <VideoCard>
                        <SectionTitle style={{ color: '#818cf8' }}>🎬 স্ক্রিন রেকর্ডিং</SectionTitle>
                        <VideoRow>
                            <VideoInfo>
                                <VideoIcon>🎬</VideoIcon>
                                <div>
                                    <VideoName>ভিডিও রেকর্ডিং</VideoName>
                                    <VideoFileName>{getFileName(task.videoUrl)}</VideoFileName>
                                </div>
                            </VideoInfo>
                            <ActionBtn $variant="indigo" onClick={() => handleDownload(task.videoUrl!)}>
                                ▶️ দেখুন / ডাউনলোড
                            </ActionBtn>
                        </VideoRow>
                    </VideoCard>
                )}

                {/* Files & Attachments — always visible */}
                <SectionCard>
                    <SectionTitle>
                        📎 ফাইল ও সংযুক্তি
                        {task?.attachments && task.attachments.length > 0 && (
                            <CountBadge>{task.attachments.length}</CountBadge>
                        )}
                    </SectionTitle>
                    {task?.attachments && task.attachments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {task.attachments.map((url, i) => {
                                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url.split('?')[0]);
                                return (
                                    <FileItem key={i}>
                                        <FileLeft>
                                            {isImage ? (
                                                <FileThumb src={url} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                            ) : (
                                                <FileIconText>{getFileIcon(url)}</FileIconText>
                                            )}
                                            <FileName>{getFileName(url)}</FileName>
                                        </FileLeft>
                                        <FileBtnGroup>
                                            <ActionBtn $variant="primary" onClick={() => handleDownload(url)}>
                                                ⬇️ ডাউনলোড
                                            </ActionBtn>
                                            <ActionBtn $variant="ghost" onClick={() => window.electron?.openExternal?.(url.startsWith('http') ? url : `${API_URL.replace('/api', '')}/${url}`)} title="ব্রাউজারে খুলুন">
                                                🔗
                                            </ActionBtn>
                                        </FileBtnGroup>
                                    </FileItem>
                                );
                            })}
                        </div>
                    ) : (
                        <PlaceholderText>কোনো ফাইল নেই</PlaceholderText>
                    )}

                    {/* Resource Links */}
                    {task?.resourceLinks && task.resourceLinks.length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                            <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.muted, marginBottom: '4px' }}>🔗 রিসোর্স লিংক</div>
                            {task.resourceLinks.map((link, i) => (
                                <ResourceLink key={i} onClick={() => window.electron?.openExternal?.(link)}>
                                    {link}
                                </ResourceLink>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* Read-Only Checklist */}
                {task?.checklist && task.checklist.length > 0 && (
                    <SectionCard>
                        <SectionTitle>✅ চেকলিস্ট ({task.checklist.filter(c => c.isCompleted).length}/{task.checklist.length})</SectionTitle>
                        <ChecklistBar>
                            <ChecklistBarFill $pct={(task.checklist.filter(c => c.isCompleted).length / task.checklist.length) * 100} />
                        </ChecklistBar>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {task.checklist.map(item => (
                                <ChecklistItem key={item.id} $done={item.isCompleted}>
                                    <span>{item.isCompleted ? '✅' : '⬜'}</span>
                                    <span>{item.title}</span>
                                </ChecklistItem>
                            ))}
                        </div>
                    </SectionCard>
                )}

                {/* Sub-task List */}
                {subTasks.length === 0 ? (
                    <EmptyState>কোনো সাব-টাস্ক নেই</EmptyState>
                ) : (
                    subTasks.map((st, idx) => (
                        <SubTaskCard
                            key={st.id}
                            $active={st.isActive}
                            $completed={st.status === 'COMPLETED'}
                            $locked={st.canStart === false}
                        >
                            <SubTaskRow>
                                <SubTaskLeft>
                                    <StatusDot
                                        $color={
                                            st.status === 'COMPLETED' ? theme.colors.status.success :
                                            st.isActive ? theme.colors.primary.main :
                                            st.canStart === false ? theme.colors.text.disabled :
                                            theme.colors.text.muted
                                        }
                                        $pulse={st.isActive}
                                    />

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <SubTaskTitle $completed={st.status === 'COMPLETED'}>
                                                {idx + 1}. {st.title}
                                            </SubTaskTitle>
                                            {st.scheduleStatus && st.scheduleStatus !== 'no_schedule' && (
                                                <ScheduleBadge $type={st.scheduleStatus}>
                                                    {st.scheduleStatus === 'locked' && '🔒'}
                                                    {st.scheduleStatus === 'active' && '🟢'}
                                                    {st.scheduleStatus === 'starting_soon' && '⏰'}
                                                    {' '}{st.scheduleLabel}
                                                </ScheduleBadge>
                                            )}
                                        </div>
                                        {st.budgetSeconds && (
                                            <BudgetInfo>
                                                <span>বাজেট: <span style={{ color: '#60a5fa' }}>{formatBudget(st.budgetSeconds)}</span></span>
                                                <span>বাকি: <span style={{ color: st.remainingBudgetSeconds && st.remainingBudgetSeconds < 3600 ? '#f87171' : theme.colors.text.muted }}>
                                                    {formatBudget(st.remainingBudgetSeconds)}
                                                </span></span>
                                            </BudgetInfo>
                                        )}
                                        {st.description && (
                                            <SubTaskDesc>{st.description}</SubTaskDesc>
                                        )}
                                    </div>
                                </SubTaskLeft>

                                <SubTaskRight>
                                    <SubTaskTimer $active={st.isActive}>
                                        {formatTime(st.totalSeconds + (st.isActive ? st.currentSessionSeconds : 0))}
                                    </SubTaskTimer>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {st.status !== 'COMPLETED' && !isDone && (
                                            <>
                                                {st.isActive ? (
                                                    <CircleBtn $color={theme.colors.status.error} onClick={() => stopSubTask(st.id)} disabled={actionLoading === st.id}>
                                                        ⏹
                                                    </CircleBtn>
                                                ) : (
                                                    <CircleBtn
                                                        $color={st.canStart === false ? theme.colors.text.disabled : theme.colors.status.success}
                                                        onClick={() => startSubTask(st.id)}
                                                        disabled={actionLoading === st.id || st.canStart === false}
                                                        title={st.canStart === false ? st.scheduleLabel || 'সময়সূচীর বাইরে' : 'শুরু করুন'}
                                                    >
                                                        {st.canStart === false ? '🔒' : '▶'}
                                                    </CircleBtn>
                                                )}

                                                {canEmployeeComplete && (
                                                    <CircleBtn $color="#3b82f6" onClick={() => completeSubTask(st.id)} disabled={actionLoading === st.id} title="সম্পন্ন করুন">
                                                        ✓
                                                    </CircleBtn>
                                                )}
                                            </>
                                        )}

                                        {st.status === 'COMPLETED' && (
                                            <CompletedTag>✓ সম্পন্ন</CompletedTag>
                                        )}
                                    </div>
                                </SubTaskRight>
                            </SubTaskRow>
                        </SubTaskCard>
                    ))
                )}

                {/* Work Journal / Notes Section */}
                <SectionCard>
                    <SectionTitle>📝 ওয়ার্ক জার্নাল</SectionTitle>

                    {/* Add Note */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <NoteInput
                            type="text"
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                            placeholder="নোট লিখুন..."
                        />
                        <NoteSubmitBtn onClick={handleAddNote} disabled={notesLoading || !newNote.trim()}>
                            {notesLoading ? '...' : 'যোগ করুন'}
                        </NoteSubmitBtn>
                    </div>

                    {/* Notes List */}
                    {notes.length === 0 ? (
                        <PlaceholderText>কোনো নোট নেই</PlaceholderText>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                            {notes.map(note => (
                                <NoteItem key={note.id}>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <NoteContent>{note.content}</NoteContent>
                                        <NoteMeta>
                                            {note.user?.name || 'Unknown'} &middot; {new Date(note.createdAt).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })}
                                        </NoteMeta>
                                    </div>
                                    <NoteDeleteBtn onClick={() => handleDeleteNote(note.id)} title="মুছুন">
                                        ✕
                                    </NoteDeleteBtn>
                                </NoteItem>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </ScrollContent>

            {/* Proof of Work Modal for Auto-Stop */}
            <ProofOfWorkModal
                isOpen={showProofOfWorkModal}
                subTaskTitle={autoStopSubTaskTitle}
                onSubmit={handleProofOfWorkSubmit}
                onClose={() => setShowProofOfWorkModal(false)}
            />
        </PageWrapper>
    );
}
