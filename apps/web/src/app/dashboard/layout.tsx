"use client";

import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";

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
                    {children}
                </main>
            </div>
        </div>
    );
}
