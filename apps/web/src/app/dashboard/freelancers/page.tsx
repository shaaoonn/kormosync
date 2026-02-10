"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Globe, Linkedin, CheckCircle } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { AdminOnly } from "@/components/guards/RoleGuard";

interface Freelancer {
    id: string;
    name: string;
    designation: string;
    profileImage: string;
    skills: string[];
    bio: string;
    city: string;
    country: string;
    linkedIn: string;
    portfolio: string;
}

export default function FindFreelancersPage() {
    const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [skillFilter, setSkillFilter] = useState("");

    const fetchFreelancers = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/freelancer/search`, {
                params: { query, skill: skillFilter },
                headers: { Authorization: `Bearer ${token}` }
            });
            setFreelancers(res.data.freelancers || []);
        } catch (error) {
            console.error("Failed to fetch freelancers", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchFreelancers();
        });
        return () => unsubscribe();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        fetchFreelancers();
    };

    return (
        <AdminOnly>
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Find Freelancers</h1>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by name, title, or bio..."
                        className="w-full pl-10 p-2 border rounded-lg"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="w-48">
                    <input
                        type="text"
                        placeholder="Filter by Skill"
                        className="w-full p-2 border rounded-lg"
                        value={skillFilter}
                        onChange={(e) => setSkillFilter(e.target.value)}
                    />
                </div>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                    Search
                </button>
            </form>

            {/* Results Grid */}
            {loading ? (
                <div className="text-center py-10 text-gray-500">Loading freelancers...</div>
            ) : freelancers.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-gray-100">
                    <p className="text-gray-500 text-lg">No freelancers found matching your criteria.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {freelancers.map(f => (
                        <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
                            <div className="p-6">
                                <div className="flex items-start justify-between">
                                    <img
                                        src={f.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.name)}&background=random`}
                                        alt={f.name}
                                        className="w-16 h-16 rounded-full object-cover border-2 border-indigo-50"
                                    />
                                    {f.portfolio && (
                                        <a href={f.portfolio} target="_blank" className="text-gray-400 hover:text-indigo-600">
                                            <Globe className="w-5 h-5" />
                                        </a>
                                    )}
                                </div>
                                <h2 className="mt-4 text-xl font-bold text-gray-800">{f.name}</h2>
                                <p className="text-indigo-600 font-medium text-sm">{f.designation}</p>

                                <div className="mt-3 flex items-center text-sm text-gray-500 gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {f.city}, {f.country}
                                </div>

                                <p className="mt-4 text-gray-600 text-sm line-clamp-3">
                                    {f.bio || "No bio available."}
                                </p>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {f.skills.slice(0, 3).map(skill => (
                                        <span key={skill} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                                            {skill}
                                        </span>
                                    ))}
                                    {f.skills.length > 3 && (
                                        <span className="text-gray-400 text-xs px-2 py-1">+ {f.skills.length - 3}</span>
                                    )}
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 border-t flex justify-between items-center">
                                <Link href={`/dashboard/employees/${f.id}`} className="text-indigo-600 font-medium hover:underline text-sm">
                                    View full Profile
                                </Link>
                                <button className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-indigo-700">
                                    Hire / Contact
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        </AdminOnly>
    );
}
