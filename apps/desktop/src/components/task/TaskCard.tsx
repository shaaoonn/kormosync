// ============================================================
// KormoSync Desktop App - Task Card Component
// Schedule-aware task card for Dashboard
// ============================================================

import React, { useMemo } from 'react';
import styled, { css } from 'styled-components';
import { theme } from '../../styles/theme';
import { Card, Badge, ScheduleBadge, Timer, ProgressBar, Avatar } from '../ui';
import { getScheduleInfo, formatMoney, formatDuration } from '../../utils/formatters';
import type { Task, ScheduleStatus } from '../../types';
import { useAppStore } from '../../store/useAppStore';

// ============================================================
// Types
// ============================================================
interface TaskCardProps {
    task: Task;
    onClick?: () => void;
    showProgress?: boolean;
}

// ============================================================
// Styled Components
// ============================================================
const StyledCard = styled(Card)<{ $scheduleStatus: ScheduleStatus }>`
    position: relative;
    overflow: hidden;

    ${({ $scheduleStatus }) => $scheduleStatus === 'locked' && css`
        opacity: 0.6;

        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                ${theme.colors.bg.tertiary}20 10px,
                ${theme.colors.bg.tertiary}20 20px
            );
            pointer-events: none;
        }
    `}

    ${({ $scheduleStatus }) => $scheduleStatus === 'active' && css`
        border-color: ${theme.colors.status.success}60;
    `}
`;

const CardInner = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.md};
`;

const TaskHeader = styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${theme.spacing.md};
`;

const TaskIcon = styled.div<{ $color?: string }>`
    width: 48px;
    height: 48px;
    border-radius: ${theme.borderRadius.lg};
    background: ${({ $color }) => $color || theme.colors.primary.main}20;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
`;

const TaskInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const TaskTitle = styled.h3`
    margin: 0;
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const TaskMeta = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    margin-top: 4px;
    flex-wrap: wrap;
`;

const TaskClient = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
`;

const Dot = styled.span`
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: ${theme.colors.text.muted};
`;

const TaskStats = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.lg};
    padding-top: ${theme.spacing.sm};
    border-top: 1px solid ${theme.colors.border.primary};
`;

const StatItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const StatLabel = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const StatValue = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.primary};
`;

const ProgressSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const ProgressHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const ProgressLabel = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.secondary};
`;

const SubTaskCount = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};

    strong {
        color: ${theme.colors.primary.main};
    }
`;

const ScheduleInfo = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const ActiveTimerBadge = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: ${theme.colors.status.success}20;
    border-radius: ${theme.borderRadius.full};
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.status.success};
`;

const PulseDot = styled.span`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${theme.colors.status.success};
    animation: pulse 2s ease-in-out infinite;

    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.8); }
    }
`;

const PausedBadge = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    background: rgba(234, 179, 8, 0.15);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.3);
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.xs};
    font-weight: 600;
    margin-bottom: ${theme.spacing.sm};
`;

const ExternalLinkButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.secondary};
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;

    &:hover {
        background: ${theme.colors.bg.hover};
        color: ${theme.colors.primary.main};
        border-color: ${theme.colors.primary.main}50;
    }
`;

