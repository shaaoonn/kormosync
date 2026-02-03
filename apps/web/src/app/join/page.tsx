"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { Building, RefreshCw, AlertCircle } from "lucide-react";

function JoinContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [ready, setReady] = useState(false);

    // Sign out any existing user when page loads - fresh start
    useEffect(() => {
        const clearSession = async () => {
            try {
                await signOut(auth);
            } catch (e) {
                console.log("No session to clear");
            }
            setReady(true);
        };
        clearSession();
    }, []);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError("");

        try {
            const provider = new GoogleAuthProvider();
            // Force account selection - always show account chooser
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            const result = await signInWithPopup(auth, provider);

            if (result.user) {
                // Store invite token in session storage for signup page
                sessionStorage.setItem('inviteToken', token || '');

                // Check if user already exists in database
                const idToken = await result.user.getIdToken();
                try {
                    const checkRes = await axios.get(
                        `${process.env.NEXT_PUBLIC_API_URL}/profile/me`,
                        { headers: { Authorization: `Bearer ${idToken}` } }
                    );

                    // User exists - try to accept invite and go to dashboard
                    if (checkRes.data.profile) {
                        await acceptInviteAndRedirect(result.user);
                    }
                } catch (err: any) {
                    if (err.response?.status === 404 || err.response?.status === 401) {
                        // New user - redirect to signup page with invite context
                        router.push(`/onboarding?invite=true&token=${token}`);
                    } else {
                        throw err;
                    }
                }
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/popup-closed-by-user') {
                setError("লগইন বাতিল করা হয়েছে");
            } else {
                setError("লগইন ব্যর্থ হয়েছে");
            }
            setLoading(false);
        }
    };

    const acceptInviteAndRedirect = async (user: any) => {
        try {
            const authToken = await user.getIdToken();
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/company/accept-invite`,
                { token },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );
            router.push("/dashboard");
        } catch (err: any) {
            // If already a member, just go to dashboard
            if (err.response?.data?.error?.includes("already")) {
                router.push("/dashboard");
            } else {
                setError(err.response?.data?.error || "টিমে যোগ দিতে সমস্যা হয়েছে");
                await signOut(auth);
                setLoading(false);
            }
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                    <p className="text-red-500 font-medium">ইনভাইট লিংক সঠিক নয়</p>
                    <p className="text-gray-500 text-sm mt-2">কোনো টোকেন পাওয়া যায়নি। অনুগ্রহ করে আপনার অ্যাডমিনের কাছ থেকে নতুন লিংক নিন।</p>
                </div>
            </div>
        );
    }

    if (!ready) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                    <Building className="w-8 h-8 text-indigo-600" />
                </div>

                <h1 className="text-2xl font-bold text-gray-800">টিমে যোগ দিন!</h1>
                <p className="text-gray-500">আপনাকে KormoSync-এ একটি টিমে আমন্ত্রণ জানানো হয়েছে।</p>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 justify-center">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                )}

                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        নিচে ক্লিক করে আপনার Google অ্যাকাউন্ট দিয়ে লগইন করুন
                    </p>

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                প্রসেস হচ্ছে...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </>
                        )}
                    </button>

                    <p className="text-xs text-gray-400">
                        নতুন ইউজার হলে সাইনআপ পেজে নিয়ে যাবে
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function JoinPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
        }>
            <JoinContent />
        </Suspense>
    );
}
