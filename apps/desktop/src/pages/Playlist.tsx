// ============================================================
// KormoSync Desktop App - Playlist Page
// Split Screen Layout: Left (Playlist) | Right (Controls)
// ============================================================

import React, { useMemo, useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { theme } from '../styles/theme';
import {
    ProgressBar,
} from '../components/ui';
import { SubTaskItem } from '../components/task';
import { useAppStore } from '../store/useAppStore';
import { formatDuration } from '../utils/formatters';
import { proofApi, uploadApi } from '../services/api';
import type { SubTask } from '../types';

// ============================================================
// Animations
// ============================================================
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.4); }
    50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(234, 179, 8, 0); }
`;

// ============================================================
// Styled Components
// ============================================================
const PageContainer = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 350px);
    height: 100%;
    width: 100%;
    min-width: 0;
    background: ${theme.colors.bg.primary};
    overflow: hidden;
    color: ${theme.colors.text.primary};
`;

// --- LEFT COLUMN (Playlist) ---
const LeftColumn = styled.div`
    /* Grid item implicitly */
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    border-right: 1px solid ${theme.colors.border.primary};
    background: ${theme.colors.bg.primary};
`;

const StickyHeader = styled.div`
    position: sticky;
    top: 0;
    z-index: 10;
    background: ${theme.colors.bg.primary};
    border-bottom: 1px solid ${theme.colors.border.primary};
    padding: ${theme.spacing.lg};
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
`;

const BackButton = styled.button`
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    color: ${theme.colors.text.primary};
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        background: ${theme.colors.bg.hover};
    }
`;

const HeaderTitleCol = styled.div`
    display: flex;
    flex-direction: column;
`;

const TaskTitle = styled.h1`
    font-size: ${theme.typography.fontSize.xl};
    font-weight: ${theme.typography.fontWeight.bold};
    margin: 0;
    color: ${theme.colors.text.primary};
`;

const StatusBadge = styled.span`
    display: inline-block;
    padding: 2px 8px;
    margin-top: 4px;
    border-radius: ${theme.borderRadius.sm};
    background: ${theme.colors.primary.main}15;
    color: ${theme.colors.primary.main};
    font-size: ${theme.typography.fontSize.xs};
    font-weight: 600;
    width: fit-content;
`;

const PlaylistContainer = styled.div`
    padding: ${theme.spacing.lg};
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.md};
`;

// --- RIGHT COLUMN (Controls) ---
const RightColumn = styled.div`
    /* Fixed width handled by grid-template-columns */
    height: 100%;
    background: ${theme.colors.bg.secondary};
    display: flex;
    flex-direction: column;
    box-shadow: -5px 0 20px rgba(0,0,0,0.2);
    z-index: 20;
    overflow: hidden;
`;

const TimerSection = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: ${theme.spacing.xl};
    text-align: center;
`;

const TotalTimeLabel = styled.div`
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: ${theme.colors.text.muted};
    font-size: ${theme.typography.fontSize.xs};
    margin-bottom: ${theme.spacing.sm};
`;

const BigTimerDisplay = styled.div`
    font-family: 'JetBrains Mono', monospace;
    font-size: 48px;
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
    margin-bottom: ${theme.spacing.xl};
`;

const ActiveTaskCard = styled.div<{ $isPlaying: boolean }>`
    width: 100%;
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
    padding: ${theme.spacing.md};
    text-align: center;
    animation: ${fadeIn} 0.5s ease;
    ${({ $isPlaying }) => $isPlaying && css`
        border-color: ${theme.colors.status.warning};
        box-shadow: ${theme.shadows.glow.yellow};
    `}
`;

const ActiveTaskLabel = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
`;

const ActiveTaskTitle = styled.div`
    font-size: ${theme.typography.fontSize.lg};
    color: ${theme.colors.text.primary};
    font-weight: ${theme.typography.fontWeight.semibold};
    margin-bottom: ${theme.spacing.md};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const ControlsRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.spacing.lg};
    margin-top: ${theme.spacing.md};
`;

const PlayButton = styled.button<{ $isPlaying: boolean }>`
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: none;
    background: ${({ $isPlaying }) => $isPlaying ? theme.colors.status.warning : theme.colors.primary.main};
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all ${theme.animation.duration.fast};
    box-shadow: ${theme.shadows.md};

    &:hover {
        transform: scale(1.1);
        box-shadow: ${theme.shadows.lg};
    }
    
    ${({ $isPlaying }) => $isPlaying && css`
        animation: ${pulse} 2s infinite;
    `}

    svg {
        width: 28px;
        height: 28px;
        fill: currentColor;
    }
`;

