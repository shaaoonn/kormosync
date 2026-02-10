// ============================================================
// KormoSync Desktop App - Avatar Component
// User avatars with status indicators
// ============================================================

import React from 'react';
import styled, { css } from 'styled-components';
import { theme } from '../../styles/theme';

// ============================================================
// Types
// ============================================================
type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

interface AvatarProps {
    src?: string | null;
    name?: string;
    size?: AvatarSize;
    status?: AvatarStatus;
    showStatus?: boolean;
    className?: string;
}

// ============================================================
// Utilities
// ============================================================
const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const stringToColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
};

// ============================================================
// Styled Components
// ============================================================
const sizeMap = {
    xs: '24px',
    sm: '32px',
    md: '40px',
    lg: '56px',
    xl: '80px',
};

const fontSizeMap = {
    xs: '10px',
    sm: '12px',
    md: '14px',
    lg: '20px',
    xl: '28px',
};

const statusSizeMap = {
    xs: '6px',
    sm: '8px',
    md: '10px',
    lg: '14px',
    xl: '18px',
};

const AvatarWrapper = styled.div<{ $size: AvatarSize }>`
    position: relative;
    width: ${({ $size }) => sizeMap[$size]};
    height: ${({ $size }) => sizeMap[$size]};
    flex-shrink: 0;
`;

const AvatarImage = styled.img<{ $size: AvatarSize }>`
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid ${theme.colors.border.primary};
`;

const AvatarFallback = styled.div<{ $size: AvatarSize; $bgColor: string }>`
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: ${({ $bgColor }) => $bgColor};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${({ $size }) => fontSizeMap[$size]};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: white;
    border: 2px solid ${theme.colors.border.primary};
`;

const statusColors = {
    online: theme.colors.status.success,
    offline: theme.colors.text.muted,
    busy: theme.colors.status.error,
    away: theme.colors.status.warning,
};

const StatusIndicator = styled.span<{ $status: AvatarStatus; $size: AvatarSize }>`
    position: absolute;
    bottom: 0;
    right: 0;
    width: ${({ $size }) => statusSizeMap[$size]};
    height: ${({ $size }) => statusSizeMap[$size]};
    border-radius: 50%;
    background: ${({ $status }) => statusColors[$status]};
    border: 2px solid ${theme.colors.bg.primary};
`;

// ============================================================
// Component
// ============================================================
export const Avatar: React.FC<AvatarProps> = ({
    src,
    name,
    size = 'md',
    status,
    showStatus = false,
    className,
}) => {
    const [imageError, setImageError] = React.useState(false);
    const bgColor = name ? stringToColor(name) : theme.colors.text.muted;

    return (
        <AvatarWrapper $size={size} className={className}>
            {src && !imageError ? (
                <AvatarImage
                    $size={size}
                    src={src}
                    alt={name || 'Avatar'}
                    onError={() => setImageError(true)}
                />
            ) : (
                <AvatarFallback $size={size} $bgColor={bgColor}>
                    {getInitials(name)}
                </AvatarFallback>
            )}
            {showStatus && status && (
                <StatusIndicator $status={status} $size={size} />
            )}
        </AvatarWrapper>
    );
};

// ============================================================
// Avatar Group
// ============================================================
interface AvatarGroupProps {
    avatars: Array<{ src?: string | null; name?: string }>;
    max?: number;
    size?: AvatarSize;
}

const AvatarGroupWrapper = styled.div`
    display: flex;
    align-items: center;
`;

const AvatarGroupItem = styled.div<{ $offset: number }>`
    margin-left: ${({ $offset }) => $offset}px;

    &:first-child {
        margin-left: 0;
    }
`;

const MoreAvatar = styled.div<{ $size: AvatarSize }>`
    width: ${({ $size }) => sizeMap[$size]};
    height: ${({ $size }) => sizeMap[$size]};
    border-radius: 50%;
    background: ${theme.colors.bg.tertiary};
    border: 2px solid ${theme.colors.border.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${({ $size }) => fontSizeMap[$size]};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.secondary};
`;

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
    avatars,
    max = 4,
    size = 'sm',
}) => {
    const visible = avatars.slice(0, max);
    const remaining = avatars.length - max;
    const offset = size === 'xs' ? -8 : size === 'sm' ? -10 : -12;

    return (
        <AvatarGroupWrapper>
            {visible.map((avatar, index) => (
                <AvatarGroupItem key={index} $offset={offset}>
                    <Avatar src={avatar.src} name={avatar.name} size={size} />
                </AvatarGroupItem>
            ))}
            {remaining > 0 && (
                <AvatarGroupItem $offset={offset}>
                    <MoreAvatar $size={size}>+{remaining}</MoreAvatar>
                </AvatarGroupItem>
            )}
        </AvatarGroupWrapper>
    );
};

export default Avatar;
