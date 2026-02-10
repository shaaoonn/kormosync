// ============================================================
// KormoSync Desktop App - Button Component
// Reusable button with multiple variants
// ============================================================

import React from 'react';
import styled, { css } from 'styled-components';
import { theme } from '../../styles/theme';

// ============================================================
// Types
// ============================================================
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
}

// ============================================================
// Styled Components
// ============================================================
const variantStyles = {
    primary: css`
        background: ${theme.colors.primary.gradient};
        color: ${theme.colors.text.primary};
        border: none;

        &:hover:not(:disabled) {
            filter: brightness(1.1);
            box-shadow: ${theme.shadows.glow.yellow};
        }
    `,
    secondary: css`
        background: ${theme.colors.bg.tertiary};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};

        &:hover:not(:disabled) {
            background: ${theme.colors.bg.hover};
            border-color: ${theme.colors.primary.main};
        }
    `,
    ghost: css`
        background: transparent;
        color: ${theme.colors.text.secondary};
        border: none;

        &:hover:not(:disabled) {
            background: ${theme.colors.bg.hover};
            color: ${theme.colors.text.primary};
        }
    `,
    danger: css`
        background: ${theme.colors.status.error};
        color: white;
        border: none;

        &:hover:not(:disabled) {
            filter: brightness(1.1);
        }
    `,
    success: css`
        background: ${theme.colors.status.success};
        color: white;
        border: none;

        &:hover:not(:disabled) {
            filter: brightness(1.1);
        }
    `,
};

const sizeStyles = {
    sm: css`
        padding: 6px 12px;
        font-size: ${theme.typography.fontSize.xs};
        border-radius: ${theme.borderRadius.sm};
        gap: 4px;
    `,
    md: css`
        padding: 10px 20px;
        font-size: ${theme.typography.fontSize.sm};
        border-radius: ${theme.borderRadius.md};
        gap: 8px;
    `,
    lg: css`
        padding: 14px 28px;
        font-size: ${theme.typography.fontSize.md};
        border-radius: ${theme.borderRadius.lg};
        gap: 10px;
    `,
};

const StyledButton = styled.button<{
    $variant: ButtonVariant;
    $size: ButtonSize;
    $fullWidth: boolean;
    $loading: boolean;
    $iconPosition: 'left' | 'right';
}>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: ${theme.typography.fontFamily};
    font-weight: ${theme.typography.fontWeight.medium};
    cursor: pointer;
    transition: all ${theme.animation.duration.fast} ease;
    outline: none;
    position: relative;
    overflow: hidden;

    ${({ $variant }) => variantStyles[$variant]}
    ${({ $size }) => sizeStyles[$size]}
    ${({ $fullWidth }) => $fullWidth && css`width: 100%;`}
    ${({ $iconPosition }) => $iconPosition === 'right' && css`flex-direction: row-reverse;`}

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    &:focus-visible {
        box-shadow: 0 0 0 2px ${theme.colors.primary.main}40;
    }

    ${({ $loading }) => $loading && css`
        pointer-events: none;

        & > *:not(.spinner) {
            opacity: 0;
        }
    `}
`;

const Spinner = styled.div`
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
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
export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    icon,
    iconPosition = 'left',
    children,
    ...props
}) => {
    return (
        <StyledButton
            $variant={variant}
            $size={size}
            $fullWidth={fullWidth}
            $loading={loading}
            $iconPosition={iconPosition}
            disabled={loading || props.disabled}
            {...props}
        >
            {loading && <Spinner className="spinner" />}
            {icon && <IconWrapper>{icon}</IconWrapper>}
            {children}
        </StyledButton>
    );
};

export default Button;
