/**
 * Global Axios Interceptors — auto-token + 401 refresh+retry
 *
 * This file sets up interceptors on the DEFAULT axios instance.
 * Since 26+ files use raw 'import axios from "axios"', this ensures
 * ALL API calls get fresh Firebase tokens automatically.
 *
 * Imported once in AuthContext.tsx (which wraps all pages).
 */
import axios from 'axios';
import { auth } from './firebase';

// ============================================================
// GLOBAL AXIOS CONFIG
// ============================================================
axios.defaults.timeout = 30000; // 30 seconds — some endpoints are heavy (monitoring, activity)

// ============================================================
// Setup flag — ensure interceptors are only registered once
// ============================================================
let isSetup = false;

export function setupGlobalAxiosInterceptors() {
    if (isSetup) return;
    isSetup = true;

    // REQUEST: Auto-attach fresh Firebase token to every request
    axios.interceptors.request.use(
        async (config) => {
            try {
                const user = auth.currentUser;
                if (user) {
                    // ALWAYS override — pages may pass stale token from useAuth context
                    // getIdToken() returns cached token if valid, auto-refreshes if <5min remaining
                    const token = await user.getIdToken();
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (e) {
                // Silent fail — let the request go, 401 interceptor will handle
            }
            return config;
        },
        (error) => Promise.reject(error)
    );

    // RESPONSE: Handle 401 with force-refresh + retry
    let isRefreshing = false;
    let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

    const processQueue = (error: any, token: string | null) => {
        failedQueue.forEach(({ resolve, reject }) => {
            if (token) resolve(token);
            else reject(error);
        });
        failedQueue = [];
    };

    axios.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;

            // Only handle 401, only retry once per request
            if (error.response?.status === 401 && !originalRequest._retry) {
                // If already refreshing, queue this request
                if (isRefreshing) {
                    return new Promise<string>((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    }).then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return axios(originalRequest);
                    });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const user = auth.currentUser;
                    if (user) {
                        // Force refresh the token (bypasses cache)
                        const newToken = await user.getIdToken(true);
                        processQueue(null, newToken);
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        return axios(originalRequest);
                    }
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }

            // Fix 7C: Handle 429 (server busy) and 503 (maintenance) errors
            if (error.response?.status === 429) {
                console.warn('[AXIOS] Server busy (429) — rate limited');
            }
            if (error.response?.status === 503) {
                console.warn('[AXIOS] Service unavailable (503) — server maintenance');
            }

            return Promise.reject(error);
        }
    );

    console.log('[AXIOS] Global interceptors registered (auto-token + 401 refresh)');
}
