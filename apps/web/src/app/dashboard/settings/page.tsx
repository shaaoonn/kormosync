"use client";

import { useEffect, useState } from "react";
import { Settings, Building2, HardDrive, Users, CreditCard, Save, Sparkles, Clock } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface CompanySettings {
    id: string;
    name: string;
    companySize: string | null;
    subscriptionStatus: string;
    maxEmployees: number;
    storageUsed: number;
    storageLimit: number;
    subscriptionEndDate: string | null;
    aiCredits: number;
    hasClaimedTrial: boolean;
    trialEmployeeEndDate: string | null;
    workingDaysPerMonth: number | null;
    overtimeRate: number;
    defaultExpectedHours: number;
    createdAt: string;
    _count: { users: number; tasks: number };
}

const companySizeOptions = ["1-10", "11-50", "51-200", "201-500", "500+"];

export default function SettingsPage() {
    const { user } = useAuth();
    const [company, setCompany] = useState<CompanySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editName, setEditName] = useState("");
    const [editSize, setEditSize] = useState("");
    const [workingDays, setWorkingDays] = useState(22);
    const [overtimeRate, setOvertimeRate] = useState(1.5);
    const [expectedHours, setExpectedHours] = useState(8);
    const [savingPayroll, setSavingPayroll] = useState(false);

    // Payroll settings state
    const [workingDays, setWorkingDays] = useState<number>(22);
    const [overtimeRate, setOvertimeRate] = useState<number>(1.5);
    const [expectedHours, setExpectedHours] = useState<number>(8);
    const [savingPayroll, setSavingPayroll] = useState(false);

    const isOwner = user?.role === "OWNER";

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        if (isOwner) fetchPayrollSettings();
    }, [isOwner]);

    const fetchPayrollSettings = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/company/payroll-settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setWorkingDays(res.data.settings.workingDaysPerMonth || 22);
                setOvertimeRate(res.data.settings.overtimeRate || 1.5);
                setExpectedHours(res.data.settings.defaultExpectedHours || 8);
            }
        } catch (error) {
            console.error("Failed to fetch payroll settings:", error);
        }
    };

    const handleSavePayroll = async () => {
        setSavingPayroll(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/company/payroll-settings`,
                { workingDaysPerMonth: workingDays, overtimeRate, defaultExpectedHours: expectedHours },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("পে-রোল সেটিংস সেভ হয়েছে!");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "সেটিংস সেভ করতে ব্যর্থ");
        } finally {
            setSavingPayroll(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/settings/company`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setCompany(res.data.company);
                setEditName(res.data.company.name);
                setEditSize(res.data.company.companySize || "1-10");
                // Populate payroll settings from company data
                setWorkingDays(res.data.company.workingDaysPerMonth ?? 22);
                setOvertimeRate(res.data.company.overtimeRate ?? 1.5);
                setExpectedHours(res.data.company.defaultExpectedHours ?? 8);
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
            toast.error("সেটিংস লোড করতে ব্যর্থ");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editName.trim()) {
            toast.error("কোম্পানির নাম দিন");
            return;
        }
        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/settings/company`,
                { name: editName.trim(), companySize: editSize },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("সেটিংস সেভ হয়েছে!");
            fetchSettings();
        } catch (error) {
            toast.error("সেটিংস সেভ করতে ব্যর্থ");
        } finally {
            setSaving(false);
        }
    };

    const handleSavePayroll = async () => {
        // Validate inputs
        if (workingDays < 1 || workingDays > 31) {
            toast.error("Working days must be between 1 and 31");
            return;
        }
        if (overtimeRate < 1.0) {
            toast.error("Overtime rate must be at least 1.0");
            return;
        }
        if (expectedHours < 1 || expectedHours > 24) {
            toast.error("Expected hours must be between 1 and 24");
            return;
        }

        setSavingPayroll(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/settings/payroll`,
                {
                    workingDaysPerMonth: workingDays,
                    overtimeRate: overtimeRate,
                    defaultExpectedHours: expectedHours,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("Payroll settings saved!");
            fetchSettings();
        } catch (error: any) {
            const msg = error?.response?.data?.error || "Failed to save payroll settings";
            toast.error(msg);
        } finally {
            setSavingPayroll(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-gray-400">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                Loading settings...
            </div>
        );
    }

    if (!company) {
        return <div className="p-8 text-center text-gray-400">সেটিংস পাওয়া যায়নি</div>;
    }

    const storagePercent = Math.min((company.storageUsed / company.storageLimit) * 100, 100);
    const storageUsedGB = (company.storageUsed / 1024).toFixed(2);
    const storageLimitGB = (company.storageLimit / 1024).toFixed(1);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-indigo-400" />
                <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
            </div>

            {/* Company Info Card */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg font-semibold text-gray-100">Company Information</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Company Name</label>
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={!isOwner}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Company Size</label>
                        <select
                            value={editSize}
                            onChange={(e) => setEditSize(e.target.value)}
                            disabled={!isOwner}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {companySizeOptions.map(size => (
                                <option key={size} value={size}>{size} employees</option>
                            ))}
                        </select>
                    </div>
                </div>

                {isOwner && (
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                )}
            </div>

            {/* Payroll & Attendance Settings Card */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-orange-400" />
                    <h2 className="text-lg font-semibold text-gray-100">Payroll & Attendance Settings</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Working Days Per Month</label>
                        <input
                            type="number"
                            min={1}
                            max={31}
                            value={workingDays}
                            onChange={(e) => setWorkingDays(Number(e.target.value))}
                            disabled={!isOwner}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">1-31 days (used for salary calculation)</p>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Default Expected Hours/Day</label>
                        <input
                            type="number"
                            min={1}
                            max={24}
                            step={0.5}
                            value={expectedHours}
                            onChange={(e) => setExpectedHours(Number(e.target.value))}
                            disabled={!isOwner}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">1-24 hours per day</p>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Overtime Rate Multiplier</label>
                        <input
                            type="number"
                            min={1.0}
                            step={0.1}
                            value={overtimeRate}
                            onChange={(e) => setOvertimeRate(Number(e.target.value))}
                            disabled={!isOwner}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">e.g. 1.5 = 1.5x pay for overtime</p>
                    </div>
                </div>

                {isOwner && (
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSavePayroll}
                            disabled={savingPayroll}
                            className="flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {savingPayroll ? "Saving..." : "Save Payroll Settings"}
                        </button>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Team Members */}
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                        <Users className="w-5 h-5 text-blue-400" />
                        <h3 className="text-sm font-medium text-gray-400">Team Members</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-100">
                        {company._count.users}
                        <span className="text-lg text-gray-500"> / {company.maxEmployees}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Total Tasks: {company._count.tasks}</p>
                </div>

                {/* Storage */}
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                        <HardDrive className="w-5 h-5 text-green-400" />
                        <h3 className="text-sm font-medium text-gray-400">Storage</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-100">
                        {storageUsedGB}
                        <span className="text-lg text-gray-500"> / {storageLimitGB} GB</span>
                    </p>
                    <div className="w-full bg-slate-700 rounded-full h-2 mt-3">
                        <div
                            className={`h-2 rounded-full transition-all ${storagePercent > 90 ? 'bg-red-500' : storagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${storagePercent}%` }}
                        />
                    </div>
                </div>

                {/* AI Credits */}
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <h3 className="text-sm font-medium text-gray-400">AI Credits</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-100">{company.aiCredits}</p>
                    <p className="text-sm text-gray-500 mt-1">Available credits</p>
                </div>
            </div>

            {/* Payroll & Attendance Settings */}
            {isOwner && (
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-cyan-400" />
                        <h2 className="text-lg font-semibold text-gray-100">Payroll & Attendance Settings</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Working Days / Month</label>
                            <input
                                type="number"
                                min={1}
                                max={31}
                                value={workingDays}
                                onChange={(e) => setWorkingDays(parseInt(e.target.value) || 22)}
                                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Default: 22 days</p>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Overtime Rate Multiplier</label>
                            <input
                                type="number"
                                min={1.0}
                                step={0.1}
                                value={overtimeRate}
                                onChange={(e) => setOvertimeRate(parseFloat(e.target.value) || 1.5)}
                                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Default: 1.5x</p>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Expected Hours / Day</label>
                            <input
                                type="number"
                                min={1}
                                max={24}
                                step={0.5}
                                value={expectedHours}
                                onChange={(e) => setExpectedHours(parseFloat(e.target.value) || 8)}
                                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Default: 8 hours</p>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSavePayroll}
                            disabled={savingPayroll}
                            className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {savingPayroll ? "Saving..." : "Save Payroll Settings"}
                        </button>
                    </div>
                </div>
            )}

            {/* Subscription Card */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-yellow-400" />
                        <h2 className="text-lg font-semibold text-gray-100">Subscription</h2>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        company.subscriptionStatus === 'ACTIVE' ? 'bg-green-900/30 text-green-400' :
                        company.subscriptionStatus === 'PAST_DUE' ? 'bg-yellow-900/30 text-yellow-400' :
                        'bg-gray-800 text-gray-400'
                    }`}>
                        {company.subscriptionStatus}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-400">Status:</span>
                        <span className="ml-2 text-gray-100">{company.subscriptionStatus}</span>
                    </div>
                    {company.subscriptionEndDate && (
                        <div>
                            <span className="text-gray-400">Expires:</span>
                            <span className="ml-2 text-gray-100">{new Date(company.subscriptionEndDate).toLocaleDateString('bn-BD')}</span>
                        </div>
                    )}
                    <div>
                        <span className="text-gray-400">Created:</span>
                        <span className="ml-2 text-gray-100">{new Date(company.createdAt).toLocaleDateString('bn-BD')}</span>
                    </div>
                    <div>
                        <span className="text-gray-400">Max Employees:</span>
                        <span className="ml-2 text-gray-100">{company.maxEmployees}</span>
                    </div>
                </div>

                <div className="mt-4">
                    <Link
                        href="/dashboard/billing"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-lg hover:bg-indigo-600/30 transition text-sm"
                    >
                        <CreditCard className="w-4 h-4" />
                        Manage Billing
                    </Link>
                </div>
            </div>
        </div>
    );
}
