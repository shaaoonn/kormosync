// ============================================================
// KormoSync Desktop App - Leave Request Page
// Employee can request leave and view their requests
// ============================================================

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { Card, Badge } from '../components/ui';
import { leaveApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { LeaveRequest as LeaveRequestType, LeaveBalance } from '../types';

// ============================================================
// Styled Components
// ============================================================
const PageWrapper = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: ${theme.colors.bg.primary};
    overflow: hidden;
`;

const Header = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    border-bottom: 1px solid ${theme.colors.border.primary};
    background: ${theme.colors.bg.secondary};
    flex-shrink: 0;
`;

const HeaderTitle = styled.h1`
    margin: 0;
    font-size: ${theme.typography.fontSize.lg};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
`;

const Content = styled.main`
    flex: 1;
    overflow-y: auto;
    padding: ${theme.spacing.lg} ${theme.spacing.xl};
`;

// Balance Cards
const BalanceGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${theme.spacing.md};
    margin-bottom: ${theme.spacing.xl};
`;

const BalanceCard = styled.div<{ $color: string }>`
    background: ${theme.colors.bg.secondary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
    padding: ${theme.spacing.lg};
    text-align: center;
    border-top: 3px solid ${({ $color }) => $color};
`;

const BalanceValue = styled.div`
    font-size: ${theme.typography.fontSize['2xl']};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
`;

const BalanceLabel = styled.div`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
    margin-top: 4px;
`;

const BalanceUsed = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    margin-top: 2px;
`;

// Form
const FormSection = styled.div`
    background: ${theme.colors.bg.secondary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
    padding: ${theme.spacing.xl};
    margin-bottom: ${theme.spacing.xl};
`;

const FormTitle = styled.h3`
    margin: 0 0 ${theme.spacing.lg} 0;
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
`;

const FormRow = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${theme.spacing.md};
    margin-bottom: ${theme.spacing.md};
`;

const FormGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const Label = styled.label`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.secondary};
`;

const Select = styled.select`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.fontSize.sm};
    font-family: ${theme.typography.fontFamily};
    outline: none;
    &:focus {
        border-color: ${theme.colors.primary.main};
    }
`;

const Input = styled.input`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.fontSize.sm};
    font-family: ${theme.typography.fontFamily};
    outline: none;
    &:focus {
        border-color: ${theme.colors.primary.main};
    }
`;

const Textarea = styled.textarea`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.fontSize.sm};
    font-family: ${theme.typography.fontFamily};
    outline: none;
    resize: vertical;
    min-height: 80px;
    &:focus {
        border-color: ${theme.colors.primary.main};
    }
`;

const SubmitButton = styled.button`
    padding: ${theme.spacing.sm} ${theme.spacing.xl};
    background: ${theme.colors.primary.main};
    color: ${theme.colors.bg.primary};
    border: none;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.semibold};
    font-family: ${theme.typography.fontFamily};
    cursor: pointer;
    transition: all 0.2s;
    margin-top: ${theme.spacing.sm};
    &:hover {
        background: ${theme.colors.primary.hover};
        transform: translateY(-1px);
    }
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
    }
`;

// Request List
const RequestList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
`;

const RequestCard = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing.md} ${theme.spacing.lg};
    background: ${theme.colors.bg.secondary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
    transition: all 0.2s;
    &:hover {
        border-color: ${theme.colors.border.secondary};
    }
`;

const RequestInfo = styled.div`
    flex: 1;
`;

const RequestType = styled.div`
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
    margin-bottom: 4px;
`;

const RequestMeta = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    display: flex;
    gap: ${theme.spacing.md};
    flex-wrap: wrap;
`;

const RequestActions = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
`;

const CancelBtn = styled.button`
    padding: 4px 12px;
    background: transparent;
    color: ${theme.colors.status.error};
    border: 1px solid ${theme.colors.status.error}40;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.xs};
    cursor: pointer;
    transition: all 0.2s;
    &:hover {
        background: ${theme.colors.status.error}15;
    }
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const SectionTitle = styled.h3`
    margin: 0 0 ${theme.spacing.md} 0;
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
`;

// ============================================================
// Helper
// ============================================================
const LEAVE_TYPE_LABELS: Record<string, string> = {
    PAID: 'বেতনসহ ছুটি',
    UNPAID: 'বিনা বেতনে ছুটি',
    SICK: 'অসুস্থতাজনিত ছুটি',
    HALF_DAY: 'অর্ধদিবস',
};

const STATUS_LABELS: Record<string, string> = {
    PENDING: 'অপেক্ষমাণ',
    APPROVED: 'অনুমোদিত',
    REJECTED: 'প্রত্যাখ্যাত',
    CANCELLED: 'বাতিল',
};

const STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'error' | 'primary'> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'error',
    CANCELLED: 'error',
};

