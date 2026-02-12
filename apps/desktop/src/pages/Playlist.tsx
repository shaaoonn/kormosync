// ============================================================
// KormoSync Desktop App - Playlist Page (Phase 12C Revision)
// Single-column layout with horizontal subtask slider,
// task details, required files with download, NO screenshots
// ============================================================

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { theme } from '../styles/theme';
import {
    ProgressBar,
    Badge,
    ScheduleBadge,
} from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import { formatDuration, formatRelativeTime, getScheduleInfo } from '../utils/formatters';
import { proofApi, uploadApi } from '../services/api';
import type { SubTask } from '../types';
import { API_URL } from '../utils/constants';

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

const equalizer = keyframes`
    0%, 100% { height: 4px; }
    50% { height: 14px; }
`;

// ============================================================
// Styled Components \u2014 Page Layout
// ============================================================
const PageContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: ${theme.colors.bg.primary};
    color: ${theme.colors.text.primary};
    overflow: hidden;
`;

const StickyHeader = styled.div`
    position: sticky;
    top: 0;
    z-index: 10;
    background: ${theme.colors.bg.secondary};
    border-bottom: 1px solid ${theme.colors.border.primary};
    padding: ${theme.spacing.md} ${theme.spacing.xl};
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    box-shadow: ${theme.shadows.sm};
`;

const BackButton = styled.button`
    width: 36px;
    height: 36px;
    min-width: 36px;
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
        border-color: ${theme.colors.primary.main};
    }
`;

const HeaderInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const TaskTitle = styled.h1`
    font-size: 2rem;
    font-weight: ${theme.typography.fontWeight.bold};
    margin: 0;
    color: ${theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const HeaderMeta = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    margin-top: 2px;
`;

const StatusBadge = styled.span<{ $status: string }>`
    display: inline-block;
    padding: 2px 8px;
    border-radius: ${theme.borderRadius.sm};
    font-size: ${theme.typography.fontSize.xs};
    font-weight: 600;
    ${({ $status }) => {
        switch ($status) {
            case 'IN_PROGRESS': return css`
                background: ${theme.colors.primary.main}15;
                color: ${theme.colors.primary.main};
            `;
            case 'DONE': return css`
                background: ${theme.colors.status.success}15;
                color: ${theme.colors.status.success};
            `;
            case 'REVIEW': return css`
                background: ${theme.colors.status.info}15;
                color: ${theme.colors.status.info};
            `;
            default: return css`
                background: ${theme.colors.bg.tertiary};
                color: ${theme.colors.text.secondary};
            `;
        }
    }}
`;

const HeaderTimer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
`;

const TimerLabel = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    text-transform: uppercase;
    letter-spacing: 1px;
`;

const BigTimer = styled.div<{ $active: boolean }>`
    font-family: 'JetBrains Mono', monospace;
    font-size: ${theme.typography.fontSize.xl};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${({ $active }) => $active ? theme.colors.primary.main : theme.colors.text.primary};
`;

// ============================================================
// Styled Components \u2014 Scrollable Content
// ============================================================
const ScrollContent = styled.div`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: ${theme.spacing.xl};
`;

// ============================================================
// Styled Components \u2014 SubTask Slider
// ============================================================
const SliderSection = styled.div`
    position: relative;
    background: ${theme.colors.bg.secondary};
    border-bottom: 1px solid ${theme.colors.border.primary};
    padding: ${theme.spacing.md} 0;
`;

const SliderWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    padding: 0 ${theme.spacing.lg};
`;

const SliderTrack = styled.div`
    display: flex;
    gap: ${theme.spacing.md};
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    padding: ${theme.spacing.xs} ${theme.spacing.xs};
    flex: 1;

    /* Hide scrollbar */
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar { display: none; }
`;

const ScrollButton = styled.button<{ $direction: 'left' | 'right' }>`
    position: absolute;
    ${({ $direction }) => $direction === 'left' ? 'left: 4px;' : 'right: 4px;'}
    z-index: 5;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid ${theme.colors.border.primary};
    background: ${theme.colors.bg.elevated};
    color: ${theme.colors.text.secondary};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    box-shadow: ${theme.shadows.sm};

    &:hover {
        background: ${theme.colors.bg.hover};
        color: ${theme.colors.text.primary};
        border-color: ${theme.colors.primary.main};
    }

    svg { width: 14px; height: 14px; }
`;

const SliderCard = styled.div<{ $isSelected: boolean; $isActive: boolean; $isCompleted: boolean }>`
    min-width: 200px;
    max-width: 260px;
    padding: 4px 8px;
    background: ${theme.colors.bg.tertiary};
    border: 1.5px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
    cursor: pointer;
    transition: all 0.2s ease;
    scroll-snap-align: start;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;

    ${({ $isSelected }) => $isSelected && css`
        border-color: ${theme.colors.primary.main};
        box-shadow: 0 0 12px ${theme.colors.primary.glow};
        background: ${theme.colors.primary.main}08;
    `}

    ${({ $isActive }) => $isActive && css`
        border-color: ${theme.colors.status.success};
        background: ${theme.colors.status.success}08;
    `}

    ${({ $isCompleted }) => $isCompleted && css`
        opacity: 0.7;
        border-color: ${theme.colors.status.success}40;
    `}

    &:hover {
        border-color: ${theme.colors.primary.main}80;
        transform: translateY(-1px);
    }
`;

const SliderCardHeader = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
`;

const SliderCardIndex = styled.span<{ $isActive: boolean }>`
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: ${theme.typography.fontWeight.bold};
    background: ${({ $isActive }) => $isActive ? theme.colors.primary.main : theme.colors.bg.hover};
    color: ${({ $isActive }) => $isActive ? theme.colors.bg.primary : theme.colors.text.secondary};
    flex-shrink: 0;
`;

const SliderCardTitle = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const SliderCardMeta = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing.sm};
`;

const SliderCardTime = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    font-family: 'JetBrains Mono', monospace;
    color: ${theme.colors.text.muted};
`;

// Hourly progress bar for subtask cards
const MiniHourlyProgress = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
`;

const HourlyProgressText = styled.span<{ $isOvertime?: boolean }>`
    font-size: 10px;
    font-family: 'JetBrains Mono', monospace;
    color: ${({ $isOvertime }) => $isOvertime ? theme.colors.status.error : theme.colors.text.muted};
    white-space: nowrap;
`;

// Per-subtask play/pause controls
const SubTaskControls = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
    padding-top: 2px;
    border-top: 1px solid ${theme.colors.border.subtle};
`;

const MiniPlayBtn = styled.button<{ $isPlaying?: boolean }>`
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    transition: all 0.15s ease;
    background: ${({ $isPlaying }) => $isPlaying ? theme.colors.status.warning : theme.colors.primary.main};
    color: white;

    &:hover {
        filter: brightness(1.2);
        transform: scale(1.1);
    }
`;


const MiniEqualizerWrapper = styled.div`
    display: flex;
    align-items: flex-end;
    gap: 1.5px;
    height: 12px;
`;

const MiniEqualizerBar = styled.div<{ $delay: number }>`
    width: 2px;
    background: ${theme.colors.status.success};
    border-radius: 1px;
    animation: ${equalizer} 0.5s ease-in-out infinite;
    animation-delay: ${({ $delay }) => $delay}ms;
`;

// ============================================================
// Styled Components \u2014 Player Controls
// ============================================================
const PlayerBar = styled.div`
    background: ${theme.colors.bg.secondary};
    border-bottom: 1px solid ${theme.colors.border.primary};
    padding: ${theme.spacing.lg} ${theme.spacing.xl};
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${theme.spacing.md};
`;

const PlayerProgressRow = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const PlayerProgressHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const ActiveSubTaskNames = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
`;

const PlayerProgressLabel = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.secondary};
    font-family: 'JetBrains Mono', monospace;
