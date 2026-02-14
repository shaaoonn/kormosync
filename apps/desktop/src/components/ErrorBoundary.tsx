import React from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

const ErrorWrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: ${theme.colors.bg.primary};
    color: ${theme.colors.text.primary};
    padding: 2rem;
    text-align: center;
`;

const ErrorIcon = styled.div`
    font-size: 48px;
    margin-bottom: 1rem;
`;

const ErrorTitle = styled.h2`
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    color: ${theme.colors.status.error};
`;

const ErrorMessage = styled.p`
    margin: 0 0 1.5rem;
    font-size: 0.875rem;
    color: ${theme.colors.text.muted};
    max-width: 400px;
`;

const ResetButton = styled.button`
    padding: 0.5rem 1.5rem;
    background: ${theme.colors.primary.main};
    color: ${theme.colors.bg.primary};
    border: none;
    border-radius: ${theme.borderRadius.md};
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    &:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }
`;

class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <ErrorWrapper>
                    <ErrorIcon>⚠️</ErrorIcon>
                    <ErrorTitle>কিছু একটা সমস্যা হয়েছে</ErrorTitle>
                    <ErrorMessage>
                        {this.state.error?.message || 'অপ্রত্যাশিত সমস্যা — আবার চেষ্টা করুন'}
                    </ErrorMessage>
                    <ResetButton onClick={this.handleReset}>
                        🔄 আবার চেষ্টা করুন
                    </ResetButton>
                </ErrorWrapper>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
