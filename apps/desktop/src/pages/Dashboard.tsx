// ============================================================
// KormoSync Desktop App - Dashboard Page
// List-based layout with sections: Active → Upcoming → Completed
// ============================================================

import React, { useMemo, useState, useEffect } from 'react';
import styled, { css } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../utils/constants';
import { theme } from '../styles/theme';
import {
    Card,
    Timer,
    SearchInput,
    SkeletonList,
    Badge,
    ProgressBar,
} from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import { formatMoney, formatDuration, getScheduleInfo } from '../utils/formatters';
import { assignmentApi, earningsApi, leaveApi, dutyApi } from '../services/api';
import type { Task, ScheduleStatus, TaskAssignment, EarningsBreakdown, LeaveBalance } from '../types';

interface DutyProgress {
    todayWorkedSeconds: number;
    minDailySeconds: number;
    expectedDailySeconds: number;
    progressPercent: number;
    attendanceAchieved: boolean;
    salaryType: string;
    virtualHourlyRate?: number;
    currency: string;
}

// ============================================================
// Styled Components
// ============================================================
const PageWrapper = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-width: 0;
    background: ${theme.colors.bg.primary};
    overflow: hidden;
`;

const Header = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    border-bottom: 1px solid ${theme.colors.border.primary};
    background: ${theme.colors.bg.secondary};
    -webkit-app-region: drag;
    flex-shrink: 0;
    min-width: 0;
    gap: ${theme.spacing.sm};
`;

const HeaderLeft = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    -webkit-app-region: no-drag;
    flex-shrink: 0;
`;

const Logo = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
`;

const LogoIcon = styled.div`
    width: 36px;
    height: 36px;
    background: ${theme.colors.primary.gradient};
    border-radius: ${theme.borderRadius.md};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
`;

const LogoText = styled.div``;

const LogoTitle = styled.h1`
    margin: 0;
    font-size: ${theme.typography.fontSize.lg};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
`;

const LogoSubtitle = styled.p`
    margin: 0;
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const HeaderRight = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    -webkit-app-region: no-drag;
    min-width: 0;
    flex-shrink: 1;
`;

const GlobalTimer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.lg};
    border: 1px solid ${theme.colors.status.success}40;
    flex-shrink: 0;
    white-space: nowrap;
`;

const GlobalTimerLabel = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const CurrentTime = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    background: ${theme.colors.primary.main}15;
    border-radius: ${theme.borderRadius.lg};
    border: 1px solid ${theme.colors.primary.main}30;
    flex-shrink: 0;
    white-space: nowrap;
`;

const TimeDisplay = styled.div`
    font-size: ${theme.typography.fontSize.lg};
    font-weight: ${theme.typography.fontWeight.bold};
    font-family: 'JetBrains Mono', monospace;
    color: ${theme.colors.primary.main};
    line-height: 1.2;
`;

const DateDisplay = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.secondary};
`;

const Content = styled.main`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: ${theme.spacing.lg} ${theme.spacing.xl};
    width: 100%;
    min-width: 0;
`;

// Stats Grid - Compact
const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: ${theme.spacing.sm};
    margin-bottom: ${theme.spacing.lg};
`;

const StatCard = styled(Card)`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.md} !important;
`;

const StatIcon = styled.div<{ $color: string }>`
    width: 40px;
    height: 40px;
    border-radius: ${theme.borderRadius.md};
    background: ${({ $color }) => $color}15;
    color: ${({ $color }) => $color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
`;

const StatInfo = styled.div`
    min-width: 0;
`;

const StatValue = styled.div`
    font-size: ${theme.typography.fontSize.xl};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
    line-height: 1.2;
`;

const StatLabel = styled.div`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
    margin-top: 2px;
`;

// Section with visible separation
const Section = styled.section<{ $variant?: 'active' | 'upcoming' | 'completed' }>`
    margin-bottom: ${theme.spacing.lg};
    background: ${({ $variant }) =>
        $variant === 'active' ? `${theme.colors.status.success}08` :
        $variant === 'completed' ? `${theme.colors.status.error}06` :
        'transparent'};
    border: 1px solid ${({ $variant }) =>
        $variant === 'active' ? `${theme.colors.status.success}25` :
        $variant === 'completed' ? `${theme.colors.status.error}20` :
        theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
    padding: ${theme.spacing.lg};
`;

const SectionHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${theme.spacing.md};
`;

const SectionTitle = styled.h2<{ $color?: string }>`
    margin: 0;
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${({ $color }) => $color || theme.colors.text.primary};
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
`;

const SectionCount = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.normal};
    color: ${theme.colors.text.muted};
`;

// List Layout
const TasksList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
`;

// Task List Row
const TaskListRow = styled.div<{ $isActive?: boolean; $isDone?: boolean; $isPaused?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    padding: ${theme.spacing.md} ${theme.spacing.lg};
    background: ${({ $isDone }) => $isDone ? `${theme.colors.status.error}08` : theme.colors.bg.secondary};
    border: 1px solid ${({ $isActive, $isDone }) =>
        $isActive ? `${theme.colors.status.success}50` :
        $isDone ? `${theme.colors.status.error}25` :
        theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    cursor: pointer;
    transition: all ${theme.animation.duration.fast};
    min-height: 60px;

    ${({ $isActive }) => $isActive && css`
        background: ${theme.colors.status.success}10;
        box-shadow: 0 0 0 1px ${theme.colors.status.success}30;
    `}

    ${({ $isPaused }) => $isPaused && css`
        border-left: 3px solid ${theme.colors.status.warning};
    `}

    &:hover {
        background: ${theme.colors.bg.hover};
        border-color: ${theme.colors.primary.main}40;
    }
`;

