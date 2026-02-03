"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function CompanyDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [company, setCompany] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        fetchCompanyDetails();
    }, [id]);

    const fetchCompanyDetails = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(`http://localhost:8000/api/admin/companies/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCompany(res.data);
        } catch (error) {
            console.error("Failed to fetch company details", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStar = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.patch(`http://localhost:8000/api/admin/companies/${id}/star`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCompany({ ...company, isStarred: res.data.isStarred });
        } catch (error) {
            console.error("Failed to toggle star", error);
        }
    };

    const handleStatusUpdate = async (newStatus: string) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.patch(`http://localhost:8000/api/admin/companies/${id}/status`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCompany({ ...company, subscriptionStatus: newStatus });
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to remove this company?")) return;
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.delete(`http://localhost:8000/api/admin/companies/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            router.push('/companies');
        } catch (error) {
            console.error("Failed to delete company", error);
        }
    };

    if (loading) return <div className="text-white p-10">Loading...</div>;
    if (!company) return <div className="text-white p-10">Company not found.</div>;

    return (
        <div className="p-8 text-white">
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
                    ← Back
                </button>

                <div className="flex gap-2">
                    <button
                        onClick={handleStar}
                        className={`px-4 py-2 rounded font-bold border ${company.isStarred ? 'bg-yellow-500 text-black border-yellow-500' : 'border-gray-600 text-gray-300 hover:border-yellow-500'}`}
                    >
                        {company.isStarred ? '★ Starred' : '☆ Star'}
                    </button>
                    {company.subscriptionStatus !== 'ACTIVE' && (
                        <button onClick={() => handleStatusUpdate('ACTIVE')} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium">Activate</button>
                    )}
                    {company.subscriptionStatus !== 'INACTIVE' && (
                        <button onClick={() => handleStatusUpdate('INACTIVE')} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-medium">Freeze</button>
                    )}
                    {company.subscriptionStatus !== 'BLOCKED' && (
                        <button onClick={() => handleStatusUpdate('BLOCKED')} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium">Block</button>
                    )}
                    <button onClick={handleDelete} className="px-4 py-2 border border-red-600 text-red-500 hover:bg-red-600 hover:text-white rounded font-medium">Remove</button>
                </div>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-lg mb-8 border border-gray-700 relative overflow-hidden">
                {company.isStarred && (
                    <div className="absolute top-0 right-0 p-4">
                        <span className="text-6xl text-yellow-500/10">★</span>
                    </div>
                )}
                <h1 className="text-3xl font-bold text-gold-500 mb-2 flex items-center gap-2">
                    {company.name}
                    {company.isStarred && <span className="text-yellow-500 text-xl">★</span>}
                </h1>
                <div className="flex gap-8 text-gray-300 relative z-10">
                    <p>Status: <span className={`font-bold ${company.subscriptionStatus === 'ACTIVE' ? 'text-green-400' : company.subscriptionStatus === 'BLOCKED' ? 'text-red-500' : 'text-gray-400'}`}>{company.subscriptionStatus}</span></p>
                    <p>Total Tasks: {company.totalTasks}</p>
                    <p>Created At: {new Date(company.createdAt).toLocaleDateString()}</p>
                </div>
            </div>

            <h2 className="text-2xl font-bold mb-4">Employees</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700 text-gray-400">
                            <th className="p-3">Name</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Role</th>
                            <th className="p-3">Total Tasks</th>
                            <th className="p-3">Active Tasks</th>
                            <th className="p-3">Pending Tasks</th>
                            <th className="p-3">Completed</th>
                        </tr>
                    </thead>
                    <tbody>
                        {company.employees.map((emp: any) => (
                            <tr key={emp.id} className="border-b border-gray-800 hover:bg-[#334155]">
                                <td className="p-3 flex items-center gap-2">
                                    {emp.profileImage ? (
                                        <img src={emp.profileImage} className="w-8 h-8 rounded-full" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-gray-600" />
                                    )}
                                    {emp.name || 'N/A'}
                                </td>
                                <td className="p-3 text-gray-300">{emp.email}</td>
                                <td className="p-3 text-sm">{emp.role}</td>
                                <td className="p-3 font-bold">{emp.stats.total}</td>
                                <td className="p-3 text-blue-400">{emp.stats.active}</td>
                                <td className="p-3 text-yellow-500">{emp.stats.pending}</td>
                                <td className="p-3 text-green-500">{emp.stats.completed}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
