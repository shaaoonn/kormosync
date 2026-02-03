"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
    Home,
    CheckSquare,
    Users,
    DollarSign,
    Settings,
    LogOut,
    Activity,
    UserPlus
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import axios from "axios";

const adminMenuItems = [
    { name: "Overview", href: "/dashboard", icon: Home },
    { name: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
    { name: "Activity Log", href: "/dashboard/activity", icon: Activity },
    { name: "Employees", href: "/dashboard/employees", icon: Users },
    { name: "Find Freelancers", href: "/dashboard/freelancers", icon: UserPlus },
    { name: "Payroll", href: "/dashboard/payroll", icon: DollarSign },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

const employeeMenuItems = [
    { name: "Overview", href: "/dashboard", icon: Home },
    { name: "My Tasks", href: "/dashboard/tasks", icon: CheckSquare },
    { name: "My Activity", href: "/dashboard/activity", icon: Activity },
];

const freelancerMenuItems = [
    { name: "Overview", href: "/dashboard", icon: Home },
    { name: "My Tasks", href: "/dashboard/tasks", icon: CheckSquare },
    { name: "My Profile", href: "/dashboard/profile", icon: Users },
];

const commonMenuItems = [
    { name: "My Profile", href: "/dashboard/profile", icon: Users },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [role, setRole] = useState<string>("EMPLOYEE");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRole = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (token) {
                    const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setRole(res.data.user?.role || "EMPLOYEE");
                }
            } catch (error) {
                console.error("Failed to fetch role:", error);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchRole();
            else setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        await auth.signOut();
        router.push("/");
    };

    const isAdmin = role === "OWNER" || role === "ADMIN";
    const isFreelancer = role === "FREELANCER";

    let menuItems = employeeMenuItems;
    if (isAdmin) menuItems = adminMenuItems;
    if (isFreelancer) menuItems = freelancerMenuItems;

    return (
        <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transition-transform duration-300 transform md:translate-x-0 -translate-x-full">
            {/* Brand */}
            <div className="flex items-center justify-center h-16 border-b border-slate-800">
                <h1 className="text-2xl font-bold tracking-wider text-indigo-400">KormoSync</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${isActive
                                ? "bg-indigo-600 text-white shadow-lg"
                                : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                }`}
                        >
                            <Icon className="w-5 h-5 mr-3" />
                            {item.name}
                        </Link>
                    );
                })}

                {/* Common Items (Profile) */}
                <div className="pt-4 border-t border-slate-800 mt-4">
                    {commonMenuItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${isActive
                                    ? "bg-indigo-600 text-white shadow-lg"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                    }`}
                            >
                                <Icon className="w-5 h-5 mr-3" />
                                {item.name}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Role Badge */}
            <div className="px-4 py-2">
                <span className={`text-xs px-2 py-1 rounded-full ${isAdmin ? 'bg-purple-600' : isFreelancer ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                    {role === 'OWNER' ? 'Administrator' : role === 'ADMIN' ? 'Admin' : role === 'FREELANCER' ? 'Freelancer' : 'Employee'}
                </span>
            </div>

            {/* Footer / Logout */}
            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
