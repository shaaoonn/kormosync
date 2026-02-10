"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Mail, Phone, Briefcase, MapPin, Globe, Linkedin, Facebook, Youtube, Github, Twitter, Users, GraduationCap, Calendar, DollarSign, Clock, Save, CheckCircle } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";

interface Education {
    degree: string;
    institution: string;
    year: string;
}

interface Experience {
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
}

interface Reference {
    name: string;
    position: string;
    company: string;
    phone: string;
    email: string;
}

interface Profile {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    designation: string;
    profileImage: string;
    bio: string;
    dateOfBirth: string;
    address: string;
    city: string;
    country: string;
    skills: string[];
    education: Education[];
    experience: Experience[];
    references: Reference[];
    linkedIn: string;
    portfolio: string;
    facebook: string;
    youtube: string;
    twitter: string;
    github: string;
    role: string;
    createdAt: string;
}

interface SalaryConfig {
    salaryType: "HOURLY" | "MONTHLY";
    monthlySalary: number;
    hourlyRate: number;
    expectedHoursPerDay: number;
    minDailyHours: number;
    currency: string;
}

export default function EmployeeProfilePage() {
    const params = useParams();
    const userId = params.userId as string;
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [salaryConfig, setSalaryConfig] = useState<SalaryConfig | null>(null);
    const [salaryForm, setSalaryForm] = useState<SalaryConfig>({
        salaryType: "HOURLY",
        monthlySalary: 0,
        hourlyRate: 0,
        expectedHoursPerDay: 8,
        minDailyHours: 0,
        currency: "BDT",
    });
    const [salaryLoading, setSalaryLoading] = useState(false);
    const [salarySaved, setSalarySaved] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const fetchSalaryConfig = useCallback(async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/profile/employee/${userId}/salary-config`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success && res.data.salaryConfig) {
                const config = res.data.salaryConfig;
                setSalaryConfig(config);
                setSalaryForm({
                    salaryType: config.salaryType || "HOURLY",
                    monthlySalary: config.monthlySalary || 0,
                    hourlyRate: config.hourlyRate || 0,
                    expectedHoursPerDay: config.expectedHoursPerDay || 8,
                    minDailyHours: config.minDailyHours || 0,
                    currency: config.currency || "BDT",
                });
                setIsAdmin(true);
            }
        } catch (error: any) {
            if (error?.response?.status === 403) {
                setIsAdmin(false); // Not admin — don't show salary section
            } else {
                console.error("Failed to fetch salary config", error);
            }
        }
    }, [userId]);

    const handleSaveSalary = async () => {
        setSalaryLoading(true);
        setSalarySaved(false);
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.put(
                `${process.env.NEXT_PUBLIC_API_URL}/profile/employee/${userId}/salary-config`,
                salaryForm,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSalarySaved(true);
            setTimeout(() => setSalarySaved(false), 3000);
        } catch (error) {
            console.error("Failed to save salary config", error);
        } finally {
            setSalaryLoading(false);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/profile/employee/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setProfile(res.data.profile);
            } catch (error) {
                console.error("Failed to fetch employee profile", error);
            } finally {
                setLoading(false);
            }
        };

        auth.onAuthStateChanged(user => {
            if (user) {
                fetchProfile();
                fetchSalaryConfig();
            }
            else setLoading(false);
        });
    }, [userId, fetchSalaryConfig]);

    const getAvatar = () => {
        if (profile?.profileImage) return profile.profileImage;
        const name = profile?.name || profile?.email || "U";
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=150`;
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading profile...</div>;
    if (!profile) return <div className="p-8 text-center text-red-500">Employee not found</div>;

    return (
        <div className="max-w-4xl mx-auto pb-10">
            {/* Back Button */}
            <Link href="/dashboard/employees" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
                <ArrowLeft className="w-4 h-4" /> Back to Employees
            </Link>

            {/* CV Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl p-8 text-white">
                <div className="flex items-center gap-6">
                    <img src={getAvatar()} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg" />
                    <div>
                        <h1 className="text-3xl font-bold">{profile.name || "No Name"}</h1>
                        <p className="text-indigo-100 text-lg">{profile.designation || "No Designation"}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-indigo-200">
                            {profile.email && <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {profile.email}</span>}
                            {profile.phoneNumber && <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {profile.phoneNumber}</span>}
                        </div>
                        {(profile.city || profile.country) && (
                            <p className="flex items-center gap-1 mt-1 text-sm text-indigo-200">
                                <MapPin className="w-4 h-4" /> {[profile.address, profile.city, profile.country].filter(Boolean).join(", ")}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* CV Body */}
            <div className="bg-white rounded-b-2xl shadow-lg p-8 space-y-8">
                {/* Bio */}
                {profile.bio && (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">About</h2>
                        <p className="text-gray-600 whitespace-pre-wrap">{profile.bio}</p>
                    </div>
                )}

                {/* Skills */}
                {profile.skills && profile.skills.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">Skills</h2>
                        <div className="flex flex-wrap gap-2">
                            {profile.skills.map((skill, i) => (
                                <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">{skill}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Experience */}
                {profile.experience && profile.experience.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                            <Briefcase className="w-5 h-5" /> Experience
                        </h2>
                        <div className="space-y-4">
                            {profile.experience.map((exp, i) => (
                                <div key={i} className="border-l-4 border-indigo-400 pl-4">
                                    <h3 className="font-semibold text-gray-800">{exp.title}</h3>
                                    <p className="text-gray-600">{exp.company}</p>
                                    <p className="text-sm text-gray-400">{exp.startDate} - {exp.endDate || "Present"}</p>
                                    {exp.description && <p className="text-gray-500 mt-1 text-sm">{exp.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Education */}
                {profile.education && profile.education.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                            <GraduationCap className="w-5 h-5" /> Education
                        </h2>
                        <div className="space-y-3">
                            {profile.education.map((edu, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">{edu.degree}</h3>
                                        <p className="text-gray-600">{edu.institution}</p>
                                        <p className="text-sm text-gray-400">{edu.year}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* References */}
                {profile.references && profile.references.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                            <Users className="w-5 h-5" /> References
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            {profile.references.map((ref, i) => (
                                <div key={i} className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold text-gray-800">{ref.name}</h3>
                                    <p className="text-gray-600 text-sm">{ref.position} at {ref.company}</p>
                                    {ref.phone && <p className="text-sm text-gray-400"><Phone className="w-3 h-3 inline mr-1" />{ref.phone}</p>}
                                    {ref.email && <p className="text-sm text-gray-400"><Mail className="w-3 h-3 inline mr-1" />{ref.email}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Social Links */}
                {(profile.linkedIn || profile.facebook || profile.youtube || profile.twitter || profile.github || profile.portfolio) && (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                            <Globe className="w-5 h-5" /> Links
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            {profile.linkedIn && (
                                <a href={profile.linkedIn} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                                    <Linkedin className="w-4 h-4" /> LinkedIn
                                </a>
                            )}
                            {profile.facebook && (
                                <a href={profile.facebook} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                                    <Facebook className="w-4 h-4" /> Facebook
                                </a>
                            )}
                            {profile.youtube && (
                                <a href={profile.youtube} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                                    <Youtube className="w-4 h-4" /> YouTube
                                </a>
                            )}
                            {profile.twitter && (
                                <a href={profile.twitter} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-400 rounded-lg hover:bg-blue-100">
                                    <Twitter className="w-4 h-4" /> Twitter
                                </a>
                            )}
                            {profile.github && (
                                <a href={profile.github} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200">
                                    <Github className="w-4 h-4" /> GitHub
                                </a>
                            )}
                            {profile.portfolio && (
                                <a href={profile.portfolio} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200">
                                    <Globe className="w-4 h-4" /> Portfolio
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Salary & Duty Configuration — Admin Only */}
                {isAdmin && (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                            <DollarSign className="w-5 h-5" /> Salary & Duty Configuration
                        </h2>
                        <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                            {/* Salary Type Toggle */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Salary Type</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setSalaryForm(f => ({ ...f, salaryType: "MONTHLY" }))}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            salaryForm.salaryType === "MONTHLY"
                                                ? "bg-indigo-600 text-white shadow"
                                                : "bg-white text-gray-600 border hover:bg-gray-100"
                                        }`}
                                    >
                                        Monthly Salary
                                    </button>
                                    <button
                                        onClick={() => setSalaryForm(f => ({ ...f, salaryType: "HOURLY" }))}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            salaryForm.salaryType === "HOURLY"
                                                ? "bg-indigo-600 text-white shadow"
                                                : "bg-white text-gray-600 border hover:bg-gray-100"
                                        }`}
                                    >
                                        Hourly Rate
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Monthly Salary */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Monthly Salary ({salaryForm.currency})
                                    </label>
                                    <input
                                        type="number"
                                        value={salaryForm.monthlySalary}
                                        onChange={e => setSalaryForm(f => ({ ...f, monthlySalary: parseFloat(e.target.value) || 0 }))}
                                        disabled={salaryForm.salaryType !== "MONTHLY"}
                                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                                            salaryForm.salaryType !== "MONTHLY" ? "bg-gray-100 text-gray-400" : "bg-white"
                                        }`}
                                        placeholder="e.g. 50000"
                                    />
                                </div>

                                {/* Hourly Rate */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Hourly Rate ({salaryForm.currency})
                                    </label>
                                    <input
                                        type="number"
                                        value={salaryForm.hourlyRate}
                                        onChange={e => setSalaryForm(f => ({ ...f, hourlyRate: parseFloat(e.target.value) || 0 }))}
                                        disabled={salaryForm.salaryType !== "HOURLY"}
                                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                                            salaryForm.salaryType !== "HOURLY" ? "bg-gray-100 text-gray-400" : "bg-white"
                                        }`}
                                        placeholder="e.g. 300"
                                    />
                                </div>

                                {/* Expected Hours Per Day */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" /> Expected Hours/Day
                                    </label>
                                    <input
                                        type="number"
                                        value={salaryForm.expectedHoursPerDay}
                                        onChange={e => setSalaryForm(f => ({ ...f, expectedHoursPerDay: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                                        placeholder="e.g. 8"
                                        min="0"
                                        max="24"
                                        step="0.5"
                                    />
                                </div>

                                {/* Min Daily Hours for Attendance */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                        <CheckCircle className="w-3.5 h-3.5" /> Min Hours for Attendance
                                    </label>
                                    <input
                                        type="number"
                                        value={salaryForm.minDailyHours}
                                        onChange={e => setSalaryForm(f => ({ ...f, minDailyHours: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                                        placeholder="0 = disabled"
                                        min="0"
                                        max="24"
                                        step="0.5"
                                    />
                                    {salaryForm.minDailyHours === 0 && (
                                        <p className="text-xs text-amber-600 mt-1">Attendance tracking disabled</p>
                                    )}
                                </div>
                            </div>

                            {/* Virtual Hourly Rate Preview */}
                            {salaryForm.salaryType === "MONTHLY" && salaryForm.monthlySalary > 0 && salaryForm.expectedHoursPerDay > 0 && (
                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                                    <p className="text-sm text-indigo-700">
                                        <strong>Virtual Hourly Rate:</strong>{" "}
                                        {(salaryForm.monthlySalary / (22 * salaryForm.expectedHoursPerDay)).toFixed(2)} {salaryForm.currency}/hr
                                        <span className="text-indigo-500 text-xs ml-2">(based on 22 working days)</span>
                                    </p>
                                </div>
                            )}

                            {/* Save Button */}
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={handleSaveSalary}
                                    disabled={salaryLoading}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm font-medium"
                                >
                                    <Save className="w-4 h-4" />
                                    {salaryLoading ? "Saving..." : "Save Changes"}
                                </button>
                                {salarySaved && (
                                    <span className="text-sm text-green-600 flex items-center gap-1">
                                        <CheckCircle className="w-4 h-4" /> Saved successfully
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
