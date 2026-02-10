"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface Company {
    id: string;
    name: string;
    ownerEmail: string;
    ownerName: string;
    plan: string;
    status: string;
    isStarred: boolean;
    createdAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");

    const fetchCompanies = useCallback(async (page = 1, query = search) => {
        try {
            setLoading(true);
            const params: any = { page, limit: 20 };
            if (query) params.search = query;
            const response = await api.get('/admin/companies', { params });
            setCompanies(response.data.companies || []);
            setPagination(response.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch (error) {
            console.error("Failed to fetch companies", error);
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        fetchCompanies(1);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
        fetchCompanies(1, searchInput);
    };

    const toggleStar = async (id: string) => {
        try {
            await api.patch(`/admin/companies/${id}/star`);
            setCompanies(prev => prev.map(c =>
                c.id === id ? { ...c, isStarred: !c.isStarred } : c
            ));
        } catch (error) {
            console.error("Failed to toggle star", error);
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case "ACTIVE": return "bg-green-900/30 text-green-400";
            case "BLOCKED": return "bg-red-900/30 text-red-400";
            case "INACTIVE": return "bg-gray-800 text-gray-400";
            case "TRIAL": return "bg-blue-900/30 text-blue-400";
            default: return "bg-gray-800 text-gray-400";
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <h1 className="text-2xl font-bold text-slate-100">Company Manager</h1>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search company or email..."
                                className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary w-64"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm rounded-lg transition"
                        >
                            Search
                        </button>
                    </form>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-950 text-slate-100 uppercase">
                            <tr>
                                <th className="px-6 py-4 font-medium w-8"></th>
                                <th className="px-6 py-4 font-medium">Company Name</th>
                                <th className="px-6 py-4 font-medium">Owner</th>
                                <th className="px-6 py-4 font-medium">Plan</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium">Created</th>
                                <th className="px-6 py-4 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center">Loading...</td>
                                </tr>
                            ) : companies.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center">No companies found.</td>
                                </tr>
                            ) : (
                                companies.map((company) => (
                                    <tr key={company.id} className="hover:bg-slate-800/50 transition">
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleStar(company.id)}
                                                className="text-lg hover:scale-110 transition"
                                                title={company.isStarred ? "Unstar" : "Star"}
                                            >
                                                {company.isStarred
                                                    ? <span className="text-yellow-500">★</span>
                                                    : <span className="text-gray-600">☆</span>
                                                }
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-200">{company.name}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-300 text-xs">{company.ownerName}</div>
                                            <div className="text-slate-500 text-xs">{company.ownerEmail}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="rounded-full bg-slate-800 px-2 py-1 text-xs">{company.plan}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`rounded-full px-2 py-1 text-xs ${statusColor(company.status)}`}>
                                                {company.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500">
                                            {new Date(company.createdAt).toLocaleDateString("en-US", {
                                                year: "numeric", month: "short", day: "numeric"
                                            })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link href={`/companies/${company.id}`} className="text-primary hover:text-primary-hover hover:underline text-sm">
                                                Manage
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
                            <p className="text-sm text-slate-500">
                                Page {pagination.page} of {pagination.totalPages} ({pagination.total} companies)
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchCompanies(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                </button>

                                {/* Page numbers */}
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                                        let pageNum: number;
                                        if (pagination.totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (pagination.page <= 3) {
                                            pageNum = i + 1;
                                        } else if (pagination.page >= pagination.totalPages - 2) {
                                            pageNum = pagination.totalPages - 4 + i;
                                        } else {
                                            pageNum = pagination.page - 2 + i;
                                        }
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => fetchCompanies(pageNum)}
                                                className={`w-8 h-8 rounded-lg text-sm transition ${
                                                    pageNum === pagination.page
                                                        ? 'bg-primary text-white'
                                                        : 'text-slate-400 hover:bg-slate-800'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => fetchCompanies(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
