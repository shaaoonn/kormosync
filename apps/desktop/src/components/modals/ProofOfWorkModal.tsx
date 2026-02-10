// ============================================================
// KormoSync Desktop App - Proof of Work Modal
// Submit work proof when stopping a timer
// ============================================================

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/theme';
import { Modal, ModalFooter, Button, Input, TextArea, ProgressBar } from '../ui';
import { formatDuration, formatMoney } from '../../utils/formatters';
import type { SubTask, Task } from '../../types';
import { uploadApi } from '../../services/api';
import { UPLOAD_LIMITS } from '../../utils/constants';

// ============================================================
// Types
// ============================================================
interface ProofOfWorkModalProps {
    isOpen: boolean;
    onClose: () => void;
    subTask: SubTask | null;
    task: Task | null;
    trackedTime: number;
    onSubmit: (proof: ProofOfWorkData) => void;
}

export interface ProofOfWorkData {
    summary: string;
    notes: string;
    completionPercent: number;
    screenshots?: string[];
    attachments?: { url: string; key: string; filename: string }[];
}

interface FileValidation {
    isValid: boolean;
    error?: string;
}

// ============================================================
// Styled Components
// ============================================================
const ModalContent = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.lg};
`;

const SessionSummary = styled.div`
    padding: ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.lg};
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${theme.spacing.md};
`;

const SummaryItem = styled.div`
    text-align: center;
`;

const SummaryValue = styled.div`
    font-size: ${theme.typography.fontSize.xl};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
`;

const SummaryLabel = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    margin-top: 2px;
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
`;

const SectionLabel = styled.label`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.secondary};
`;

const CompletionSlider = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
`;

const SliderWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
`;

const Slider = styled.input`
    flex: 1;
    -webkit-appearance: none;
    height: 8px;
    border-radius: 4px;
    background: ${theme.colors.bg.tertiary};
    outline: none;

    &::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: ${theme.colors.primary.main};
        cursor: pointer;
        transition: all ${theme.animation.duration.fast};

        &:hover {
            transform: scale(1.1);
            box-shadow: ${theme.shadows.md};
        }
    }
`;

const SliderValue = styled.span`
    font-size: ${theme.typography.fontSize.lg};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.primary.main};
    min-width: 50px;
    text-align: right;
`;

const QuickSelectButtons = styled.div`
    display: flex;
    gap: ${theme.spacing.xs};
`;

const QuickButton = styled.button<{ $active: boolean }>`
    padding: 4px 12px;
    border-radius: ${theme.borderRadius.full};
    border: 1px solid ${({ $active }) =>
        $active ? theme.colors.primary.main : theme.colors.border.primary};
    background: ${({ $active }) =>
        $active ? theme.colors.primary.main : 'transparent'};
    color: ${({ $active }) =>
        $active ? 'white' : theme.colors.text.secondary};
    font-size: ${theme.typography.fontSize.xs};
    cursor: pointer;
    transition: all ${theme.animation.duration.fast};

    &:hover {
        border-color: ${theme.colors.primary.main};
    }
`;

const TaskInfo = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    padding: ${theme.spacing.md};
    background: ${theme.colors.primary.main}10;
    border: 1px solid ${theme.colors.primary.main}30;
    border-radius: ${theme.borderRadius.lg};
`;

const TaskIcon = styled.div`
    width: 48px;
    height: 48px;
    background: ${theme.colors.primary.main}20;
    border-radius: ${theme.borderRadius.lg};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
`;

const TaskDetails = styled.div`
    flex: 1;
`;

const TaskName = styled.div`
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
`;

const SubTaskName = styled.div`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
`;

const FooterButtons = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${theme.spacing.sm};
`;

const DropZone = styled.div<{ $isDragActive: boolean }>`
    border: 2px dashed ${({ $isDragActive }) =>
        $isDragActive ? theme.colors.primary.main : theme.colors.border.primary};
    background: ${({ $isDragActive }) =>
        $isDragActive ? theme.colors.primary.main + '10' : theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.md};
    padding: ${theme.spacing.lg};
    text-align: center;
    cursor: pointer;
    transition: all ${theme.animation.duration.fast};
    
    &:hover {
        border-color: ${theme.colors.primary.main};
    }
`;

const DropZoneText = styled.div`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.fontSize.sm};
    margin-top: ${theme.spacing.sm};
`;

