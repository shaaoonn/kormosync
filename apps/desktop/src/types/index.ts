// ============================================================
// KormoSync Desktop App - Type Definitions
// ============================================================

// User & Auth
export interface User {
    id: string;
    firebaseUid: string;
    email: string;
    name: string;
    companyId: string;
    role: 'OWNER' | 'ADMIN' | 'EMPLOYEE' | 'FREELANCER';
    profileImage?: string;
}

// Task Types
export type BillingType = 'FIXED_PRICE' | 'HOURLY' | 'SCHEDULED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type SubTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    deadline?: string;
    billingType: BillingType;
    fixedPrice?: number;
    hourlyRate?: number;
    estimatedHours?: number;
    scheduleDays?: number[];  // 0=Sun, 1=Mon, ..., 6=Sat
    startTime?: string;       // "09:00" format
    endTime?: string;         // "17:00" format
    allowOvertime?: boolean;  // Allow work beyond endTime?
    screenshotInterval: number;
    monitoringMode?: 'TRANSPARENT' | 'STEALTH';
    companyId?: string;
    creatorId: string;
    subTasks?: SubTask[];
    totalWorkedSeconds?: number;
    // Admin control flags
    isActive?: boolean;
    pausedAt?: string;
    pausedReason?: string;
    screenshotEnabled?: boolean;
    activityEnabled?: boolean;
    // Phase 9: New features
    isRecurring?: boolean;
    recurringType?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    maxBudget?: number;
    reviewerId?: string;
    isBlocked?: boolean; // Derived from dependencies
    // Phase 10: Employee completion & break
    employeeCanComplete?: boolean;
    breakReminderEnabled?: boolean;
    breakAfterHours?: number;
    // Attachments & resources
    attachments?: string[];
    resourceLinks?: string[];
    videoUrl?: string;
    // UI related
    icon?: string;
    currency?: string;
    color?: string;
    client?: {
        id?: string;
        name?: string;
    };
}

// Phase 9: Checklist
export interface TaskChecklistItem {
    id: string;
    title: string;
    isCompleted: boolean;
    orderIndex: number;
}

export interface SubTask {
    id: string;
    taskId: string;
    title: string;
    description?: string;
    status: SubTaskStatus;
    billingType: BillingType;
    fixedPrice?: number;
    hourlyRate?: number;
    estimatedHours?: number;
    scheduleDays?: number[];
    startTime?: string;
    endTime?: string;
    allowOvertime?: boolean;
    totalSeconds: number;
    orderIndex: number;
    // Aliases for tracked time (from server)
    trackedTime?: number;
    estimatedTime?: number;
}

// Schedule Status
export type ScheduleStatus =
    | 'active'           // Currently within scheduled time
    | 'locked'           // Outside scheduled time
    | 'starting_soon'    // Within 30 minutes of start
    | 'ended'            // Past end time today
    | 'overtime'         // Past end time but overtime allowed
    | 'no_schedule';     // No schedule restrictions

export interface ScheduleInfo {
    status: ScheduleStatus;
    message: string;
    timeUntilStart?: number;  // seconds
    timeUntilEnd?: number;    // seconds
    canStart: boolean;
    scheduleText?: string;    // e.g., "সোম-শুক্র, ৯:০০ AM - ৫:০০ PM"
}

// Active Tracking State
export interface ActiveTimer {
    subTaskId: string;
    taskId: string;
    startedAt: number;        // timestamp
    elapsedSeconds: number;
    isPaused: boolean;
}

// Multiple concurrent timers support
export interface TimerState {
    activeTimers: Map<string, ActiveTimer>;  // subTaskId -> timer
    globalElapsed: number;                   // total across all active
}

// Toast Notifications
export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

// Screenshot
export interface Screenshot {
    id: string;
    imageUrl: string;
    taskId: string;
    subTaskId?: string;
    activityScore: number;
    keyboardCount: number;
    mouseCount: number;
    recordedAt: string;
}

// Activity Stats
export interface ActivityStats {
    keystrokes: number;
    mouseClicks: number;
}

export interface TodayStats {
    totalSeconds: number;
    totalKeystrokes: number;
    totalMouseClicks: number;
    averageActivity: number;
    sessionsCount: number;
}

// Proof of Work
export interface ProofOfWork {
    subTaskId: string;
    note?: string;
    files?: File[];
}

// Task Assignment (Approval Workflow)
export type TaskAssignmentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface TaskAssignment {
    id: string;
    taskId: string;
    userId: string;
    status: TaskAssignmentStatus;
    assignedAt: string;
    respondedAt?: string;
    task: {
        id: string;
        title: string;
        description?: string;
        priority: string;
        deadline?: string;
        billingType: BillingType;
        hourlyRate?: number;
        fixedPrice?: number;
        estimatedHours?: number;
        screenshotInterval: number;
        monitoringMode?: string;
        creator?: { id: string; name: string; email: string };
        subTasks?: SubTask[];
    };
}

// Work Proof (Employee Submission)
export interface WorkProofData {
    id: string;
    taskId: string;
    subTaskId?: string;
    userId: string;
    summary: string;
    notes?: string;
    attachments: string[];
    createdAt: string;
}

// Leave Management
export type LeaveType = 'PAID' | 'UNPAID' | 'SICK' | 'HALF_DAY';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
    id: string;
    userId: string;
    companyId: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason?: string;
    status: LeaveStatus;
    approvedBy?: string;
    approvedAt?: string;
    rejectedReason?: string;
    createdAt: string;
    updatedAt: string;
    user?: { id: string; name: string; email: string; profileImage?: string };
    approver?: { id: string; name: string };
}

export interface LeaveBalance {
    id: string;
    userId: string;
    year: number;
    paidLeave: number;
    sickLeave: number;
    unpaidLeave: number;
    paidUsed: number;
    sickUsed: number;
    unpaidUsed: number;
    paidRemaining: number;
    sickRemaining: number;
}

// Earnings
export interface EarningsBreakdown {
    periodStart: string;
    periodEnd: string;
    workedHours: number;
    workedAmount: number;
    paidLeaveDays: number;
    leaveHours: number;
    leavePay: number;
    overtimeHours: number;
    overtimePay: number;
    overtimeRate: number;
    penaltyHours: number;
    penaltyAmount: number;
    salaryType: string;
    monthlySalary: number;
    workedDays: number;
    totalWorkingDays: number;
    grossAmount: number;
    netAmount: number;
    currency: string;
}

// Task Note (Work Journal)
export interface TaskNote {
    id: string;
    taskId: string;
    subTaskId?: string;
    userId: string;
    content: string;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        email: string;
        profileImage?: string;
    };
}

// App Settings
export interface AppSettings {
    theme: 'dark' | 'light';
    language: 'bn' | 'en';
    idleTimeout: number;      // minutes
    screenshotInterval: number; // minutes
    alwaysOnTop: boolean;
    minimizeToTray: boolean;
    autoStart: boolean;
    notifications: boolean;
}

// Navigation
export type NavItem = 'home' | 'tasks' | 'history' | 'settings';

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