// ============================================================
// Component
// ============================================================
export const TaskCard: React.FC<TaskCardProps> = ({
    task,
    onClick,
    showProgress = true,
}) => {
    const activeTimers = useAppStore((state) => state.activeTimers);

    // Check if any subtask of this task is running
    const runningSubTasks = useMemo(() => {
        return Object.values(activeTimers).filter(
            (timer) => timer.taskId === task.id && !timer.isPaused
        );
    }, [activeTimers, task.id]);

    const isRunning = runningSubTasks.length > 0;

    // Calculate schedule status
    const scheduleInfo = useMemo(() => {
        return getScheduleInfo(task, new Date());
    }, [task]);

    // Calculate progress
    const progress = useMemo(() => {
        if (!task.subTasks || task.subTasks.length === 0) return 0;
        const completed = task.subTasks.filter((st) => st.status === 'completed').length;
        return (completed / task.subTasks.length) * 100;
    }, [task.subTasks]);

    // Total time tracked
    const totalTrackedTime = useMemo(() => {
        return task.subTasks?.reduce((acc, st) => acc + (st.trackedTime || 0), 0) || 0;
    }, [task.subTasks]);

    // Calculate earnings
    const earnings = useMemo(() => {
        if (!task.hourlyRate) return null;
        const hours = totalTrackedTime / 3600;
        return hours * task.hourlyRate;
    }, [totalTrackedTime, task.hourlyRate]);

    return (
        <StyledCard
            $scheduleStatus={scheduleInfo.status}
            variant="default"
            padding="md"
            clickable
            active={isRunning}
            onClick={onClick}
        >
            <CardInner>
                {task.isActive === false && (
                    <PausedBadge>⏸ বন্ধ আছে</PausedBadge>
                )}
                <TaskHeader>
                    <TaskIcon $color={task.color}>
                        {task.icon || '📋'}
                    </TaskIcon>
                    <TaskInfo>
                        <TaskTitle>{task.title}</TaskTitle>
                        <TaskMeta>
                            {task.client?.name && (
                                <>
                                    <TaskClient>{task.client.name}</TaskClient>
                                    <Dot />
                                </>
                            )}
                            <ScheduleBadge scheduleStatus={scheduleInfo.status} />
                        </TaskMeta>
                    </TaskInfo>
                    <ExternalLinkButton
                        title="ব্রাউজারে দেখুন"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.electron?.openExternal?.(`https://appkormosync.ejobsit.com/dashboard/tasks/${task.id}`);
                        }}
                    >
                        🔗
                    </ExternalLinkButton>
                    {isRunning && (
                        <ActiveTimerBadge>
                            <PulseDot />
                            {runningSubTasks.length} সক্রিয়
                        </ActiveTimerBadge>
                    )}
                </TaskHeader>

                {showProgress && task.subTasks && task.subTasks.length > 0 && (
                    <ProgressSection>
                        <ProgressHeader>
                            <ProgressLabel>অগ্রগতি</ProgressLabel>
                            <SubTaskCount>
                                <strong>{task.subTasks.filter(st => st.status === 'completed').length}</strong>
                                /{task.subTasks.length} সাবটাস্ক
                            </SubTaskCount>
                        </ProgressHeader>
                        <ProgressBar
                            value={progress}
                            variant={progress === 100 ? 'success' : 'primary'}
                            size="sm"
                        />
                    </ProgressSection>
                )}

                <TaskStats>
                    <StatItem>
                        <StatLabel>ট্র্যাক করা সময়</StatLabel>
                        <StatValue>{formatDuration(totalTrackedTime)}</StatValue>
                    </StatItem>
                    {earnings !== null && (
                        <StatItem>
                            <StatLabel>আয়</StatLabel>
                            <StatValue style={{ color: theme.colors.status.success }}>
                                {formatMoney(earnings, task.currency || 'BDT')}
                            </StatValue>
                        </StatItem>
                    )}
                    {scheduleInfo.status === 'active' && scheduleInfo.timeUntilEnd && (
                        <StatItem>
                            <StatLabel>বাকি সময়</StatLabel>
                            <StatValue>{formatDuration(scheduleInfo.timeUntilEnd)}</StatValue>
                        </StatItem>
                    )}
                    {scheduleInfo.status === 'locked' && scheduleInfo.timeUntilStart && (
                        <StatItem>
                            <StatLabel>শুরু হবে</StatLabel>
                            <StatValue>{formatDuration(scheduleInfo.timeUntilStart)}</StatValue>
                        </StatItem>
                    )}
                </TaskStats>

                {scheduleInfo.scheduleText && (
                    <ScheduleInfo>
                        🗓️ {scheduleInfo.scheduleText}
                    </ScheduleInfo>
                )}
            </CardInner>
        </StyledCard>
    );
};

export default TaskCard;
