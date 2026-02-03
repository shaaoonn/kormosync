"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import axios from "axios";
import { auth } from "@/lib/firebase";

export default function Home() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeCompanies: 0,
    totalUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken();
          const response = await axios.get('http://localhost:8000/api/admin/stats', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setStats(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch stats", error);
      } finally {
        setLoading(false);
      }
    };

    // Wait for auth to be ready
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) fetchStats();
    });

    return () => unsubscribe();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Dashboard Overview</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Stat Card 1 */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm font-medium text-slate-400">Total Revenue</p>
            <p className="mt-2 text-3xl font-bold text-primary">BDT {stats.totalRevenue.toLocaleString()}</p>
          </div>

          {/* Stat Card 2 */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm font-medium text-slate-400">Active Companies</p>
            <p className="mt-2 text-3xl font-bold text-slate-100">{stats.activeCompanies}</p>
          </div>

          {/* Stat Card 3 */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm font-medium text-slate-400">Total Users</p>
            <p className="mt-2 text-3xl font-bold text-slate-100">{stats.totalUsers}</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
