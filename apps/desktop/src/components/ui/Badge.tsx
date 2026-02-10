// ============================================================
// KormoSync Desktop App - Badge Component
// Status badges and tags
// ============================================================

import React from 'react';
import styled, { css } from 'styled-components';
import { theme } from '../../styles/theme';

// ============================================================
// Types
// ============================================================
type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
    variant?: BadgeVariant;
    size?: BadgeSize;
    icon?: React.ReactNode;
    dot?: boolean;
    children: React.ReactNode;
    className?: string;
}

// ============================================================
// Styled Components
// ============================================================
const variantStyles = {
    default: css`
        background: ${theme.colors.bg.tertiary};
        color: ${theme.colors.text.secondary};
        border-color: ${theme.colors.border.primary};
    `,
    success: css`
        background: ${theme.colors.status.success}20;
        color: ${theme.colors.status.success};
        border-color: ${theme.colors.status.success}40;
    `,
    warning: css`
        background: ${theme.colors.status.warning}20;
        color: ${theme.colors.status.warning};
        border-color: ${theme.colors.status.warning}40;
    `,
    error: css`
        background: ${theme.colors.status.error}20;
        color: ${theme.colors.status.error};
        border-color: ${theme.colors.status.error}40;
    `,
    info: css`
        background: ${theme.colors.status.info}20;
        color: ${theme.colors.status.info};
        border-color: ${theme.colors.status.info}40;
    `,
    primary: css`
        background: ${theme.colors.primary.main}20;
        color: ${theme.colors.primary.main};
        border-color: ${theme.colors.primary.main}40;
    `,
};

const sizeStyles = {
    sm: css`
        padding: 2px 8px;
        font-size: ${theme.typography.fontSize.xs};
        gap: 4px;
    `,
    md: css`
        padding: 4px 12px;
        font-size: ${theme.typography.fontSize.sm};
        gap: 6px;
    `,
};

const StyledBadge = styled.span<{
    $variant: BadgeVariant;
    $size: BadgeSize;
}>`
    display: inline-flex;
    align-items: center;
    font-weight: ${theme.typography.fontWeight.medium};
    border-radius: ${theme.borderRadius.full};
    border: 1px solid;
    white-space: nowrap;

    ${({ $variant }) => variantStyles[$variant]}
    ${({ $size }) => sizeStyles[$size]}
`;

const Dot = styled.span<{ $variant: BadgeVariant }>`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
`;

const IconWrapper = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    svg {
        width: 1em;
        height: 1em;
    }
`;

// ============================================================
// Component
// ============================================================
export const Badge: React.FC<BadgeProps> = ({
    variant = 'default',
    size = 'md',
    icon,
    dot = false,
    children,
    className,
}) => {
    return (
        <StyledBadge $variant={variant} $size={size} className={className}>
            {dot && <Dot $variant={variant} />}
            {icon && <IconWrapper>{icon}</IconWrapper>}
            {children}
        </StyledBadge>
    );
};

// ============================================================
// Status Badge - Pre-configured for common statuses
// ============================================================
interface StatusBadgeProps {
    status: 'pending' | 'in_progress' | 'completed' | 'active' | 'locked' | 'paused';
    size?: BadgeSize;
}

const statusConfig: Record<StatusBadgeProps['status'], { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'default', label: 'অপেক্ষমান' },
    in_progress: { variant: 'primary', label: 'চলমান' },
    completed: { variant: 'success', label: 'সম্পন্ন' },
    active: { variant: 'success', label: 'সক্রিয়' },
    locked: { variant: 'error', label: 'লক' },
    paused: { variant: 'warning', label: 'বিরতি' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
    const config = statusConfig[status];

    return (
        <Badge variant={config.variant} size={size} dot>
            {config.label}
        </Badge>
    );
};

// ============================================================
// Schedule Badge
// ============================================================
interface ScheduleBadgeProps {
    scheduleStatus: 'active' | 'locked' | 'starting_soon' | 'ended' | 'no_schedule';
    size?: BadgeSize;
}

const scheduleConfig: Record<ScheduleBadgeProps['scheduleStatus'], { variant: BadgeVariant; label: string; icon: React.ReactNode }> = {
    active: {
        variant: 'success',
        label: 'এখন চলছে',
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5,3 19,12 5,21" />
            </svg>
        ),
    },
    locked: {
        variant: 'error',
        label: 'সময় নেই',
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
    },
    starting_soon: {
        variant: 'warning',
        label: 'শীঘ্রই শুরু',
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12,6 12,12 16,14" />
            </svg>
        ),
    },
    ended: {
        variant: 'default',
        label: 'শেষ হয়েছে',
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
        ),
    },
    no_schedule: {
        variant: 'info',
        label: 'যেকোনো সময়',
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12,6 12,12 16,14" />
            </svg>
        ),
    },
};

export const ScheduleBadge: React.FC<ScheduleBadgeProps> = ({ scheduleStatus, size = 'sm' }) => {
    const config = scheduleConfig[scheduleStatus];

    return (
        <Badge variant={config.variant} size={size} icon={config.icon}>
            {config.label}
        </Badge>
    );
};

export default Badge;
