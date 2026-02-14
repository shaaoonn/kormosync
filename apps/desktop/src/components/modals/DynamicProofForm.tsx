// ============================================================
// KormoSync Desktop App - Dynamic Proof Form (Sprint 11)
// Renders admin-configured proof fields per task
// ============================================================

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/theme';
import { Modal, ModalFooter, Button } from '../ui';
import type { ProofField } from '../../types';
import { uploadApi, submissionApi } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

// ============================================================
// Props
// ============================================================
interface DynamicProofFormProps {
    isOpen: boolean;
    onClose: () => void;
    proofSchema: ProofField[];
    taskId: string;
    subTaskId?: string;
    taskTitle: string;
    onSubmitted: () => void;
}

// ============================================================
// Styled Components
// ============================================================
const FormContent = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.md};
    max-height: 60vh;
    overflow-y: auto;
    padding-right: ${theme.spacing.sm};
`;

const FieldGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const FieldLabel = styled.label<{ $required?: boolean }>`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
    display: flex;
    align-items: center;
    gap: 4px;

    ${({ $required }) => $required && `
        &::after {
            content: '*';
            color: ${theme.colors.status.error};
        }
    `}
`;

const TextInput = styled.input`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.fontSize.sm};
    font-family: ${theme.typography.fontFamily};
    transition: border-color 0.2s;

    &:focus {
        outline: none;
        border-color: ${theme.colors.primary.main};
    }

    &::placeholder {
        color: ${theme.colors.text.muted};
    }
`;

const TextAreaInput = styled.textarea`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.fontSize.sm};
    font-family: ${theme.typography.fontFamily};
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.2s;

    &:focus {
        outline: none;
        border-color: ${theme.colors.primary.main};
    }
`;

const SelectInput = styled.select`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.fontSize.sm};
    font-family: ${theme.typography.fontFamily};
    cursor: pointer;

    &:focus {
        outline: none;
        border-color: ${theme.colors.primary.main};
    }
`;

const CheckboxRow = styled.label`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    cursor: pointer;
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.primary};

    input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: ${theme.colors.primary.main};
        cursor: pointer;
    }
`;

const FileUploadArea = styled.div<{ $hasFile?: boolean }>`
    padding: ${theme.spacing.md};
    background: ${({ $hasFile }) => $hasFile ? `${theme.colors.status.success}10` : theme.colors.bg.tertiary};
    border: 2px dashed ${({ $hasFile }) => $hasFile ? theme.colors.status.success : theme.colors.border.secondary};
    border-radius: ${theme.borderRadius.md};
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        border-color: ${theme.colors.primary.main};
        background: ${theme.colors.primary.main}10;
    }
`;

const FileInfo = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    margin-top: 4px;
`;

const FileName = styled.div`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.status.success};
    font-weight: 600;
`;

const ErrorText = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.status.error};
    margin-top: 2px;
`;

const FormHeader = styled.div`
    padding: ${theme.spacing.md};
    background: ${theme.colors.primary.main}10;
    border: 1px solid ${theme.colors.primary.main}30;
    border-radius: ${theme.borderRadius.md};
    text-align: center;
`;

const FormHeaderTitle = styled.div`
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
    margin-bottom: 4px;