`;

const PlayerCenterControls = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${theme.spacing.md};
    margin-top: ${theme.spacing.sm};
`;

const PlayButton = styled.button<{ $isPlaying: boolean }>`
    width: 96px;
    height: 96px;
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
        transform: scale(1.05);
        box-shadow: ${theme.shadows.lg};
    }

    ${({ $isPlaying }) => $isPlaying && css`
        animation: ${pulse} 2s infinite;
    `}

    svg { width: 44px; height: 44px; fill: currentColor; }
`;

const ControlButton = styled.button`
    width: 36px;
    height: 36px;
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

    &:disabled { opacity: 0.3; cursor: not-allowed; }
    svg { width: 16px; height: 16px; fill: currentColor; }
`;

const PlayerTimer = styled.div`
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px;
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
    text-align: center;
`;

// ============================================================
// Styled Components \u2014 Content Sections
// ============================================================
const ContentArea = styled.div`
    padding: ${theme.spacing.lg} ${theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.lg};
    animation: ${fadeIn} 0.3s ease;
`;

const SectionCard = styled.div<{ $accentColor?: string }>`
    background: ${theme.colors.bg.secondary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.lg};
    overflow: hidden;

    ${({ $accentColor }) => $accentColor && css`
        border-left: 3px solid ${$accentColor};
    `}
`;

const SectionHeader = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.md} ${theme.spacing.lg};
    border-bottom: 1px solid ${theme.colors.border.primary};
    background: ${theme.colors.bg.tertiary}40;
`;

const SectionIcon = styled.span`
    font-size: 16px;
`;

const SectionTitle = styled.h3`
    margin: 0;
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const SectionBody = styled.div`
    padding: ${theme.spacing.md} ${theme.spacing.lg};
`;

const DescriptionText = styled.p`
    margin: 0;
    font-size: ${theme.typography.fontSize.base};
    color: ${theme.colors.text.secondary};
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
`;

const PlaceholderText = styled.p`
    margin: 0;
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.muted};
    font-style: italic;
`;

const SubTaskDetailGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: ${theme.spacing.md};
    margin-top: ${theme.spacing.md};
`;

const StatItem = styled.div`
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.md};
    padding: ${theme.spacing.sm} ${theme.spacing.md};
