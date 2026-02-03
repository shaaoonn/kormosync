"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // AuthGuard will handle redirection
            router.push("/");
        } catch (err: any) {
            console.error(err);
            setError("Invalid credentials or access denied.");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[100px]" />
            <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-red-900/10 blur-[100px]" />

            <div className="w-full max-w-md relative z-10">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-8 shadow-2xl">
                    <div className="mb-8 text-center space-y-2">
                        <h1 className="text-4xl font-bold tracking-tight text-primary drop-shadow-sm">
                            KormoSync
                        </h1>
                        <div className="flex items-center justify-center gap-2">
                            <div className="h-[1px] w-8 bg-slate-700"></div>
                            <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">Super Admin Portal</span>
                            <div className="h-[1px] w-8 bg-slate-700"></div>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-900/50 bg-red-900/20 p-4 text-sm text-red-200 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle size={18} className="shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-primary">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@kormosync.com"
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950/50 py-3 pl-10 pr-4 text-slate-100 placeholder-slate-600 transition-all focus:border-primary focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-primary">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950/50 py-3 pl-10 pr-4 text-slate-100 placeholder-slate-600 transition-all focus:border-primary focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-500 py-3 font-semibold text-white shadow-lg shadow-yellow-500/20 transition-all hover:scale-[1.02] hover:shadow-yellow-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            <div className="flex items-center justify-center gap-2">
                                {isLoading && <Loader2 size={18} className="animate-spin" />}
                                <span>{isLoading ? "Signing In..." : "Access Dashboard"}</span>
                            </div>
                        </button>
                    </form>

                    <div className="mt-8 text-center text-xs text-slate-600">
                        <p>Restricted Access - Authorized Personnel Only</p>
                        <p className="mt-1">© 2026 KormoSync Inc.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
