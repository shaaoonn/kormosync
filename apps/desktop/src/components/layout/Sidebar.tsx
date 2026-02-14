import React, { useState } from 'react';
import styled, { css } from 'styled-components';
import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { theme } from '../../styles/theme';
// react-hot-toast removed — using built-in Zustand toast system

// Icons need to be sourced. For now using text emojis or basic SVGs if available.
// Assuming we can use emojis as per user design or simple divs.
// The user prompt used emojis in the description: 🏠, 📋, 📊, ⚙️, 🚪

const SidebarContainer = styled.aside<{ $expanded: boolean }>`
    width: ${({ $expanded }) => ($expanded ? '200px' : '64px')};
    min-width: ${({ $expanded }) => ($expanded ? '200px' : '64px')};
    height: 100%;
    background: ${theme.colors.bg.secondary};
    border-right: 1px solid ${theme.colors.border.primary};
    display: flex;
    flex-direction: column;
    transition: width 0.3s ease, min-width 0.3s ease;
    overflow-x: hidden;
    overflow-y: auto;
    z-index: 100;
    flex-shrink: 0;
`;

const SidebarHeader = styled.div`
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 ${theme.spacing.sm};
    border-bottom: 1px solid ${theme.colors.border.primary};
    cursor: pointer;
    -webkit-app-region: drag;
    flex-shrink: 0;
`;

const LogoIcon = styled.div`
    font-size: 24px;
    min-width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${theme.colors.primary.gradient};
    border-radius: ${theme.borderRadius.md};
    color: white;
`;

const LogoText = styled.div<{ $visible: boolean }>`
    margin-left: ${theme.spacing.sm};
    font-weight: bold;
    font-size: ${theme.typography.fontSize.md};
    color: ${theme.colors.text.primary};
    opacity: ${({ $visible }) => ($visible ? 1 : 0)};
    transition: opacity 0.2s;
    white-space: nowrap;
    overflow: hidden;
`;

const NavList = styled.nav`
    flex: 1;
    padding: ${theme.spacing.md} 0;
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.xs};
`;

const NavItem = styled(NavLink)`
    display: flex;
    align-items: center;
    height: 48px;
    padding: 0 ${theme.spacing.md};
    color: ${theme.colors.text.secondary};
    text-decoration: none;
    transition: all 0.2s;
    position: relative;

    &:hover {
        background: ${theme.colors.bg.hover};
        color: ${theme.colors.text.primary};
    }

    &.active {
        background: ${theme.colors.primary.main}15;
        color: ${theme.colors.primary.main};
        border-right: 3px solid ${theme.colors.primary.main};
    }
`;

const NavIcon = styled.span`
    font-size: 20px;
    min-width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const NavLabel = styled.span<{ $visible: boolean }>`
    margin-left: ${theme.spacing.md};
    opacity: ${({ $visible }) => ($visible ? 1 : 0)};
    transition: opacity 0.2s;
    white-space: nowrap;
`;

const StatusBadge = styled.div<{ $online: boolean; $expanded: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 4px 8px;
    margin: ${theme.spacing.sm} ${theme.spacing.sm} 0;
    border-radius: ${theme.borderRadius.sm};
    background: ${({ $online }) => $online ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)'};
    border: 1px solid ${({ $online }) => $online ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'};
    transition: all 0.3s ease;
    flex-shrink: 0;
`;

const StatusDot = styled.span<{ $online: boolean }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $online }) => $online ? '#22c55e' : '#eab308'};
    box-shadow: 0 0 4px ${({ $online }) => $online ? 'rgba(34, 197, 94, 0.5)' : 'rgba(234, 179, 8, 0.5)'};
    flex-shrink: 0;
`;

const StatusText = styled.span<{ $visible: boolean; $online: boolean }>`
    font-size: 11px;
    font-weight: 600;
    color: ${({ $online }) => $online ? '#22c55e' : '#eab308'};
    opacity: ${({ $visible }) => ($visible ? 1 : 0)};
    transition: opacity 0.2s;
    white-space: nowrap;
    overflow: hidden;
`;

const Spacer = styled.div`
    flex: 1;
