// ============================================================
// KormoSync Desktop App - Constants
// ============================================================

// Day names in Bengali
export const DAYS_BENGALI = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
export const DAYS_ENGLISH = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Month names in Bengali
export const MONTHS_BENGALI = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

// Status labels
export const STATUS_LABELS = {
    TODO: { bn: 'নতুন', en: 'To Do', color: '#3b82f6' },
    IN_PROGRESS: { bn: 'চলমান', en: 'In Progress', color: '#22c55e' },
    REVIEW: { bn: 'রিভিউ', en: 'Review', color: '#f59e0b' },
    DONE: { bn: 'সম্পন্ন', en: 'Done', color: '#64748b' },
    PENDING: { bn: 'অপেক্ষমাণ', en: 'Pending', color: '#6b7280' },
    COMPLETED: { bn: 'শেষ', en: 'Completed', color: '#22c55e' },
};

// Priority labels
export const PRIORITY_LABELS = {
    LOW: { bn: 'কম', en: 'Low', color: '#22c55e' },
    MEDIUM: { bn: 'মাঝারি', en: 'Medium', color: '#f59e0b' },
    HIGH: { bn: 'জরুরি', en: 'High', color: '#ef4444' },
};

// Billing type labels
export const BILLING_LABELS = {
    FIXED_PRICE: { bn: 'ফিক্সড প্রাইস', en: 'Fixed Price', icon: '🏷️' },
    HOURLY: { bn: 'আওয়ারলি', en: 'Hourly', icon: '⏱️' },
    SCHEDULED: { bn: 'শিডিউল', en: 'Scheduled', icon: '📅' },
};

// Schedule status labels
export const SCHEDULE_STATUS_LABELS = {
    active: { bn: 'চলছে', en: 'Active', color: '#22c55e' },
    locked: { bn: 'লক', en: 'Locked', color: '#6b7280' },
    starting_soon: { bn: 'শীঘ্রই শুরু', en: 'Starting Soon', color: '#f59e0b' },
    ended: { bn: 'শেষ হয়েছে', en: 'Ended', color: '#ef4444' },
    no_schedule: { bn: 'যেকোনো সময়', en: 'Anytime', color: '#3b82f6' },
};

// API URLs
export const API_URL = 'http://localhost:8001/api';
export const SOCKET_URL = 'http://localhost:8001';

// Time constants
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;
export const MINUTES_PER_HOUR = 60;

// Default settings
export const DEFAULT_SETTINGS = {
    theme: 'dark' as const,
    language: 'en' as const,
    idleTimeout: 5,           // minutes
    screenshotInterval: 5,    // minutes
    alwaysOnTop: false,
    minimizeToTray: true,
    autoStart: false,
    notifications: true,
};

// Window dimensions
export const WINDOW_SIZES = {
    main: { width: 1100, height: 750 },
    mini: { width: 350, height: 80 },
    widget: { width: 380, height: 100 },
};

// Navigation items
export const NAV_ITEMS = [
    { id: 'home', icon: '🏠', label: 'হোম', labelEn: 'Home' },
    { id: 'tasks', icon: '📋', label: 'টাস্ক', labelEn: 'Tasks' },
    { id: 'history', icon: '📊', label: 'ইতিহাস', labelEn: 'History' },
    { id: 'settings', icon: '⚙️', label: 'সেটিংস', labelEn: 'Settings' },
];

// Screenshot intervals (minutes)
export const SCREENSHOT_INTERVALS = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60];

// Idle detection
export const IDLE_WARNING_THRESHOLD = 300;  // 5 minutes in seconds
export const IDLE_AUTO_PAUSE_DELAY = 30;    // 30 seconds countdown

// Toast durations (ms)
export const TOAST_DURATION = {
    short: 2000,
    normal: 3000,
    long: 5000,
};

// Animation durations (ms)
export const ANIMATION_DURATION = {
    fast: 150,
    normal: 250,
    slow: 350,
};

// File upload limits
export const UPLOAD_LIMITS = {
    maxFileSize: 100 * 1024 * 1024,  // 100MB
    maxFiles: 5,
    allowedTypes: ['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip'],
};