`;

const StatLabel = styled.div`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    margin-bottom: 2px;
`;

const StatValue = styled.div`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: ${theme.colors.text.primary};
`;

// ============================================================
// Styled Components \u2014 Required Files (Video + Attachments)
// ============================================================
const VideoPreviewCard = styled.div`
    width: 100%;
    aspect-ratio: 16 / 9;
    max-height: 220px;
    background: linear-gradient(135deg, ${theme.colors.bg.tertiary}, #4f46e510);
    border: 1.5px solid rgba(99, 102, 241, 0.3);
    border-radius: ${theme.borderRadius.lg};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    margin-bottom: ${theme.spacing.md};
    transition: all 0.25s ease;

    &:hover {
        border-color: rgba(99, 102, 241, 0.6);
        box-shadow: 0 0 24px rgba(99, 102, 241, 0.15);
        transform: translateY(-2px);
    }
`;

const VideoPlayCircle = styled.div`
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
    transition: transform 0.2s;

    ${VideoPreviewCard}:hover & {
        transform: scale(1.1);
    }

    svg { width: 28px; height: 28px; fill: currentColor; }
`;

const VideoLabelOverlay = styled.div`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: linear-gradient(transparent, rgba(0,0,0,0.7));
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
`;

const VideoLabelText = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: rgba(255,255,255,0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const VideoDownloadHint = styled.span`
    font-size: 10px;
    color: rgba(255,255,255,0.6);
    margin-left: auto;
    white-space: nowrap;
`;

const FileThumbnailGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: ${theme.spacing.sm};
`;

const FileThumbnail = styled.div`
    aspect-ratio: 1;
    border-radius: ${theme.borderRadius.md};
    border: 1px solid ${theme.colors.border.primary};
    background: ${theme.colors.bg.tertiary};
    overflow: hidden;
    position: relative;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        border-color: ${theme.colors.primary.main};
        box-shadow: ${theme.shadows.sm};
    }
`;

const ThumbnailImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
`;

const ThumbnailOverlay = styled.div`
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;

    ${FileThumbnail}:hover & {
        opacity: 1;
    }
`;

const DownloadBtn = styled.button`
    padding: 6px 14px;
    background: ${theme.colors.primary.main};
    color: #fff;
    border: none;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.xs};
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: background 0.2s;

    &:hover {
        background: ${theme.colors.primary.light};
    }
`;

const ThumbnailFileName = styled.div`
    font-size: 9px;
    color: rgba(255,255,255,0.8);
    max-width: 90%;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const FileTypeCenterIcon = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 4px;
`;

const FileTypeEmoji = styled.span`
    font-size: 28px;
`;

const FileExtText = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    font-weight: ${theme.typography.fontWeight.bold};
    text-transform: uppercase;
`;

const LinksList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
`;

const LinkItem = styled.a`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    border-radius: ${theme.borderRadius.md};
    text-decoration: none;
    color: ${theme.colors.status.info};
    font-size: ${theme.typography.fontSize.sm};
    transition: all 0.2s;
    word-break: break-all;
    &:hover {
        background: ${theme.colors.bg.hover};
        color: ${theme.colors.primary.light};
    }
    svg { flex-shrink: 0; width: 14px; height: 14px; }
`;

// ============================================================
// Styled Components \u2014 Bottom Actions
// ============================================================
const BottomActions = styled.div`
    background: ${theme.colors.bg.secondary};
    border-top: 1px solid ${theme.colors.border.primary};
    padding: ${theme.spacing.md} ${theme.spacing.xl};
    display: flex;
    gap: ${theme.spacing.md};
`;

const ProofButton = styled.button`
    flex: 1;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.primary.main};
    color: ${theme.colors.bg.primary};
    border: none;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.bold};
    cursor: pointer;
    transition: all 0.2s;
    &:hover { opacity: 0.9; transform: translateY(-1px); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const FinishButton = styled.button`
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    background: transparent;
    color: ${theme.colors.status.error};
    border: 1px solid ${theme.colors.status.error}60;
    border-radius: ${theme.borderRadius.md};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.bold};
    cursor: pointer;
    transition: all 0.2s;
    &:hover { background: ${theme.colors.status.error}15; }
`;

const ProofFormWrapper = styled.div`
    background: ${theme.colors.bg.secondary};
    border-top: 1px solid ${theme.colors.border.primary};
    padding: ${theme.spacing.lg} ${theme.spacing.xl};
`;

const ProofFormGrid = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
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
    min-height: 50px;
    &:focus { outline: none; border-color: ${theme.colors.primary.main}; }
    &::placeholder { color: ${theme.colors.text.muted}; }
`;

const ProofActions = styled.div`
    display: flex;
    gap: ${theme.spacing.sm};
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

// ============================================================
// Icons
// ============================================================
const ArrowLeftIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
    </svg>
);
const PlayIcon = () => <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>;
const StopIcon = () => <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>;
const NextIcon = () => <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>;
const ChevronLeft = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>;
const ChevronRight = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>;
const ExternalLinkIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
);
const DownloadIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

// ============================================================
// Helper Functions
// ============================================================
const getFileExtension = (url: string): string => {
    const parts = url.split('.');
    return parts.length > 1 ? parts[parts.length - 1].split('?')[0].toLowerCase() : '';
};

const getFileName = (url: string): string => {
    const parts = url.split('/');
    const raw = parts[parts.length - 1] || url;
    return decodeURIComponent(raw.split('?')[0]);
};

const getFileEmoji = (ext: string): string => {
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return '\uD83D\uDDBC\uFE0F';
    if (['pdf'].includes(ext)) return '\uD83D\uDCC4';
    if (['doc', 'docx'].includes(ext)) return '\uD83D\uDCDD';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '\uD83D\uDCCA';
    if (['zip', 'rar', '7z'].includes(ext)) return '\uD83D\uDCE6';
    if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return '\uD83C\uDFA5';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return '\uD83C\uDFB5';
    if (['psd', 'ai', 'fig'].includes(ext)) return '\uD83C\uDFA8';
    return '\uD83D\uDCCE';
};

const isImageFile = (ext: string): boolean => {
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
};

const getSubTaskStatusText = (status: string): string => {
    switch (status) {
        case 'COMPLETED': return '\u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8';
        case 'IN_PROGRESS': return '\u099A\u09B2\u09AE\u09BE\u09A8';
        default: return '\u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09AE\u09BE\u09A8';
    }
};

const resolveFileUrl = (url: string): string => {
    if (url.startsWith('http')) return url;
    const base = API_URL.replace(/\/api\/?$/, '');
    return `${base}/${url.replace(/^\//, '')}`;
};

