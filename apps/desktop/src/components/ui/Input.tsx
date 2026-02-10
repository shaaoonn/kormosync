// ============================================================
// KormoSync Desktop App - Input Component
// Form inputs with variants
// ============================================================

import React from 'react';
import styled, { css } from 'styled-components';
import { theme } from '../../styles/theme';

// ============================================================
// Types
// ============================================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    hint?: string;
    fullWidth?: boolean;
}

// ============================================================
// Styled Components
// ============================================================
const InputWrapper = styled.div<{ $fullWidth: boolean }>`
    display: flex;
    flex-direction: column;
    gap: 6px;
    ${({ $fullWidth }) => $fullWidth && css`width: 100%;`}
`;

const Label = styled.label`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.secondary};
`;

const InputContainer = styled.div<{ $hasIcon: boolean; $iconPosition: 'left' | 'right' }>`
    position: relative;
    display: flex;
    align-items: center;

    ${({ $hasIcon, $iconPosition }) => $hasIcon && css`
        input {
            ${$iconPosition === 'left' ? 'padding-left: 40px;' : 'padding-right: 40px;'}
        }
    `}
`;

const IconWrapper = styled.span<{ $position: 'left' | 'right' }>`
    position: absolute;
    ${({ $position }) => $position === 'left' ? 'left: 12px;' : 'right: 12px;'}
    color: ${theme.colors.text.muted};
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;

    svg {
        width: 18px;
        height: 18px;
    }
`;

const baseInputStyles = css`
    width: 100%;
    padding: 10px 14px;
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.fontSize.sm};
    font-family: ${theme.typography.fontFamily};
    transition: all ${theme.animation.duration.fast} ease;
    outline: none;

    &::placeholder {
        color: ${theme.colors.text.muted};
    }

    &:hover:not(:disabled) {
        border-color: ${theme.colors.border.active};
    }

    &:focus {
        border-color: ${theme.colors.primary.main};
        box-shadow: 0 0 0 3px ${theme.colors.primary.main}20;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const StyledInput = styled.input<{ $hasError: boolean }>`
    ${baseInputStyles}

    ${({ $hasError }) => $hasError && css`
        border-color: ${theme.colors.status.error};

        &:focus {
            border-color: ${theme.colors.status.error};
            box-shadow: 0 0 0 3px ${theme.colors.status.error}20;
        }
    `}
`;

const StyledTextArea = styled.textarea<{ $hasError: boolean }>`
    ${baseInputStyles}
    min-height: 100px;
    resize: vertical;

    ${({ $hasError }) => $hasError && css`
        border-color: ${theme.colors.status.error};

        &:focus {
            border-color: ${theme.colors.status.error};
            box-shadow: 0 0 0 3px ${theme.colors.status.error}20;
        }
    `}
`;

const ErrorMessage = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.status.error};
`;

const HintMessage = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

// ============================================================
// Input Component
// ============================================================
export const Input: React.FC<InputProps> = ({
    label,
    error,
    hint,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    ...props
}) => {
    return (
        <InputWrapper $fullWidth={fullWidth}>
            {label && <Label>{label}</Label>}
            <InputContainer $hasIcon={!!icon} $iconPosition={iconPosition}>
                {icon && <IconWrapper $position={iconPosition}>{icon}</IconWrapper>}
                <StyledInput $hasError={!!error} {...props} />
            </InputContainer>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            {hint && !error && <HintMessage>{hint}</HintMessage>}
        </InputWrapper>
    );
};

// ============================================================
// TextArea Component
// ============================================================
export const TextArea: React.FC<TextAreaProps> = ({
    label,
    error,
    hint,
    fullWidth = false,
    ...props
}) => {
    return (
        <InputWrapper $fullWidth={fullWidth}>
            {label && <Label>{label}</Label>}
            <StyledTextArea $hasError={!!error} {...props} />
            {error && <ErrorMessage>{error}</ErrorMessage>}
            {hint && !error && <HintMessage>{hint}</HintMessage>}
        </InputWrapper>
    );
};

// ============================================================
// Search Input
// ============================================================
interface SearchInputProps extends Omit<InputProps, 'icon' | 'iconPosition'> {
    onSearch?: (value: string) => void;
}

const SearchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
    </svg>
);

export const SearchInput: React.FC<SearchInputProps> = ({
    onSearch,
    onChange,
    ...props
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(e);
        onSearch?.(e.target.value);
    };

    return (
        <Input
            {...props}
            icon={<SearchIcon />}
            iconPosition="left"
            placeholder={props.placeholder || 'অনুসন্ধান করুন...'}
            onChange={handleChange}
        />
    );
};

export default Input;