`;

const FormHeaderSub = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

// ============================================================
// Component
// ============================================================
const DynamicProofForm: React.FC<DynamicProofFormProps> = ({
    isOpen,
    onClose,
    proofSchema,
    taskId,
    subTaskId,
    taskTitle,
    onSubmitted,
}) => {
    const addToast = useAppStore((s) => s.addToast);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [fileNames, setFileNames] = useState<Record<string, string>>({});
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const updateAnswer = useCallback((fieldId: string, value: any) => {
        setAnswers(prev => ({ ...prev, [fieldId]: value }));
        setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
    }, []);

    const handleFileUpload = useCallback(async (fieldId: string, file: File) => {
        if (file.size > 100 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, [fieldId]: 'ফাইল ১০০MB এর বেশি হতে পারবে না' }));
            return;
        }
        setUploading(true);
        try {
            const result = await uploadApi.uploadFile(file);
            updateAnswer(fieldId, result.key);
            setFileNames(prev => ({ ...prev, [fieldId]: file.name }));
        } catch (err: any) {
            setErrors(prev => ({ ...prev, [fieldId]: 'আপলোড ব্যর্থ: ' + (err.message || 'Unknown') }));
        } finally {
            setUploading(false);
        }
    }, [updateAnswer]);

    const validate = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};
        for (const field of proofSchema) {
            if (field.required) {
                const val = answers[field.id];
                if (val === undefined || val === null || val === '') {
                    newErrors[field.id] = `"${field.label}" পূরণ করুন`;
                }
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [proofSchema, answers]);

    const handleSubmit = useCallback(async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            // Convert NUMBER fields
            const processedAnswers = { ...answers };
            for (const field of proofSchema) {
                if (field.type === 'NUMBER' && processedAnswers[field.id] !== undefined) {
                    processedAnswers[field.id] = Number(processedAnswers[field.id]);
                }
            }

            await submissionApi.submit({
                taskId,
                subTaskId,
                answers: processedAnswers,
            });
            addToast('success', 'প্রুফ ফর্ম সফলভাবে জমা হয়েছে!');
            onSubmitted();
            onClose();
        } catch (err: any) {
            addToast('error', err.message || 'প্রুফ জমা ব্যর্থ');
        } finally {
            setSubmitting(false);
        }
    }, [answers, proofSchema, taskId, subTaskId, validate, addToast, onSubmitted, onClose]);

    const renderField = (field: ProofField) => {
        switch (field.type) {
            case 'TEXT':
                return (
                    <TextAreaInput
                        placeholder={field.label + '...'}
                        value={answers[field.id] || ''}
                        onChange={(e) => updateAnswer(field.id, e.target.value)}
                    />
                );

            case 'NUMBER':
                return (
                    <TextInput
                        type="number"
                        placeholder="0"
                        value={answers[field.id] ?? ''}
                        onChange={(e) => updateAnswer(field.id, e.target.value)}
                    />
                );

            case 'FILE':
                return (
                    <>
                        <FileUploadArea
                            $hasFile={!!answers[field.id]}
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '*/*';
                                input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) handleFileUpload(field.id, file);
                                };
                                input.click();
                            }}
                        >
                            {answers[field.id] ? (
                                <>
                                    <FileName>✅ {fileNames[field.id] || 'ফাইল আপলোড হয়েছে'}</FileName>
                                    <FileInfo>পরিবর্তন করতে ক্লিক করুন</FileInfo>
                                </>
                            ) : (
                                <>
                                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📎</div>
                                    <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary }}>
                                        {uploading ? '⏳ আপলোড হচ্ছে...' : 'ফাইল আপলোড করুন'}
                                    </div>
                                    <FileInfo>সর্বোচ্চ ১০০MB</FileInfo>
                                </>
                            )}
                        </FileUploadArea>
                    </>
                );

            case 'DROPDOWN':
                return (
                    <SelectInput
                        value={answers[field.id] || ''}
                        onChange={(e) => updateAnswer(field.id, e.target.value)}
                    >
                        <option value="">-- নির্বাচন করুন --</option>
                        {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </SelectInput>
                );

            case 'CHECKBOX':
                return (
                    <CheckboxRow>
                        <input
                            type="checkbox"
                            checked={!!answers[field.id]}
                            onChange={(e) => updateAnswer(field.id, e.target.checked)}
                        />
                        {field.label}
                    </CheckboxRow>
                );

            default:
                return null;
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="📋 প্রুফ ফর্ম"
            size="md"
        >
            <FormContent>
                <FormHeader>
                    <FormHeaderTitle>{taskTitle}</FormHeaderTitle>
                    <FormHeaderSub>নিচের তথ্যগুলো পূরণ করুন</FormHeaderSub>
                </FormHeader>

                {proofSchema.map((field) => (
                    <FieldGroup key={field.id}>
                        {field.type !== 'CHECKBOX' && (
                            <FieldLabel $required={field.required}>{field.label}</FieldLabel>
                        )}
                        {renderField(field)}
                        {errors[field.id] && <ErrorText>⚠️ {errors[field.id]}</ErrorText>}
                    </FieldGroup>
                ))}
            </FormContent>

            <ModalFooter>
                <Button variant="ghost" onClick={onClose} disabled={submitting}>
                    বাতিল
                </Button>
                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={submitting || uploading}
                >
                    {submitting ? '⏳ জমা হচ্ছে...' : '✅ জমা দিন'}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default DynamicProofForm;