// ============================================================
// Component
// ============================================================
export const Playlist: React.FC = () => {
    const navigate = useNavigate();
    const {
        selectedTask,
        activeTimers,
        taskTrackers,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        stopAllTimers,
        startTaskTracking,
        pauseTaskTracking,
        resumeTaskTracking,
    } = useAppStore();

    const addToast = useAppStore((s) => s.addToast);
    const sliderRef = useRef<HTMLDivElement>(null);

    const [selectedSubTask, setSelectedSubTask] = useState<SubTask | null>(null);
    const [showProofForm, setShowProofForm] = useState(false);
    const [proofSummary, setProofSummary] = useState('');
    const [proofNotes, setProofNotes] = useState('');
    const [proofFiles, setProofFiles] = useState<File[]>([]);
    const [proofSubmitting, setProofSubmitting] = useState(false);

    // ---- Computed Values ----
    const taskActiveTimers = useMemo(() => {
        if (!selectedTask) return [];
        return Object.values(activeTimers).filter(
            (timer) => timer.taskId === selectedTask.id
        );
    }, [activeTimers, selectedTask]);

    // Task-level tracker for wall-clock time and main controls
    const taskTracker = selectedTask ? taskTrackers[selectedTask.id] : undefined;
    const isTaskRunning = !!taskTracker && !taskTracker.isPaused;
    const isTaskPaused = !!taskTracker && taskTracker.isPaused;

    // Active subtask names for "Now Playing" display
    const activeSubTaskNames = useMemo(() => {
        return taskActiveTimers.filter(t => !t.isPaused).map(t => t.subTaskTitle);
    }, [taskActiveTimers]);

    // Selected subtask for details panel
    const activeSubTaskTimer = taskActiveTimers.find(t => !t.isPaused);
    const activeSubTask = useMemo(() => {
        if (!selectedTask?.subTasks) return selectedSubTask;
        const fromTimer = selectedTask.subTasks.find(st => st.id === activeSubTaskTimer?.subTaskId);
        return fromTimer || selectedSubTask;
    }, [selectedTask, activeSubTaskTimer, selectedSubTask]);

    // Wall-clock total time (from task tracker or fallback to sum)
    const totalDuration = useMemo(() => {
        if (taskTracker) return taskTracker.wallClockElapsed;
        if (!selectedTask?.subTasks) return 0;
        return selectedTask.subTasks.reduce((acc, st) => {
            const timer = activeTimers[st.id];
            return acc + (timer ? timer.elapsedSeconds : (st.trackedTime || 0));
        }, 0);
    }, [taskTracker, selectedTask, activeTimers]);

    // Time-based progress: totalDuration / totalEstimatedSeconds
    const timeBasedProgress = useMemo(() => {
        if (!selectedTask?.subTasks) return 0;
        const totalEstimated = selectedTask.subTasks.reduce((acc, st) =>
            acc + (st.estimatedHours ? st.estimatedHours * 3600 : 0), 0);
        if (totalEstimated === 0) return 0;
        return Math.min(100, (totalDuration / totalEstimated) * 100);
    }, [selectedTask, totalDuration]);

    // Total estimated time for display
    const totalEstimatedSeconds = useMemo(() => {
        if (!selectedTask?.subTasks) return 0;
        return selectedTask.subTasks.reduce((acc, st) =>
            acc + (st.estimatedHours ? st.estimatedHours * 3600 : 0), 0);
    }, [selectedTask]);

    // ---- Handlers ----
    const handleSubTaskSelect = useCallback((subTask: SubTask) => {
        setSelectedSubTask(subTask);
    }, []);

    // Main task play/pause/stop
    const toggleTaskPlayPause = useCallback(() => {
        if (!selectedTask) return;
        if (isTaskRunning) {
            pauseTaskTracking(selectedTask.id);
        } else if (isTaskPaused) {
            resumeTaskTracking(selectedTask.id);
        } else {
            startTaskTracking(selectedTask);
        }
    }, [selectedTask, isTaskRunning, isTaskPaused, pauseTaskTracking, resumeTaskTracking, startTaskTracking]);

    // Per-subtask play/pause handler
    const handleSubTaskPlayPause = useCallback((st: SubTask) => {
        if (!selectedTask) return;
        const timer = activeTimers[st.id];
        if (timer && !timer.isPaused) {
            // Running → pause this subtask only
            pauseTimer(st.id);
        } else if (timer && timer.isPaused) {
            // Paused → resume
            resumeTimer(st.id);
        } else {
            // Not started → ensure task tracker is running, then start subtask
            if (!taskTracker) {
                startTaskTracking(selectedTask);
            }
            startTimer(st, selectedTask);
        }
    }, [selectedTask, activeTimers, taskTracker, pauseTimer, resumeTimer, startTimer, startTaskTracking]);

    const handleNext = useCallback(() => {
        if (!selectedTask?.subTasks || !activeSubTask) return;
        const currentIndex = selectedTask.subTasks.findIndex(st => st.id === activeSubTask.id);
        if (currentIndex < selectedTask.subTasks.length - 1) {
            const nextSubTask = selectedTask.subTasks[currentIndex + 1];
            setSelectedSubTask(nextSubTask);
            // Stop current subtask and start next one
            const timer = activeTimers[activeSubTask.id];
            if (timer) {
                stopTimer(activeSubTask.id);
                startTimer(nextSubTask, selectedTask);
            }
        }
    }, [selectedTask, activeSubTask, activeTimers, stopTimer, startTimer]);

    const scrollSlider = useCallback((direction: 'left' | 'right') => {
        if (sliderRef.current) {
            const amount = direction === 'left' ? -220 : 220;
            sliderRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    }, []);

    const handleFinishProject = useCallback(() => {
        if (confirm('\u0986\u09AA\u09A8\u09BF \u0995\u09BF \u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4 \u09AF\u09C7 \u0986\u09AA\u09A8\u09BF \u098F\u0987 \u09AA\u09CD\u09B0\u099C\u09C7\u0995\u09CD\u099F\u099F\u09BF \u09B6\u09C7\u09B7 \u0995\u09B0\u09A4\u09C7 \u099A\u09BE\u09A8? \u09B8\u09AC \u099F\u09BE\u0987\u09AE\u09BE\u09B0 \u09AC\u09A8\u09CD\u09A7 \u0995\u09B0\u09BE \u09B9\u09AC\u09C7\u0964')) {
            stopAllTimers();
            navigate('/dashboard');
        }
    }, [stopAllTimers, navigate]);

    const handleSubmitProof = useCallback(async () => {
        if (!proofSummary.trim() || !selectedTask) return;
        setProofSubmitting(true);
        try {
            const attachmentUrls: string[] = [];
            for (const file of proofFiles) {
                if (file.size > 10 * 1024 * 1024) {
                    addToast('error', `${file.name} \u09AB\u09BE\u0987\u09B2 \u09E7\u09E6MB \u098F\u09B0 \u09AC\u09C7\u09B6\u09BF`);
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
            addToast('success', '\u09AA\u09CD\u09B0\u09C1\u09AB \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B9\u09AF\u09BC\u09C7\u099B\u09C7!');
            setShowProofForm(false);
            setProofSummary('');
            setProofNotes('');
            setProofFiles([]);
        } catch (err: any) {
            addToast('error', err.message || '\u09AA\u09CD\u09B0\u09C1\u09AB \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7');
        } finally {
            setProofSubmitting(false);
        }
    }, [proofSummary, proofNotes, proofFiles, selectedTask, activeSubTask, addToast]);

    const handleDownload = useCallback(async (url: string) => {
        const fullUrl = resolveFileUrl(url);

        if ((window as any).electron?.downloadFile) {
            const ext = url.split('.').pop()?.split('?')[0] || 'file';
            const filename = `attachment-${Date.now()}.${ext}`;
            try {
                const result = await (window as any).electron.downloadFile({ url: fullUrl, filename });
                if (result.success) {
                    addToast('success', '\u09AB\u09BE\u0987\u09B2 \u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8!');
                    return;
                }
                if (result.canceled) return;
            } catch (err) {
                console.error('Download failed, opening in browser:', err);
            }
        }

        // Fallback: open in browser
        (window as any).electron?.openExternal?.(fullUrl) || window.open(fullUrl, '_blank');
    }, [addToast]);

    // ---- Effects ----
    useEffect(() => {
        if (selectedTask?.subTasks && selectedTask.subTasks.length > 0 && !selectedSubTask) {
            setSelectedSubTask(selectedTask.subTasks[0]);
        }
    }, [selectedTask, selectedSubTask]);

    const selectedScheduleInfo = useMemo(() => {
        if (!activeSubTask) return null;
        return getScheduleInfo(activeSubTask, new Date());
    }, [activeSubTask]);

    // Check if task has any required files
    const hasVideoUrl = !!selectedTask?.videoUrl;
    const hasAttachments = !!(selectedTask?.attachments && selectedTask.attachments.length > 0);
    const hasResourceLinks = !!(selectedTask?.resourceLinks && selectedTask.resourceLinks.length > 0);
    const hasRequiredFiles = hasVideoUrl || hasAttachments;

    // ---- Render ----
    if (!selectedTask) {
        return (
            <PageContainer>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                    <h2 style={{ color: theme.colors.text.muted }}>{'\u0995\u09CB\u09A8\u09CB \u099F\u09BE\u09B8\u09CD\u0995 \u09B8\u09BF\u09B2\u09C7\u0995\u09CD\u099F \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF'}</h2>
                    <BackButton onClick={() => navigate('/dashboard')} style={{ width: 'auto', borderRadius: theme.borderRadius.md, padding: '8px 20px', gap: 8, display: 'flex' }}>
                        <ArrowLeftIcon /> {'\u09A1\u09CD\u09AF\u09BE\u09B6\u09AC\u09CB\u09B0\u09CD\u09A1\u09C7 \u09AB\u09BF\u09B0\u09C1\u09A8'}
                    </BackButton>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            {/* STICKY HEADER */}
            <StickyHeader>
                <BackButton onClick={() => { stopAllTimers(); navigate('/dashboard'); }}>
                    <ArrowLeftIcon />
                </BackButton>
                <HeaderInfo>
                    <TaskTitle>{selectedTask.title}</TaskTitle>
                    <HeaderMeta>
                        <StatusBadge $status={selectedTask.status}>{selectedTask.status}</StatusBadge>
                        {selectedTask.priority && (
                            <Badge variant={selectedTask.priority === 'HIGH' ? 'error' : selectedTask.priority === 'MEDIUM' ? 'warning' : 'default'} size="sm">
                                {selectedTask.priority}
                            </Badge>
                        )}
                    </HeaderMeta>
                </HeaderInfo>
                <HeaderTimer>
                    <TimerLabel>{'\u09AE\u09CB\u099F \u09B8\u09AE\u09AF\u09BC'}</TimerLabel>
                    <BigTimer $active={isTaskRunning || taskActiveTimers.length > 0}>{formatDuration(totalDuration)}</BigTimer>
                </HeaderTimer>
            </StickyHeader>

            {/* PLAYER CONTROLS BAR — Main Task Level (Vertical, Centered) */}
            <PlayerBar>
                {/* Centered play button + timer */}
                <PlayerCenterControls>
                    <PlayButton $isPlaying={isTaskRunning} onClick={toggleTaskPlayPause} title={isTaskRunning ? 'Pause All' : 'Play'}>
                        {isTaskRunning ? <PauseIcon /> : <PlayIcon />}
                    </PlayButton>
                    <PlayerTimer>{formatDuration(totalDuration)}</PlayerTimer>
                </PlayerCenterControls>

                {/* Progress bar — below timer */}
                <PlayerProgressRow>
                    <PlayerProgressHeader>
                        <PlayerProgressLabel>{formatDuration(totalDuration)}{totalEstimatedSeconds > 0 ? ` / ${formatDuration(totalEstimatedSeconds)}` : ''}</PlayerProgressLabel>
                        {activeSubTaskNames.length > 0 && (
                            <ActiveSubTaskNames>
                                {activeSubTaskNames.join(' | ')}
                            </ActiveSubTaskNames>
                        )}
                    </PlayerProgressHeader>
                    <ProgressBar value={timeBasedProgress} size="sm" />
                </PlayerProgressRow>
            </PlayerBar>

            {/* SUBTASK SLIDER */}
            {selectedTask.subTasks && selectedTask.subTasks.length > 0 && (
                <SliderSection>
                    <SliderWrapper>
                        <ScrollButton $direction="left" onClick={() => scrollSlider('left')}><ChevronLeft /></ScrollButton>
                        <SliderTrack ref={sliderRef}>
                            {selectedTask.subTasks.map((st, index) => {
                                const isSelected = activeSubTask?.id === st.id;
                                const timer = activeTimers[st.id];
                                const isActive = !!timer && !timer.isPaused;
                                const isStPaused = !!timer && timer.isPaused;
                                const isCompleted = st.status === 'COMPLETED';
                                const elapsed = timer ? timer.elapsedSeconds : (st.trackedTime || 0);

                                return (
                                    <SliderCard
                                        key={st.id}
                                        $isSelected={isSelected}
                                        $isActive={isActive}
                                        $isCompleted={isCompleted}
                                        onClick={() => handleSubTaskSelect(st)}
                                    >
                                        <SliderCardHeader>
                                            {isActive ? (
                                                <MiniEqualizerWrapper>
                                                    <MiniEqualizerBar $delay={0} />
                                                    <MiniEqualizerBar $delay={150} />
                                                    <MiniEqualizerBar $delay={300} />
                                                </MiniEqualizerWrapper>
                                            ) : (
                                                <SliderCardIndex $isActive={isSelected}>{index + 1}</SliderCardIndex>
                                            )}
                                            <SliderCardTitle>{st.title}</SliderCardTitle>
                                        </SliderCardHeader>
                                        <SliderCardMeta>
                                            <SliderCardTime>{formatDuration(elapsed)}</SliderCardTime>
                                        </SliderCardMeta>
                                        {/* Hourly progress bar */}
                                        {st.billingType === 'HOURLY' && st.estimatedHours && st.estimatedHours > 0 && (() => {
                                            const estimatedSec = st.estimatedHours! * 3600;
                                            const pct = Math.min(100, (elapsed / estimatedSec) * 100);
                                            const workedH = Math.round((elapsed / 3600) * 10) / 10;
                                            const isOT = st.allowOvertime && elapsed > estimatedSec;
                                            const otH = isOT ? Math.round(((elapsed - estimatedSec) / 3600) * 10) / 10 : 0;
                                            return (
                                                <MiniHourlyProgress>
                                                    <div style={{ flex: 1 }}>
                                                        <ProgressBar value={pct} size="sm" />
                                                    </div>
                                                    <HourlyProgressText $isOvertime={isOT}>
                                                        {isOT
                                                            ? `${st.estimatedHours}h + ${otH}h OT`
                                                            : `${workedH}h / ${st.estimatedHours}h`
                                                        }
                                                    </HourlyProgressText>
                                                </MiniHourlyProgress>
                                            );
                                        })()}
                                        {/* Per-subtask play/pause controls (no stop) */}
                                        {!isCompleted && (
                                            <SubTaskControls onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                <MiniPlayBtn
                                                    $isPlaying={isActive}
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleSubTaskPlayPause(st); }}
                                                    title={isActive ? 'Pause' : isStPaused ? 'Resume' : 'Start'}
                                                >
                                                    {isActive ? '\u23F8' : '\u25B6'}
                                                </MiniPlayBtn>
                                            </SubTaskControls>
                                        )}
                                    </SliderCard>
                                );
                            })}
                        </SliderTrack>
                        <ScrollButton $direction="right" onClick={() => scrollSlider('right')}><ChevronRight /></ScrollButton>
                    </SliderWrapper>
                </SliderSection>
            )}

            {/* SCROLLABLE CONTENT */}
            <ScrollContent>
                <ContentArea>
                    {/* Task Description */}
                    <SectionCard $accentColor={theme.colors.primary.main}>
                        <SectionHeader>
                            <SectionIcon>{'\uD83D\uDCCB'}</SectionIcon>
                            <SectionTitle>{'\u099F\u09BE\u09B8\u09CD\u0995\u09C7\u09B0 \u09AC\u09BF\u09AC\u09B0\u09A3'}</SectionTitle>
                        </SectionHeader>
                        <SectionBody>
                            {selectedTask.description ? (
                                <DescriptionText>{selectedTask.description}</DescriptionText>
                            ) : (
                                <PlaceholderText>{'\u0995\u09CB\u09A8\u09CB \u09AC\u09BF\u09AC\u09B0\u09A3 \u09A6\u09C7\u0993\u09AF\u09BC\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF'}</PlaceholderText>
                            )}
                        </SectionBody>
                    </SectionCard>

                    {/* Selected SubTask Details */}
                    {activeSubTask && (
                        <SectionCard $accentColor={theme.colors.status.info}>
                            <SectionHeader>
                                <SectionIcon>{'\uD83D\uDCDD'}</SectionIcon>
                                <SectionTitle>{'\u09B8\u09BE\u09AC\u099F\u09BE\u09B8\u09CD\u0995\u09C7\u09B0 \u09AC\u09BF\u09B8\u09CD\u09A4\u09BE\u09B0\u09BF\u09A4'} — {activeSubTask.title}</SectionTitle>
                            </SectionHeader>
                            <SectionBody>
                                {activeSubTask.description ? (
                                    <DescriptionText>{activeSubTask.description}</DescriptionText>
                                ) : (
                                    <PlaceholderText>{'\u098F\u0987 \u09B8\u09BE\u09AC\u099F\u09BE\u09B8\u09CD\u0995\u09C7\u09B0 \u0995\u09CB\u09A8\u09CB \u09AC\u09BF\u09AC\u09B0\u09A3 \u09A8\u09C7\u0987'}</PlaceholderText>
                                )}
                                <SubTaskDetailGrid>
                                    <StatItem>
                                        <StatLabel>{'\u099F\u09CD\u09B0\u09CD\u09AF\u09BE\u0995 \u0995\u09B0\u09BE \u09B8\u09AE\u09AF\u09BC'}</StatLabel>
                                        <StatValue style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                            {formatDuration(activeTimers[activeSubTask.id] ? activeTimers[activeSubTask.id].elapsedSeconds : (activeSubTask.trackedTime || 0))}
                                        </StatValue>
                                    </StatItem>
                                    {activeSubTask.estimatedTime && (
                                        <StatItem>
                                            <StatLabel>{'\u0986\u09A8\u09C1\u09AE\u09BE\u09A8\u09BF\u0995 \u09B8\u09AE\u09AF\u09BC'}</StatLabel>
                                            <StatValue>{formatDuration(activeSubTask.estimatedTime * 60)}</StatValue>
                                        </StatItem>
                                    )}
                                    <StatItem>
                                        <StatLabel>{'\u09B8\u09CD\u099F\u09CD\u09AF\u09BE\u099F\u09BE\u09B8'}</StatLabel>
                                        <StatValue>{getSubTaskStatusText(activeSubTask.status)}</StatValue>
                                    </StatItem>
                                    {selectedScheduleInfo && (
                                        <StatItem>
                                            <StatLabel>{'\u09B6\u09BF\u09A1\u09BF\u0989\u09B2'}</StatLabel>
                                            <div style={{ marginTop: 4 }}>
                                                <ScheduleBadge scheduleStatus={selectedScheduleInfo.status as any} size="sm" />
                                            </div>
                                        </StatItem>
                                    )}
                                    <StatItem>
                                        <StatLabel>{'\u09AC\u09BF\u09B2\u09BF\u0982'}</StatLabel>
                                        <StatValue>
                                            {activeSubTask.billingType === 'HOURLY' ? '\u0998\u09A3\u09CD\u099F\u09BE \u09AA\u09CD\u09B0\u09A4\u09BF' :
                                             activeSubTask.billingType === 'FIXED_PRICE' ? '\u09A8\u09BF\u09B0\u09CD\u09A6\u09BF\u09B7\u09CD\u099F \u09AE\u09C2\u09B2\u09CD\u09AF' : '\u09B6\u09BF\u09A1\u09BF\u0989\u09B2\u09A1'}
                                        </StatValue>
                                    </StatItem>
                                    {activeSubTask.hourlyRate && (
                                        <StatItem>
                                            <StatLabel>{'\u09B0\u09C7\u099F'}</StatLabel>
                                            <StatValue>{'\u09F3'}{activeSubTask.hourlyRate}/{'\u0998\u09A3\u09CD\u099F\u09BE'}</StatValue>
                                        </StatItem>
                                    )}
                                </SubTaskDetailGrid>
                            </SectionBody>
                        </SectionCard>
                    )}

                    {/* \u09AA\u09CD\u09B0\u09AF\u09BC\u09CB\u099C\u09A8\u09C0\u09AF\u09BC \u09AB\u09BE\u0987\u09B2\u09B8\u09AE\u09C2\u09B9 (Required Files) */}
                    {hasRequiredFiles && (
                        <SectionCard>
                            <SectionHeader>
                                <SectionIcon>{'\uD83D\uDCC1'}</SectionIcon>
                                <SectionTitle>
                                    {'\u09AA\u09CD\u09B0\u09AF\u09BC\u09CB\u099C\u09A8\u09C0\u09AF\u09BC \u09AB\u09BE\u0987\u09B2\u09B8\u09AE\u09C2\u09B9'}
                                    {hasAttachments ? ` (${(selectedTask.attachments?.length || 0) + (hasVideoUrl ? 1 : 0)})` : ''}
                                </SectionTitle>
                            </SectionHeader>
                            <SectionBody>
                                {/* Video / Screen Recording \u2014 Large prominent card */}
                                {hasVideoUrl && (
                                    <VideoPreviewCard onClick={() => handleDownload(selectedTask.videoUrl!)}>
                                        <VideoPlayCircle>
                                            <PlayIcon />
                                        </VideoPlayCircle>
                                        <VideoLabelOverlay>
                                            <span style={{ fontSize: 14 }}>{'\uD83C\uDFA5'}</span>
                                            <VideoLabelText>{getFileName(selectedTask.videoUrl!)}</VideoLabelText>
                                            <VideoDownloadHint>{'\u0995\u09CD\u09B2\u09BF\u0995 \u0995\u09B0\u09C7 \u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1 \u0995\u09B0\u09C1\u09A8'}</VideoDownloadHint>
                                        </VideoLabelOverlay>
                                    </VideoPreviewCard>
                                )}

                                {/* Attachment thumbnails \u2014 small square grid */}
                                {hasAttachments && (
                                    <FileThumbnailGrid>
                                        {selectedTask.attachments!.map((url, i) => {
                                            const ext = getFileExtension(url);
                                            const name = getFileName(url);
                                            const fullUrl = resolveFileUrl(url);
                                            const isImg = isImageFile(ext);

                                            return (
                                                <FileThumbnail key={i}>
                                                    {isImg ? (
                                                        <ThumbnailImage
                                                            src={fullUrl}
                                                            alt={name}
                                                            loading="lazy"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <FileTypeCenterIcon>
                                                            <FileTypeEmoji>{getFileEmoji(ext)}</FileTypeEmoji>
                                                            <FileExtText>{ext || 'FILE'}</FileExtText>
                                                        </FileTypeCenterIcon>
                                                    )}
                                                    <ThumbnailOverlay>
                                                        <DownloadBtn onClick={(e) => { e.stopPropagation(); handleDownload(url); }}>
                                                            <DownloadIcon /> {'\u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1'}
                                                        </DownloadBtn>
                                                        <ThumbnailFileName title={name}>{name}</ThumbnailFileName>
                                                    </ThumbnailOverlay>
                                                </FileThumbnail>
                                            );
                                        })}
                                    </FileThumbnailGrid>
                                )}
                            </SectionBody>
                        </SectionCard>
                    )}

                    {/* Resource Links */}
                    {hasResourceLinks && (
                        <SectionCard>
                            <SectionHeader>
                                <SectionIcon>{'\uD83D\uDD17'}</SectionIcon>
                                <SectionTitle>{'\u09B0\u09BF\u09B8\u09CB\u09B0\u09CD\u09B8 \u09B2\u09BF\u0982\u0995'} ({selectedTask.resourceLinks!.length})</SectionTitle>
                            </SectionHeader>
                            <SectionBody>
                                <LinksList>
                                    {selectedTask.resourceLinks!.map((link, index) => (
                                        <LinkItem key={index} href={link} target="_blank" rel="noopener noreferrer">
                                            <ExternalLinkIcon />
                                            {link.length > 80 ? link.substring(0, 80) + '...' : link}
                                        </LinkItem>
                                    ))}
                                </LinksList>
                            </SectionBody>
                        </SectionCard>
                    )}
                </ContentArea>
            </ScrollContent>

            {/* Bottom Actions */}
            {showProofForm ? (
                <ProofFormWrapper>
                    <ProofFormGrid>
                        <ProofInput placeholder={'\u0995\u09BE\u099C\u09C7\u09B0 \u09B8\u09BE\u09B0\u09BE\u0982\u09B6 \u09B2\u09BF\u0996\u09C1\u09A8 *'} value={proofSummary} onChange={(e) => setProofSummary(e.target.value)} maxLength={200} />
                        <ProofTextarea placeholder={'\u09AC\u09BF\u09B8\u09CD\u09A4\u09BE\u09B0\u09BF\u09A4 \u09A8\u09CB\u099F (\u0990\u099A\u09CD\u099B\u09BF\u0995)'} value={proofNotes} onChange={(e) => setProofNotes(e.target.value)} />
                        <FileUploadLabel>
                            {'\uD83D\uDCCE \u09AB\u09BE\u0987\u09B2 \u09B8\u0982\u09AF\u09C1\u0995\u09CD\u09A4 \u0995\u09B0\u09C1\u09A8 (\u09B8\u09B0\u09CD\u09AC\u09CB\u099A\u09CD\u099A \u09E7\u09E6MB)'}
                            {proofFiles.length > 0 && ` \u2014 ${proofFiles.length} \u099F\u09BF \u09AB\u09BE\u0987\u09B2`}
                            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.zip" onChange={(e) => { const files = Array.from(e.target.files || []).slice(0, 5); setProofFiles(files); }} />
                        </FileUploadLabel>
                        <ProofActions>
                            <ProofButton onClick={handleSubmitProof} disabled={!proofSummary.trim() || proofSubmitting} style={{ flex: 1 }}>
                                {proofSubmitting ? '\u23F3 \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B9\u099A\u09CD\u099B\u09C7...' : '\u2705 \u09AA\u09CD\u09B0\u09C1\u09AB \u09AA\u09BE\u09A0\u09BE\u09A8'}
                            </ProofButton>
                            <FinishButton onClick={() => { setShowProofForm(false); setProofFiles([]); }} style={{ color: theme.colors.text.secondary, borderColor: theme.colors.border.primary }}>
                                {'\u09AC\u09BE\u09A4\u09BF\u09B2'}
                            </FinishButton>
                        </ProofActions>
                    </ProofFormGrid>
                </ProofFormWrapper>
            ) : (
                <BottomActions>
                    <ProofButton onClick={() => setShowProofForm(true)}>{'\uD83D\uDCCE \u09AA\u09CD\u09B0\u09C1\u09AB \u09AA\u09BE\u09A0\u09BE\u09A8'}</ProofButton>
                    <FinishButton onClick={handleFinishProject}>{'\uD83C\uDFC1 \u09AA\u09CD\u09B0\u099C\u09C7\u0995\u09CD\u099F \u09B6\u09C7\u09B7'}</FinishButton>
                </BottomActions>
            )}
        </PageContainer>
    );
};

export default Playlist;
