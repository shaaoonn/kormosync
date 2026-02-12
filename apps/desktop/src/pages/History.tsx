import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { Card, ProgressBar, SkeletonList } from '../components/ui';
import { timeLogApi } from '../services/api';
import {
    formatDateBengali,
    formatTimeBengali,
    formatDuration
} from '../utils/formatters';
import {
    cacheHistoryLogs,
    getCachedHistoryLogs,
    type CachedTimeLog,
} from '../utils/historyCache';
import { getQueuedScreenshots } from '../utils/offlineQueue';

const PageWrapper = styled.div`
    display: flex;
    flex-direction: column;
    padding: ${theme.spacing.lg};
    gap: ${theme.spacing.xl};
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const Title = styled.h1`
    margin: 0;
    font-size: ${theme.typography.fontSize.xl};
    color: ${theme.colors.text.primary};
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
`;

const DateControls = styled.div`
    display: flex;
    gap: ${theme.spacing.sm};
    align-items: center;
`;

const DateButton = styled.button<{ $active?: boolean }>`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${({ $active }) => $active ? theme.colors.primary.main : theme.colors.bg.tertiary};
    color: ${({ $active }) => $active ? 'white' : theme.colors.text.primary};
    border: 1px solid ${({ $active }) => $active ? theme.colors.primary.main : theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    cursor: pointer;
    font-size: ${theme.typography.fontSize.sm};
    transition: all 0.2s;

    &:hover {
        background: ${({ $active }) => $active ? theme.colors.primary.main : theme.colors.bg.hover};
    }
`;

const StyledDateInput = styled.input`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    color: ${theme.colors.text.primary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    font-family: inherit;
    color-scheme: dark;
`;

const SummaryCards = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${theme.spacing.md};
`;

const SummaryCard = styled(Card)`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    padding: ${theme.spacing.lg};
`;

const SummaryIcon = styled.div<{ $color: string }>`
    width: 48px;
    height: 48px;
    border-radius: ${theme.borderRadius.lg};
    background: ${({ $color }) => $color}15;
    color: ${({ $color }) => $color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
`;

const SummaryInfo = styled.div`
    display: flex;
    flex-direction: column;
`;

const SummaryValue = styled.div`
    font-size: ${theme.typography.fontSize.xl};
    font-weight: bold;
    color: ${theme.colors.text.primary};
`;

const SummaryLabel = styled.div`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
`;

const TimelineContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.md};
`;

const EmptyState = styled.div`
    text-align: center;
    padding: ${theme.spacing['3xl']};
    color: ${theme.colors.text.muted};
    background: ${theme.colors.bg.secondary};
    border-radius: ${theme.borderRadius.lg};
    border: 1px dashed ${theme.colors.border.primary};
`;

const TimelineGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
`;

const GroupHeader = styled.div`
    font-size: ${theme.typography.fontSize.md};
    font-weight: bold;
    color: ${theme.colors.text.primary};
    margin-bottom: ${theme.spacing.xs};
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
`;

const LogCard = styled(Card)`
    display: flex;
    gap: ${theme.spacing.md};
    padding: ${theme.spacing.md};
    align-items: flex-start;
`;

const Thumbnail = styled.div<{ $src?: string }>`
    width: 120px;
    height: 68px;
    background-color: ${theme.colors.bg.tertiary};
    background-image: ${({ $src }) => $src ? `url(${$src})` : 'none'};
    background-size: cover;
    background-position: center;
    border-radius: ${theme.borderRadius.md};
    border: 1px solid ${theme.colors.border.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${theme.colors.text.muted};
    font-size: 24px;
    flex-shrink: 0;
`;

const LogContent = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.xs};
`;

const LogTitle = styled.div`
    font-size: ${theme.typography.fontSize.md};
    font-weight: 500;
    color: ${theme.colors.text.primary};
    display: flex;
    justify-content: space-between;
`;

const LogTime = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
    font-family: monospace;
`;

const ActivityBar = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    margin-top: ${theme.spacing.xs};
`;

const ActivityLabel = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.secondary};
    width: 80px;
`;

interface TimeLog {
    id: string;
    recordedAt: string;
    imageUrl?: string;
    activityScore: number;
    keyboardCount: number;
    mouseCount: number;
    duration: number; // in seconds
    taskId?: string;
    synced?: boolean; // true = server, false/undefined = pending
}