const TaskStatusDot = styled.div<{ $status: 'active' | 'paused' | 'todo' | 'done' }>`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    background: ${({ $status }) =>
        $status === 'active' ? theme.colors.status.success :
        $status === 'paused' ? theme.colors.status.warning :
        $status === 'done' ? theme.colors.status.error :
        theme.colors.text.muted};

    ${({ $status }) => $status === 'active' && css`
        box-shadow: 0 0 8px ${theme.colors.status.success}80;
        animation: dotPulse 2s ease-in-out infinite;
        @keyframes dotPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    `}
`;

const TaskRowIcon = styled.div`
    width: 36px;
    height: 36px;
    border-radius: ${theme.borderRadius.md};
    background: ${theme.colors.bg.tertiary};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
`;

const TaskRowInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const TaskRowTitle = styled.div`
    font-size: ${theme.typography.fontSize.base};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const TaskRowMeta = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    margin-top: 2px;
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const TaskRowStats = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.lg};
    flex-shrink: 0;
`;

const TaskRowStat = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
`;

const TaskRowStatLabel = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const TaskRowStatValue = styled.span<{ $color?: string }>`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${({ $color }) => $color || theme.colors.text.primary};
    font-family: 'JetBrains Mono', monospace;
`;

const DeadlineBadge = styled.span<{ $urgent?: boolean; $warning?: boolean }>`
    padding: 2px 8px;
    border-radius: ${theme.borderRadius.full};
    font-size: ${theme.typography.fontSize.xs};
    font-weight: 600;
    ${({ $urgent }) => $urgent && css`
        background: ${theme.colors.status.error}20;
        color: ${theme.colors.status.error};
        border: 1px solid ${theme.colors.status.error}40;
    `}
    ${({ $warning }) => $warning && css`
        background: ${theme.colors.status.warning}20;
        color: ${theme.colors.status.warning};
        border: 1px solid ${theme.colors.status.warning}40;
    `}
    ${({ $urgent, $warning }) => !$urgent && !$warning && css`
        background: ${theme.colors.bg.tertiary};
        color: ${theme.colors.text.secondary};
        border: 1px solid ${theme.colors.border.primary};
    `}
`;

const TaskRowBadges = styled.div`
    display: flex;
    gap: 4px;
    flex-shrink: 0;
`;

const MiniProgressBar = styled.div`
    width: 80px;
    flex-shrink: 0;
`;

const WebButton = styled.button`
    padding: ${theme.spacing.xs} ${theme.spacing.md};
    background: rgba(234, 179, 8, 0.15);
    color: ${theme.colors.primary.main};
    border: 1px solid rgba(234, 179, 8, 0.3);
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.xs};
    font-weight: 600;
    cursor: pointer;
    -webkit-app-region: no-drag;
    transition: all 0.2s ease;
    white-space: nowrap;
    &:hover {
        background: rgba(234, 179, 8, 0.25);
    }
`;

const EmptyState = styled.div`
    text-align: center;
    padding: ${theme.spacing['3xl']} ${theme.spacing.xl};
    color: ${theme.colors.text.muted};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 200px;
`;

const EmptyIcon = styled.div`
    font-size: 56px;
    margin-bottom: ${theme.spacing.md};
    opacity: 0.4;
`;

const EmptyText = styled.p`
    font-size: ${theme.typography.fontSize.base};
    margin: 0;
    color: ${theme.colors.text.secondary};
`;

const RetryButton = styled.button`
    margin-top: ${theme.spacing.md};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    background: ${theme.colors.primary.main};
    color: ${theme.colors.bg.primary};
    border: none;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    &:hover {
        background: ${theme.colors.primary.light};
        transform: translateY(-1px);
    }
`;

const PausedTag = styled.span`
    padding: 2px 6px;
    background: rgba(234, 179, 8, 0.15);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.3);
    border-radius: ${theme.borderRadius.sm};
    font-size: ${theme.typography.fontSize.xs};
    font-weight: 600;
`;

const TaskBadge = styled.span<{ color: string }>`
    padding: 1px 6px;
    background: ${props => props.color}15;
    color: ${props => props.color};
    border: 1px solid ${props => props.color}30;
    border-radius: ${theme.borderRadius.sm};
    font-size: 9px;
    font-weight: 600;
    white-space: nowrap;
`;

// Assignment Approval Section
const AssignmentSection = styled.div`
    margin-bottom: ${theme.spacing.lg};
`;

const AssignmentCard = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing.md} ${theme.spacing.lg};
    background: ${theme.colors.bg.secondary};
    border: 1px solid ${theme.colors.primary.main}30;
    border-radius: ${theme.borderRadius.lg};
    margin-bottom: ${theme.spacing.sm};
    transition: all 0.2s ease;
    &:hover {
        border-color: ${theme.colors.primary.main}60;
        background: ${theme.colors.bg.tertiary};
    }
`;

const AssignmentInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const AssignmentTitle = styled.div`
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
    margin-bottom: 4px;
`;

const AssignmentMeta = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    display: flex;
    gap: ${theme.spacing.md};
    flex-wrap: wrap;
`;

const AssignmentActions = styled.div`
    display: flex;
    gap: ${theme.spacing.sm};
    flex-shrink: 0;
    margin-left: ${theme.spacing.md};