const FileList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.xs};
    margin-top: ${theme.spacing.sm};
`;

const FileItem = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing.sm};
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.sm};
    font-size: ${theme.typography.fontSize.sm};
`;

const FileInfo = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    overflow: hidden;
`;

const FileName = styled.span`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
    color: ${theme.colors.text.primary};
`;

const FileSize = styled.span`
    color: ${theme.colors.text.muted};
    font-size: ${theme.typography.fontSize.xs};
`;

const RemoveButton = styled.button`
    background: none;
    border: none;
    color: ${theme.colors.text.muted};
    cursor: pointer;
    padding: 4px;
    
    &:hover {
        color: ${theme.colors.status.error};
    }
`;

// ============================================================
// Component
// ============================================================
export const ProofOfWorkModal: React.FC<ProofOfWorkModalProps> = ({
    isOpen,
    onClose,
    subTask,
    task,
    trackedTime,
    onSubmit,
}) => {
    const [summary, setSummary] = useState('');
    const [notes, setNotes] = useState('');
    const [completionPercent, setCompletionPercent] = useState(50);
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);

    const quickSelectValues = [0, 25, 50, 75, 100];

    // Calculate earnings
    const earnings = task?.hourlyRate
        ? (trackedTime / 3600) * task.hourlyRate
        : 0;

    const validateFile = (file: File): FileValidation => {
        if (file.size > UPLOAD_LIMITS.maxFileSize) {
            return { isValid: false, error: 'ফাইল সাইজ ১০০ মেগাবাইটের বেশি হতে পারবে না' };
        }
        // Simplified check, could use regex on type for 'image/*', etc.
        // For now trusting UPLOAD_LIMITS but not strictly enforcing type check here as UI feedback
        // Just checking if user exceeds total count
        if (files.length >= UPLOAD_LIMITS.maxFiles) {
            return { isValid: false, error: `সর্বোচ্চ ${UPLOAD_LIMITS.maxFiles} টি ফাইল আপলোড করা যাবে` };
        }
        return { isValid: true };
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const validFiles: File[] = [];

            for (const file of newFiles) {
                const validation = validateFile(file);
                if (validation.isValid) {
                    validFiles.push(file);
                } else {
                    // Could show toast error here
                    console.warn(validation.error);
                }
            }

            setFiles(prev => [...prev, ...validFiles].slice(0, UPLOAD_LIMITS.maxFiles));
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(false);

        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files);
            const validFiles: File[] = [];

            for (const file of newFiles) {
                const validation = validateFile(file);
                if (validation.isValid) {
                    validFiles.push(file);
                }
            }

            setFiles(prev => [...prev, ...validFiles].slice(0, UPLOAD_LIMITS.maxFiles));
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = useCallback(async () => {
        if (!summary.trim()) return;

        setIsSubmitting(true);
        try {
            // Upload files first
            const uploadedAttachments = [];
            if (files.length > 0) {
                for (const file of files) {
                    try {
                        const { url, key } = await uploadApi.uploadFile(file);
                        uploadedAttachments.push({
                            url,
                            key,
                            filename: file.name
                        });
                    } catch (err) {
                        console.error(`Failed to upload ${file.name}`, err);
                        // Start partial failure handling or abort? For now continue with what succeeded
                    }
                }
            }

            await onSubmit({
                summary: summary.trim(),
                notes: notes.trim(),
                completionPercent,
                attachments: uploadedAttachments
            });

            // Reset form
            setSummary('');
            setNotes('');
            setCompletionPercent(50);
            setFiles([]);
            onClose();
        } catch (error) {
            console.error('Failed to submit proof of work:', error);
        } finally {
            setIsSubmitting(false);
        }
    }, [summary, notes, completionPercent, files, onSubmit, onClose]);

    const handleSkip = useCallback(() => {
        onSubmit({
            summary: 'কাজ সম্পন্ন',
            notes: '',
            completionPercent: 0,
        });
        onClose();
    }, [onSubmit, onClose]);

    if (!subTask || !task) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="কাজের প্রমাণ জমা দিন"
            subtitle="আপনি কি সম্পন্ন করেছেন তা জানান"
            size="md"
            closeOnOverlay={false}
            closeOnEscape={false}
        >
            <ModalContent>
                {/* Task Info */}
                <TaskInfo>
                    <TaskIcon>{task.icon || '📋'}</TaskIcon>
                    <TaskDetails>
                        <TaskName>{task.title}</TaskName>
                        <SubTaskName>{subTask.title}</SubTaskName>
                    </TaskDetails>
                </TaskInfo>

                {/* Session Summary */}
                <SessionSummary>
                    <SummaryItem>
                        <SummaryValue>{formatDuration(trackedTime)}</SummaryValue>
                        <SummaryLabel>সময়কাল</SummaryLabel>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryValue style={{ color: theme.colors.status.success }}>
                            {formatMoney(earnings, task.currency || 'BDT')}
                        </SummaryValue>
                        <SummaryLabel>আয়</SummaryLabel>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryValue>{completionPercent}%</SummaryValue>
                        <SummaryLabel>সম্পন্নতা</SummaryLabel>
                    </SummaryItem>
                </SessionSummary>

                {/* Summary Input */}
                <Section>
                    <SectionLabel>কি কাজ করলেন? *</SectionLabel>
                    <Input
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="উদাহরণ: হোমপেজ ডিজাইন সম্পন্ন করেছি"
                        fullWidth
                    />
                </Section>

                {/* Completion Percentage */}
                <Section>
                    <SectionLabel>সাবটাস্ক কতটুকু সম্পন্ন?</SectionLabel>
                    <CompletionSlider>
                        <SliderWrapper>
                            <Slider
                                type="range"
                                min={0}
                                max={100}
                                value={completionPercent}
                                onChange={(e) => setCompletionPercent(Number(e.target.value))}
                            />
                            <SliderValue>{completionPercent}%</SliderValue>
                        </SliderWrapper>
                        <QuickSelectButtons>
                            {quickSelectValues.map((value) => (
                                <QuickButton
                                    key={value}
                                    $active={completionPercent === value}
                                    onClick={() => setCompletionPercent(value)}
                                >
                                    {value}%
                                </QuickButton>
                            ))}
                        </QuickSelectButtons>
                        <ProgressBar
                            value={completionPercent}
                            variant={
                                completionPercent === 100
                                    ? 'success'
                                    : completionPercent >= 50
                                        ? 'primary'
                                        : 'warning'
                            }
                            size="sm"
                        />
                    </CompletionSlider>
                </Section>

                {/* File Upload */}
                <Section>
                    <SectionLabel>ফাইল যুক্ত করুন (ঐচ্ছিক)</SectionLabel>
                    <DropZone
                        $isDragActive={isDragActive}
                        onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                        onDragLeave={() => setIsDragActive(false)}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('file-upload')?.click()}
                    >
                        <input
                            id="file-upload"
                            type="file"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        <div style={{ fontSize: '24px' }}>📁</div>
                        <DropZoneText>
                            ফাইল এখানে ড্রপ করুন অথবা ক্লিক করে সিলেক্ট করুন
                        </DropZoneText>
                    </DropZone>

                    {files.length > 0 && (
                        <FileList>
                            {files.map((file, index) => (
                                <FileItem key={index}>
                                    <FileInfo>
                                        <FileName>{file.name}</FileName>
                                        <FileSize>({(file.size / 1024 / 1024).toFixed(2)} MB)</FileSize>
                                    </FileInfo>
                                    <RemoveButton onClick={() => removeFile(index)}>❌</RemoveButton>
                                </FileItem>
                            ))}
                        </FileList>
                    )}
                </Section>

                {/* Additional Notes */}
                <Section>
                    <SectionLabel>অতিরিক্ত নোট (ঐচ্ছিক)</SectionLabel>
                    <TextArea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="কোনো সমস্যা বা মন্তব্য থাকলে লিখুন..."
                        rows={3}
                        fullWidth
                    />
                </Section>
            </ModalContent>

            <ModalFooter>
                <FooterButtons>
                    <Button
                        variant="ghost"
                        onClick={handleSkip}
                        disabled={isSubmitting}
                    >
                        এড়িয়ে যান
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        disabled={!summary.trim()}
                    >
                        {isSubmitting ? 'আপলোড হচ্ছে...' : 'জমা দিন'}
                    </Button>
                </FooterButtons>
            </ModalFooter>
        </Modal>
    );
};

export default ProofOfWorkModal;
