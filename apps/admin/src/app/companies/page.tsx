"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { auth } from "@/lib/firebase";

interface Company {
    id: string;
    name: string;
    ownerEmail: string;
    plan: string;
    status: string;
    isStarred: boolean;
}

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                if (auth.currentUser) {
                    const token = await auth.currentUser.getIdToken();
                    const response = await axios.get('http://localhost:8000/api/admin/companies', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setCompanies(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch companies", error);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchCompanies();
        });

        return () => unsubscribe();
    }, []);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-100">Company Manager</h1>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-950 text-slate-100 uppercase">
                            <tr>
                                <th className="px-6 py-4 font-medium w-8"></th>
                                <th className="px-6 py-4 font-medium">Company Name</th>
                                <th className="px-6 py-4 font-medium">Owner Email</th>
                                <th className="px-6 py-4 font-medium">Plan</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center">Loading...</td>
                                </tr>
                            ) : companies.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center">No companies found.</td>
                                </tr>
                            ) : (
                                companies.map((company) => (
                                    <tr key={company.id} className="hover:bg-slate-800/50 transition">
                                        <td className="px-6 py-4">
                                            {company.isStarred ? <span className="text-yellow-500 text-lg">★</span> : <span className="text-gray-600 text-lg">☆</span>}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-200">{company.name}</td>
                                        <td className="px-6 py-4">{company.ownerEmail}</td>
                                        <td className="px-6 py-4">
                                            <span className="rounded-full bg-slate-800 px-2 py-1 text-xs">{company.plan}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`rounded-full px-2 py-1 text-xs ${company.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' :
                                                company.status === 'BLOCKED' ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-400'
                                                }`}>
                                                {company.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link href={`/companies/${company.id}`} className="text-primary hover:text-primary-hover hover:underline">Manage</Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