`;

const AcceptBtn = styled.button`
    padding: 6px 16px;
    background: ${theme.colors.status.success};
    color: white;
    border: none;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    &:hover { opacity: 0.9; transform: translateY(-1px); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const RejectBtn = styled.button`
    padding: 6px 16px;
    background: transparent;
    color: ${theme.colors.status.error};
    border: 1px solid ${theme.colors.status.error}60;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    &:hover { background: ${theme.colors.status.error}15; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// Combined Earnings + Duty Compact Block
const CompactOverviewRow = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${theme.spacing.sm};
    margin-bottom: ${theme.spacing.lg};
`;

const CompactPanel = styled.div<{ $variant: 'earnings' | 'duty' }>`
    background: ${({ $variant }) =>
        $variant === 'earnings'
            ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
            : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'};
    border-radius: ${theme.borderRadius.lg};
    padding: ${theme.spacing.md};
    color: white;
    position: relative;
    overflow: hidden;
    min-height: 0;

    &::before {
        content: '';
        position: absolute;
        top: -40%;
        right: -15%;
        width: 120px;
        height: 120px;
        background: rgba(255,255,255,0.08);
        border-radius: 50%;
    }
`;

const CompactPanelLabel = styled.div`
    font-size: 11px;
    opacity: 0.85;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
`;

const CompactPanelValue = styled.div`
    font-size: 22px;
    font-weight: ${theme.typography.fontWeight.bold};
    font-family: 'JetBrains Mono', monospace;
    line-height: 1.2;
    margin-bottom: 4px;
`;

const CompactProgressBarWrapper = styled.div`
    width: 100%;
    height: 8px;
    background: rgba(255,255,255,0.2);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 4px;
`;

const CompactProgressBarFill = styled.div<{ $percent: number; $color: string }>`
    height: 100%;
    width: ${({ $percent }) => Math.min(100, $percent)}%;
    background: ${({ $color }) => $color};
    border-radius: 4px;
    transition: width 0.5s ease;
`;

const CompactSubtext = styled.div`
    font-size: 10px;
    opacity: 0.75;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const CompactBadge = styled.span<{ $color: string }>`
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 6px;
    border-radius: ${theme.borderRadius.full};
    font-size: 9px;
    font-weight: 600;
    background: ${({ $color }) => $color}40;
`;

const CompactDebugMsg = styled.div`
    font-size: 10px;
    opacity: 0.8;
    margin-top: 2px;
`;

const LeaveRequestBtn = styled.button`
    padding: 2px 8px;
    background: rgba(255,255,255,0.2);
    color: white;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: ${theme.borderRadius.full};
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    font-family: ${theme.typography.fontFamily};
    transition: all 0.2s;
    -webkit-app-region: no-drag;
    &:hover {
        background: rgba(255,255,255,0.3);
    }
`;

const SectionEmptyMessage = styled.div`
    padding: ${theme.spacing.md};
    text-align: center;
    color: ${theme.colors.text.muted};
    font-size: ${theme.typography.fontSize.sm};
`;

// ============================================================
// Component
// ============================================================
const DAY_NAMES_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

// Helper: deadline proximity
function getDeadlineInfo(deadline?: string): { text: string; hoursLeft: number } | null {
    if (!deadline) return null;
    const now = new Date();
    const dl = new Date(deadline);
    const diffMs = dl.getTime() - now.getTime();
    const hoursLeft = diffMs / (1000 * 60 * 60);
    const daysLeft = Math.floor(hoursLeft / 24);

    if (hoursLeft < 0) return { text: 'মেয়াদ শেষ!', hoursLeft };
    if (hoursLeft < 24) return { text: `${Math.ceil(hoursLeft)} ঘন্টা বাকি`, hoursLeft };
    if (daysLeft === 1) return { text: 'আগামীকাল', hoursLeft };
    return { text: `${daysLeft} দিন বাকি`, hoursLeft };
}

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { tasks, activeTimers, taskTrackers, isLoading, setSelectedTask, setCurrentView, fetchTasks } = useAppStore();
    const tickCounter = useAppStore((s) => s.tickCounter);
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingAssignments, setPendingAssignments] = useState<TaskAssignment[]>([]);
    const [assignmentLoading, setAssignmentLoading] = useState<string | null>(null);
    const [currentEarnings, setCurrentEarnings] = useState<EarningsBreakdown | null>(null);
    const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
    const [dutyProgress, setDutyProgress] = useState<DutyProgress | null>(null);
    const addToast = useAppStore((s) => s.addToast);
    const currentTime = useMemo(() => new Date(), [tickCounter]);

    // Fetch current earnings
    const fetchCurrentEarnings = async () => {
        try {
            console.log('[earningsApi] Fetching current earnings...');
            const earnings = await earningsApi.getCurrentEarnings();
            console.log('[earningsApi] Response:', earnings);
            setCurrentEarnings(earnings);
        } catch (err: any) {
            console.error('Failed to fetch current earnings:', err);
            // Set fallback so UI doesn't stay on "loading" forever
            setCurrentEarnings({
                periodStart: new Date().toISOString(),
                periodEnd: new Date().toISOString(),
                workedHours: 0,
                workedAmount: 0,
                paidLeaveDays: 0,
                leaveHours: 0,
                leavePay: 0,
                overtimeHours: 0,
                overtimePay: 0,
                overtimeRate: 1.5,
                penaltyHours: 0,
                penaltyAmount: 0,
                salaryType: 'HOURLY',
                monthlySalary: 0,
                workedDays: 0,
                totalWorkingDays: 0,
                grossAmount: 0,
                netAmount: 0,
                currency: 'BDT',
                _debug: { reason: 'FETCH_ERROR', hourlyRate: 0, monthlySalary: 0, salaryType: 'HOURLY', completedTimeLogCount: 0, activeTimeLogCount: 0 },
            } as any);
        }
    };

    // Fetch leave balance
    const fetchLeaveBalance = async () => {
        try {
            const balance = await leaveApi.getMyBalance();
            setLeaveBalance(balance);
        } catch (err) {
            console.error('Failed to fetch leave balance:', err);
        }
    };

    // Fetch duty progress (for MONTHLY salary users)
    const fetchDutyProgress = async () => {
        try {
            const progress = await dutyApi.getDutyProgress();
            setDutyProgress(progress);
        } catch (err) {
            console.error('Failed to fetch duty progress:', err);
        }
    };

    // Fetch pending assignments
    const fetchPendingAssignments = async () => {
        try {
            const assignments = await assignmentApi.getPending();
            setPendingAssignments(assignments);
        } catch (err) {
            console.error('Failed to fetch pending assignments:', err);
        }
    };

    // Handle accept assignment
    const handleAcceptAssignment = async (assignmentId: string) => {
        setAssignmentLoading(assignmentId);
        try {
            await assignmentApi.accept(assignmentId);
            setPendingAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
            addToast('success', 'টাস্ক সফলভাবে গৃহীত হয়েছে!');
            fetchTasks();
        } catch (err: any) {
            addToast('error', err.message || 'টাস্ক গ্রহণ ব্যর্থ হয়েছে');
        } finally {
            setAssignmentLoading(null);
        }
    };

    // Handle reject assignment
    const handleRejectAssignment = async (assignmentId: string) => {
        setAssignmentLoading(assignmentId);
        try {
            await assignmentApi.reject(assignmentId);
            setPendingAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
            addToast('info', 'টাস্ক প্রত্যাখ্যান করা হয়েছে');
        } catch (err: any) {
            addToast('error', err.message || 'টাস্ক প্রত্যাখ্যান ব্যর্থ হয়েছে');
        } finally {
            setAssignmentLoading(null);
        }
    };

    // Fetch tasks and dashboard data on mount — auth is handled by App.tsx (single source of truth)
    useEffect(() => {
        // Always fetch tasks first (cache-first, works offline)
        fetchTasks();

        // Parallel API calls — each independent, wrapped in try/catch
        // Auth sync first (critical), then all dashboard data in parallel
        if (navigator.onLine) {
            (async () => {
                try {
                    const { authApi } = await import('../services/api');
                    await authApi.syncUser();
                    await authApi.getMe();
                } catch (err) {
                    console.warn('User sync failed, continuing with cached data:', err);
                }
                // Fire all dashboard data fetches in parallel — no need to wait sequentially
                await Promise.allSettled([
                    fetchPendingAssignments(),
                    fetchCurrentEarnings(),
                    fetchLeaveBalance(),
                    fetchDutyProgress(),
                ]);
            })();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount — auth state managed by App.tsx

    // Auto-refresh duty progress every 5 minutes (for all salary types)
    useEffect(() => {
        if (!dutyProgress) return;
        const interval = setInterval(() => {
            if (navigator.onLine) fetchDutyProgress();
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [dutyProgress]);

    // Midnight auto-reset: refresh duty progress at midnight
    useEffect(() => {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const msUntilMidnight = midnight.getTime() - now.getTime();

        const timer = setTimeout(() => {
            if (navigator.onLine) fetchDutyProgress();
        }, msUntilMidnight);

        return () => clearTimeout(timer);
    }, []);

    // Listen for earnings-update events (dispatched after each screenshot upload)
    useEffect(() => {
        const handler = () => {
            // Quick refetch — cache already invalidated server-side after screenshot upload
            setTimeout(() => {
                if (navigator.onLine) fetchCurrentEarnings().catch(() => {});
            }, 500);
        };
        window.addEventListener('earnings-update', handler);
        return () => window.removeEventListener('earnings-update', handler);
    }, []);

    // Fallback poll: refresh earnings every 5 minutes (primary trigger is screenshot events above)
    useEffect(() => {
        const interval = setInterval(() => {
            if (navigator.onLine && document.visibilityState === 'visible') {
                fetchCurrentEarnings().catch(() => {});
            }
        }, 300000); // 5 min fallback
        return () => clearInterval(interval);
    }, []);

    // Safety timeout: if earnings still null after 15 seconds, set fallback
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!currentEarnings) {
                console.warn('[earningsApi] Safety timeout — earnings still null after 15s, setting fallback');
                setCurrentEarnings({
                    periodStart: new Date().toISOString(),
                    periodEnd: new Date().toISOString(),
                    workedHours: 0, workedAmount: 0,
                    paidLeaveDays: 0, leaveHours: 0, leavePay: 0,
                    overtimeHours: 0, overtimePay: 0, overtimeRate: 1.5,
                    penaltyHours: 0, penaltyAmount: 0,
                    salaryType: 'HOURLY', monthlySalary: 0,
                    workedDays: 0, totalWorkingDays: 0,
                    grossAmount: 0, netAmount: 0, currency: 'BDT',
                    _debug: { reason: 'TIMEOUT', hourlyRate: 0, monthlySalary: 0, salaryType: 'HOURLY', completedTimeLogCount: 0, activeTimeLogCount: 0 },
                } as any);
            }
        }, 15000);
        return () => clearTimeout(timeout);
    }, [currentEarnings]);

    // Calculate global stats — uses taskTrackers wall-clock to avoid double-counting concurrent subtasks
    const stats = useMemo(() => {
        const totalTrackedToday = Object.values(taskTrackers).reduce((acc, tracker) => {
            if (tracker.isPaused) return acc + tracker.wallClockAccumulated;
            return acc + tracker.wallClockAccumulated + Math.floor((Date.now() - tracker.wallClockStartedAt) / 1000);
        }, 0);
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(
            (t) => t.status === 'DONE' || t.subTasks?.every((st) => st.status === 'COMPLETED')
        ).length;
        const totalEarnings = (() => {
            // Local calculation from live timers
            const localCalc = tasks.reduce((acc, task) => {
                if (!task.hourlyRate) return acc;
                const trackedSeconds = task.subTasks?.reduce((a, st) => {
                    const timer = activeTimers[st.id];
                    if (timer && !timer.isPaused) {
                        return a + (timer.elapsedSeconds || 0);
                    }
                    return a + (st.totalSeconds || st.trackedTime || 0);
                }, 0) || 0;
                return acc + (trackedSeconds / 3600) * task.hourlyRate;
            }, 0);
            // Use the higher of local calculation or API-fetched netAmount
            // API includes leave pay, overtime, penalty adjustments that local doesn't
            const apiAmount = currentEarnings?.netAmount || 0;
            return Math.max(localCalc, apiAmount);
        })();
        // Count active items: subtask timers OR task trackers (whichever is higher)
        const activeSubtasks = Object.values(activeTimers).filter(t => !t.isPaused).length;
        const activeTrackers = Object.values(taskTrackers).filter(t => !t.isPaused).length;
        const activeNow = Math.max(activeSubtasks, activeTrackers);
        return { totalTrackedToday, totalTasks, completedTasks, totalEarnings, activeNow };
    }, [tasks, activeTimers, taskTrackers, tickCounter, currentEarnings]);

    // Effective duty progress — show for ALL users (fallback 8h default if API returns nothing)
    const effectiveDutyProgress = useMemo(() => {
        if (dutyProgress && dutyProgress.expectedDailySeconds > 0) return dutyProgress;
        return {
            todayWorkedSeconds: 0,
            minDailySeconds: 8 * 3600,
            expectedDailySeconds: 8 * 3600,
            progressPercent: 0,
            attendanceAchieved: false,
            salaryType: 'HOURLY',
            currency: 'BDT',
        } as DutyProgress;
    }, [dutyProgress]);

    // Live-ticking worked seconds: API base + currently-running tracker elapsed only
    // Note: paused trackers' wallClockAccumulated is already included in API's todayWorkedSeconds
    // Adding them again would double-count. Only add LIVE elapsed from running trackers.
    const liveWorkedSeconds = useMemo(() => {
        const base = effectiveDutyProgress.todayWorkedSeconds || 0;
        let liveExtra = 0;
        Object.values(taskTrackers).forEach(tracker => {
            if (!tracker.isPaused) {
                // Only running trackers: live elapsed since last resume
                liveExtra += Math.floor((Date.now() - tracker.wallClockStartedAt) / 1000);
            }
            // Paused trackers: already counted in API base — don't add again
        });
        return base + liveExtra;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveDutyProgress.todayWorkedSeconds, taskTrackers, tickCounter]);

    const liveProgressPercent = effectiveDutyProgress.expectedDailySeconds > 0
        ? Math.min(100, Math.round((liveWorkedSeconds / effectiveDutyProgress.expectedDailySeconds) * 100))
        : 0;
    const liveAttendanceAchieved = liveWorkedSeconds >= effectiveDutyProgress.minDailySeconds;

    // Search filter
    const searchedTasks = useMemo(() => {
        if (!searchQuery) return tasks;
        const query = searchQuery.toLowerCase();
        return tasks.filter(
            (t) =>
                t.title.toLowerCase().includes(query) ||
                t.client?.name?.toLowerCase().includes(query)
        );
    }, [tasks, searchQuery]);

    // Split tasks into 3 sections
    const { activeTasks, upcomingTasks, completedTasks } = useMemo(() => {
        const activeTimerTaskIds = new Set(Object.values(activeTimers).map(t => t.taskId));
        // Also include tasks with running TaskTrackers (wall-clock timer)
        const activeTrackerTaskIds = new Set(Object.keys(taskTrackers).filter(id => !taskTrackers[id].isPaused));

        // Active: has running timers OR status is IN_PROGRESS
        const active: Task[] = [];
        // Upcoming: TODO / not started
        const upcoming: Task[] = [];
        // Completed: DONE status (this month)
        const completed: Task[] = [];

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        for (const task of searchedTasks) {
            const isDone = task.status === 'DONE' || task.subTasks?.every((st) => st.status === 'COMPLETED');
            const isActiveTimer = activeTimerTaskIds.has(task.id) || activeTrackerTaskIds.has(task.id);
            const isInProgress = task.status === 'IN_PROGRESS' || task.subTasks?.some((st) => st.status === 'IN_PROGRESS');

            // Active timer ALWAYS takes priority — even if task is marked DONE
            if (isActiveTimer) {
                active.push(task);
            } else if (isDone) {
                completed.push(task);
            } else if (isInProgress) {
                active.push(task);
            } else {
                upcoming.push(task);
            }
        }

        // Sort upcoming by deadline (nearest first)
        upcoming.sort((a, b) => {
            if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            if (a.deadline) return -1;
            if (b.deadline) return 1;
            return 0;
        });

        return { activeTasks: active, upcomingTasks: upcoming, completedTasks: completed };
    }, [searchedTasks, activeTimers, taskTrackers]);

    // Total running time
    const totalRunningTime = useMemo(() => {
        return Object.values(activeTimers)
            .filter((t) => !t.isPaused)
            .reduce((acc, t) => acc + t.elapsedSeconds, 0);
    }, [activeTimers]);

    const handleTaskClick = (task: Task) => {
        setSelectedTask(task);
        setCurrentView('playlist');
        navigate('/playlist');
    };

    // Format current time
    const formattedTime = currentTime.toLocaleTimeString('bn-BD', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const formattedDate = `${DAY_NAMES_BN[currentTime.getDay()]}, ${currentTime.toLocaleDateString('bn-BD')}`;

    // Helper: render a task row
    const renderTaskRow = (task: Task, sectionType: 'active' | 'upcoming' | 'completed') => {
        const timerForTask = Object.values(activeTimers).filter(t => t.taskId === task.id);
        const tracker = taskTrackers[task.id];
        const isRunning = timerForTask.some(t => !t.isPaused) || (tracker && !tracker.isPaused);
        const isPaused = (timerForTask.some(t => t.isPaused) || (tracker?.isPaused)) && !isRunning;
        const totalTracked = task.subTasks?.reduce((acc, st) => acc + (st.trackedTime || st.totalSeconds || 0), 0) || 0;
        const deadlineInfo = getDeadlineInfo(task.deadline);
        const completedSubs = task.subTasks?.filter(st => st.status === 'COMPLETED').length || 0;
        const totalSubs = task.subTasks?.length || 0;
        const progress = totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0;
        const earnings = task.hourlyRate ? (totalTracked / 3600) * task.hourlyRate : null;
        // Use subtask timer time, or fall back to task tracker wall-clock
        const subtaskRunningTime = timerForTask.reduce((acc, t) => acc + t.elapsedSeconds, 0);
        const trackerRunningTime = tracker ? (tracker.isPaused ? tracker.wallClockAccumulated : tracker.wallClockAccumulated + Math.floor((Date.now() - tracker.wallClockStartedAt) / 1000)) : 0;
        const runningTime = Math.max(subtaskRunningTime, trackerRunningTime);

        return (
            <TaskListRow
                key={task.id}
                $isActive={isRunning}
                $isDone={sectionType === 'completed'}
                $isPaused={isPaused}
                onClick={() => handleTaskClick(task)}
            >
                <TaskStatusDot $status={
                    isRunning ? 'active' :
                    isPaused ? 'paused' :
                    sectionType === 'completed' ? 'done' : 'todo'
                } />

                <TaskRowIcon>{task.icon || '📋'}</TaskRowIcon>

                <TaskRowInfo>
                    <TaskRowTitle>{task.title}</TaskRowTitle>
                    <TaskRowMeta>
                        {task.client?.name && <span>{task.client.name}</span>}
                        {task.client?.name && totalSubs > 0 && <span>•</span>}
                        {totalSubs > 0 && <span>{completedSubs}/{totalSubs} সাবটাস্ক</span>}
                        {task.isActive === false && <PausedTag>⏸ বন্ধ</PausedTag>}
                    </TaskRowMeta>
                </TaskRowInfo>

                <TaskRowBadges>
                    {task.isRecurring && (
                        <TaskBadge color="#6366f1">🔄 {task.recurringType === 'DAILY' ? 'দৈনিক' : task.recurringType === 'WEEKLY' ? 'সাপ্তাহিক' : 'মাসিক'}</TaskBadge>
                    )}
                    {task.status === 'REVIEW' && (
                        <TaskBadge color="#ea580c">🔍 রিভিউ</TaskBadge>
                    )}
                    {task.allowOvertime && (
                        <TaskBadge color="#d97706">⏰ OT</TaskBadge>
                    )}
                </TaskRowBadges>

                {/* Deadline Badge */}
                {deadlineInfo && sectionType !== 'completed' && (
                    <DeadlineBadge
                        $urgent={deadlineInfo.hoursLeft < 24 && deadlineInfo.hoursLeft >= 0}
                        $warning={deadlineInfo.hoursLeft >= 24 && deadlineInfo.hoursLeft < 48}
                    >
                        {deadlineInfo.hoursLeft < 0 ? '⚠️' : deadlineInfo.hoursLeft < 24 ? '🔴' : deadlineInfo.hoursLeft < 48 ? '🟡' : '📅'} {deadlineInfo.text}
                    </DeadlineBadge>
                )}

                {/* Progress mini bar */}
                {totalSubs > 0 && (
                    <MiniProgressBar>
                        <ProgressBar
                            value={progress}
                            variant={progress === 100 ? 'success' : 'primary'}
                            size="sm"
                        />
                    </MiniProgressBar>
                )}

                <TaskRowStats>
                    {/* Show running timer for active tasks */}
                    {isRunning && (
                        <TaskRowStat>
                            <TaskRowStatLabel>চলমান</TaskRowStatLabel>
                            <Timer seconds={runningTime} size="sm" isActive={true} />
                        </TaskRowStat>
                    )}

                    <TaskRowStat>
                        <TaskRowStatLabel>সময়</TaskRowStatLabel>
                        <TaskRowStatValue>{formatDuration(totalTracked)}</TaskRowStatValue>
                    </TaskRowStat>

                    {earnings !== null && (
                        <TaskRowStat>
                            <TaskRowStatLabel>আয়</TaskRowStatLabel>
                            <TaskRowStatValue $color={theme.colors.status.success}>
                                {formatMoney(earnings, task.currency || 'BDT')}
                            </TaskRowStatValue>
                        </TaskRowStat>
                    )}
                </TaskRowStats>
            </TaskListRow>
        );
    };

    return (
        <PageWrapper>
            <Header>
                <HeaderLeft>
                    <Logo>
                        <LogoIcon>⚡</LogoIcon>
                        <LogoText>
                            <LogoTitle>KormoSync</LogoTitle>
                            <LogoSubtitle>টাইম ট্র্যাকার</LogoSubtitle>
                        </LogoText>
                    </Logo>
                </HeaderLeft>
                <HeaderRight>
                    <WebButton onClick={() => window.electron?.openExternal?.('https://appkormosync.ejobsit.com/dashboard')}>
                        🌐 ওয়েবে দেখুন
                    </WebButton>
                    <SearchInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="টাস্ক অনুসন্ধান..."
                        style={{ width: '180px', minWidth: '120px', flexShrink: 1 }}
                    />
                    <CurrentTime>
                        <TimeDisplay>{formattedTime}</TimeDisplay>
                        <DateDisplay>{formattedDate}</DateDisplay>
                    </CurrentTime>
                    {totalRunningTime > 0 && (
                        <GlobalTimer>
                            <GlobalTimerLabel>চলমান সময়</GlobalTimerLabel>
                            <Timer seconds={totalRunningTime} size="md" isActive={true} showIcon />
                        </GlobalTimer>
                    )}
                </HeaderRight>
            </Header>

            <Content>
                {/* Combined Earnings + Duty Progress Compact Block */}
                <CompactOverviewRow>
                    {/* Left: Earnings Panel */}
                    <CompactPanel $variant="earnings">
                        <CompactPanelLabel>💰 শেষ বেতনের পর</CompactPanelLabel>
                        {!currentEarnings ? (
                            <CompactPanelValue style={{ opacity: 0.5 }}>৳ ...</CompactPanelValue>
                        ) : (
                            <>
                                <CompactPanelValue>
                                    ৳{currentEarnings.netAmount?.toLocaleString('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
                                </CompactPanelValue>
                                {(currentEarnings as any)?._debug?.reason === 'NO_PAY_RATE' && (
                                    <CompactDebugMsg style={{ color: '#fbbf24' }}>⚠️ বেতনের হার সেট নেই</CompactDebugMsg>
                                )}
                                {(currentEarnings as any)?._debug?.reason === 'NO_TIME_LOGS' && (
                                    <CompactDebugMsg style={{ color: '#94a3b8' }}>কোনো কাজ রেকর্ড হয়নি</CompactDebugMsg>
                                )}
                                {((currentEarnings as any)?._debug?.reason === 'FETCH_ERROR' || (currentEarnings as any)?._debug?.reason === 'TIMEOUT') && (
                                    <CompactDebugMsg style={{ color: '#fca5a5' }}>
                                        ⚠️ লোড ব্যর্থ{' '}
                                        <span
                                            onClick={() => { setCurrentEarnings(null); fetchCurrentEarnings(); }}
                                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                        >🔄 আবার</span>
                                    </CompactDebugMsg>
                                )}
                                {!(currentEarnings as any)?._debug && (
                                    <CompactSubtext>
                                        <span>{(currentEarnings.workedHours || 0).toFixed(1)}h কাজ</span>
                                        {currentEarnings.overtimeHours > 0 && <span>+{currentEarnings.overtimeHours.toFixed(1)}h OT</span>}
                                    </CompactSubtext>
                                )}
                                {leaveBalance && (
                                    <CompactSubtext style={{ marginTop: '4px' }}>
                                        <span>ছুটি: {(leaveBalance.paidRemaining ?? (leaveBalance.paidLeave - leaveBalance.paidUsed))}দিন</span>
                                        <LeaveRequestBtn onClick={() => navigate('/leave')}>🏖️ আবেদন</LeaveRequestBtn>
                                    </CompactSubtext>
                                )}
                            </>
                        )}
                    </CompactPanel>

                    {/* Right: Duty Progress Panel */}
                    <CompactPanel $variant="duty">
                        <CompactPanelLabel>📊 আজ</CompactPanelLabel>
                        <CompactPanelValue>
                            {formatDuration(liveWorkedSeconds)}
                        </CompactPanelValue>
                        <CompactProgressBarWrapper>
                            <CompactProgressBarFill
                                $percent={liveProgressPercent}
                                $color={liveAttendanceAchieved ? '#34d399' : '#fbbf24'}
                            />
                        </CompactProgressBarWrapper>
                        <CompactSubtext>
                            <span>{formatDuration(effectiveDutyProgress.expectedDailySeconds)} এর মধ্যে {liveProgressPercent}%</span>
                            <CompactBadge $color={liveAttendanceAchieved ? '#34d399' : '#fbbf24'}>
                                {liveAttendanceAchieved
                                    ? '✅ সম্পন্ন'
                                    : `⏳ ${formatDuration(Math.max(0, effectiveDutyProgress.minDailySeconds - liveWorkedSeconds))} বাকি`
                                }
                            </CompactBadge>
                        </CompactSubtext>
                        {effectiveDutyProgress.virtualHourlyRate && (
                            <CompactSubtext style={{ marginTop: '2px' }}>
                                <span>৳{effectiveDutyProgress.virtualHourlyRate.toFixed(0)}/hr</span>
                            </CompactSubtext>
                        )}
                    </CompactPanel>
                </CompactOverviewRow>

                {/* Stats */}
                <StatsGrid>
                    <StatCard variant="default" padding="md">
                        <StatIcon $color={theme.colors.primary.main}>⏱️</StatIcon>
                        <StatInfo>
                            <StatValue>{formatDuration(stats.totalTrackedToday)}</StatValue>
                            <StatLabel>আজকের ট্র্যাক</StatLabel>
                        </StatInfo>
                    </StatCard>
                    <StatCard variant="default" padding="md">
                        <StatIcon $color={theme.colors.status.success}>💰</StatIcon>
                        <StatInfo>
                            <StatValue>{formatMoney(stats.totalEarnings, 'BDT')}</StatValue>
                            <StatLabel>মোট আয়</StatLabel>
                        </StatInfo>
                    </StatCard>
                    <StatCard variant="default" padding="md">
                        <StatIcon $color={theme.colors.status.info}>📋</StatIcon>
                        <StatInfo>
                            <StatValue>{stats.completedTasks}/{stats.totalTasks}</StatValue>
                            <StatLabel>সম্পন্ন টাস্ক</StatLabel>
                        </StatInfo>
                    </StatCard>
                    <StatCard variant="default" padding="md">
                        <StatIcon $color={theme.colors.status.warning}>🎯</StatIcon>
                        <StatInfo>
                            <StatValue>{stats.activeNow}</StatValue>
                            <StatLabel>চলমান এখন</StatLabel>
                        </StatInfo>
                    </StatCard>
                </StatsGrid>

                {/* Pending Assignments */}
                {pendingAssignments.length > 0 && (
                    <AssignmentSection>
                        <SectionHeader>
                            <SectionTitle>
                                📋 অনুমোদনের অপেক্ষায়
                                <Badge variant="warning" size="sm">{pendingAssignments.length}</Badge>
                            </SectionTitle>
                        </SectionHeader>
                        {pendingAssignments.map((assignment) => (
                            <AssignmentCard key={assignment.id}>
                                <AssignmentInfo>
                                    <AssignmentTitle>{assignment.task.title}</AssignmentTitle>
                                    <AssignmentMeta>
                                        {assignment.task.creator?.name && <span>👤 {assignment.task.creator.name}</span>}
                                        {assignment.task.priority && (
                                            <span>
                                                {assignment.task.priority === 'HIGH' ? '🔴' : assignment.task.priority === 'MEDIUM' ? '🟡' : '🟢'} {assignment.task.priority}
                                            </span>
                                        )}
                                        {assignment.task.deadline && (
                                            <span>📅 {new Date(assignment.task.deadline).toLocaleDateString('bn-BD')}</span>
                                        )}
                                        {assignment.task.billingType === 'HOURLY' && assignment.task.hourlyRate && (
                                            <span>💰 ৳{assignment.task.hourlyRate}/ঘন্টা</span>
                                        )}
                                    </AssignmentMeta>
                                </AssignmentInfo>
                                <AssignmentActions>
                                    <AcceptBtn
                                        onClick={() => handleAcceptAssignment(assignment.id)}
                                        disabled={assignmentLoading === assignment.id}
                                    >
                                        {assignmentLoading === assignment.id ? '...' : '✅ গ্রহণ করুন'}
                                    </AcceptBtn>
                                    <RejectBtn
                                        onClick={() => handleRejectAssignment(assignment.id)}
                                        disabled={assignmentLoading === assignment.id}
                                    >
                                        ❌ প্রত্যাখ্যান
                                    </RejectBtn>
                                </AssignmentActions>
                            </AssignmentCard>
                        ))}
                    </AssignmentSection>
                )}

                {isLoading ? (
                    <SkeletonList count={4} />
                ) : tasks.length === 0 ? (
                    <EmptyState>
                        <EmptyIcon>📭</EmptyIcon>
                        <EmptyText>কোনো টাস্ক পাওয়া যায়নি</EmptyText>
                        <RetryButton onClick={() => fetchTasks()}>
                            🔄 আবার চেষ্টা করুন
                        </RetryButton>
                    </EmptyState>
                ) : (
                    <>
                        {/* Section 1: Active/Running Tasks */}
                        {activeTasks.length > 0 && (
                            <Section $variant="active">
                                <SectionHeader>
                                    <SectionTitle $color={theme.colors.status.success}>
                                        🟢 চলমান কাজ
                                        <SectionCount>({activeTasks.length})</SectionCount>
                                    </SectionTitle>
                                    {totalRunningTime > 0 && (
                                        <Timer seconds={totalRunningTime} size="sm" isActive={true} />
                                    )}
                                </SectionHeader>
                                <TasksList>
                                    {activeTasks.map((task) => renderTaskRow(task, 'active'))}
                                </TasksList>
                            </Section>
                        )}

                        {/* Section 2: Upcoming Tasks */}
                        {upcomingTasks.length > 0 && (
                            <Section $variant="upcoming">
                                <SectionHeader>
                                    <SectionTitle>
                                        ⏰ আপকামিং কাজ
                                        <SectionCount>({upcomingTasks.length})</SectionCount>
                                    </SectionTitle>
                                </SectionHeader>
                                <TasksList>
                                    {upcomingTasks.map((task) => renderTaskRow(task, 'upcoming'))}
                                </TasksList>
                            </Section>
                        )}

                        {/* Section 3: Completed Tasks */}
                        {completedTasks.length > 0 && (
                            <Section $variant="completed">
                                <SectionHeader>
                                    <SectionTitle $color={theme.colors.status.error}>
                                        ✅ সম্পন্ন কাজ
                                        <SectionCount>({completedTasks.length})</SectionCount>
                                    </SectionTitle>
                                </SectionHeader>
                                <TasksList>
                                    {completedTasks.map((task) => renderTaskRow(task, 'completed'))}
                                </TasksList>
                            </Section>
                        )}

                        {/* If all sections empty (search filter cleared everything) */}
                        {activeTasks.length === 0 && upcomingTasks.length === 0 && completedTasks.length === 0 && (
                            <SectionEmptyMessage>
                                কোনো টাস্ক পাওয়া যায়নি
                            </SectionEmptyMessage>
                        )}
                    </>
                )}
            </Content>
        </PageWrapper>
    );
};

export default Dashboard;
