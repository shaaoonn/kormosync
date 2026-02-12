// ============================================================
// KormoSync Desktop App - SubTask Item Component
// Playlist-style sub-task with individual timer (like Spotify)
// ============================================================

import React, { useMemo, useCallback } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { theme } from '../../styles/theme';
import { Button, Badge, ScheduleBadge, Timer } from '../ui';
import { getScheduleInfo, formatDuration } from '../../utils/formatters';
import type { SubTask, Task, ScheduleStatus } from '../../types';
import { useAppStore } from '../../store/useAppStore';

// ============================================================
// Types
// ============================================================
interface SubTaskItemProps {
    subTask: SubTask;
    task: Task;
    index: number;
    onSelect?: (subTask: SubTask) => void;
}

// ============================================================
// Animations
// ============================================================
const pulse = keyframes`
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
`;

const equalizer = keyframes`
    0%, 100% { height: 4px; }
    50% { height: 16px; }
`;

// ============================================================
// Styled Components
// ============================================================
const ItemWrapper = styled.div<{
    $isActive: boolean;
    $isPaused: boolean;
    $isLocked: boolean;
}>`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.secondary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
    transition: all ${theme.animation.duration.fast} ease;
    cursor: pointer;

    &:hover {
        background: ${theme.colors.bg.hover};
        border-color: ${theme.colors.border.active};
    }

    ${({ $isActive }) => $isActive && css`
        background: ${theme.colors.primary.main}10;
        border-color: ${theme.colors.primary.main}60;
        box-shadow: ${theme.shadows.glow.yellow};
    `}

    ${({ $isPaused }) => $isPaused && css`
        background: ${theme.colors.status.warning}10;
        border-color: ${theme.colors.status.warning}40;
    `}

    ${({ $isLocked }) => $isLocked && css`
        opacity: 0.5;
        cursor: not-allowed;

        &:hover {
            background: ${theme.colors.bg.secondary};
            border-color: ${theme.colors.border.primary};
        }
    `}
`;

const IndexNumber = styled.span<{ $isActive: boolean }>`
    width: 24px;
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${({ $isActive }) =>
        $isActive ? theme.colors.primary.main : theme.colors.text.muted};
    text-align: center;
`;

// Spotify-style Equalizer Animation
const EqualizerWrapper = styled.div`
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 16px;
`;

const EqualizerBar = styled.div<{ $delay: number }>`
    width: 3px;
    background: ${theme.colors.primary.main};
    border-radius: 1px;
    animation: ${equalizer} 0.5s ease-in-out infinite;
    animation-delay: ${({ $delay }) => $delay}ms;
`;

const SubTaskInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const SubTaskTitle = styled.h4<{ $isActive: boolean }>`
    margin: 0;
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${({ $isActive }) =>
        $isActive ? theme.colors.primary.main : theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const SubTaskMeta = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    margin-top: 2px;
`;

const MetaText = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const TimerSection = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
`;

const TrackedTime = styled.div`
    text-align: right;
`;

const TimeLabel = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const TimeValue = styled.div`
    font-size: ${theme.typography.fontSize.sm};
    font-family: 'JetBrains Mono', monospace;
    color: ${theme.colors.text.primary};
`;

const ControlButtons = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.xs};
`;

const PlayButton = styled.button<{ $isPlaying: boolean }>`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: ${({ $isPlaying }) =>
        $isPlaying ? theme.colors.status.warning : theme.colors.primary.main};
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all ${theme.animation.duration.fast};

    &:hover:not(:disabled) {
        transform: scale(1.1);
        box-shadow: ${theme.shadows.md};
    }

    &:disabled {
        background: ${theme.colors.text.muted};
        cursor: not-allowed;
        transform: none;
    }

    svg {
        width: 18px;
        height: 18px;
    }
`;

const StopButton = styled.button`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid ${theme.colors.status.error}60;
    background: transparent;
    color: ${theme.colors.status.error};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all ${theme.animation.duration.fast};

    &:hover {
        background: ${theme.colors.status.error}20;
    }

    svg {
        width: 14px;
        height: 14px;
    }
`;

const LockIcon = styled.div`
    color: ${theme.colors.text.muted};
    display: flex;
    align-items: center;
    justify-content: center;
`;

// ============================================================
// Icons
// ============================================================
const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,3 19,12 5,21" />
    </svg>
);

const PauseIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
    </svg>
);

const StopIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12" />
    </svg>
);

const LockIconSvg = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

// ============================================================
// Component
// ============================================================
export const SubTaskItem: React.FC<SubTaskItemProps> = ({
    subTask,
    task,
    index,
    onSelect,
}) => {
    const activeTimers = useAppStore((state) => state.activeTimers);
    const startTimer = useAppStore((state) => state.startTimer);
    const pauseTimer = useAppStore((state) => state.pauseTimer);
    const resumeTimer = useAppStore((state) => state.resumeTimer);
    const stopTimer = useAppStore((state) => state.stopTimer);

    // Get current timer state for this subtask
    const currentTimer = activeTimers[subTask.id];
    const isActive = !!currentTimer;
    const isPaused = currentTimer?.isPaused || false;
    const isRunning = isActive && !isPaused;

    // Calculate schedule status
    const scheduleInfo = useMemo(() => {
        return getScheduleInfo(subTask, new Date());
    }, [subTask]);

    const isLocked = scheduleInfo.status === 'locked';
    const canStart = scheduleInfo.status === 'active' || scheduleInfo.status === 'no_schedule';

    // Calculate current elapsed time
    const currentElapsed = useMemo(() => {
        if (!currentTimer) return subTask.trackedTime || 0;
        return currentTimer.elapsedSeconds;
    }, [currentTimer, subTask.trackedTime]);

    // Handlers
    const handlePlayPause = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLocked) return;

        if (isRunning) {
            pauseTimer(subTask.id);
        } else if (isPaused) {
            // Resume from paused state (FIX: was calling pauseTimer which is a no-op when paused)
            resumeTimer(subTask.id);
        } else {
            startTimer(subTask, task);
        }
    }, [isLocked, isRunning, isPaused, subTask, task, startTimer, pauseTimer, resumeTimer]);

    const handleStop = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        stopTimer(subTask.id);
    }, [subTask.id, stopTimer]);

    const handleClick = () => {
        if (!isLocked) {
            onSelect?.(subTask);
        }
    };

    return (
        <ItemWrapper
            $isActive={isActive}
            $isPaused={isPaused}
            $isLocked={isLocked}
            onClick={handleClick}
        >
            {/* Index or Equalizer */}
            {isRunning ? (
                <EqualizerWrapper>
                    <EqualizerBar $delay={0} />
                    <EqualizerBar $delay={150} />
                    <EqualizerBar $delay={300} />
                </EqualizerWrapper>
            ) : (
                <IndexNumber $isActive={isActive}>
                    {index + 1}
                </IndexNumber>
            )}

            {/* SubTask Info */}
            <SubTaskInfo>
                <SubTaskTitle $isActive={isActive}>
                    {subTask.title}
                </SubTaskTitle>
                <SubTaskMeta>
                    <ScheduleBadge scheduleStatus={scheduleInfo.status} size="sm" />
                    {subTask.estimatedTime && (
                        <MetaText>
                            আনুমানিক: {formatDuration(subTask.estimatedTime * 60)}
                        </MetaText>
                    )}
                </SubTaskMeta>
            </SubTaskInfo>

            {/* Timer Display */}
            <TimerSection>
                <TrackedTime>
                    <TimeLabel>ট্র্যাক করা</TimeLabel>
                    <Timer
                        seconds={currentElapsed}
                        size="sm"
                        isActive={isRunning}
                        isPaused={isPaused}
                    />
                </TrackedTime>

                {/* Control Buttons */}
                <ControlButtons>
                    {isLocked ? (
                        <LockIcon>
                            <LockIconSvg />
                        </LockIcon>
                    ) : (
                        <>
                            <PlayButton
                                $isPlaying={isRunning}
                                onClick={handlePlayPause}
                                disabled={isLocked}
                                title={isRunning ? 'বিরতি' : isPaused ? 'চালু করুন' : 'শুরু করুন'}
                            >
                                {isRunning ? <PauseIcon /> : <PlayIcon />}
                            </PlayButton>
                            {isActive && (
                                <StopButton
                                    onClick={handleStop}
                                    title="বন্ধ করুন"
                                >
                                    <StopIcon />
                                </StopButton>
                            )}
                        </>
                    )}
                </ControlButtons>
            </TimerSection>
        </ItemWrapper>
    );
};

export default SubTaskItem;