`;

const SidebarFooter = styled.div`
    padding: ${theme.spacing.sm};
    border-top: 1px solid ${theme.colors.border.primary};
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.xs};
    flex-shrink: 0;
`;

const UserInfo = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    overflow: hidden;
`;

const UserAvatar = styled.div`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: ${theme.colors.primary.main};
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    font-weight: bold;
    flex-shrink: 0;
`;

const UserDetails = styled.div<{ $visible: boolean }>`
    display: flex;
    flex-direction: column;
    opacity: ${({ $visible }) => ($visible ? 1 : 0)};
    transition: opacity 0.2s;
    overflow: hidden;
`;

const UserName = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    font-weight: bold;
    color: ${theme.colors.text.primary};
    white-space: nowrap;
`;

const UserRole = styled.span`
    font-size: ${theme.typography.fontSize.xs};
    color: ${theme.colors.text.muted};
    white-space: nowrap;
`;

const LogoutButton = styled.button<{ $expanded: boolean }>`
    display: flex;
    align-items: center;
    justify-content: ${({ $expanded }) => ($expanded ? 'flex-start' : 'center')};
    width: 100%;
    padding: ${theme.spacing.sm};
    background: transparent;
    border: 1px solid transparent; 
    border-radius: ${theme.borderRadius.md};
    color: ${theme.colors.status.error};
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
        background: ${theme.colors.status.error}15;
    }
`;

export const Sidebar: React.FC = () => {
    const [expanded, setExpanded] = useState(false);
    const { activeTimers, logout, addToast, isOffline, user } = useAppStore();
    const userRole = (window as any).__DEBUG_USER_ROLE__ || 'User';

    const toggleSidebar = () => setExpanded(!expanded);

    const handleLogout = () => {
        if (Object.keys(activeTimers).length > 0) {
            addToast('error', 'টাইমার চলছে! আগে বন্ধ করুন।');
            return;
        }
        logout(); // signOut(auth) + store cleanup; App.tsx handles redirect
    };

    return (
        <SidebarContainer $expanded={expanded} onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
            <SidebarHeader>
                <LogoIcon>⚡</LogoIcon>
                <LogoText $visible={expanded}>KormoSync</LogoText>
            </SidebarHeader>

            <StatusBadge $online={!isOffline} $expanded={expanded}>
                <StatusDot $online={!isOffline} />
                <StatusText $visible={expanded} $online={!isOffline}>
                    {isOffline ? 'অফলাইন' : 'লাইভ'}
                </StatusText>
            </StatusBadge>

            <NavList>
                <NavItem to="/dashboard" end>
                    <NavIcon>🏠</NavIcon>
                    <NavLabel $visible={expanded}>হোম</NavLabel>
                </NavItem>
                <NavItem to="/dashboard?tab=tasks">
                    <NavIcon>📋</NavIcon>
                    <NavLabel $visible={expanded}>টাস্ক</NavLabel>
                </NavItem>
                <NavItem to="/history">
                    <NavIcon>📊</NavIcon>
                    <NavLabel $visible={expanded}>ইতিহাস</NavLabel>
                </NavItem>
                <NavItem to="/settings">
                    <NavIcon>⚙️</NavIcon>
                    <NavLabel $visible={expanded}>সেটিংস</NavLabel>
                </NavItem>
            </NavList>

            <Spacer />

            <SidebarFooter>
                {user && (
                    <UserInfo>
                        <UserAvatar>{(user.email || user.name || '?')[0].toUpperCase()}</UserAvatar>
                        <UserDetails $visible={expanded}>
                            <UserName>{user.name || user.email?.split('@')[0] || 'User'}</UserName>
                            <UserRole>{userRole}</UserRole>
                        </UserDetails>
                    </UserInfo>
                )}
                <LogoutButton onClick={handleLogout} $expanded={expanded} title="লগআউট">
                    <NavIcon>🚪</NavIcon>
                    <NavLabel $visible={expanded}>লগআউট</NavLabel>
                </LogoutButton>
            </SidebarFooter>
        </SidebarContainer>
    );
};