// Full-Screen Screenshot Modal (Read-Only)
const ModalOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.92);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${theme.spacing.lg};
`;

const ModalContent = styled.div`
    display: flex;
    flex-direction: column;
    max-width: 95vw;
    max-height: 95vh;
    gap: ${theme.spacing.md};
    position: relative;
`;

const ModalImage = styled.img`
    max-width: 100%;
    max-height: 75vh;
    object-fit: contain;
    border-radius: ${theme.borderRadius.lg};
    border: 1px solid ${theme.colors.border.primary};
`;

const ModalInfoBar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: ${theme.colors.bg.secondary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
    padding: ${theme.spacing.md} ${theme.spacing.lg};
    gap: ${theme.spacing.lg};
`;

const ModalStat = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
`;

const ModalStatValue = styled.span`
    font-size: ${theme.typography.fontSize.lg};
    font-weight: bold;
    color: ${theme.colors.text.primary};
`;

const ModalStatLabel = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
`;

const CloseButton = styled.button`
    position: absolute;
    top: -40px;
    right: 0;
    background: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    color: ${theme.colors.text.primary};
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: all 0.2s;

    &:hover {
        background: ${theme.colors.status.error};
        color: white;
    }
`;

const ScoreBadge = styled.span<{ $score: number }>`
    padding: 4px 12px;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: bold;
    background: ${({ $score }) => $score >= 70 ? theme.colors.status.success : $score >= 40 ? theme.colors.status.warning : theme.colors.status.error}20;
    color: ${({ $score }) => $score >= 70 ? theme.colors.status.success : $score >= 40 ? theme.colors.status.warning : theme.colors.status.error};
`;

const SyncBadge = styled.span<{ $synced: boolean }>`
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
    background: ${({ $synced }) => $synced ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)'};
    color: ${({ $synced }) => $synced ? '#22c55e' : '#eab308'};
    border: 1px solid ${({ $synced }) => $synced ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'};
`;

