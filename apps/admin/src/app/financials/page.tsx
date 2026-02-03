"use client";

import DashboardLayout from "@/components/DashboardLayout";

export default function FinancialsPage() {
    return (
        <DashboardLayout>
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-slate-100">Financial Reports</h1>

                <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
                    Transaction history will appear here.
                </div>
            </div>
        </DashboardLayout>
    );
}
