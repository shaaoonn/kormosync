// ============================================================
// KormoSync Desktop App - API Service
// ============================================================

import axios, { AxiosError } from 'axios';
import type { AxiosInstance } from 'axios';
import { auth } from '../firebase';
import { API_URL } from '../utils/constants';
import type { Task, User, TodayStats, SubTask, ApiResponse } from '../types';

// Create axios instance
export const api: AxiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 15000, // 15s — prevents long hangs when API is slow/down
    headers: {
        'Content-Type': 'application/json',
    },
});

// Retry helper with exponential backoff
async function retryRequest<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 2000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const isRetryable = error.code === 'ECONNABORTED' ||
                error.code === 'ERR_NETWORK' ||
                error.message?.includes('timeout') ||
                error.message?.includes('Network Error') ||
                (error.response?.status && error.response.status >= 500);
            if (!isRetryable || i === maxRetries - 1) throw error;
            const delay = baseDelay * Math.pow(2, i);
            console.log(`⏳ Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

// Request interceptor
api.interceptors.request.use(
    async (config) => {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        if (import.meta.env.DEV) {
            console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        if (import.meta.env.DEV) {
            console.log(`✅ API Response: ${response.status} from ${response.config.url}`);
        }
        return response;
    },
    (error) => {
        console.error(`❌ API Error: ${error.message} URL: ${error.config?.baseURL}${error.config?.url}`);
        if (error.response) {
            console.error('Response Data:', error.response.data);
            console.error('Response Status:', error.response.status);
        }
        if (error.response?.status === 401) {
            // Token expired or invalid - redirect to login
            window.location.hash = '#/login';
        }
        return Promise.reject(error);
    }
);

// ============================================================
// Auth APIs
// ============================================================
export const authApi = {
    /**
     * Get current user profile (with retry)
     */
    getMe: async (): Promise<User> => {
        return retryRequest(async () => {
            const { data } = await api.get('/auth/me');
            if (!data.success) throw new Error(data.error);
            return data.user;
        });
    },

    /**
     * Sync user (create if not exists) — with retry
     */
    syncUser: async (): Promise<User> => {
        return retryRequest(async () => {
            const { data } = await api.post('/auth/sync', {});
            if (!data.success) throw new Error(data.error);
            return data.user;
        });
    },
};

// ============================================================
// Task APIs
// ============================================================
export const taskApi = {
    /**
     * Get all tasks for current user
     */
    getTasks: async (): Promise<Task[]> => {
        const { data } = await api.get('/tasks/list');
        if (!data.success) throw new Error(data.error);
        return data.tasks;
    },

    /**
     * Get single task with details
     */
    getTask: async (taskId: string): Promise<Task> => {
        const { data } = await api.get(`/tasks/${taskId}`);
        if (!data.success) throw new Error(data.error);
        return data.task;
    },

    /**
     * Start tracking a task (main task time log)
     */
    startTask: async (taskId: string): Promise<{ timeLogId: string }> => {
        const { data } = await api.post('/tasks/start', { taskId });
        if (!data.success) throw new Error(data.error);
        return { timeLogId: data.timeLog.id };
    },

    /**
     * Stop tracking a task
     */
    stopTask: async (timeLogId: string): Promise<void> => {
        const { data } = await api.post('/tasks/stop', { timeLogId });
        if (!data.success) throw new Error(data.error);
    },
};

// ============================================================
// SubTask APIs
// ============================================================
export const subTaskApi = {
    /**
     * Get subtasks for a task
     */
    getSubTasks: async (taskId: string): Promise<SubTask[]> => {
        const { data } = await api.get(`/subtasks/task/${taskId}`);
        if (!data.success) throw new Error(data.error);
        return data.subTasks;
    },

    /**
     * Get currently active subtask
     */
    getActive: async (): Promise<SubTask | null> => {
        const { data } = await api.get('/subtasks/active');
        if (!data.success) return null;
        return data.activeSubTask;
    },

    /**
     * Start a subtask
     */
    start: async (subTaskId: string): Promise<void> => {
        const { data } = await api.post(`/subtasks/${subTaskId}/start`);
        if (!data.success) throw new Error(data.error || data.message);
    },

    /**
     * Stop (pause) a subtask
     */
    stop: async (subTaskId: string): Promise<void> => {
        const { data } = await api.post(`/subtasks/${subTaskId}/stop`);
        if (!data.success) throw new Error(data.error);
    },

    /**
     * Complete a subtask
     */
    complete: async (subTaskId: string, proofOfWork?: { note?: string }): Promise<void> => {
        const { data } = await api.post(`/subtasks/${subTaskId}/complete`, proofOfWork || {});
        if (!data.success) throw new Error(data.error);
    },

    /**
     * Auto-stop (when schedule ends)
     */
    autoStop: async (subTaskId: string, proofOfWork?: { note?: string }): Promise<void> => {
        const { data } = await api.post(`/subtasks/${subTaskId}/auto-stop`, proofOfWork || {});
        if (!data.success) throw new Error(data.error);
    },

    /**
     * Update subtask time
     */
    updateTime: async (subTaskId: string, totalSeconds: number): Promise<void> => {
        const { data } = await api.patch(`/subtasks/${subTaskId}/time`, { totalSeconds });
        if (!data.success) throw new Error(data.error);
    },
};

// ============================================================
// Activity APIs
// ============================================================
export const activityApi = {
    /**
     * Get today's statistics
     */
    getToday: async (): Promise<TodayStats> => {
        const { data } = await api.get('/activity/today');
        if (!data.success) throw new Error(data.error);
        return data.stats;
    },

    /**
     * Log activity interval
     */
    logActivity: async (activityData: {
        taskId: string;
        subTaskId?: string;
        intervalStart: Date;
        intervalEnd: Date;
        keystrokes: number;
        mouseClicks: number;
        mouseMovement: number;
        activeSeconds: number;
    }): Promise<void> => {
        const { data } = await api.post('/activity/log', activityData);
        if (!data.success) throw new Error(data.error);
    },
};

// ============================================================
// Screenshot APIs
// ============================================================
export const screenshotApi = {
    /**
     * Upload screenshot
     */
    upload: async (formData: FormData): Promise<{ id: string; imageUrl: string }> => {
        const { data } = await api.post('/screenshots/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 30000, // 30s — reduced from 90s to prevent long-hanging requests that exhaust API memory
        });
        if (!data.success) throw new Error(data.error);
        return data.screenshot;
    },

    /**
     * Get screenshots for a task
     */
    getByTask: async (taskId: string): Promise<any[]> => {
        const { data } = await api.get('/screenshots/list', {
            params: { taskId },
        });
        if (!data.success) throw new Error(data.error);
        return data.screenshots;
    },
};

// ============================================================
// Upload API
// ============================================================
export const uploadApi = {
    /**
     * Upload file (attachment, proof of work, etc.)
     */
    uploadFile: async (file: File): Promise<{ url: string; key: string }> => {
        const formData = new FormData();
        formData.append('file', file);

        const { data } = await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (!data.success) throw new Error(data.error);
        return { url: data.url, key: data.key };
    },
};

// ============================================================
// TimeLog API
// ============================================================
export const timeLogApi = {
    getLogs: async (params: { date?: string; taskId?: string }): Promise<any[]> => {
        const { data } = await api.get('/timelogs', { params });
        if (!data.success) throw new Error(data.message);
        return data.data;
    },
};

// ============================================================
// Assignment APIs (Task Approval Workflow)
// ============================================================
export const assignmentApi = {
    /** Get pending assignments for current user */
    getPending: async (): Promise<any[]> => {
        const { data } = await api.get('/assignments/pending');
        if (!data.success) throw new Error(data.error);
        return data.assignments;
    },

    /** Accept an assignment */
    accept: async (assignmentId: string): Promise<void> => {
        const { data } = await api.post(`/assignments/${assignmentId}/accept`);
        if (!data.success) throw new Error(data.error);
    },

    /** Reject an assignment */
    reject: async (assignmentId: string): Promise<void> => {
        const { data } = await api.post(`/assignments/${assignmentId}/reject`);
        if (!data.success) throw new Error(data.error);
    },
};

// ============================================================
// Work Proof APIs
// ============================================================
export const proofApi = {
    /** Submit work proof */
    submit: async (proofData: {
        taskId: string;
        subTaskId?: string;
        summary: string;
        notes?: string;
        attachments?: string[];
    }): Promise<any> => {
        const { data } = await api.post('/proofs/submit', proofData);
        if (!data.success) throw new Error(data.error);
        return data.proof;
    },

    /** Get my proofs */
    getMyProofs: async (): Promise<any[]> => {
        const { data } = await api.get('/proofs/my');
        if (!data.success) throw new Error(data.error);
        return data.proofs;
    },
};

// ============================================================
// Leave APIs
// ============================================================
export const leaveApi = {
    /** Request leave */
    requestLeave: async (data: {
        type: string;
        startDate: string;
        endDate: string;
        reason?: string;
    }): Promise<any> => {
        const { data: res } = await api.post('/leave/request', data);
        if (!res.success) throw new Error(res.error);
        return res.leaveRequest;
    },

    /** Get my leave requests */
    getMyRequests: async (): Promise<any[]> => {
        const { data: res } = await api.get('/leave/my-requests');
        if (!res.success) throw new Error(res.error);
        return res.leaveRequests;
    },

    /** Get my leave balance */
    getMyBalance: async (): Promise<any> => {
        const { data: res } = await api.get('/leave/my-balance');
        if (!res.success) throw new Error(res.error);
        return res.balance;
    },

    /** Cancel a pending leave request */
    cancel: async (id: string): Promise<void> => {
        const { data: res } = await api.delete(`/leave/${id}/cancel`);
        if (!res.success) throw new Error(res.error);
    },
};

// ============================================================
// Earnings APIs
// ============================================================
export const earningsApi = {
    /** Get current earnings (since last pay) */
    getCurrentEarnings: async (): Promise<any> => {
        const { data: res } = await api.get('/payroll/current-earnings');
        if (!res.success) throw new Error(res.error);
        return res.earnings;
    },
};

// ============================================================
// Duty Progress API (for MONTHLY salary employees)
// ============================================================
export const dutyApi = {
    /** Get today's duty achievement progress */
    getDutyProgress: async (): Promise<any> => {
        const { data: res } = await api.get('/profile/duty-progress');
        if (!res.success) throw new Error(res.error);
        return res.dutyProgress;
    },
};

// ============================================================
// Task Notes (Work Journal) APIs
// ============================================================
export const noteApi = {
    /** Get notes for a task */
    getByTask: async (taskId: string): Promise<any[]> => {
        const { data: res } = await api.get(`/notes/${taskId}`);
        if (!res.success) throw new Error(res.error);
        return res.notes;
    },

    /** Add a note to a task */
    create: async (taskId: string, content: string, subTaskId?: string): Promise<any> => {
        const { data: res } = await api.post(`/notes/${taskId}`, { content, subTaskId });
        if (!res.success) throw new Error(res.error);
        return res.note;
    },

    /** Delete a note */
    delete: async (noteId: string): Promise<void> => {
        const { data: res } = await api.delete(`/notes/${noteId}`);
        if (!res.success) throw new Error(res.error);
    },
};

// Export default api instance for custom requests
export default api;
