"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, Building2, Receipt, LogOut, BarChart3, Activity } from "lucide-react";
import clsx from "clsx";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, isAdmin, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) return <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">Loading...</div>;
    if (!user) return null;

    const navItems = [
        { name: "Overview", href: "/", icon: LayoutDashboard },
        { name: "Companies", href: "/companies", icon: Building2 },
        { name: "Financials", href: "/financials", icon: Receipt },
        { name: "Analytics", href: "/analytics", icon: BarChart3 },
        { name: "System", href: "/system", icon: Activity },
    ];

    return (
        <div className="flex h-screen bg-slate-950">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-800 bg-slate-900">
                <div className="flex h-16 items-center px-6 border-b border-slate-800">
                    <span className="text-xl font-bold text-primary">Admin Panel</span>
                </div>

                <nav className="p-4 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                                "flex items-center gap-3 rounded px-4 py-3 text-sm font-medium transition",
                                (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))
                                    ? "bg-slate-800 text-primary border-l-4 border-primary"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                            )}
                        >
                            <item.icon size={20} />
                            {item.name}
                        </Link>
                    ))}
                </nav>

                <div className="absolute bottom-0 w-64 border-t border-slate-800 p-4">
                    <button
                        onClick={logout}
                        className="flex w-full items-center gap-3 rounded px-4 py-2 text-sm font-medium text-red-400 hover:bg-slate-800 hover:text-red-300 transition"
                    >
                        <LogOut size={20} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-8">
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
