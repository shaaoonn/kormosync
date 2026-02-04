"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { CheckCircle, ArrowRight, Download, Loader2 } from "lucide-react";

function SuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const trxID = searchParams.get('trxID');
    const amount = searchParams.get('amount');
    const planName = searchParams.get('planName');
    const date = searchParams.get('date');

    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        if (date) {
            setFormattedDate(new Date(date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }));
        } else {
            setFormattedDate(new Date().toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }));
        }
    }, [date]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border-t-8 border-green-500">

                {/* Animated Success Icon */}
                <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 mb-6 animate-pulse">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                </div>

                <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Payment Successful!</h1>
                <p className="text-gray-500 mb-8">Thank you for upgrading your plan.</p>

                {/* Invoice Card */}
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 text-left space-y-4 mb-8">
                    <div className="flex justify-between items-center border-b pb-4">
                        <span className="text-gray-500 text-sm">Transaction ID</span>
                        <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded text-gray-700">{trxID || 'N/A'}</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Plan</span>
                        <span className="font-bold text-indigo-700">{planName || 'Pro'} Plan</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Amount Paid</span>
                        <span className="font-bold text-gray-900">৳{amount}</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Date</span>
                        <span className="text-gray-900">{formattedDate}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
                    >
                        Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                    </button>

                    {/* Placeholder for Download Invoice */}
                    <button className="w-full flex items-center justify-center py-3 px-4 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all">
                        <Download className="mr-2 w-4 h-4" /> Download Invoice
                    </button>
                </div>

            </div>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>}>
            <SuccessContent />
        </Suspense>
    );
}