const SecondaryControlButton = styled.button`
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 1px solid ${theme.colors.border.primary};
    background: transparent;
    color: ${theme.colors.text.secondary};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover:not(:disabled) {
        background: ${theme.colors.bg.hover};
        color: ${theme.colors.text.primary};
    }
    
    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
    }
`;

const ProgressInfo = styled.div`
    width: 100%;
    margin-top: ${theme.spacing.xl};
`;

const BottomActionSection = styled.div`
    padding: ${theme.spacing.lg};
    border-top: 1px solid ${theme.colors.border.primary};
    background: ${theme.colors.bg.tertiary};
`;

const FinishButton = styled.button`
    width: 100%;
    padding: ${theme.spacing.md};
    background: ${theme.colors.status.error};
    color: white;
    border: none;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.bold};
    cursor: pointer;
    transition: background 0.2s;
    box-shadow: ${theme.shadows.md};

    &:hover {
        background: #dc2626;
    }
`;

const ProofButton = styled.button`
    width: 100%;
    padding: ${theme.spacing.md};
    background: ${theme.colors.primary.main};
    color: ${theme.colors.bg.primary};
    border: none;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.bold};
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: ${theme.shadows.md};
    margin-bottom: ${theme.spacing.sm};

    &:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

// Inline Proof Form
const ProofForm = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
    margin-bottom: ${theme.spacing.md};
`;

const ProofInput = styled.input`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.primary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.fontSize.sm};
    font-family: ${theme.typography.fontFamily};
    &:focus { outline: none; border-color: ${theme.colors.primary.main}; }
    &::placeholder { color: ${theme.colors.text.muted}; }
`;

const ProofTextarea = styled.textarea`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.primary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.fontSize.sm};
    font-family: ${theme.typography.fontFamily};
    resize: vertical;
    min-height: 60px;
    &:focus { outline: none; border-color: ${theme.colors.primary.main}; }
    &::placeholder { color: ${theme.colors.text.muted}; }
`;

const ProofSubmitRow = styled.div`
    display: flex;
    gap: ${theme.spacing.sm};
`;

const ProofSubmitBtn = styled.button`
    flex: 1;
    padding: ${theme.spacing.sm};
    background: ${theme.colors.status.success};
    color: white;
    border: none;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: 600;
    cursor: pointer;
    &:hover { opacity: 0.9; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ProofCancelBtn = styled.button`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: transparent;
    color: ${theme.colors.text.secondary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.sm};
    cursor: pointer;
    &:hover { background: ${theme.colors.bg.hover}; }
`;

const FileUploadLabel = styled.label`
    padding: ${theme.spacing.xs} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border: 1px dashed ${theme.colors.border.active};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.fontSize.xs};
    cursor: pointer;
    text-align: center;
    &:hover { background: ${theme.colors.bg.hover}; }
    input { display: none; }
