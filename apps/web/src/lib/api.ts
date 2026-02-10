import axios from 'axios';

// Create axios instance with credentials enabled for CORS
// NOTE: Global interceptors (token auto-attach + 401 refresh+retry)
// are configured in AuthContext.tsx and apply to ALL axios instances
// including this one and raw 'import axios from "axios"' in 26+ files
const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
    timeout: 15000, // 15s timeout — prevents infinite hang when remote API/DB is slow
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
