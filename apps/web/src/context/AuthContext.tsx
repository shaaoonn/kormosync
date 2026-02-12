"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { setupGlobalAxiosInterceptors } from '@/lib/axiosSetup';



interface ExtendedUser {
    uid: string;
    email: string | null;
    name: string | null;
    role: string;
    companyId: string | null;
    profileImage: string | null;
}

interface AuthContextType {
    user: ExtendedUser | null;
    firebaseUser: FirebaseUser | null;
    token: string | null;
    loading: boolean;
    authLoading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    firebaseUser: null,
    token: null,
    loading: true,
    authLoading: true,
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<ExtendedUser | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Setup global axios interceptors (auto-token + 401 refresh+retry)
        // Must run inside useEffect to avoid SSR issues (server modifying global axios)
        setupGlobalAxiosInterceptors();
    }, []);


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                setFirebaseUser(fbUser);
                try {
                    const idToken = await fbUser.getIdToken();
                    setToken(idToken);

                    // Fetch user details from backend (60s timeout — remote DB 400ms ping + packet loss)
                    const controller = new AbortController();
                    const fetchTimeout = setTimeout(() => controller.abort(), 60000);
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                        headers: { Authorization: `Bearer ${idToken}` },
                        signal: controller.signal,
                    });
                    clearTimeout(fetchTimeout);

                    if (res.ok) {
                        const data = await res.json();
                        if (data.success && data.user) {
                            setUser({
                                uid: fbUser.uid,
                                email: fbUser.email,
                                name: data.user.name || fbUser.displayName,
                                role: data.user.role || 'EMPLOYEE',
                                companyId: data.user.companyId || null,
                                profileImage: data.user.profileImage || null,
                            });
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch user details:', error);
                    // Fallback: use Firebase user data so UI doesn't break on timeout
                    setUser({
                        uid: fbUser.uid,
                        email: fbUser.email,
                        name: fbUser.displayName,
                        role: 'EMPLOYEE',
                        companyId: null,
                        profileImage: null,
                    });
                }
            } else {
                setFirebaseUser(null);
                setUser(null);
                setToken(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // ============================================================
    // Periodic Token Refresh — Firebase ID tokens expire after 60 minutes
    // Force refresh every 50 minutes to prevent 401 errors
    // ============================================================
    useEffect(() => {
        const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes
        const interval = setInterval(async () => {
            const currentUser = auth.currentUser;
            if (currentUser) {
                try {
                    const freshToken = await currentUser.getIdToken(true); // force refresh
                    setToken(freshToken);
                    console.log('[AUTH] Token refreshed successfully');
                } catch (e) {
                    console.error('[AUTH] Token refresh failed:', e);
                }
            }
        }, TOKEN_REFRESH_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    const logout = async () => {
        await auth.signOut();
        setUser(null);
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, firebaseUser, token, loading, authLoading: loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
