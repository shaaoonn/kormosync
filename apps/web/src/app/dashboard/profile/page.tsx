"use client";

import { useEffect, useState, useRef } from "react";
import { User, Mail, Phone, Briefcase, MapPin, Globe, Linkedin, Save, Plus, X, Camera, Facebook, Youtube, Github, Twitter, Users, Edit, Download, GraduationCap, Calendar as CalendarIcon } from "lucide-react";
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
    isPublic: boolean;
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isPublic, setIsPublic] = useState(false);
    const [newSkill, setNewSkill] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cvRef = useRef<HTMLDivElement>(null);

    // Form states
    const [name, setName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [designation, setDesignation] = useState("");
    const [profileImage, setProfileImage] = useState("");
    const [bio, setBio] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [country, setCountry] = useState("");
    const [skills, setSkills] = useState<string[]>([]);
    const [education, setEducation] = useState<Education[]>([]);
    const [experience, setExperience] = useState<Experience[]>([]);
    const [references, setReferences] = useState<Reference[]>([]);
    const [linkedIn, setLinkedIn] = useState("");
    const [portfolio, setPortfolio] = useState("");
    const [facebook, setFacebook] = useState("");
    const [youtube, setYoutube] = useState("");
    const [twitter, setTwitter] = useState("");
    const [github, setGithub] = useState("");

    const fetchProfile = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/profile/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const p = res.data.profile;
            setProfile(p);
            setIsPublic(p.isPublic || false);
            populateForm(p);
        } catch (error) {
            console.error("Failed to fetch profile", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePublic = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/freelancer/me/visibility`,
                { isPublic: !isPublic },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setIsPublic(res.data.isPublic);
        } catch (error) {
            alert("Failed to update visibility");
        }
    };

    const populateForm = (p: Profile) => {
        setName(p.name || "");
        setPhoneNumber(p.phoneNumber || "");
        setDesignation(p.designation || "");
        setProfileImage(p.profileImage || "");
        setBio(p.bio || "");
        setDateOfBirth(p.dateOfBirth ? p.dateOfBirth.split('T')[0] : "");
        setAddress(p.address || "");
        setCity(p.city || "");
        setCountry(p.country || "");
        setSkills(p.skills || []);
        setEducation(p.education || []);
        setExperience(p.experience || []);
        setReferences(p.references || []);
        setLinkedIn(p.linkedIn || "");
        setPortfolio(p.portfolio || "");
        setFacebook(p.facebook || "");
        setYoutube(p.youtube || "");
        setTwitter(p.twitter || "");
        setGithub(p.github || "");
    };

    useEffect(() => {
        auth.onAuthStateChanged(user => {
            if (user) fetchProfile();
            else setLoading(false);
        });
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("file", file);

            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload`, formData, {
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
            });

            setProfileImage(res.data.url);
        } catch (error) {
            alert("Failed to upload image");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/profile/me`, {
                name, phoneNumber, designation, profileImage, bio, dateOfBirth, address, city, country,
                skills, education, experience, references, linkedIn, portfolio, facebook, youtube, twitter, github
            }, { headers: { Authorization: `Bearer ${token}` } });

            setProfile(res.data.profile);
            window.dispatchEvent(new Event('profile-updated'));
            setIsEditMode(false);
            alert("Profile saved!");
        } catch (error) {
            alert("Failed to save profile");
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadPDF = async () => {
        // @ts-ignore
        const html2pdf = (await import('html2pdf.js')).default;
        const element = cvRef.current;
        if (!element) return;

        const opt = {
            margin: 10,
            filename: `${name || 'profile'}_cv.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save();
    };

    // Skills
    const addSkill = () => {
        if (newSkill && !skills.includes(newSkill)) {
            setSkills([...skills, newSkill]);
            setNewSkill("");
        }
    };
    const removeSkill = (skill: string) => setSkills(skills.filter(s => s !== skill));

    // Education
    const addEducation = () => setEducation([...education, { degree: "", institution: "", year: "" }]);
    const updateEducation = (i: number, field: keyof Education, val: string) => {
        const newEdu = [...education];
        newEdu[i][field] = val;
        setEducation(newEdu);
    };
    const removeEducation = (i: number) => setEducation(education.filter((_, idx) => idx !== i));

    // Experience
    const addExperience = () => setExperience([...experience, { title: "", company: "", startDate: "", endDate: "", description: "" }]);
    const updateExperience = (i: number, field: keyof Experience, val: string) => {
        const newExp = [...experience];
        newExp[i][field] = val;
        setExperience(newExp);
    };
    const removeExperience = (i: number) => setExperience(experience.filter((_, idx) => idx !== i));

    // References
    const addReference = () => setReferences([...references, { name: "", position: "", company: "", phone: "", email: "" }]);
    const updateReference = (i: number, field: keyof Reference, val: string) => {
        const newRef = [...references];
        newRef[i][field] = val;
        setReferences(newRef);
    };
    const removeReference = (i: number) => setReferences(references.filter((_, idx) => idx !== i));

    const getAvatar = () => {
        if (profileImage) return profileImage;
        const email = profile?.email || "";
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email)}&background=6366f1&color=fff&size=150`;
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading profile...</div>;

    // ==================== VIEW MODE ====================
    if (!isEditMode) {
        return (
            <div className="max-w-4xl mx-auto pb-10">
                {/* Header Actions */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
                    <div className="flex gap-2 items-center">
                        {profile?.role === 'FREELANCER' && (
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-gray-200">
                                <span className="text-sm font-medium text-gray-600">Public Profile</span>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={isPublic} onChange={handleTogglePublic} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </div>
                            </label>
                        )}
                        <button onClick={handleDownloadPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
                            <Download className="w-4 h-4" /> Download CV
                        </button>
                        <button onClick={() => setIsEditMode(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                            <Edit className="w-4 h-4" /> Edit Profile
                        </button>
                    </div>
                </div>

                {/* CV View */}
                <div ref={cvRef}>
                    {/* Header Card */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl p-8 text-white">
                        <div className="flex items-center gap-6">
                            <img src={getAvatar()} alt="Profile" className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg" />
                            <div>
                                <h1 className="text-3xl font-bold">{profile?.name || "Your Name"}</h1>
                                <p className="text-indigo-100 text-lg">{profile?.designation || "Your Designation"}</p>
                                <div className="flex items-center gap-4 mt-2 text-sm text-indigo-200">
                                    {profile?.email && <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {profile.email}</span>}
                                    {profile?.phoneNumber && <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {profile.phoneNumber}</span>}
                                </div>
                                {(profile?.city || profile?.country) && (
                                    <p className="flex items-center gap-1 mt-1 text-sm text-indigo-200">
                                        <MapPin className="w-4 h-4" /> {[profile?.address, profile?.city, profile?.country].filter(Boolean).join(", ")}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="bg-white rounded-b-2xl shadow-lg p-8 space-y-8">
                        {/* Bio */}
                        {profile?.bio && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">About</h2>
                                <p className="text-gray-600 whitespace-pre-wrap">{profile.bio}</p>
                            </div>
                        )}

                        {/* Skills */}
                        {profile?.skills && profile.skills.length > 0 && (
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
                        {profile?.experience && profile.experience.length > 0 && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                                    <Briefcase className="w-5 h-5" /> Experience
                                </h2>
                                <div className="space-y-4">
                                    {profile.experience.map((exp: Experience, i: number) => (
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
                        {profile?.education && profile.education.length > 0 && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                                    <GraduationCap className="w-5 h-5" /> Education
                                </h2>
                                <div className="space-y-3">
                                    {profile.education.map((edu: Education, i: number) => (
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
                        {profile?.references && profile.references.length > 0 && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                                    <Users className="w-5 h-5" /> References
                                </h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {profile.references.map((ref: Reference, i: number) => (
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
                        {(profile?.linkedIn || profile?.facebook || profile?.youtube || profile?.twitter || profile?.github || profile?.portfolio) && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                                    <Globe className="w-5 h-5" /> Links
                                </h2>
                                <div className="flex flex-wrap gap-3">
                                    {profile?.linkedIn && (
                                        <a href={profile.linkedIn} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                                            <Linkedin className="w-4 h-4" /> LinkedIn
                                        </a>
                                    )}
                                    {profile?.facebook && (
                                        <a href={profile.facebook} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                                            <Facebook className="w-4 h-4" /> Facebook
                                        </a>
                                    )}
                                    {profile?.youtube && (
                                        <a href={profile.youtube} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                                            <Youtube className="w-4 h-4" /> YouTube
                                        </a>
                                    )}
                                    {profile?.twitter && (
                                        <a href={profile.twitter} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-400 rounded-lg hover:bg-blue-100">
                                            <Twitter className="w-4 h-4" /> Twitter
                                        </a>
                                    )}
                                    {profile?.github && (
                                        <a href={profile.github} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200">
                                            <Github className="w-4 h-4" /> GitHub
                                        </a>
                                    )}
                                    {profile?.portfolio && (
                                        <a href={profile.portfolio} target="_blank" className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200">
                                            <Globe className="w-4 h-4" /> Portfolio
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ==================== EDIT MODE ====================
    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">Edit Profile</h1>
                <div className="flex gap-2">
                    <button onClick={() => { setIsEditMode(false); if (profile) populateForm(profile); }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">
                        <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Profile"}
                    </button>
                </div>
            </div>

            {/* Profile Image */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-6">
                <div className="relative">
                    <img src={getAvatar()} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100" />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white hover:bg-indigo-700"
                    >
                        <Camera className="w-4 h-4" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">{name || "Your Name"}</h2>
                    <p className="text-gray-500">{designation || "Your Designation"}</p>
                    <p className="text-sm text-gray-400">{profile?.email}</p>
                    {uploading && <p className="text-sm text-indigo-500">Uploading...</p>}
                </div>
            </div>

            {/* Basic Info */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <h2 className="font-semibold text-gray-700 flex items-center gap-2"><User className="w-4 h-4" /> Basic Information</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-gray-500">Full Name</label>
                        <input type="text" className="w-full p-2 border rounded mt-1" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Email</label>
                        <input type="email" disabled className="w-full p-2 border rounded mt-1 bg-gray-50" value={profile?.email || ""} />
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Phone</label>
                        <input type="tel" className="w-full p-2 border rounded mt-1" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Designation</label>
                        <input type="text" className="w-full p-2 border rounded mt-1" value={designation} onChange={e => setDesignation(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Date of Birth</label>
                        <input type="date" className="w-full p-2 border rounded mt-1" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
                    </div>
                </div>
                <div>
                    <label className="text-sm text-gray-500">Bio</label>
                    <textarea rows={3} className="w-full p-2 border rounded mt-1" value={bio} onChange={e => setBio(e.target.value)} placeholder="A short introduction about yourself..." />
                </div>
            </div>

            {/* Location */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <h2 className="font-semibold text-gray-700 flex items-center gap-2"><MapPin className="w-4 h-4" /> Location</h2>
                <div className="grid grid-cols-3 gap-4">
                    <input type="text" placeholder="Address" className="p-2 border rounded" value={address} onChange={e => setAddress(e.target.value)} />
                    <input type="text" placeholder="City" className="p-2 border rounded" value={city} onChange={e => setCity(e.target.value)} />
                    <input type="text" placeholder="Country" className="p-2 border rounded" value={country} onChange={e => setCountry(e.target.value)} />
                </div>
            </div>

            {/* Skills */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <h2 className="font-semibold text-gray-700 flex items-center gap-2">🛠️ Skills</h2>
                <div className="flex flex-wrap gap-2">
                    {skills.map(skill => (
                        <span key={skill} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm flex items-center gap-1">
                            {skill} <button onClick={() => removeSkill(skill)}><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input type="text" placeholder="Add a skill" className="flex-1 p-2 border rounded" value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyPress={e => e.key === 'Enter' && addSkill()} />
                    <button onClick={addSkill} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"><Plus className="w-4 h-4" /></button>
                </div>
            </div>

            {/* Education */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700 flex items-center gap-2">🎓 Education</h2>
                    <button onClick={addEducation} className="text-sm text-indigo-600 flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
                </div>
                {education.map((edu, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 items-center border-b pb-2">
                        <input type="text" placeholder="Degree" className="p-2 border rounded" value={edu.degree} onChange={e => updateEducation(i, 'degree', e.target.value)} />
                        <input type="text" placeholder="Institution" className="p-2 border rounded" value={edu.institution} onChange={e => updateEducation(i, 'institution', e.target.value)} />
                        <input type="text" placeholder="Year" className="p-2 border rounded" value={edu.year} onChange={e => updateEducation(i, 'year', e.target.value)} />
                        <button onClick={() => removeEducation(i)} className="text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>

            {/* Experience */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Experience</h2>
                    <button onClick={addExperience} className="text-sm text-indigo-600 flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
                </div>
                {experience.map((exp, i) => (
                    <div key={i} className="space-y-2 border-b pb-4">
                        <div className="grid grid-cols-3 gap-2">
                            <input type="text" placeholder="Job Title" className="p-2 border rounded" value={exp.title} onChange={e => updateExperience(i, 'title', e.target.value)} />
                            <input type="text" placeholder="Company" className="p-2 border rounded" value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)} />
                            <button onClick={() => removeExperience(i)} className="text-red-500 justify-self-end"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Start Date" className="p-2 border rounded" value={exp.startDate} onChange={e => updateExperience(i, 'startDate', e.target.value)} />
                            <input type="text" placeholder="End Date" className="p-2 border rounded" value={exp.endDate} onChange={e => updateExperience(i, 'endDate', e.target.value)} />
                        </div>
                        <textarea placeholder="Description" className="w-full p-2 border rounded" value={exp.description} onChange={e => updateExperience(i, 'description', e.target.value)} />
                    </div>
                ))}
            </div>

            {/* References */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700 flex items-center gap-2"><Users className="w-4 h-4" /> References</h2>
                    <button onClick={addReference} className="text-sm text-indigo-600 flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
                </div>
                {references.map((ref, i) => (
                    <div key={i} className="space-y-2 border-b pb-4">
                        <div className="grid grid-cols-4 gap-2">
                            <input type="text" placeholder="Name" className="p-2 border rounded" value={ref.name} onChange={e => updateReference(i, 'name', e.target.value)} />
                            <input type="text" placeholder="Position" className="p-2 border rounded" value={ref.position} onChange={e => updateReference(i, 'position', e.target.value)} />
                            <input type="text" placeholder="Company" className="p-2 border rounded" value={ref.company} onChange={e => updateReference(i, 'company', e.target.value)} />
                            <button onClick={() => removeReference(i)} className="text-red-500 justify-self-end"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="tel" placeholder="Phone" className="p-2 border rounded" value={ref.phone} onChange={e => updateReference(i, 'phone', e.target.value)} />
                            <input type="email" placeholder="Email" className="p-2 border rounded" value={ref.email} onChange={e => updateReference(i, 'email', e.target.value)} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Social Links */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <h2 className="font-semibold text-gray-700 flex items-center gap-2"><Globe className="w-4 h-4" /> Social Links</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                        <Linkedin className="w-5 h-5 text-blue-600" />
                        <input type="url" placeholder="LinkedIn URL" className="flex-1 p-2 border rounded" value={linkedIn} onChange={e => setLinkedIn(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Facebook className="w-5 h-5 text-blue-500" />
                        <input type="url" placeholder="Facebook URL" className="flex-1 p-2 border rounded" value={facebook} onChange={e => setFacebook(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Youtube className="w-5 h-5 text-red-600" />
                        <input type="url" placeholder="YouTube Channel" className="flex-1 p-2 border rounded" value={youtube} onChange={e => setYoutube(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Twitter className="w-5 h-5 text-blue-400" />
                        <input type="url" placeholder="Twitter/X URL" className="flex-1 p-2 border rounded" value={twitter} onChange={e => setTwitter(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Github className="w-5 h-5 text-gray-800" />
                        <input type="url" placeholder="GitHub URL" className="flex-1 p-2 border rounded" value={github} onChange={e => setGithub(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-gray-600" />
                        <input type="url" placeholder="Portfolio Website" className="flex-1 p-2 border rounded" value={portfolio} onChange={e => setPortfolio(e.target.value)} />
                    </div>
                </div>
            </div>
        </div>
    );
}
