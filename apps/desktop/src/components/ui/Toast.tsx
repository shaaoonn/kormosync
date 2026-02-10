// ============================================================
// KormoSync Desktop App - Toast Component
// Beautiful notification toasts
// ============================================================

import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { theme } from '../../styles/theme';
import { useAppStore } from '../../store/useAppStore';
import type { Toast as ToastType } from '../../types';

// ============================================================
// Animations
// ============================================================
const slideIn = keyframes`
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
`;

const slideOut = keyframes`
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
`;

// ============================================================
// Styled Components
// ============================================================
const ToastContainer = styled.div`
    position: fixed;
    top: ${theme.spacing.lg};
    right: ${theme.spacing.lg};
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
    pointer-events: none;
`;

const toastVariants = {
    success: css`
        border-left: 4px solid ${theme.colors.status.success};

        .toast-icon {
            color: ${theme.colors.status.success};
        }
    `,
    error: css`
        border-left: 4px solid ${theme.colors.status.error};

        .toast-icon {
            color: ${theme.colors.status.error};
        }
    `,
    warning: css`
        border-left: 4px solid ${theme.colors.status.warning};

        .toast-icon {
            color: ${theme.colors.status.warning};
        }
    `,
    info: css`
        border-left: 4px solid ${theme.colors.status.info};

        .toast-icon {
            color: ${theme.colors.status.info};
        }
    `,
};

const ToastItem = styled.div<{ $type: ToastType['type']; $exiting?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.md};
    background: ${theme.colors.bg.elevated};
    border-radius: ${theme.borderRadius.md};
    box-shadow: ${theme.shadows.lg};
    pointer-events: auto;
    min-width: 280px;
    max-width: 400px;
    animation: ${slideIn} 0.3s ease-out forwards;

    ${({ $type }) => toastVariants[$type]}

    ${({ $exiting }) => $exiting && css`
        animation: ${slideOut} 0.2s ease-in forwards;
    `}
`;

const ToastIcon = styled.div`
    font-size: ${theme.typography.fontSize.lg};
    display: flex;
    align-items: center;
    justify-content: center;
`;

const ToastContent = styled.div`
    flex: 1;
`;

const ToastMessage = styled.p`
    margin: 0;
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.primary};
    line-height: 1.4;
`;

const ToastCloseBtn = styled.button`
    background: transparent;
    border: none;
    color: ${theme.colors.text.muted};
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${theme.borderRadius.sm};
    transition: all ${theme.animation.duration.fast};

    &:hover {
        background: ${theme.colors.bg.hover};
        color: ${theme.colors.text.primary};
    }
`;

// ============================================================
// Icons
// ============================================================
const icons = {
    success: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22,4 12,14.01 9,11.01" />
        </svg>
    ),
    error: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    ),
    warning: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    info: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    ),
};

const closeIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

// ============================================================
// Component
// ============================================================
export const ToastProvider: React.FC = () => {
    const toasts = useAppStore((state) => state.toasts);
    const removeToast = useAppStore((state) => state.removeToast);

    if (toasts.length === 0) return null;

    return (
        <ToastContainer>
            {toasts.map((toast) => (
                <ToastItem key={toast.id} $type={toast.type}>
                    <ToastIcon className="toast-icon">
                        {icons[toast.type]}
                    </ToastIcon>
                    <ToastContent>
                        <ToastMessage>{toast.message}</ToastMessage>
                    </ToastContent>
                    <ToastCloseBtn onClick={() => removeToast(toast.id)}>
                        {closeIcon}
                    </ToastCloseBtn>
                </ToastItem>
            ))}
        </ToastContainer>
    );
};

// ============================================================
// Hook for easy toast usage
// ============================================================
export const useToast = () => {
    const addToast = useAppStore((state) => state.addToast);

    return {
        success: (message: string, duration?: number) => addToast('success', message, duration),
        error: (message: string, duration?: number) => addToast('error', message, duration),
        warning: (message: string, duration?: number) => addToast('warning', message, duration),
        info: (message: string, duration?: number) => addToast('info', message, duration),
    };
};

export default ToastProvider;
