// ============================================================
// KormoSync Desktop App - Design System & Theme
// ============================================================

export const theme = {
    // Colors
    colors: {
        // Background Colors (Dark Theme — lighter, better contrast)
        bg: {
            primary: '#111827',      // Main background (was #0a0e1a)
            secondary: '#1e293b',    // Sidebar & section bg (was #0f172a)
            tertiary: '#334155',     // Cards background (was #1e293b)
            elevated: '#2d3748',     // Modals, dropdowns (was #1a1f35)
            hover: '#4a5568',        // Hover states (was #252d3d)
            deep: '#0f172a',         // Deepest background (was #030712)
        },

        // Primary brand color
        primary: {
            main: '#eab308',         // Yellow/Gold (brand)
            light: '#facc15',        // Lighter yellow
            dark: '#ca8a04',         // Darker yellow
            gradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
            glow: 'rgba(234, 179, 8, 0.3)',
            muted: 'rgba(234, 179, 8, 0.15)',
        },

        // Status Colors
        status: {
            success: '#22c55e',      // Green - running/active
            successGlow: 'rgba(34, 197, 94, 0.3)',
            warning: '#f59e0b',      // Amber - paused/warning
            info: '#3b82f6',         // Blue - info/pending
            error: '#ef4444',        // Red - error
            danger: '#ef4444',       // Red - stop/error (alias)
            dangerGlow: 'rgba(239, 68, 68, 0.3)',
        },

        // Text Colors
        text: {
            primary: '#f1f5f9',      // White-ish
            secondary: '#94a3b8',    // Gray
            muted: '#64748b',        // Darker gray
            disabled: '#475569',     // Very dark gray
            inverse: '#0f172a',      // For light backgrounds
        },

        // Border Colors (more visible)
        border: {
            primary: 'rgba(100, 116, 139, 0.4)',
            secondary: 'rgba(100, 116, 139, 0.6)',
            active: 'rgba(234, 179, 8, 0.5)',
            focus: 'rgba(234, 179, 8, 0.8)',
        },

        // Legacy gradients (updated for lighter theme)
        gradients: {
            primary: 'linear-gradient(135deg, #eab308, #ca8a04)',
            success: 'linear-gradient(135deg, #22c55e, #16a34a)',
            danger: 'linear-gradient(135deg, #ef4444, #dc2626)',
            card: 'linear-gradient(135deg, rgba(51, 65, 85, 0.8), rgba(30, 41, 59, 0.9))',
            sidebar: 'linear-gradient(180deg, #1e293b 0%, #111827 100%)',
        },
    },

    // Typography
    typography: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontFamilyBengali: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
        fontFamilyMono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        fontSize: {
            xs: '10px',
            sm: '12px',
            base: '14px',
            md: '16px',
            lg: '18px',
            xl: '24px',
            '2xl': '28px',
            '3xl': '32px',
            '4xl': '40px',
            timer: '56px',
        },
        fontWeight: {
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700,
            extrabold: 800,
        },
    },

    // Spacing
    spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
    },

    // Border Radius
    borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        full: '9999px',
    },

    // Shadows
    shadows: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        md: '0 4px 6px rgba(0, 0, 0, 0.4)',
        lg: '0 10px 20px rgba(0, 0, 0, 0.5)',
        xl: '0 20px 40px rgba(0, 0, 0, 0.6)',
        glow: {
            yellow: '0 0 20px rgba(234, 179, 8, 0.4)',
            green: '0 0 20px rgba(34, 197, 94, 0.4)',
            red: '0 0 20px rgba(239, 68, 68, 0.4)',
        },
    },

    // Animation
    animation: {
        duration: {
            fast: '150ms',
            normal: '250ms',
            slow: '350ms',
        },
        easing: {
            default: 'ease',
            spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        },
    },

    // Z-Index
    zIndex: {
        base: 0,
        dropdown: 100,
        sticky: 200,
        modal: 300,
        popover: 400,
        tooltip: 500,
        toast: 600,
        widget: 700,
    },
};

export default theme;
