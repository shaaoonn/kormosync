import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { Bell, User as UserIcon, Menu, CreditCard, CheckCircle } from "lucide-react";
import { User } from "firebase/auth";
import axios from "axios";
import Link from "next/link";


interface UserProfile {
    name: string;
    profileImage: string | null;
}

export default function Header({ toggleSidebar }: { toggleSidebar?: () => void }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [isPro, setIsPro] = useState(false);

    const [planName, setPlanName] = useState<string | null>(null);

    const getPlanNameFromEmployees = (maxEmployees: number) => {
        if (maxEmployees <= 10) return "Startup";
        if (maxEmployees <= 50) return "Growth";
        if (maxEmployees <= 200) return "Business";
        if (maxEmployees <= 500) return "Corporate";
        return "Enterprise";
    };

    const fetchProfile = async (token: string) => {
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/profile/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProfile(res.data.profile);
        } catch (e) {
            console.error("Failed to fetch profile", e);
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (u) => {
            setUser(u);
            if (u) {
                const token = await u.getIdToken();
                // Fetch Subscription Status
                try {
                    const res = await axios.post(
                        `${process.env.NEXT_PUBLIC_API_URL}/auth/sync`,
                        {},
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const company = res.data.user?.company;
                    if (company?.subscriptionStatus === 'ACTIVE') {
                        setIsPro(true);
                        setPlanName(getPlanNameFromEmployees(company.maxEmployees || 10));
                    }
                } catch (e) {
                    console.error("Failed to fetch subscription status", e);
                }
                // Fetch profile for image
                await fetchProfile(token);
            }
        });
        return () => unsubscribe();
    }, []);

    // Listen for profile updates (custom event)
    useEffect(() => {
        const handleProfileUpdate = async () => {
            const token = await auth.currentUser?.getIdToken();
            if (token) await fetchProfile(token);
        };
        window.addEventListener('profile-updated', handleProfileUpdate);
        return () => window.removeEventListener('profile-updated', handleProfileUpdate);
    }, []);



    const getAvatar = () => {
        if (profile?.profileImage) return profile.profileImage;
        const name = profile?.name || user?.displayName || user?.email || "U";
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
                        {profile?.name || user?.displayName || "User"}
                    </span>
                </Link>
            </div>
        </header >
    );
}
