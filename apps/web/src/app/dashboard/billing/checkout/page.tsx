"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { Loader2, ShieldCheck, CreditCard, TestTube, CheckCircle } from "lucide-react";

const getPlanDetails = (planName: string) => {
    const plans = {
        startup: { name: "Startup", employees: 10, storage: 5, price: { monthly: 1250, yearly: 10500 } },
        growth: { name: "Growth", employees: 50, storage: 25, price: { monthly: 4850, yearly: 40740 } },
        business: { name: "Business", employees: 200, storage: 100, price: { monthly: 12450, yearly: 104580 } },
        corporate: { name: "Corporate", employees: 500, storage: 250, price: { monthly: 24500, yearly: 205800 } },
        enterprise: { name: "Enterprise", employees: 1000, storage: 500, price: { monthly: 45000, yearly: 378000 } }
    };
    return plans[planName as keyof typeof plans] || plans.startup;
};

function CheckoutContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const planParam = searchParams.get('plan') || 'startup';
    const billingParam = searchParams.get('billing') || 'yearly';

    const plan = getPlanDetails(planParam);
    const isYearly = billingParam === 'yearly';
    const amount = isYearly ? plan.price.yearly : plan.price.monthly;

    const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'DEMO'>('BKASH');
    const [loading, setLoading] = useState(false);

    const handlePayment = async () => {
        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();

            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/payment/create`, {
                amount: amount.toString(),
                planName: plan.name,
                maxEmployees: plan.employees,
                storageLimit: plan.storage * 1024,
                billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
                paymentMethod
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (paymentMethod === 'DEMO') {
                if (res.data.success) {
                    router.push(`/dashboard/billing/success?trxID=DEMO-${Date.now()}&amount=${amount}&planName=${plan.name}&date=${new Date().toISOString()}`);
                }
            } else {
                if (res.data.bkashURL) {
                    window.location.href = res.data.bkashURL;
                } else {
                    alert("Failed to initiate bKash payment");
                }
            }

        } catch (error) {
            console.error("Payment Error", error);
            alert("Payment failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left: Summary */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

                        <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg mb-6">
                            <div>
                                <h3 className="font-bold text-indigo-900 text-lg">{plan.name} Plan</h3>
                                <p className="text-indigo-600 text-sm">Billed {isYearly ? 'Yearly' : 'Monthly'}</p>
                            </div>
                            <span className="font-bold text-indigo-700 text-xl">৳{amount.toLocaleString()}</span>
                        </div>

                        <div className="space-y-3 text-gray-600">
                            <div className="flex justify-between">
                                <span>Base Price</span>
                                <span>৳{amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-green-600">
                                <span>Discount</span>
                                <span>{isYearly ? 'Applied (30%)' : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>VAT (0%)</span>
                                <span>৳0</span>
                            </div>
                            <div className="border-t pt-3 flex justify-between items-center text-lg font-bold text-gray-900">
                                <span>Total</span>
                                <span>৳{amount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex items-center gap-4 text-green-700 bg-green-50">
                        <ShieldCheck className="w-6 h-6" />
                        <p className="text-sm font-medium">Your payment is secure with SSL encryption.</p>
                    </div>
                </div>

                {/* Right: Payment Method */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Select Payment Method</h2>

                        <div className="space-y-4">
                            {/* bKash Option */}
                            <label className={`block cursor-pointer border-2 rounded-xl p-4 transition-all ${paymentMethod === 'BKASH' ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-pink-200'}`}>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="radio"
                                        name="payment"
                                        className="w-5 h-5 text-pink-600 focus:ring-pink-500"
                                        checked={paymentMethod === 'BKASH'}
                                        onChange={() => setPaymentMethod('BKASH')}
                                    />
                                    <div className="flex-1">
                                        <span className="font-bold text-gray-900 block">bKash Payment</span>
                                        <span className="text-xs text-gray-500">Fast & Secure Mobile Banking</span>
                                    </div>
                                    <div className="h-8 w-16 bg-pink-100 rounded flex items-center justify-center text-pink-600 font-bold text-xs italic">
                                        bKash
                                    </div>
                                </div>
                            </label>

                            {/* Demo Option */}
                            <label className={`block cursor-pointer border-2 rounded-xl p-4 transition-all ${paymentMethod === 'DEMO' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="radio"
                                        name="payment"
                                        className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                                        checked={paymentMethod === 'DEMO'}
                                        onChange={() => setPaymentMethod('DEMO')}
                                    />
                                    <div className="flex-1">
                                        <span className="font-bold text-gray-900 block">Demo Payment</span>
                                        <span className="text-xs text-gray-500">Test Mode (No Charge)</span>
                                    </div>
                                    <TestTube className="w-5 h-5 text-indigo-600" />
                                </div>
                            </label>
                        </div>

                        <button
                            onClick={handlePayment}
                            disabled={loading}
                            className={`mt-8 w-full py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 text-white ${paymentMethod === 'BKASH'
                                ? 'bg-pink-600 hover:bg-pink-700 shadow-pink-200'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                } disabled:opacity-50`}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (paymentMethod === 'BKASH' ? <CreditCard className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />)}
                            {paymentMethod === 'BKASH' ? `Pay ${amount.toLocaleString()} BDT` : 'Complete Demo Payment'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
            <CheckoutContent />
        </Suspense>
    );
}
