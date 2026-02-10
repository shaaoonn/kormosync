import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { Card, Button } from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_SETTINGS } from '../utils/constants';

const PageWrapper = styled.div`
    display: flex;
    flex-direction: column;
    padding: ${theme.spacing.lg};
    gap: ${theme.spacing.xl};
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
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

const SettingsContainer = styled(Card)`
    padding: ${theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.xl};
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.md};
`;

const SectionTitle = styled.h2`
    margin: 0;
    font-size: ${theme.typography.fontSize.lg};
    color: ${theme.colors.text.primary};
    border-bottom: 1px solid ${theme.colors.border.primary};
    padding-bottom: ${theme.spacing.sm};
`;

const SettingRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${theme.spacing.xs} 0;
`;

const Label = styled.label`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const LabelText = styled.span`
    font-size: ${theme.typography.fontSize.md};
    color: ${theme.colors.text.primary};
`;

const LabelDescription = styled.span`
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.text.secondary};
`;

const Control = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    min-width: 200px;
    justify-content: flex-end;
`;

const StyledSelect = styled.select`
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    background: ${theme.colors.bg.tertiary};
    color: ${theme.colors.text.primary};
    border: 1px solid ${theme.colors.border.primary};
    border-radius: ${theme.borderRadius.md};
    font-family: inherit;
    font-size: ${theme.typography.fontSize.md};
    outline: none;
    cursor: pointer;

    &:focus {
        border-color: ${theme.colors.primary.main};
    }
`;

const ToggleSwitch = styled.label`
    position: relative;
    display: inline-block;
    width: 60px;
    height: 30px;
`;

const ToggleInput = styled.input`
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + span {
        background-color: ${theme.colors.primary.main};
    }

    &:checked + span:before {
        transform: translateX(30px);
    }
`;

const ToggleSlider = styled.span`
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${theme.colors.bg.tertiary};
    border: 1px solid ${theme.colors.border.primary};
    transition: .4s;
    border-radius: 34px;

    &:before {
        position: absolute;
        content: "";
        height: 22px;
        width: 22px;
        left: 4px;
        bottom: 3px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
    }
`;



const ActionButtons = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${theme.spacing.md};
    margin-top: ${theme.spacing.lg};
`;

const Settings: React.FC = () => {
    const { settings, updateSettings, addToast } = useAppStore();
    const [localSettings, setLocalSettings] = useState(settings);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (key: keyof typeof settings, value: any) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = () => {
        updateSettings(localSettings);
        setHasChanges(false);
        addToast('success', 'সেটিংস সংরক্ষণ করা হয়েছে');
    };

    const handleCancel = () => {
        setLocalSettings(settings);
        setHasChanges(false);
    };

    return (
        <PageWrapper>
            <Header>
                <Title>⚙️ সেটিংস</Title>
            </Header>

            <SettingsContainer variant="default">

                <Section>
                    <SectionTitle>সাধারণ</SectionTitle>
                    <SettingRow>
                        <Label>
                            <LabelText>ভাষা (Language)</LabelText>
                            <LabelDescription>অ্যাপের ভাষা নির্বাচন করুন</LabelDescription>
                        </Label>
                        <Control>
                            <StyledSelect
                                value={localSettings.language}
                                onChange={(e) => handleChange('language', e.target.value)}
                            >
                                <option value="bn">বাংলা</option>
                                <option value="en">English</option>
                            </StyledSelect>
                        </Control>
                    </SettingRow>
                </Section>

                {/* Tracking settings moved to Admin Dashboard */}


                <Section>
                    <SectionTitle>নোটিফিকেশন ও উইজেট</SectionTitle>
                    <SettingRow>
                        <Label>
                            <LabelText>নোটিফিকেশন</LabelText>
                            <LabelDescription>সকল প্রপ-আপ নোটিফিকেশন চালু/বন্ধ করুন</LabelDescription>
                        </Label>
                        <Control>
                            <ToggleSwitch>
                                <ToggleInput
                                    type="checkbox"
                                    checked={localSettings.notifications}
                                    onChange={(e) => handleChange('notifications', e.target.checked)}
                                />
                                <ToggleSlider />
                            </ToggleSwitch>
                        </Control>
                    </SettingRow>

                    <SettingRow>
                        <Label>
                            <LabelText>সবসময় উপরে (Always on Top)</LabelText>
                            <LabelDescription>উইজেট মোডে সব উইন্ডোর উপরে থাকবে</LabelDescription>
                        </Label>
                        <Control>
                            <ToggleSwitch>
                                <ToggleInput
                                    type="checkbox"
                                    checked={localSettings.alwaysOnTop}
                                    onChange={(e) => handleChange('alwaysOnTop', e.target.checked)}
                                />
                                <ToggleSlider />
                            </ToggleSwitch>
                        </Control>
                    </SettingRow>

                    <SettingRow>
                        <Label>
                            <LabelText>মিনিমাইজ টু ট্রে</LabelText>
                            <LabelDescription>বন্ধ করলে অ্যাপটি ট্রে-তে মিনিমাইজ হবে</LabelDescription>
                        </Label>
                        <Control>
                            <ToggleSwitch>
                                <ToggleInput
                                    type="checkbox"
                                    checked={localSettings.minimizeToTray}
                                    onChange={(e) => handleChange('minimizeToTray', e.target.checked)}
                                />
                                <ToggleSlider />
                            </ToggleSwitch>
                        </Control>
                    </SettingRow>
                </Section>

                <ActionButtons>
                    <Button variant="secondary" onClick={handleCancel} disabled={!hasChanges}>
                        বাতিল
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={!hasChanges}>
                        সংরক্ষণ করুন
                    </Button>
                </ActionButtons>

            </SettingsContainer>
        </PageWrapper>
    );
};

export default Settings;
