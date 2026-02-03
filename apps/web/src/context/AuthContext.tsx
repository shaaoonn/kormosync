"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

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
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    firebaseUser: null,
    token: null,
    loading: true,
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<ExtendedUser | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                setFirebaseUser(fbUser);
                try {
                    const idToken = await fbUser.getIdToken();
                    setToken(idToken);

                    // Fetch user details from backend
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                        headers: { Authorization: `Bearer ${idToken}` }
                    });

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

    const logout = async () => {
        await auth.signOut();
        setUser(null);
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, firebaseUser, token, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
