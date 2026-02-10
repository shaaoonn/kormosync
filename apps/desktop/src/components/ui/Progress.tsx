// ============================================================
// KormoSync Desktop App - Progress Component
// Progress bars and circular progress
// ============================================================

import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { theme } from '../../styles/theme';

// ============================================================
// Types
// ============================================================
type ProgressVariant = 'default' | 'success' | 'warning' | 'error' | 'primary';
type ProgressSize = 'sm' | 'md' | 'lg';

interface ProgressBarProps {
    value: number; // 0-100
    variant?: ProgressVariant;
    size?: ProgressSize;
    showLabel?: boolean;
    animated?: boolean;
    label?: string;
}

// ============================================================
// Animations
// ============================================================
const shimmer = keyframes`
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
`;

// ============================================================
// Styled Components
// ============================================================
const variantColors = {
    default: theme.colors.text.muted,
    success: theme.colors.status.success,
    warning: theme.colors.status.warning,
    error: theme.colors.status.error,
    primary: theme.colors.primary.main,
};

const sizeHeights = {
    sm: '4px',
    md: '8px',
    lg: '12px',
};

const ProgressWrapper = styled.div`
    width: 100%;
`;

const ProgressLabel = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
`;

const ProgressText = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
`;

const ProgressPercentage = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.primary};
`;

const ProgressTrack = styled.div<{ $size: ProgressSize }>`
    width: 100%;
    height: ${({ $size }) => sizeHeights[$size]};
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.full};
    overflow: hidden;
`;

const ProgressFill = styled.div<{
    $value: number;
    $variant: ProgressVariant;
    $animated: boolean;
}>`
    height: 100%;
    width: ${({ $value }) => Math.min(100, Math.max(0, $value))}%;
    background: ${({ $variant }) => variantColors[$variant]};
    border-radius: ${theme.borderRadius.full};
    transition: width ${theme.animation.duration.normal} ease;

    ${({ $animated }) => $animated && css`
        background: linear-gradient(
            90deg,
            currentColor 0%,
            rgba(255, 255, 255, 0.2) 50%,
            currentColor 100%
        );
        background-size: 200% 100%;
        animation: ${shimmer} 1.5s ease-in-out infinite;
    `}
`;

// ============================================================
// Progress Bar Component
// ============================================================
export const ProgressBar: React.FC<ProgressBarProps> = ({
    value,
    variant = 'primary',
    size = 'md',
    showLabel = false,
    animated = false,
    label,
}) => {
    const clampedValue = Math.min(100, Math.max(0, value));

    return (
        <ProgressWrapper>
            {showLabel && (
                <ProgressLabel>
                    <ProgressText>{label || 'অগ্রগতি'}</ProgressText>
                    <ProgressPercentage>{Math.round(clampedValue)}%</ProgressPercentage>
                </ProgressLabel>
            )}
            <ProgressTrack $size={size}>
                <ProgressFill
                    $value={clampedValue}
                    $variant={variant}
                    $animated={animated}
                />
            </ProgressTrack>
        </ProgressWrapper>
    );
};

// ============================================================
// Circular Progress
// ============================================================
interface CircularProgressProps {
    value: number; // 0-100
    size?: number; // px
    strokeWidth?: number;
    variant?: ProgressVariant;
    showLabel?: boolean;
    label?: string;
}

const CircularWrapper = styled.div<{ $size: number }>`
    position: relative;
    width: ${({ $size }) => $size}px;
    height: ${({ $size }) => $size}px;
`;

const CircularSvg = styled.svg`
    transform: rotate(-90deg);
`;

const CircularTrack = styled.circle`
    fill: none;
    stroke: ${theme.colors.bg.tertiary};
`;

const CircularFill = styled.circle<{ $variant: ProgressVariant }>`
    fill: none;
    stroke: ${({ $variant }) => variantColors[$variant]};
    stroke-linecap: round;
    transition: stroke-dashoffset ${theme.animation.duration.normal} ease;
`;

const CircularLabel = styled.div`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`;

const CircularValue = styled.span`
    font-size: ${theme.typography.fontSize.lg};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
`;

const CircularText = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.secondary};
`;

export const CircularProgress: React.FC<CircularProgressProps> = ({
    value,
    size = 80,
    strokeWidth = 6,
    variant = 'primary',
    showLabel = true,
    label,
}) => {
    const clampedValue = Math.min(100, Math.max(0, value));
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (clampedValue / 100) * circumference;

    return (
        <CircularWrapper $size={size}>
            <CircularSvg width={size} height={size}>
                <CircularTrack
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                />
                <CircularFill
                    $variant={variant}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </CircularSvg>
            {showLabel && (
                <CircularLabel>
                    <CircularValue>{Math.round(clampedValue)}%</CircularValue>
                    {label && <CircularText>{label}</CircularText>}
                </CircularLabel>
            )}
        </CircularWrapper>
    );
};

// ============================================================
// Activity Progress (for activity score)
// ============================================================
interface ActivityProgressProps {
    keystrokes: number;
    mouseClicks: number;
    targetKeystrokes?: number;
    targetClicks?: number;
}

const ActivityWrapper = styled.div`
    display: flex;
    gap: ${theme.spacing.lg};
`;

const ActivityItem = styled.div`
    flex: 1;
`;

const ActivityHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
`;

const ActivityIcon = styled.span`
    font-size: ${theme.typography.fontSize.lg};
`;

const ActivityLabel = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.secondary};
`;

const ActivityValue = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
    margin-left: auto;
`;

export const ActivityProgress: React.FC<ActivityProgressProps> = ({
    keystrokes,
    mouseClicks,
    targetKeystrokes = 1000,
    targetClicks = 500,
}) => {
    const keystrokePercent = Math.min(100, (keystrokes / targetKeystrokes) * 100);
    const clickPercent = Math.min(100, (mouseClicks / targetClicks) * 100);

    return (
        <ActivityWrapper>
            <ActivityItem>
                <ActivityHeader>
                    <ActivityIcon>⌨️</ActivityIcon>
                    <ActivityLabel>কীস্ট্রোক</ActivityLabel>
                    <ActivityValue>{keystrokes.toLocaleString()}</ActivityValue>
                </ActivityHeader>
                <ProgressBar value={keystrokePercent} variant="primary" size="sm" />
            </ActivityItem>
            <ActivityItem>
                <ActivityHeader>
                    <ActivityIcon>🖱️</ActivityIcon>
                    <ActivityLabel>মাউস ক্লিক</ActivityLabel>
                    <ActivityValue>{mouseClicks.toLocaleString()}</ActivityValue>
                </ActivityHeader>
                <ProgressBar value={clickPercent} variant="success" size="sm" />
            </ActivityItem>
        </ActivityWrapper>
    );
};

export default ProgressBar;
