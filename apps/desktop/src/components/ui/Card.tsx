// ============================================================
// KormoSync Desktop App - Card Component
// Flexible card container with variants
// ============================================================

import React from 'react';
import styled, { css } from 'styled-components';
import { theme } from '../../styles/theme';

// ============================================================
// Types
// ============================================================
type CardVariant = 'default' | 'elevated' | 'outlined' | 'glass';

interface CardProps {
    variant?: CardVariant;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    clickable?: boolean;
    active?: boolean;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

// ============================================================
// Styled Components
// ============================================================
const variantStyles = {
    default: css`
        background: ${theme.colors.bg.secondary};
        border: 1px solid ${theme.colors.border.primary};
    `,
    elevated: css`
        background: ${theme.colors.bg.secondary};
        border: 1px solid ${theme.colors.border.primary};
        box-shadow: ${theme.shadows.lg};
    `,
    outlined: css`
        background: transparent;
        border: 1px solid ${theme.colors.border.primary};
    `,
    glass: css`
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(20px);
        border: 1px solid ${theme.colors.border.primary};
    `,
};

const paddingStyles = {
    none: css`padding: 0;`,
    sm: css`padding: ${theme.spacing.sm};`,
    md: css`padding: ${theme.spacing.md};`,
    lg: css`padding: ${theme.spacing.lg};`,
};

const StyledCard = styled.div<{
    $variant: CardVariant;
    $padding: 'none' | 'sm' | 'md' | 'lg';
    $clickable: boolean;
    $active: boolean;
}>`
    border-radius: ${theme.borderRadius.lg};
    transition: all ${theme.animation.duration.fast} ease;

    ${({ $variant }) => variantStyles[$variant]}
    ${({ $padding }) => paddingStyles[$padding]}

    ${({ $clickable }) => $clickable && css`
        cursor: pointer;

        &:hover {
            background: ${theme.colors.bg.hover};
            border-color: ${theme.colors.primary.main}40;
            transform: translateY(-1px);
        }
    `}

    ${({ $active }) => $active && css`
        border-color: ${theme.colors.primary.main};
        box-shadow: ${theme.shadows.glow.yellow};
    `}
`;

// ============================================================
// Component
// ============================================================
export const Card: React.FC<CardProps> = ({
    variant = 'default',
    padding = 'md',
    clickable = false,
    active = false,
    children,
    className,
    onClick,
}) => {
    return (
        <StyledCard
            $variant={variant}
            $padding={padding}
            $clickable={clickable}
            $active={active}
            className={className}
            onClick={onClick}
        >
            {children}
        </StyledCard>
    );
};

// ============================================================
// Card Header
// ============================================================
export const CardHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: ${theme.spacing.sm};
    margin-bottom: ${theme.spacing.sm};
    border-bottom: 1px solid ${theme.colors.border.primary};
`;

export const CardTitle = styled.h3`
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
    margin: 0;
`;

export const CardSubtitle = styled.p`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
    margin: 4px 0 0 0;
`;

// ============================================================
// Card Body
// ============================================================
export const CardBody = styled.div`
    flex: 1;
`;

// ============================================================
// Card Footer
// ============================================================
export const CardFooter = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    padding-top: ${theme.spacing.sm};
    margin-top: ${theme.spacing.sm};
    border-top: 1px solid ${theme.colors.border.primary};
`;

export default Card;
