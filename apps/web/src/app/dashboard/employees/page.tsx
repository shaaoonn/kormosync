"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, Link2, Trash2, Copy, Mail, Check, Users, Clock, Eye } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";

interface Member {
    id: string;
    name: string | null;
    email: string;
    role: string;
    designation: string | null;
}

export default function EmployeesPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'email' | 'link'>('email');
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteLink, setInviteLink] = useState("");
    const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
    const [copying, setCopying] = useState(false);
    const [sending, setSending] = useState(false);
    const [inviteResult, setInviteResult] = useState<{ link: string, email?: string } | null>(null);

    const fetchMembers = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/company/members`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMembers(res.data.members || []);
        } catch (error) {
            console.error("Failed to fetch members", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInviteLink = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/company/invite-link`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInviteLink(res.data.inviteLink || "");
            setInviteExpiry(res.data.expiresAt || null);
        } catch (error) {
            console.error("Failed to fetch invite link", error);
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchMembers();
                fetchInviteLink();
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleInviteEmail = async () => {
        if (!inviteEmail) return;
        setSending(true);
        setInviteResult(null);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/company/invite`,
                { email: inviteEmail },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setInviteResult({ link: res.data.invite.link, email: res.data.invite.email });
            setInviteEmail("");
            fetchMembers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to send invite");
        } finally {
            setSending(false);
        }
    };

    const handleCopyLink = (link: string) => {
        navigator.clipboard.writeText(link);
        setCopying(true);
        setTimeout(() => setCopying(false), 2000);
    };

    const handleRemove = async (memberId: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;
        try {
            const token = await auth.currentUser?.getIdToken();
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/company/members/${memberId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchMembers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to remove member");
        }
    };

    const roleColor = (role: string) => {
        if (role === 'OWNER') return 'bg-purple-100 text-purple-700';
        if (role === 'ADMIN') return 'bg-blue-100 text-blue-700';
        return 'bg-gray-100 text-gray-700';
    };

    const roleLabel = (role: string) => {
        if (role === 'OWNER') return 'Administrator';
        if (role === 'ADMIN') return 'Admin';
        return 'Employee';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">Team Members</h1>
                <button
                    onClick={() => { setShowModal(true); setInviteResult(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-medium"
                >
                    <UserPlus className="w-4 h-4" />
                    Invite Member
                </button>
            </div>

            {/* Members Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : members.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No team members yet. Invite someone!</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Designation</th>
                                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {members.map((member) => (
                                <tr key={member.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{member.name || 'Unnamed'}</td>
                                    <td className="px-6 py-4 text-gray-600">{member.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColor(member.role)}`}>
                                            {roleLabel(member.role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">{member.designation || '-'}</td>
                                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                        <Link href={`/dashboard/employees/${member.id}`} className="text-indigo-600 hover:text-indigo-800" title="View Profile">
                                            <Eye className="w-4 h-4" />
                                        </Link>
                                        {member.role !== 'OWNER' && (
                                            <button onClick={() => handleRemove(member.id)} className="text-red-500 hover:text-red-700" title="Remove">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Invite Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <h2 className="text-xl font-bold text-gray-800">Invite Team Member</h2>

                        {/* Tabs */}
                        <div className="flex border-b">
                            <button
                                onClick={() => setActiveTab('email')}
                                className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'email' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}
                            >
                                <Mail className="w-4 h-4 inline mr-1" /> By Email
                            </button>
                            <button
                                onClick={() => setActiveTab('link')}
                                className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'link' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}
                            >
                                <Link2 className="w-4 h-4 inline mr-1" /> Open Link
                            </button>
                        </div>

                        {activeTab === 'email' ? (
                            <div className="space-y-3">
                                <p className="text-xs text-gray-500">
                                    🔒 Only this email can use the invite link.
                                </p>
                                <input
                                    type="email"
                                    placeholder="Enter email address"
                                    className="w-full p-3 border rounded-lg"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                />
                                <button
                                    onClick={handleInviteEmail}
                                    disabled={sending || !inviteEmail}
                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50"
                                >
                                    {sending ? "Creating..." : "Create Invite"}
                                </button>

                                {inviteResult && (
                                    <div className="bg-green-50 p-3 rounded-lg space-y-2">
                                        <p className="text-green-700 text-sm font-medium">✅ Invite created for {inviteResult.email}</p>
                                        <div className="flex gap-2">
                                            <input type="text" readOnly value={inviteResult.link} className="flex-1 p-2 border rounded text-xs bg-white" />
                                            <button onClick={() => handleCopyLink(inviteResult.link)} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">
                                                {copying ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-gray-500">
                                    🌐 Anyone with this link can join your team.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={inviteLink}
                                        className="flex-1 p-3 border rounded-lg bg-gray-50 text-sm"
                                    />
                                    <button
                                        onClick={() => handleCopyLink(inviteLink)}
                                        className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                                    >
                                        {copying ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                                {inviteExpiry && (
                                    <p className="text-xs text-gray-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Expires: {new Date(inviteExpiry).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
