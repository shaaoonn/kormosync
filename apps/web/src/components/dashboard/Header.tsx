import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Bell, User as UserIcon, Menu, CreditCard, CheckCircle } from "lucide-react";
import axios from "axios";
import Link from "next/link";


interface UserProfile {
    name: string;
    profileImage: string | null;
}

export default function Header({ toggleSidebar }: { toggleSidebar?: () => void }) {
    const { user: authUser, firebaseUser, token } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);

    const getPlanNameFromEmployees = (maxEmployees: number) => {
        if (maxEmployees <= 10) return "Startup";
        if (maxEmployees <= 50) return "Growth";
        if (maxEmployees <= 200) return "Business";
        if (maxEmployees <= 500) return "Corporate";
        return "Enterprise";
    };

    // Use auth context data — no duplicate /auth/sync call needed
    const isPro = false; // Will be set from profile/subscription data
    const planName: string | null = null;

    const fetchProfile = async (tkn: string) => {
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/profile/me`, {
                headers: { Authorization: `Bearer ${tkn}` },
                timeout: 10000, // 10s — don't block page render for profile
            });
            setProfile(res.data.profile);
        } catch (e) {
            console.error("Failed to fetch profile", e);
        }
    };

    // Fetch profile once when token is available (no duplicate auth listener)
    useEffect(() => {
        if (token) {
            fetchProfile(token);
        }
    }, [token]);

    // Listen for profile updates (custom event)
    useEffect(() => {
        const handleProfileUpdate = async () => {
            const tkn = await auth.currentUser?.getIdToken();
            if (tkn) await fetchProfile(tkn);
        };
        window.addEventListener('profile-updated', handleProfileUpdate);
        return () => window.removeEventListener('profile-updated', handleProfileUpdate);
    }, []);



    const getAvatar = () => {
        if (profile?.profileImage) return profile.profileImage;
        const name = profile?.name || authUser?.name || firebaseUser?.email || "U";
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=40`;
    };

    return (
        <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 shadow-sm">
            {/* Left: Mobile Toggle & Title */}
            <div className="flex items-center gap-4">
                <button
                    className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded"
                    onClick={toggleSidebar}
                >
                    <Menu className="w-6 h-6" />
                </button>
                <h2 className="text-lg font-semibold text-gray-800">Overview</h2>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-4">
                {/* Upgrade Plan Button */}
                {isPro ? (
                    <span className="hidden md:inline-flex items-center px-3 py-1 text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full shadow-sm">
                        <CheckCircle className="w-4 h-4 mr-1.5 text-indigo-600" />
                        {planName || 'Pro'} Plan
                    </span>
                ) : (
                    <Link
                        href="/dashboard/billing"
                        className="hidden md:flex items-center px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-full hover:bg-orange-600 transition shadow-sm"
                    >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Upgrade Plan
                    </Link>
                )}

                {/* Notifications */}
                <button className="p-2 text-gray-500 hover:text-indigo-600 transition relative">
                    <Bell className="w-6 h-6" />
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                </button>

                {/* User Profile */}
                <Link href="/dashboard/profile" className="flex items-center gap-2 pl-4 border-l border-gray-200 hover:opacity-80 transition">
                    <img
                        src={getAvatar()}
                        alt="Profile"
                        className="w-8 h-8 rounded-full object-cover border-2 border-indigo-100"
                    />
                    <span className="hidden md:block text-sm font-medium text-gray-700">
                        {profile?.name || firebaseUser?.displayName || authUser?.name || "User"}
                    </span>
                </Link>
            </div>
        </header >
    );
}
