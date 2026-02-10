"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface RoleGuardProps {
    allowed: ('OWNER' | 'ADMIN' | 'EMPLOYEE' | 'FREELANCER')[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function RoleGuard({ allowed, children, fallback }: RoleGuardProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user && !allowed.includes(user.role as any)) {
            if (!fallback) {
                router.push('/dashboard');
            }
        }
    }, [user, loading, allowed, fallback, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    if (!allowed.includes(user.role as any)) {
        if (fallback) return <>{fallback}</>;
        return null;
    }

    return <>{children}</>;
}

export function AdminOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
    return <RoleGuard allowed={['OWNER', 'ADMIN']} fallback={fallback}>{children}</RoleGuard>;
}

export function EmployeeOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
    return <RoleGuard allowed={['EMPLOYEE']} fallback={fallback}>{children}</RoleGuard>;
}

export function OwnerOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
    return <RoleGuard allowed={['OWNER']} fallback={fallback}>{children}</RoleGuard>;
}
