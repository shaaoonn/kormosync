"use client";

import { useState, useEffect, Suspense } from "react";
import { auth } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { User } from "firebase/auth";
import { Building2, UserCircle, Users } from "lucide-react";
import toast from "react-hot-toast";

function OnboardingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Check for invite context
    const isInvite = searchParams.get('invite') === 'true';
    const inviteToken = searchParams.get('token') || sessionStorage.getItem('inviteToken');

    // Mode: COMPANY, FREELANCER, or EMPLOYEE (for invite)
    const [mode, setMode] = useState<'COMPANY' | 'FREELANCER' | 'EMPLOYEE'>(isInvite ? 'EMPLOYEE' : 'COMPANY');

    // Form State
    const [name, setName] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [companySize, setCompanySize] = useState("");
    const [designation, setDesignation] = useState("");
    const [phone, setPhone] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            if (u) {
                setUser(u);
                if (u.displayName) setName(u.displayName);
                setLoading(false);
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSubmitting(true);

        try {
            const token = await user.getIdToken();

            // Step 1: Sync user data to backend
            const payload: any = {
                name,
                designation,
                phoneNumber: phone,
                role: mode === 'FREELANCER' ? 'FREELANCER' : mode === 'EMPLOYEE' ? 'EMPLOYEE' : undefined
            };

            if (mode === 'COMPANY') {
                payload.companyName = companyName;
                payload.companySize = companySize;
            }

            const syncResponse = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/auth/sync`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!syncResponse.data.success) {
                toast.error("সাইনআপ সম্পন্ন করতে ব্যর্থ");
                return;
            }

            // Step 2: If invite, accept the invite to join company
            if (mode === 'EMPLOYEE' && inviteToken) {
                try {
                    await axios.post(
                        `${process.env.NEXT_PUBLIC_API_URL}/company/accept-invite`,
                        { token: inviteToken },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    sessionStorage.removeItem('inviteToken');
                } catch (inviteErr: any) {
                    // If already member, continue
                    if (!inviteErr.response?.data?.error?.includes("already")) {
                        console.error("Invite accept error:", inviteErr);
                    }
                }
            }

            // Redirect to dashboard
            router.push("/dashboard");

        } catch (error) {
            console.error("Onboarding Error", error);
            toast.error("কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
                <h1 className="text-3xl font-bold mb-2">
                    {isInvite ? 'টিমে যোগ দিন' : 'Welcome to KormoSync'}
                </h1>
                <p className="text-gray-400 mb-6">
                    {isInvite
                        ? 'আপনাকে একটি টিমে আমন্ত্রণ জানানো হয়েছে। নিচে তথ্য দিয়ে সাইনআপ করুন।'
                        : 'How would you like to use the platform?'
                    }
                </p>

                {/* Mode Toggle - Only show if NOT invite */}
                {!isInvite && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <button
                            type="button"
                            onClick={() => setMode('COMPANY')}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${mode === 'COMPANY'
                                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                                }`}
                        >
                            <Building2 className="w-8 h-8 mb-2" />
                            <span className="font-semibold">Create Workspace</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('FREELANCER')}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${mode === 'FREELANCER'
                                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                                }`}
                        >
                            <UserCircle className="w-8 h-8 mb-2" />
                            <span className="font-semibold">I'm a Freelancer</span>
                        </button>
                    </div>
                )}

                {/* Invite Badge */}
                {isInvite && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
                        <Users className="w-6 h-6 text-green-400" />
                        <div>
                            <p className="font-medium text-green-400">কর্মী হিসেবে যোগ দিচ্ছেন</p>
                            <p className="text-sm text-gray-400">সাইনআপ শেষে স্বয়ংক্রিয়ভাবে টিমে যুক্ত হবেন</p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            আপনার নাম <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="আপনার পূর্ণ নাম"
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    {/* Email (Read Only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">ইমেইল</label>
                        <input
                            type="text"
                            value={user?.email || ""}
                            disabled
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-300 cursor-not-allowed"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            ফোন নম্বর <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+8801XXXXXXXXX"
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    {/* Designation */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {mode === 'EMPLOYEE' ? 'পদবী (অপশনাল)' : mode === 'COMPANY' ? 'Designation' : 'Professional Title'}
                        </label>
                        <input
                            type="text"
                            value={designation}
                            onChange={(e) => setDesignation(e.target.value)}
                            placeholder={mode === 'EMPLOYEE' ? "যেমন: সফটওয়্যার ইঞ্জিনিয়ার" : mode === 'COMPANY' ? "Ex: CEO / Manager" : "Ex: Full Stack Developer"}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    {/* Company specific fields */}
                    {mode === 'COMPANY' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Company Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Ex: Acme Corp"
                                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Company Size <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    value={companySize}
                                    onChange={(e) => setCompanySize(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="" disabled>Select employees count</option>
                                    <option value="1-10">1-10 Employees</option>
                                    <option value="11-50">11-50 Employees</option>
                                    <option value="51-200">51-200 Employees</option>
                                    <option value="201-500">201-500 Employees</option>
                                    <option value="500+">500+ Employees</option>
                                </select>
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-all mt-4 disabled:opacity-50"
                    >
                        {submitting
                            ? "প্রসেস হচ্ছে..."
                            : mode === 'EMPLOYEE'
                                ? "সাইনআপ করুন ও টিমে যোগ দিন"
                                : mode === 'COMPANY'
                                    ? "Create Workspace"
                                    : "Join as Freelancer"
                        }
                    </button>

                </form>
            </div>
        </main>
    );
}

export default function Onboarding() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
        }>
            <OnboardingContent />
        </Suspense>
    );
}