`;

// --- ICONS ---
const ArrowLeft = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
);
const PlayIcon = () => <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>;
const StopIcon = () => <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>;
const NextIcon = () => <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>;

// ============================================================
// Component
// ============================================================
export const Playlist: React.FC = () => {
    const navigate = useNavigate();
    const {
        selectedTask,
        activeTimers,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        stopAllTimers,
    } = useAppStore();

    const [selectedSubTask, setSelectedSubTask] = useState<SubTask | null>(null);
    const addToast = useAppStore((s) => s.addToast);

    // Proof submission state
    const [showProofForm, setShowProofForm] = useState(false);
    const [proofSummary, setProofSummary] = useState('');
    const [proofNotes, setProofNotes] = useState('');
    const [proofFiles, setProofFiles] = useState<File[]>([]);
    const [proofSubmitting, setProofSubmitting] = useState(false);

    // Get active timers for this task
    const taskActiveTimers = useMemo(() => {
        if (!selectedTask) return [];
        return Object.values(activeTimers).filter(
            (timer) => timer.taskId === selectedTask.id
        );
    }, [activeTimers, selectedTask]);

    // Active SubTask Logic
    const activeSubTaskTimer = taskActiveTimers.find(t => !t.isPaused);
    // If there is an active timer, prefer that subtask. Otherwise fallback to selected.
    const activeSubTask = selectedTask?.subTasks?.find(st => st.id === activeSubTaskTimer?.subTaskId) || selectedSubTask;

    // Is the currently displayed subtask running?
    const isCurrentPlaying = activeSubTask && activeTimers[activeSubTask.id] && !activeTimers[activeSubTask.id].isPaused;
    const isCurrentPaused = activeSubTask && activeTimers[activeSubTask.id] && activeTimers[activeSubTask.id].isPaused;
    const currentElapsedTime = activeSubTask && activeTimers[activeSubTask.id] ? activeTimers[activeSubTask.id].elapsedSeconds : (activeSubTask?.trackedTime || 0);

    // Calculate total duration
    const totalDuration = useMemo(() => {
        if (!selectedTask?.subTasks) return 0;
        return selectedTask.subTasks.reduce((acc, st) => {
            const activeTimer = activeTimers[st.id];
            if (activeTimer) return acc + activeTimer.elapsedSeconds;
            return acc + (st.trackedTime || 0);
        }, 0);
    }, [selectedTask, activeTimers]);

    // Progress
    const progress = useMemo(() => {
        if (!selectedTask?.subTasks || selectedTask.subTasks.length === 0) return 0;
        const completed = selectedTask.subTasks.filter((st) => st.status === 'COMPLETED').length;
        return (completed / selectedTask.subTasks.length) * 100;
    }, [selectedTask]);

    const handleSubTaskSelect = (subTask: SubTask) => {
        setSelectedSubTask(subTask);
    };

    // Handle proof submission
    const handleSubmitProof = async () => {
        if (!proofSummary.trim() || !selectedTask) return;
        setProofSubmitting(true);
        try {
            // Upload files first
            const attachmentUrls: string[] = [];
            for (const file of proofFiles) {
                if (file.size > 10 * 1024 * 1024) {
                    addToast('error', `${file.name} ফাইল ১০MB এর বেশি`);
                    setProofSubmitting(false);
                    return;
                }
                const { key } = await uploadApi.uploadFile(file);
                attachmentUrls.push(key);
            }

            await proofApi.submit({
                taskId: selectedTask.id,
                subTaskId: activeSubTask?.id,
                summary: proofSummary.trim(),
                notes: proofNotes.trim() || undefined,
                attachments: attachmentUrls,
            });

            addToast('success', 'প্রুফ সফলভাবে পাঠানো হয়েছে!');
            setShowProofForm(false);
            setProofSummary('');
            setProofNotes('');
            setProofFiles([]);
        } catch (err: any) {
            addToast('error', err.message || 'প্রুফ পাঠানো ব্যর্থ হয়েছে');
        } finally {
            setProofSubmitting(false);
        }
    };

    const handleFinishProject = () => {
        if (confirm("আপনি কি নিশ্চিত যে আপনি এই প্রজেক্টটি শেষ করতে চান? সব টাইমার বন্ধ করা হবে।")) {
            stopAllTimers();
            navigate('/dashboard');
        }
    };

    const togglePlayPause = () => {
        if (!activeSubTask || !selectedTask) return;
        if (isCurrentPlaying) {
            pauseTimer(activeSubTask.id);
        } else if (isCurrentPaused) {
            resumeTimer(activeSubTask.id);
        } else {
            startTimer(activeSubTask, selectedTask);
        }
    };

    const handleStop = () => {
        if (!activeSubTask) return;
        stopTimer(activeSubTask.id);
    };

    // Auto-select next subtask logic could go here, but keeping simple for now.

    useEffect(() => {
        if (selectedTask?.subTasks && selectedTask.subTasks.length > 0 && !selectedSubTask) {
            setSelectedSubTask(selectedTask.subTasks[0]);
        }
    }, [selectedTask, selectedSubTask]);

    if (!selectedTask) {
        return (
            <PageContainer>
                <div style={{ padding: 40, width: '100%', textAlign: 'center' }}>
                    <h2>No Task Selected</h2>
                    <BackButton onClick={() => navigate('/dashboard')} style={{ margin: '20px auto' }}>
                        <ArrowLeft /> Go Back
                    </BackButton>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            {/* LEFT COLUMN: Playlist */}
            <LeftColumn>
                <StickyHeader>
                    <BackButton onClick={() => navigate('/dashboard')}>
                        <ArrowLeft />
                    </BackButton>
                    <HeaderTitleCol>
                        <TaskTitle>{selectedTask.title}</TaskTitle>
                        <StatusBadge>{selectedTask.status}</StatusBadge>
                    </HeaderTitleCol>
                </StickyHeader>

                <PlaylistContainer>
                    {!selectedTask.subTasks || selectedTask.subTasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: theme.colors.text.muted }}>
                            No sub-tasks found.
                        </div>
                    ) : (
                        selectedTask.subTasks.map((subTask, index) => (
                            <SubTaskItem
                                key={subTask.id}
                                subTask={subTask}
                                task={selectedTask}
                                index={index}
                                onSelect={handleSubTaskSelect}
                            />
                        ))
                    )}
                </PlaylistContainer>
            </LeftColumn>

            {/* RIGHT COLUMN: Controls */}
            <RightColumn>
                <TimerSection>
                    <TotalTimeLabel>Total Time</TotalTimeLabel>
                    <BigTimerDisplay>
                        {formatDuration(totalDuration)}
                    </BigTimerDisplay>

                    <ActiveTaskCard $isPlaying={!!isCurrentPlaying}>
                        <ActiveTaskLabel>Now Playing</ActiveTaskLabel>
                        <ActiveTaskTitle>
                            {activeSubTask ? activeSubTask.title : "Select a task"}
                        </ActiveTaskTitle>

                        {/* Controls */}
                        <ControlsRow>
                            <SecondaryControlButton onClick={handleStop} disabled={!isCurrentPlaying && !isCurrentPaused} title="Stop">
                                <StopIcon />
                            </SecondaryControlButton>

                            <PlayButton $isPlaying={!!isCurrentPlaying} onClick={togglePlayPause} title={isCurrentPlaying ? "Pause" : "Start"}>
                                {isCurrentPlaying ? <PauseIcon /> : <PlayIcon />}
                            </PlayButton>

                            <SecondaryControlButton disabled title="Next">
                                <NextIcon />
                            </SecondaryControlButton>
                        </ControlsRow>

                        {activeSubTask && (
                            <div style={{ marginTop: 20, fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold' }}>
                                {formatDuration(currentElapsedTime)}
                            </div>
                        )}

                    </ActiveTaskCard>

                    <ProgressInfo>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: theme.colors.text.secondary }}>
                            <span>Overall Progress</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <ProgressBar value={progress} size="sm" />
                    </ProgressInfo>
                </TimerSection>

                <BottomActionSection>
                    {showProofForm ? (
                        <ProofForm>
                            <ProofInput
                                placeholder="কাজের সারাংশ লিখুন *"
                                value={proofSummary}
                                onChange={(e) => setProofSummary(e.target.value)}
                                maxLength={200}
                            />
                            <ProofTextarea
                                placeholder="বিস্তারিত নোট (ঐচ্ছিক)"
                                value={proofNotes}
                                onChange={(e) => setProofNotes(e.target.value)}
                            />
                            <FileUploadLabel>
                                📎 ফাইল সংযুক্ত করুন (সর্বোচ্চ ১০MB)
                                {proofFiles.length > 0 && ` — ${proofFiles.length} টি ফাইল`}
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*,.pdf,.doc,.docx,.zip"
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []).slice(0, 5);
                                        setProofFiles(files);
                                    }}
                                />
                            </FileUploadLabel>
                            <ProofSubmitRow>
                                <ProofSubmitBtn
                                    onClick={handleSubmitProof}
                                    disabled={!proofSummary.trim() || proofSubmitting}
                                >
                                    {proofSubmitting ? '⏳ পাঠানো হচ্ছে...' : '✅ প্রুফ পাঠান'}
                                </ProofSubmitBtn>
                                <ProofCancelBtn onClick={() => { setShowProofForm(false); setProofFiles([]); }}>
                                    বাতিল
                                </ProofCancelBtn>
                            </ProofSubmitRow>
                        </ProofForm>
                    ) : (
                        <ProofButton onClick={() => setShowProofForm(true)}>
                            📎 প্রুফ পাঠান
                        </ProofButton>
                    )}
                    <FinishButton onClick={handleFinishProject}>
                        🏁 Finish Project
                    </FinishButton>
                </BottomActionSection>
            </RightColumn>
        </PageContainer>
    );
};

export default Playlist;
