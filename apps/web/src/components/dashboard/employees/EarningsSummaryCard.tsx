"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign, Clock, TrendingUp, Calendar } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";

interface EarningsData {
    workedHours: number;
    workedAmount: number;
    overtimeHours: number;
    overtimePay: number;
    leavePay: number;
    penaltyAmount: number;
    grossAmount: number;
    netAmount: number;
    currency: string;
    salaryType: string;
    monthlySalary: number;
    workedDays: number;
    totalWorkingDays: number;
    expectedHoursPerDay: number;
}

interface Props {
    userId: string;
}

export default function EarningsSummaryCard({ userId }: Props) {
    const [earnings, setEarnings] = useState<EarningsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchEarnings = useCallback(async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/payroll/current-earnings/${userId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setEarnings(res.data.earnings);
            }
        } catch (error) {
            console.error("Failed to fetch earnings", error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchEarnings();

        // Poll every 60 seconds
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                fetchEarnings();
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [fetchEarnings]);

    const formatCurrency = (amount: number, currency: string) => {
        return `${currency === "BDT" ? "৳" : "$"}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    };

    if (loading) {
        return (
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                <div className="animate-pulse flex items-center gap-4">
                    <div className="h-12 w-12 bg-white/20 rounded-lg" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-white/20 rounded w-1/3" />
                        <div className="h-6 bg-white/20 rounded w-1/2" />
                    </div>
                </div>
            </div>
        );
    }

    if (!earnings) {
        return (
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                <p className="text-sm text-indigo-200">Earnings data not available</p>
            </div>
        );
    }

    const isMonthly = earnings.salaryType === "MONTHLY";

    return (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Earnings Summary</h3>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full ml-auto">
                    {isMonthly ? "Monthly" : "Hourly"} Employee
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Net Earnings */}
                <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-200" />
                        <span className="text-xs text-indigo-200">
                            {isMonthly ? "Earned So Far" : "Total Earned"}
                        </span>
                    </div>
                    <p className="text-xl font-bold">
                        {formatCurrency(earnings.netAmount, earnings.currency)}
                    </p>
                </div>

                {/* Hours Worked */}
                <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-200" />
                        <span className="text-xs text-indigo-200">Hours Worked</span>
                    </div>
                    <p className="text-xl font-bold">
                        {earnings.workedHours.toFixed(1)}h
                    </p>
                </div>

                {/* Days Worked or Monthly Salary */}
                {isMonthly ? (
                    <div className="bg-white/10 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-200" />
                            <span className="text-xs text-indigo-200">Days Worked</span>
                        </div>
                        <p className="text-xl font-bold">
                            {earnings.workedDays}/{earnings.totalWorkingDays}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white/10 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <DollarSign className="w-3.5 h-3.5 text-indigo-200" />
                            <span className="text-xs text-indigo-200">Work Earnings</span>
                        </div>
                        <p className="text-xl font-bold">
                            {formatCurrency(earnings.workedAmount, earnings.currency)}
                        </p>
                    </div>
                )}

                {/* Overtime */}
                <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-200" />
                        <span className="text-xs text-indigo-200">Overtime</span>
                    </div>
                    <p className="text-xl font-bold">
                        {earnings.overtimeHours.toFixed(1)}h
                    </p>
                    {earnings.overtimePay > 0 && (
                        <p className="text-xs text-indigo-200 mt-0.5">
                            +{formatCurrency(earnings.overtimePay, earnings.currency)}
                        </p>
                    )}
                </div>
            </div>

            {/* Monthly salary reference */}
            {isMonthly && earnings.monthlySalary > 0 && (
                <div className="mt-3 text-xs text-indigo-200 flex items-center gap-4">
                    <span>Monthly Salary: {formatCurrency(earnings.monthlySalary, earnings.currency)}</span>
                    {earnings.penaltyAmount > 0 && (
                        <span className="text-red-200">Penalties: -{formatCurrency(earnings.penaltyAmount, earnings.currency)}</span>
                    )}
                    {earnings.leavePay > 0 && (
                        <span className="text-green-200">Leave Pay: +{formatCurrency(earnings.leavePay, earnings.currency)}</span>
                    )}
                </div>
            )}
        </div>
    );
}
