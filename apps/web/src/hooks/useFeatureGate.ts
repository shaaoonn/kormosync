"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Simple in-memory cache shared across hook instances
let cachedFeatures: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to check if a feature is enabled for the current user's company.
 *
 * Usage:
 *   const { enabled, loading } = useFeatureGate("payroll");
 *   if (!enabled) return <UpgradePlanMessage />;
 */
export function useFeatureGate(feature: string): { enabled: boolean; loading: boolean } {
    const { user } = useAuth();
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.companyId) {
            setLoading(false);
            return;
        }

        const now = Date.now();
        if (cachedFeatures && now - cacheTimestamp < CACHE_TTL) {
            setEnabled(cachedFeatures.includes(feature));
            setLoading(false);
            return;
        }

        const fetchFeatures = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) {
                    setLoading(false);
                    return;
                }

                const res = await fetch(`${API_URL}/settings/company`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (res.ok) {
                    const data = await res.json();
                    const features: string[] = data.company?.enabledFeatures || [];
                    cachedFeatures = features;
                    cacheTimestamp = Date.now();
                    setEnabled(features.includes(feature));
                }
            } catch (error) {
                console.error("useFeatureGate: Failed to fetch features", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFeatures();
    }, [user?.companyId, feature]);

    return { enabled, loading };
}

/**
 * Invalidate the feature cache (call after admin updates features).
 */
export function invalidateFeatureCache() {
    cachedFeatures = null;
    cacheTimestamp = 0;
}
