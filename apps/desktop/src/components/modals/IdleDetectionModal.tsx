// ============================================================
// KormoSync Desktop App - Idle Detection Modal
// Alert user when idle detected, options to continue or stop
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { theme } from '../../styles/theme';
import { Modal, Button, Timer } from '../ui';
import { useAppStore } from '../../store/useAppStore';
import { formatDuration } from '../../utils/formatters';

// ============================================================
// Types
// ============================================================
interface IdleDetectionModalProps {
    isOpen: boolean;
    idleSeconds: number;
    onContinue: () => void;
    onPauseAll: () => void;
    onStopAll: () => void;
}

// ============================================================
// Animations
// ============================================================
const pulse = keyframes`
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
`;

const shake = keyframes`
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
`;

// ============================================================
// Styled Components
// ============================================================
const ModalContent = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: ${theme.spacing.lg};
`;

const IconWrapper = styled.div`
    width: 80px;
    height: 80px;
    background: ${theme.colors.status.warning}20;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    animation: ${pulse} 2s ease-in-out infinite;
`;

const Title = styled.h2`
    margin: 0;
    font-size: ${theme.typography.fontSize.xl};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
`;

const Description = styled.p`
    margin: 0;
    font-size: ${theme.typography.fontSize.md};
    color: ${theme.colors.text.secondary};
    line-height: 1.6;
`;

const IdleTimeDisplay = styled.div`
    padding: ${theme.spacing.lg};
    background: ${theme.colors.status.warning}15;
    border: 2px solid ${theme.colors.status.warning}40;
    border-radius: ${theme.borderRadius.xl};
    animation: ${shake} 0.5s ease-in-out;
`;

const IdleLabel = styled.div`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.status.warning};
    margin-bottom: ${theme.spacing.sm};
`;

const IdleTime = styled.div`
    font-size: ${theme.typography.fontSize['3xl']};
    font-weight: ${theme.typography.fontWeight.bold};
    font-family: 'JetBrains Mono', monospace;
    color: ${theme.colors.status.warning};
`;

const ActiveTimersInfo = styled.div`
    width: 100%;
    padding: ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.lg};
`;

const ActiveTimersTitle = styled.div`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing.sm};
`;

const ActiveTimersList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.xs};
`;

const ActiveTimerItem = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    background: ${theme.colors.bg.secondary};
    border-radius: ${theme.borderRadius.sm};
    font-size: ${theme.typography.fontSize.sm};
`;

const TimerName = styled.span`
    color: ${theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
`;

const TimerTime = styled.span`
    color: ${theme.colors.primary.main};
    font-family: 'JetBrains Mono', monospace;
    font-size: ${theme.typography.fontSize.xs};
`;

const ButtonsWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
    width: 100%;
`;

const PrimaryButton = styled(Button)`
    width: 100%;
`;

const SecondaryButtons = styled.div`
    display: flex;
    gap: ${theme.spacing.sm};
`;

const SecondaryButton = styled(Button)`
    flex: 1;
`;

const WarningText = styled.p`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    margin: 0;
`;

// ============================================================
// Component
// ============================================================
export const IdleDetectionModal: React.FC<IdleDetectionModalProps> = ({
    isOpen,
    idleSeconds,
    onContinue,
    onPauseAll,
    onStopAll,
}) => {
    const { activeTimers, tasks } = useAppStore();
    const [countdown, setCountdown] = useState(60); // 60 seconds to respond

    // Get active timers info
    const activeTimersList = useMemo(() => {
        return Object.values(activeTimers)
            .filter((timer) => !timer.isPaused)
            .map((timer) => {
                const task = tasks.find((t) => t.id === timer.taskId);
                const subTask = task?.subTasks?.find((st) => st.id === timer.subTaskId);
                return {
                    id: timer.subTaskId,
                    name: subTask?.title || 'Unknown',
                    time: timer.elapsedSeconds,
                };
            });
    }, [activeTimers, tasks]);

    // Countdown timer
    useEffect(() => {
        if (!isOpen) {
            setCountdown(60);
            return;
        }

        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    // Auto pause when countdown reaches 0
                    onPauseAll();
                    return 60;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen, onPauseAll]);

    // Play notification sound
    useEffect(() => {
        if (isOpen) {
            // Try to play system notification
            try {
                const audio = new Audio('/notification.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => {});
            } catch (e) {
                // Ignore audio errors
            }

            // Show system notification
            if (Notification.permission === 'granted') {
                new Notification('KormoSync - নিষ্ক্রিয়তা শনাক্ত!', {
                    body: `আপনি ${formatDuration(idleSeconds)} ধরে নিষ্ক্রিয়। আপনার টাইমার স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যাবে।`,
                    icon: '/icon.png',
                    tag: 'idle-detection',
                });
            }
        }
    }, [isOpen, idleSeconds]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onContinue}
            showClose={false}
            closeOnOverlay={false}
            closeOnEscape={false}
            size="sm"
        >
            <ModalContent>
                <IconWrapper>💤</IconWrapper>

                <Title>নিষ্ক্রিয়তা শনাক্ত হয়েছে!</Title>

                <Description>
                    আপনি কিছুক্ষণ ধরে কোনো কার্যকলাপ করেননি।
                    আপনার টাইমার এখনও চলছে।
                </Description>

                <IdleTimeDisplay>
                    <IdleLabel>নিষ্ক্রিয় সময়</IdleLabel>
                    <IdleTime>{formatDuration(idleSeconds)}</IdleTime>
                </IdleTimeDisplay>

                {activeTimersList.length > 0 && (
                    <ActiveTimersInfo>
                        <ActiveTimersTitle>
                            চলমান টাইমার ({activeTimersList.length} টি)
                        </ActiveTimersTitle>
                        <ActiveTimersList>
                            {activeTimersList.slice(0, 3).map((timer) => (
                                <ActiveTimerItem key={timer.id}>
                                    <TimerName>{timer.name}</TimerName>
                                    <TimerTime>{formatDuration(timer.time)}</TimerTime>
                                </ActiveTimerItem>
                            ))}
                            {activeTimersList.length > 3 && (
                                <ActiveTimerItem>
                                    <TimerName>+{activeTimersList.length - 3} আরো</TimerName>
                                </ActiveTimerItem>
                            )}
                        </ActiveTimersList>
                    </ActiveTimersInfo>
                )}

                <WarningText>
                    ⏱️ {countdown} সেকেন্ডে স্বয়ংক্রিয়ভাবে বিরতি হবে
                </WarningText>

                <ButtonsWrapper>
                    <PrimaryButton variant="primary" onClick={onContinue}>
                        🔄 কাজ চালিয়ে যাচ্ছি
                    </PrimaryButton>
                    <SecondaryButtons>
                        <SecondaryButton variant="secondary" onClick={onPauseAll}>
                            ⏸️ সব বিরতি
                        </SecondaryButton>
                        <SecondaryButton variant="danger" onClick={onStopAll}>
                            ⏹️ সব বন্ধ
                        </SecondaryButton>
                    </SecondaryButtons>
                </ButtonsWrapper>
            </ModalContent>
        </Modal>
    );
};

export default IdleDetectionModal;
