"use client";

import { useState, useEffect } from "react";
import { X, Clock, MousePointerClick, Keyboard, Calendar, Briefcase, Activity, User } from "lucide-react";
import axios from "axios";
import { auth } from "@/lib/firebase";

interface ScreenshotDetail {
    id: string;
    imageUrl: string;
    capturedAt: string;
    keystrokes: number;
    mouseClicks: number;
    activeSeconds: number;
    activityScore: number;
    task?: {
        id: string;
        title: string;
        priority: string;
    };
    user?: {
        id: string;
        name: string;
        email: string;
        profileImage?: string;
    };
}

interface ScreenshotDetailModalProps {
    screenshotId: string | null;
    onClose: () => void;
}

export default function ScreenshotDetailModal({ screenshotId, onClose }: ScreenshotDetailModalProps) {
    const [screenshot, setScreenshot] = useState<ScreenshotDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!screenshotId) return;

        const fetchScreenshot = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = await auth.currentUser?.getIdToken();
                const res = await axios.get(
                    `${process.env.NEXT_PUBLIC_API_URL}/screenshots/${screenshotId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (res.data.success) {
                    setScreenshot(res.data.screenshot);
                }
            } catch (err: any) {
                setError(err.response?.data?.error || "স্ক্রিনশট লোড করা যায়নি");
            } finally {
                setLoading(false);
            }
        };

        fetchScreenshot();
    }, [screenshotId]);

    if (!screenshotId) return null;

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('bn-BD', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Calculate activity percentage
    const activityPercentage = screenshot
        ? Math.round((screenshot.activeSeconds / 300) * 100)
        : 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
                {/* Left: Screenshot Image */}
                <div className="md:w-2/3 bg-gray-900 p-4 flex items-center justify-center relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-gray-800/80 hover:bg-gray-700 rounded-full text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {loading ? (
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                            <div className="w-10 h-10 border-4 border-gray-600 border-t-indigo-500 rounded-full animate-spin" />
                            <span>লোড হচ্ছে...</span>
                        </div>
                    ) : error ? (
                        <div className="text-red-400 text-center p-8">
                            <p>{error}</p>
                        </div>
                    ) : screenshot ? (
                        <img
                            src={screenshot.imageUrl}
                            alt="Screenshot"
                            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg"
                        />
                    ) : null}
                </div>

                {/* Right: Detail Panel */}
                <div className="md:w-1/3 p-6 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        একটিভিটি ডিটেইলস
                    </h2>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : screenshot ? (
                        <div className="space-y-4">
                            {/* Capture Time */}
                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium mb-1">
                                    <Calendar className="w-4 h-4" />
                                    ক্যাপচার টাইম
                                </div>
                                <p className="text-gray-800 font-semibold">
                                    {formatDate(screenshot.capturedAt)}
                                </p>
                            </div>

                            {/* Task Info */}
                            {screenshot.task && (
                                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                                    <div className="flex items-center gap-2 text-purple-600 text-sm font-medium mb-1">
                                        <Briefcase className="w-4 h-4" />
                                        টাস্ক
                                    </div>
                                    <p className="text-gray-800 font-semibold">
                                        {screenshot.task.title}
                                    </p>
                                    <span className={`inline-block mt-2 px-2 py-0.5 text-xs font-bold rounded-full ${screenshot.task.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                                            screenshot.task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-green-100 text-green-700'
                                        }`}>
                                        {screenshot.task.priority === 'HIGH' ? 'হাই' :
                                            screenshot.task.priority === 'MEDIUM' ? 'মিডিয়াম' : 'লো'}
                                    </span>
                                </div>
                            )}

                            {/* User Info */}
                            {screenshot.user && (
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-2 text-blue-600 text-sm font-medium mb-1">
                                        <User className="w-4 h-4" />
                                        কর্মী
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {screenshot.user.profileImage ? (
                                            <img
                                                src={screenshot.user.profileImage}
                                                alt={screenshot.user.name || ''}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                                                <User className="w-5 h-5 text-blue-600" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-semibold text-gray-800">
                                                {screenshot.user.name || 'Unknown'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {screenshot.user.email}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Activity Stats Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-center">
                                    <Keyboard className="w-5 h-5 text-green-600 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-gray-800">
                                        {screenshot.keystrokes}
                                    </p>
                                    <p className="text-xs text-gray-500">কীস্ট্রোক</p>
                                </div>

                                <div className="p-3 bg-orange-50 rounded-xl border border-orange-100 text-center">
                                    <MousePointerClick className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-gray-800">
                                        {screenshot.mouseClicks}
                                    </p>
                                    <p className="text-xs text-gray-500">মাউস ক্লিক</p>
                                </div>

                                <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-100 text-center">
                                    <Clock className="w-5 h-5 text-cyan-600 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-gray-800">
                                        {Math.round(screenshot.activeSeconds / 60)}m
                                    </p>
                                    <p className="text-xs text-gray-500">একটিভ টাইম</p>
                                </div>

                                <div className="p-3 bg-pink-50 rounded-xl border border-pink-100 text-center">
                                    <Activity className="w-5 h-5 text-pink-600 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-gray-800">
                                        {activityPercentage}%
                                    </p>
                                    <p className="text-xs text-gray-500">একটিভিটি</p>
                                </div>
                            </div>

                            {/* Activity Bar */}
                            <div className="mt-4">
                                <div className="flex justify-between text-sm text-gray-600 mb-2">
                                    <span>একটিভিটি স্কোর</span>
                                    <span className="font-bold">{activityPercentage}%</span>
                                </div>
                                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${activityPercentage >= 70 ? 'bg-green-500' :
                                                activityPercentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                        style={{ width: `${activityPercentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
