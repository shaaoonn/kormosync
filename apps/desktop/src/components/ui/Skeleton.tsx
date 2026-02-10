// ============================================================
// KormoSync Desktop App - Skeleton Component
// Loading placeholders
// ============================================================

import React from 'react';
import styled, { keyframes } from 'styled-components';
import { theme } from '../../styles/theme';

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
const SkeletonBase = styled.div<{
    $width?: string;
    $height?: string;
    $borderRadius?: string;
}>`
    background: linear-gradient(
        90deg,
        ${theme.colors.bg.tertiary} 25%,
        ${theme.colors.bg.hover} 50%,
        ${theme.colors.bg.tertiary} 75%
    );
    background-size: 200% 100%;
    animation: ${shimmer} 1.5s ease-in-out infinite;
    border-radius: ${({ $borderRadius }) => $borderRadius || theme.borderRadius.md};
    width: ${({ $width }) => $width || '100%'};
    height: ${({ $height }) => $height || '20px'};
`;

// ============================================================
// Component
// ============================================================
interface SkeletonProps {
    width?: string;
    height?: string;
    borderRadius?: string;
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width,
    height,
    borderRadius,
    className,
}) => {
    return (
        <SkeletonBase
            $width={width}
            $height={height}
            $borderRadius={borderRadius}
            className={className}
        />
    );
};

// ============================================================
// Pre-built Skeleton Variants
// ============================================================

// Text Skeleton
export const SkeletonText: React.FC<{ lines?: number; lastLineWidth?: string }> = ({
    lines = 3,
    lastLineWidth = '60%',
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
                key={i}
                height="14px"
                width={i === lines - 1 ? lastLineWidth : '100%'}
            />
        ))}
    </div>
);

// Avatar Skeleton
export const SkeletonAvatar: React.FC<{ size?: string }> = ({ size = '40px' }) => (
    <Skeleton width={size} height={size} borderRadius="50%" />
);

// Card Skeleton
const CardSkeletonWrapper = styled.div`
    padding: ${theme.spacing.md};
    background: ${theme.colors.bg.secondary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
`;

const CardSkeletonHeader = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    margin-bottom: ${theme.spacing.md};
`;

const CardSkeletonContent = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
`;

export const SkeletonCard: React.FC = () => (
    <CardSkeletonWrapper>
        <CardSkeletonHeader>
            <SkeletonAvatar />
            <div style={{ flex: 1 }}>
                <Skeleton height="16px" width="60%" />
                <Skeleton height="12px" width="40%" style={{ marginTop: '6px' }} />
            </div>
        </CardSkeletonHeader>
        <CardSkeletonContent>
            <Skeleton height="12px" width="100%" />
            <Skeleton height="12px" width="90%" />
            <Skeleton height="12px" width="75%" />
        </CardSkeletonContent>
    </CardSkeletonWrapper>
);

// Task Item Skeleton
const TaskSkeletonWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    padding: ${theme.spacing.md};
    background: ${theme.colors.bg.secondary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
`;

const TaskSkeletonInfo = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

export const SkeletonTaskItem: React.FC = () => (
    <TaskSkeletonWrapper>
        <Skeleton width="48px" height="48px" borderRadius={theme.borderRadius.md} />
        <TaskSkeletonInfo>
            <Skeleton height="16px" width="70%" />
            <Skeleton height="12px" width="50%" />
        </TaskSkeletonInfo>
        <Skeleton width="80px" height="32px" borderRadius={theme.borderRadius.full} />
    </TaskSkeletonWrapper>
);

// List Skeleton
export const SkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonTaskItem key={i} />
        ))}
    </div>
);

export default Skeleton;
