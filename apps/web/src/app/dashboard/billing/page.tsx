"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Loader2, Zap, LayoutDashboard, Users, HardDrive, Calendar } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";

export default function BillingPage() {
    const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');
    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState<any>(null);
    const [showPlans, setShowPlans] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchCompany = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;

                const res = await axios.post(
                    `${process.env.NEXT_PUBLIC_API_URL}/auth/sync`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setCompany(res.data.user?.company);
            } catch (e) {
                console.error("Failed to fetch company", e);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchCompany();
            else setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const plans = [
        {
            name: "Free",
            description: "Start free with limited features",
            employees: 1,
            storage: 0.4,
            price: { monthly: 0, yearly: 0 },
            features: ["Owner + 1 Employee (30 days)", "2 Active Tasks", "8 Monthly Tasks", "400 MB Storage", "15 Day Video"],
            isFree: true
        },
        {
            name: "Startup",
            description: "Perfect for small teams",
            employees: 10,
            storage: 5,
            price: { monthly: 1250, yearly: 10500 },
            features: ["1-10 Employees", "40 Active Tasks", "160 Monthly Tasks", "5 GB Storage", "30 Day Video"]
        },
        {
            name: "Growth",
            description: "For growing businesses",
            employees: 50,
            storage: 25,
            price: { monthly: 4850, yearly: 40740 },
            features: ["11-50 Employees", "200 Active Tasks", "800 Monthly Tasks", "25 GB Storage", "90 Day Video"]
        },
        {
            name: "Business",
            description: "Established companies",
            employees: 200,
            storage: 100,
            price: { monthly: 12450, yearly: 104580 },
            features: ["50-200 Employees", "800 Active Tasks", "3,200 Monthly Tasks", "100 GB Storage", "90 Day Video"]
        },
        {
            name: "Enterprise",
            description: "Unlimited scale",
            employees: 500,
            storage: 500,
            price: { monthly: 32650, yearly: 274260 },
            features: ["500+ Employees", "Unlimited Tasks", "Unlimited Monthly", "500 GB Storage", "1 Year Video"]
        }
    ];

    const handleChoosePlan = (plan: typeof plans[0]) => {
        router.push(`/dashboard/billing/checkout?plan=${plan.name.toLowerCase()}&billing=${billingCycle.toLowerCase()}`);
    };

    const getPlanNameFromEmployees = (maxEmployees: number) => {
        if (maxEmployees <= 10) return "Startup";
        if (maxEmployees <= 50) return "Growth";
        if (maxEmployees <= 200) return "Business";
        if (maxEmployees <= 500) return "Corporate";
        return "Enterprise";
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

    // ACTIVE SUBSCRIPTION VIEW
    if (company?.subscriptionStatus === 'ACTIVE' && !showPlans) {
        const currentPlanName = getPlanNameFromEmployees(company.maxEmployees || 10);
        const renewalDate = company.subscriptionEndDate ? new Date(company.subscriptionEndDate).toLocaleDateString() : 'N/A';
        const storageUsedGB = (company.storageUsed || 0) / 1024;
        const storageLimitGB = (company.storageLimit || 2048) / 1024;

        return (
            <div className="min-h-screen bg-gray-50 py-12 px-4">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">My Subscription</h1>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-8 border-b border-gray-100">
                            <div>
                                <h2 className="text-2xl font-bold text-indigo-700 flex items-center gap-2">
                                    <Zap className="fill-current w-6 h-6" /> {currentPlanName} Plan
                                </h2>
                                <p className="text-gray-500 mt-1 flex items-center gap-2">
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Active
                                    <span className="text-gray-300">|</span>
                                    Renews on {renewalDate}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPlans(true)}
                                className="mt-4 md:mt-0 px-6 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition shadow-sm"
                            >
                                Change Plan
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Employee Limit */}
                            <div className="bg-gray-50 rounded-xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Users className="w-5 h-5 text-indigo-600" />
                                    <h3 className="font-semibold text-gray-900">Employee Limit</h3>
                                </div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-3xl font-bold text-gray-800">? / {company.maxEmployees}</span>
                                    <span className="text-xs text-gray-500 mb-1">Users</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '10%' }}></div>
                                </div>
                            </div>

                            {/* Storage Limit */}
                            <div className="bg-gray-50 rounded-xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <HardDrive className="w-5 h-5 text-purple-600" />
                                    <h3 className="font-semibold text-gray-900">Storage Limit</h3>
                                </div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-3xl font-bold text-gray-800">{storageUsedGB.toFixed(2)} / {storageLimitGB}</span>
                                    <span className="text-xs text-gray-500 mb-1">GB</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-purple-600 h-2 rounded-full"
                                        style={{ width: `${Math.min((storageUsedGB / storageLimitGB) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-800 font-medium flex items-center justify-center gap-2 mx-auto">
                            <LayoutDashboard className="w-4 h-4" /> Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // PRICING CARDS VIEW
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
                {showPlans && (
                    <button onClick={() => setShowPlans(false)} className="mb-8 text-sm text-indigo-600 hover:underline flex items-center justify-center gap-1 mx-auto">
                        ← Back to My Subscription
                    </button>
                )}

                <span className="text-indigo-600 font-semibold tracking-wide uppercase text-sm">Prices built for scale</span>
                <h1 className="mt-2 text-4xl font-extrabold text-gray-900 sm:text-5xl">
                    Detailed, Transparent Pricing
                </h1>
                <p className="mt-4 text-xl text-gray-600">
                    Choose the perfect plan for your team size. Upgrade anytime.
                </p>

                {/* Animated Toggle */}
                <div className="mt-10 flex justify-center items-center gap-4">
                    <span className={`text-sm font-bold transition-colors ${billingCycle === 'MONTHLY' ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
                    <button
                        onClick={() => setBillingCycle(billingCycle === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
                        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-100 ${billingCycle === 'YEARLY' ? 'bg-indigo-600' : 'bg-gray-300'}`}
                    >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${billingCycle === 'YEARLY' ? 'translate-x-9' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-sm font-bold transition-colors ${billingCycle === 'YEARLY' ? 'text-gray-900' : 'text-gray-500'}`}>
                        Yearly <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 ml-1">-30% OFF</span>
                    </span>
                </div>

                {/* Money Back Guarantee Badge */}
                <div className="mt-6 flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-full px-4 py-2">
                        <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-semibold text-emerald-800">100% Money Back Guarantee (30 Days)</span>
                    </div>
                </div>
            </div>

            {/* Pricing Cards Grid - Compact 5-column */}
            <div className="max-w-7xl mx-auto grid gap-4 xl:grid-cols-5 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1">
                {plans.map((plan: any) => {
                    const isPopular = plan.name === "Growth";
                    const isFree = plan.isFree;
                    return (
                        <div
                            key={plan.name}
                            className={`relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border ${isPopular ? 'border-2 border-indigo-500 z-10' : isFree ? 'border-2 border-gray-300' : 'border-gray-100'}`}
                        >
                            {isPopular && (
                                <div className="absolute top-0 right-0 left-0 -mt-3 mx-auto w-24">
                                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-bold uppercase py-1 rounded-full text-center shadow-md flex items-center justify-center gap-1">
                                        <Zap className="w-2.5 h-2.5 fill-current" /> Popular
                                    </div>
                                </div>
                            )}
                            {isFree && (
                                <div className="absolute top-0 right-0 left-0 -mt-3 mx-auto w-16">
                                    <div className="bg-gray-700 text-white text-[10px] font-bold uppercase py-1 rounded-full text-center shadow-md">
                                        Free
                                    </div>
                                </div>
                            )}

                            <div className="p-4">
                                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                                <p className="mt-1 text-gray-500 text-xs h-8">{plan.description}</p>

                                <div className="mt-3 flex items-baseline gap-1">
                                    <span className="text-2xl font-extrabold text-gray-900">
                                        {isFree ? 'Free' : `৳${billingCycle === 'YEARLY' ? plan.price.yearly.toLocaleString() : plan.price.monthly.toLocaleString()}`}
                                    </span>
                                    {!isFree && <span className="text-gray-500 text-xs">/{billingCycle === 'YEARLY' ? 'yr' : 'mo'}</span>}
                                </div>

                                <ul className="mt-4 space-y-2 mb-4">
                                    {plan.features.map((feature: string) => (
                                        <li key={feature} className="flex items-start text-gray-600">
                                            <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                                            <span className="text-xs">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => handleChoosePlan(plan)}
                                    disabled={isFree}
                                    className={`w-full py-2.5 px-3 rounded-lg font-semibold text-sm shadow-sm transition-all flex justify-center items-center gap-1 ${isFree
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : isPopular
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
                                                : 'bg-gray-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-50'
                                        }`}
                                >
                                    {isFree ? 'Current Plan' : `Choose ${plan.name}`}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="mt-12 text-center text-sm text-gray-400 max-w-2xl mx-auto">
                Secure payments processed via bKash. By subscribing, you agree to our Terms of Service.
                All plans include a 30-day money-back guarantee for peace of mind.
            </p>
        </div>
    );
}
