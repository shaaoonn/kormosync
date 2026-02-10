// ============================================================
// KormoSync Desktop App - Timer Component
// Beautiful animated timer display
// ============================================================

import React, { useMemo } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { theme } from '../../styles/theme';
import { formatDuration, formatMoney } from '../../utils/formatters';

// ============================================================
// Types
// ============================================================
type TimerSize = 'sm' | 'md' | 'lg' | 'xl';

interface TimerProps {
    seconds: number;
    size?: TimerSize;
    showIcon?: boolean;
    isPaused?: boolean;
    isActive?: boolean;
    hourlyRate?: number;
    currency?: string;
    showEarnings?: boolean;
    className?: string;
}

// ============================================================
// Animations
// ============================================================
const pulse = keyframes`
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
`;

const glow = keyframes`
    0%, 100% {
        box-shadow: 0 0 5px ${theme.colors.primary.main}40;
    }
    50% {
        box-shadow: 0 0 20px ${theme.colors.primary.main}60;
    }
`;

// ============================================================
// Styled Components
// ============================================================
const sizeStyles = {
    sm: css`
        font-size: ${theme.typography.fontSize.md};
        gap: 4px;
    `,
    md: css`
        font-size: ${theme.typography.fontSize.xl};
        gap: 6px;
    `,
    lg: css`
        font-size: ${theme.typography.fontSize['3xl']};
        gap: 8px;
    `,
    xl: css`
        font-size: ${theme.typography.fontSize['4xl']};
        gap: 10px;
    `,
};

const TimerWrapper = styled.div<{
    $size: TimerSize;
    $isActive: boolean;
    $isPaused: boolean;
}>`
    display: flex;
    align-items: center;
    font-family: 'JetBrains Mono', monospace;
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
    letter-spacing: 2px;

    ${({ $size }) => sizeStyles[$size]}

    ${({ $isActive, $isPaused }) => $isActive && !$isPaused && css`
        color: ${theme.colors.primary.main};
    `}

    ${({ $isPaused }) => $isPaused && css`
        animation: ${pulse} 1.5s ease-in-out infinite;
    `}
`;

const TimerIcon = styled.div<{ $isActive: boolean }>`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${({ $isActive }) =>
        $isActive ? theme.colors.status.success : theme.colors.text.muted};
    margin-right: 8px;

    ${({ $isActive }) => $isActive && css`
        animation: ${glow} 2s ease-in-out infinite;
    `}
`;

const TimeSegment = styled.span`
    display: inline-block;
`;

const Colon = styled.span`
    opacity: 0.7;
`;

const EarningsWrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
`;

const Earnings = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.status.success};
    font-family: ${theme.typography.fontFamily};
    letter-spacing: normal;
`;

// ============================================================
// Component
// ============================================================
export const Timer: React.FC<TimerProps> = ({
    seconds,
    size = 'md',
    showIcon = false,
    isPaused = false,
    isActive = false,
    hourlyRate,
    currency = 'BDT',
    showEarnings = false,
    className,
}) => {
    const formattedTime = useMemo(() => formatDuration(seconds), [seconds]);
    const parts = formattedTime.split(':');

    const earnings = useMemo(() => {
        if (!hourlyRate || !showEarnings) return null;
        const hours = seconds / 3600;
        return formatMoney(hours * hourlyRate, currency);
    }, [seconds, hourlyRate, currency, showEarnings]);

    const timerDisplay = (
        <TimerWrapper
            $size={size}
            $isActive={isActive}
            $isPaused={isPaused}
            className={className}
        >
            {showIcon && <TimerIcon $isActive={isActive && !isPaused} />}
            {parts.map((part, index) => (
                <React.Fragment key={index}>
                    <TimeSegment>{part}</TimeSegment>
                    {index < parts.length - 1 && <Colon>:</Colon>}
                </React.Fragment>
            ))}
        </TimerWrapper>
    );

    if (showEarnings && earnings) {
        return (
            <EarningsWrapper>
                {timerDisplay}
                <Earnings>{earnings}</Earnings>
            </EarningsWrapper>
        );
    }

    return timerDisplay;
};

// ============================================================
// Mini Timer (for compact displays)
// ============================================================
interface MiniTimerProps {
    seconds: number;
    isActive?: boolean;
    label?: string;
}

const MiniTimerWrapper = styled.div<{ $isActive: boolean }>`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: ${({ $isActive }) =>
        $isActive ? `${theme.colors.primary.main}20` : theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.full};
    font-size: ${theme.typography.fontSize.xs};
    font-family: 'JetBrains Mono', monospace;
    color: ${({ $isActive }) =>
        $isActive ? theme.colors.primary.main : theme.colors.text.secondary};
`;

const MiniDot = styled.div<{ $isActive: boolean }>`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $isActive }) =>
        $isActive ? theme.colors.status.success : theme.colors.text.muted};
`;

const MiniLabel = styled.span`
    font-family: ${theme.typography.fontFamily};
    margin-left: 4px;
    opacity: 0.7;
`;

export const MiniTimer: React.FC<MiniTimerProps> = ({
    seconds,
    isActive = false,
    label,
}) => {
    const formattedTime = useMemo(() => formatDuration(seconds), [seconds]);

    return (
        <MiniTimerWrapper $isActive={isActive}>
            <MiniDot $isActive={isActive} />
            {formattedTime}
            {label && <MiniLabel>{label}</MiniLabel>}
        </MiniTimerWrapper>
    );
};

export default Timer;