// ============================================================
// Component
// ============================================================
export const LeaveRequestPage: React.FC = () => {
    const addToast = useAppStore((s) => s.addToast);
    const [balance, setBalance] = useState<LeaveBalance | null>(null);
    const [requests, setRequests] = useState<LeaveRequestType[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    // Form state
    const [leaveType, setLeaveType] = useState('PAID');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bal, reqs] = await Promise.all([
                leaveApi.getMyBalance(),
                leaveApi.getMyRequests(),
            ]);
            setBalance(bal);
            setRequests(reqs);
        } catch (err: any) {
            console.error('Failed to fetch leave data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate) {
            addToast('error', 'শুরু ও শেষ তারিখ দিন');
            return;
        }
        setSubmitting(true);
        try {
            await leaveApi.requestLeave({
                type: leaveType,
                startDate,
                endDate,
                reason: reason || undefined,
            });
            addToast('success', 'ছুটির আবেদন সফলভাবে জমা দেওয়া হয়েছে!');
            setStartDate('');
            setEndDate('');
            setReason('');
            fetchData();
        } catch (err: any) {
            addToast('error', err.message || 'ছুটির আবেদন ব্যর্থ হয়েছে');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async (id: string) => {
        setCancellingId(id);
        try {
            await leaveApi.cancel(id);
            addToast('success', 'ছুটির আবেদন বাতিল হয়েছে');
            fetchData();
        } catch (err: any) {
            addToast('error', err.message || 'বাতিল করা যায়নি');
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <PageWrapper>
            <Header>
                <HeaderTitle>🏖️ ছুটি ব্যবস্থাপনা</HeaderTitle>
            </Header>

            <Content>
                {/* Balance Cards */}
                {balance && (
                    <BalanceGrid>
                        <BalanceCard $color={theme.colors.status.success}>
                            <BalanceValue>{balance.paidRemaining ?? (balance.paidLeave - balance.paidUsed)}</BalanceValue>
                            <BalanceLabel>বেতনসহ ছুটি বাকি</BalanceLabel>
                            <BalanceUsed>{balance.paidUsed}/{balance.paidLeave} ব্যবহৃত</BalanceUsed>
                        </BalanceCard>
                        <BalanceCard $color={theme.colors.status.warning}>
                            <BalanceValue>{balance.sickRemaining ?? (balance.sickLeave - balance.sickUsed)}</BalanceValue>
                            <BalanceLabel>অসুস্থতা ছুটি বাকি</BalanceLabel>
                            <BalanceUsed>{balance.sickUsed}/{balance.sickLeave} ব্যবহৃত</BalanceUsed>
                        </BalanceCard>
                        <BalanceCard $color={theme.colors.status.info}>
                            <BalanceValue>{balance.unpaidUsed}</BalanceValue>
                            <BalanceLabel>বিনা বেতনে ছুটি নেওয়া</BalanceLabel>
                            <BalanceUsed>কোনো সীমা নেই</BalanceUsed>
                        </BalanceCard>
                    </BalanceGrid>
                )}

                {/* Request Form */}
                <FormSection>
                    <FormTitle>নতুন ছুটির আবেদন</FormTitle>
                    <form onSubmit={handleSubmit}>
                        <FormRow>
                            <FormGroup>
                                <Label>ছুটির ধরন</Label>
                                <Select
                                    value={leaveType}
                                    onChange={(e) => setLeaveType(e.target.value)}
                                >
                                    <option value="PAID">বেতনসহ ছুটি</option>
                                    <option value="SICK">অসুস্থতাজনিত ছুটি</option>
                                    <option value="UNPAID">বিনা বেতনে ছুটি</option>
                                    <option value="HALF_DAY">অর্ধদিবস</option>
                                </Select>
                            </FormGroup>
                            <FormGroup>
                                <Label>কারণ (ঐচ্ছিক)</Label>
                                <Input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="ছুটির কারণ লিখুন..."
                                />
                            </FormGroup>
                        </FormRow>
                        <FormRow>
                            <FormGroup>
                                <Label>শুরু তারিখ</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        if (!endDate || e.target.value > endDate) {
                                            setEndDate(e.target.value);
                                        }
                                    }}
                                />
                            </FormGroup>
                            <FormGroup>
                                <Label>শেষ তারিখ</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    min={startDate}
                                />
                            </FormGroup>
                        </FormRow>
                        <SubmitButton type="submit" disabled={submitting || !startDate || !endDate}>
                            {submitting ? 'জমা দেওয়া হচ্ছে...' : '📤 আবেদন জমা দিন'}
                        </SubmitButton>
                    </form>
                </FormSection>

                {/* My Requests */}
                <SectionTitle>
                    📋 আমার ছুটির আবেদনসমূহ
                    <Badge variant="primary" size="sm">{requests.length}</Badge>
                </SectionTitle>
                <RequestList>
                    {requests.length === 0 && !loading && (
                        <div style={{ textAlign: 'center', padding: '40px', color: theme.colors.text.muted }}>
                            কোনো ছুটির আবেদন নেই
                        </div>
                    )}
                    {requests.map((req) => (
                        <RequestCard key={req.id}>
                            <RequestInfo>
                                <RequestType>
                                    {LEAVE_TYPE_LABELS[req.type] || req.type}
                                </RequestType>
                                <RequestMeta>
                                    <span>
                                        📅 {new Date(req.startDate).toLocaleDateString('bn-BD')}
                                        {req.startDate !== req.endDate && ` - ${new Date(req.endDate).toLocaleDateString('bn-BD')}`}
                                    </span>
                                    <span>📊 {req.totalDays} দিন</span>
                                    {req.reason && <span>💬 {req.reason}</span>}
                                    {req.rejectedReason && <span style={{ color: theme.colors.status.error }}>❌ {req.rejectedReason}</span>}
                                </RequestMeta>
                            </RequestInfo>
                            <RequestActions>
                                <Badge variant={STATUS_VARIANTS[req.status] || 'primary'} size="sm">
                                    {STATUS_LABELS[req.status] || req.status}
                                </Badge>
                                {req.status === 'PENDING' && (
                                    <CancelBtn
                                        onClick={() => handleCancel(req.id)}
                                        disabled={cancellingId === req.id}
                                    >
                                        {cancellingId === req.id ? '...' : '🗑️ বাতিল'}
                                    </CancelBtn>
                                )}
                            </RequestActions>
                        </RequestCard>
                    ))}
                </RequestList>
            </Content>
        </PageWrapper>
    );
};

export default LeaveRequestPage;