const History: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<TimeLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<TimeLog | null>(null);

    // Auto-refresh: poll for new entries every 30s when on today's date
    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    // Cache object URLs to prevent memory leaks from repeated createObjectURL calls
    const blobUrlCache = React.useRef<Map<number, string>>(new Map());

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            blobUrlCache.current.forEach(url => URL.revokeObjectURL(url));
            blobUrlCache.current.clear();
        };
    }, []);

    // Load pending offline screenshots and merge them into displayed logs
    const mergeOfflineEntries = useCallback(async (baseLogs: TimeLog[]): Promise<TimeLog[]> => {
        try {
            const queued = await getQueuedScreenshots();
            if (queued.length === 0) return baseLogs;

            // Filter queued screenshots for the selected date
            const dateStr = selectedDate;
            const pendingForDate = queued.filter(q => q.capturedAt.startsWith(dateStr));
            if (pendingForDate.length === 0) return baseLogs;

            // Convert queued screenshots to TimeLog format
            const pendingLogs: TimeLog[] = pendingForDate.map(q => {
                // Reuse cached blob URL or create a new one
                let blobUrl = blobUrlCache.current.get(q.id);
                if (!blobUrl && q.imageBlob) {
                    blobUrl = URL.createObjectURL(q.imageBlob);
                    blobUrlCache.current.set(q.id, blobUrl);
                }
                return {
                    id: `pending-${q.id}`,
                    recordedAt: q.capturedAt,
                    imageUrl: blobUrl,
                    activityScore: q.activeSeconds > 0 ? Math.round(((q.keystrokes + q.mouseClicks) / q.activeSeconds) * 10) : 0,
                    keyboardCount: q.keystrokes,
                    mouseCount: q.mouseClicks,
                    duration: q.activeSeconds,
                    taskId: q.taskId,
                    synced: false,
                };
            });

            // Merge: avoid duplicates by timestamp
            const existingTimestamps = new Set(baseLogs.map(l => new Date(l.recordedAt).getTime()));
            const newPending = pendingLogs.filter(p => !existingTimestamps.has(new Date(p.recordedAt).getTime()));

            const merged = [...baseLogs, ...newPending].sort(
                (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
            );

            return merged;
        } catch (e) {
            console.warn('Failed to load offline queue entries:', e);
            return baseLogs;
        }
    }, [selectedDate]);

    const fetchLogs = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);

        // STEP 1: Instantly load from cache
        let cachedLogs: TimeLog[] = [];
        try {
            const cached = await getCachedHistoryLogs(selectedDate);
            if (cached && cached.logs.length > 0) {
                cachedLogs = cached.logs as TimeLog[];
                console.log(`📋 Showing ${cached.logs.length} cached history entries`);
            }
        } catch (e) {
            console.warn('Cache read failed:', e);
        }

        // STEP 1.5: Merge offline queue entries into cached logs
        const logsWithPending = await mergeOfflineEntries(cachedLogs);
        if (logsWithPending.length > 0) {
            setLogs(logsWithPending);
            if (showLoader) setLoading(false);
        }

        // STEP 2: If offline, show cached + pending and stop
        if (!navigator.onLine) {
            if (logsWithPending.length === 0) setLogs([]);
            setLoading(false);
            return;
        }

        // STEP 3: Fetch fresh from API in background
        try {
            const data = await timeLogApi.getLogs({ date: selectedDate });
            const apiLogs: TimeLog[] = (data || []).map((l: any) => ({ ...l, synced: true }));
            // Merge offline queue entries with fresh API data
            const mergedWithPending = await mergeOfflineEntries(apiLogs);
            setLogs(mergedWithPending);
            // Cache with merge (preserves local unsynced entries) — await to prevent race
            await cacheHistoryLogs(selectedDate, apiLogs as CachedTimeLog[]);
        } catch (error) {
            console.error("Failed to fetch logs from API:", error);
            // Cache + pending already shown above, no need to clear
        } finally {
            setLoading(false);
        }
    }, [selectedDate, mergeOfflineEntries]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Real-time polling: refresh every 30s when viewing today
    useEffect(() => {
        if (!isToday) return;
        const interval = setInterval(() => {
            fetchLogs(false); // Silent refresh (no skeleton loader)
        }, 30000);
        return () => clearInterval(interval);
    }, [isToday, fetchLogs]);

    // On coming back online — re-fetch from API to update sync badges
    useEffect(() => {
        const handleOnline = () => {
            console.log('📋 History: Back online — refreshing from API in 3s');
            // 3s delay lets SyncManager flush offline screenshots first
            setTimeout(() => fetchLogs(false), 3000);
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [fetchLogs]);

    const stats = useMemo(() => {
        const totalTime = logs.reduce((acc, log) => acc + (log.duration || 600), 0); // Assuming 10 min blocks if duration missing, or use constant
        // Actually desktop app usually records periodic screenshots, let's assume each log is an interval
        const screenshotCount = logs.length;
        const avgActivity = logs.length > 0
            ? Math.round(logs.reduce((acc, log) => acc + log.activityScore, 0) / logs.length)
            : 0;

        return { totalTime, screenshotCount, avgActivity };
    }, [logs]);

    const handleDateChange = (daysOffset: number) => {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    return (
        <PageWrapper>
            <Header>
                <Title>📊 কাজের ইতিহাস</Title>
                <DateControls>
                    <DateButton onClick={() => handleDateChange(0)} $active={selectedDate === new Date().toISOString().split('T')[0]}>আজ</DateButton>
                    <DateButton onClick={() => handleDateChange(-1)} $active={selectedDate === new Date(Date.now() - 86400000).toISOString().split('T')[0]}>গতকাল</DateButton>
                    <StyledDateInput
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                </DateControls>
            </Header>

            <SummaryCards>
                <SummaryCard variant="default">
                    <SummaryIcon $color={theme.colors.primary.main}>⏱️</SummaryIcon>
                    <SummaryInfo>
                        <SummaryValue>{formatDuration(stats.totalTime)}</SummaryValue>
                        <SummaryLabel>মোট সময়</SummaryLabel>
                    </SummaryInfo>
                </SummaryCard>
                <SummaryCard variant="default">
                    <SummaryIcon $color={theme.colors.status.info}>📷</SummaryIcon>
                    <SummaryInfo>
                        <SummaryValue>{stats.screenshotCount}</SummaryValue>
                        <SummaryLabel>স্ক্রিনশট</SummaryLabel>
                    </SummaryInfo>
                </SummaryCard>
                <SummaryCard variant="default">
                    <SummaryIcon $color={theme.colors.status.success}>⚡</SummaryIcon>
                    <SummaryInfo>
                        <SummaryValue>{stats.avgActivity}%</SummaryValue>
                        <SummaryLabel>গড় কার্যকলাপ</SummaryLabel>
                    </SummaryInfo>
                </SummaryCard>
            </SummaryCards>

            <TimelineContainer>
                {loading ? (
                    <SkeletonList count={3} />
                ) : logs.length === 0 ? (
                    <EmptyState>
                        <h3>এই তারিখে কোনো রেকর্ড নেই</h3>
                        <p>অন্য একটি তারিখ নির্বাচন করুন</p>
                    </EmptyState>
                ) : (
                    <TimelineGroup>
                        <GroupHeader>
                            {formatDateBengali(selectedDate)} - মোট {formatDuration(stats.totalTime)}
                        </GroupHeader>
                        {logs.map((log) => (
                            <LogCard key={log.id} variant="default">
                                <Thumbnail $src={log.imageUrl} onClick={() => log.imageUrl && setSelectedLog(log)} style={{ cursor: log.imageUrl ? 'pointer' : 'default' }}>
                                    {!log.imageUrl && "📷"}
                                </Thumbnail>
                                <LogContent>
                                    <LogTitle>
                                        <span>রেকর্ডেড সেশন</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <SyncBadge $synced={log.synced !== false}>
                                                {log.synced !== false ? '✅ সিংকড' : '🔄 পেন্ডিং'}
                                            </SyncBadge>
                                            <LogTime>{formatTimeBengali(log.recordedAt)}</LogTime>
                                        </div>
                                    </LogTitle>
                                    <ActivityBar>
                                        <ActivityLabel>অ্যাক্টিভিটি: {log.activityScore}%</ActivityLabel>
                                        <div style={{ flex: 1, height: 8 }}>
                                            <ProgressBar value={log.activityScore} variant={
                                                log.activityScore > 70 ? 'success' :
                                                    log.activityScore > 40 ? 'warning' : 'error'
                                            } size="sm" />
                                        </div>
                                    </ActivityBar>
                                    <div style={{ display: 'flex', gap: 10, fontSize: 12, color: theme.colors.text.muted }}>
                                        <span>কীবোর্ড: {log.keyboardCount}</span>
                                        <span>মাউস: {log.mouseCount}</span>
                                    </div>
                                </LogContent>
                            </LogCard>
                        ))}
                    </TimelineGroup>
                )}
            </TimelineContainer>

            {/* Full-Screen Screenshot Modal (Read-Only) */}
            {selectedLog && selectedLog.imageUrl && (
                <ModalOverlay onClick={() => setSelectedLog(null)}>
                    <ModalContent onClick={(e) => e.stopPropagation()}>
                        <CloseButton onClick={() => setSelectedLog(null)}>✕</CloseButton>
                        <ModalImage src={selectedLog.imageUrl} alt="Screenshot" />
                        <ModalInfoBar>
                            <ModalStat>
                                <ModalStatValue>{selectedLog.activityScore}%</ModalStatValue>
                                <ModalStatLabel>Activity</ModalStatLabel>
                            </ModalStat>
                            <div style={{ flex: 1, height: 8, maxWidth: 200 }}>
                                <ProgressBar value={selectedLog.activityScore} variant={
                                    selectedLog.activityScore >= 70 ? 'success' :
                                        selectedLog.activityScore >= 40 ? 'warning' : 'error'
                                } size="sm" />
                            </div>
                            <ModalStat>
                                <ModalStatValue>{selectedLog.keyboardCount}</ModalStatValue>
                                <ModalStatLabel>Keystrokes</ModalStatLabel>
                            </ModalStat>
                            <ModalStat>
                                <ModalStatValue>{selectedLog.mouseCount}</ModalStatValue>
                                <ModalStatLabel>Mouse Clicks</ModalStatLabel>
                            </ModalStat>
                            <ModalStat>
                                <ModalStatValue>{formatTimeBengali(selectedLog.recordedAt)}</ModalStatValue>
                                <ModalStatLabel>Captured At</ModalStatLabel>
                            </ModalStat>
                            <ScoreBadge $score={selectedLog.activityScore}>
                                {selectedLog.activityScore >= 70 ? 'HIGH' : selectedLog.activityScore >= 40 ? 'MEDIUM' : selectedLog.activityScore >= 10 ? 'LOW' : 'IDLE'}
                            </ScoreBadge>
                        </ModalInfoBar>
                    </ModalContent>
                </ModalOverlay>
            )}
        </PageWrapper>
    );
};

export default History;
