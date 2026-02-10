// ============================================================
// KormoSync Desktop App - Modal Component
// Reusable modal with animations
// ============================================================

import React, { useEffect, useCallback } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { theme } from '../../styles/theme';

// ============================================================
// Types
// ============================================================
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'full';
    showClose?: boolean;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
}

// ============================================================
// Animations
// ============================================================
const fadeIn = keyframes`
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
`;

const slideUp = keyframes`
    from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
`;

// ============================================================
// Styled Components
// ============================================================
const Overlay = styled.div<{ $isOpen: boolean }>`
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9000;
    animation: ${fadeIn} 0.2s ease-out;
    padding: ${theme.spacing.lg};

    ${({ $isOpen }) => !$isOpen && css`
        display: none;
    `}
`;

const sizeStyles = {
    sm: css`
        max-width: 360px;
    `,
    md: css`
        max-width: 480px;
    `,
    lg: css`
        max-width: 640px;
    `,
    full: css`
        max-width: calc(100vw - 48px);
        max-height: calc(100vh - 48px);
    `,
};

const ModalContainer = styled.div<{ $size: 'sm' | 'md' | 'lg' | 'full' }>`
    width: 100%;
    background: ${theme.colors.bg.secondary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.xl};
    box-shadow: ${theme.shadows.xl};
    animation: ${slideUp} 0.3s ease-out;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    ${({ $size }) => sizeStyles[$size]}
`;

const ModalHeader = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: ${theme.spacing.lg};
    border-bottom: 1px solid ${theme.colors.border.primary};
`;

const ModalTitleWrapper = styled.div`
    flex: 1;
`;

const ModalTitle = styled.h2`
    margin: 0;
    font-size: ${theme.typography.fontSize.lg};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
`;

const ModalSubtitle = styled.p`
    margin: 4px 0 0 0;
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
`;

const CloseButton = styled.button`
    background: transparent;
    border: none;
    color: ${theme.colors.text.muted};
    cursor: pointer;
    padding: 8px;
    margin: -8px -8px -8px 8px;
    border-radius: ${theme.borderRadius.md};
    transition: all ${theme.animation.duration.fast};
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background: ${theme.colors.bg.hover};
        color: ${theme.colors.text.primary};
    }

    svg {
        width: 20px;
        height: 20px;
    }
`;

const ModalBody = styled.div`
    padding: ${theme.spacing.lg};
    overflow-y: auto;
    flex: 1;
`;

const ModalFooter = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.md} ${theme.spacing.lg};
    border-top: 1px solid ${theme.colors.border.primary};
    background: ${theme.colors.bg.tertiary};
`;

// ============================================================
// Close Icon
// ============================================================
const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

// ============================================================
// Component
// ============================================================
export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    size = 'md',
    showClose = true,
    closeOnOverlay = true,
    closeOnEscape = true,
}) => {
    // Handle escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && closeOnEscape) {
            onClose();
        }
    }, [onClose, closeOnEscape]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    // Handle overlay click
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && closeOnOverlay) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <Overlay $isOpen={isOpen} onClick={handleOverlayClick}>
            <ModalContainer $size={size} onClick={(e) => e.stopPropagation()}>
                {(title || showClose) && (
                    <ModalHeader>
                        <ModalTitleWrapper>
                            {title && <ModalTitle>{title}</ModalTitle>}
                            {subtitle && <ModalSubtitle>{subtitle}</ModalSubtitle>}
                        </ModalTitleWrapper>
                        {showClose && (
                            <CloseButton onClick={onClose}>
                                <CloseIcon />
                            </CloseButton>
                        )}
                    </ModalHeader>
                )}
                <ModalBody>{children}</ModalBody>
            </ModalContainer>
        </Overlay>
    );
};

// Export sub-components for flexible usage
export { ModalFooter };

export default Modal;
