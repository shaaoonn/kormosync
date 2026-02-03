"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Mail, Phone, Briefcase, MapPin, Globe, Linkedin, Facebook, Youtube, Github, Twitter, Users, GraduationCap, Calendar } from "lucide-react";
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

export default function EmployeeProfilePage() {
    const params = useParams();
    const userId = params.userId as string;
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

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
            if (user) fetchProfile();
            else setLoading(false);
        });
    }, [userId]);

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
            </div>
        </div>
    );
}
