import React from 'react';
import styled from 'styled-components';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { theme } from '../../styles/theme';

const AppLayoutContainer = styled.div`
    display: flex;
    height: 100%;
    width: 100%;
    background: ${theme.colors.bg.primary};
    overflow: hidden;
`;

const MainContent = styled.main`
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
`;

export const AppLayout: React.FC = () => {
    return (
        <AppLayoutContainer>
            <Sidebar />

            <MainContent>
                <Outlet />
            </MainContent>
        </AppLayoutContainer>
    );
};
