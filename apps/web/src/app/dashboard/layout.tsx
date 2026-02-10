"use client";

import { useState, Component, ReactNode } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";

// ============================================================
// Error Boundary — prevents blank white page on component crash
// Shows a friendly error message instead of completely blank page
// ============================================================
class DashboardErrorBoundary extends Component<
    { children: ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Dashboard Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-[60vh] p-8">
                    <div className="text-center max-w-md">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">কিছু একটা সমস্যা হয়েছে</h2>
                        <p className="text-gray-500 mb-4 text-sm">
                            {this.state.error?.message || 'একটি অপ্রত্যাশিত ত্রুটি ঘটেছে'}
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                        >
                            পেজ রিলোড করুন
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <div className={`fixed inset-0 z-50 transition-opacity md:hidden ${sidebarOpen ? 'block' : 'hidden'}`} onClick={() => setSidebarOpen(false)}>
                <div className="absolute inset-0 bg-black opacity-50"></div>
            </div>
            <div className={`md:relative z-50 ${sidebarOpen ? 'block' : 'hidden'} md:block`}>
                <Sidebar />
            </div>

            {/* Main Content */}
            <div className="flex flex-col flex-1 w-full md:ml-64">
                <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

                <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50">
                    <DashboardErrorBoundary>
                        {children}
                    </DashboardErrorBoundary>
                </main>
            </div>
        </div>
    );
}
