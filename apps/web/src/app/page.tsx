"use client";

import { useState } from "react";
import { auth, googleProvider, signInWithPopup } from "@/lib/firebase";
import { LogIn } from "lucide-react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const token = await user.getIdToken();

      // Call backend to sync/check user status (with retry on timeout)
      let response;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/sync`,
            {},
            {
              headers: { Authorization: `Bearer ${token}` },
              withCredentials: true,
              timeout: 60000, // 60s — login is one-time, remote DB with 400ms ping needs time
            }
          );
          break; // success
        } catch (retryErr: any) {
          const isTimeout = retryErr.code === 'ECONNABORTED' || retryErr.message?.includes('timeout');
          if (isTimeout && attempt === 0) {
            setError('সার্ভার ধীর, আবার চেষ্টা করছি...');
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          throw retryErr;
        }
      }

      if (response?.data.success) {
        if (response.data.isNew) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      }

    } catch (err: any) {
      console.error("Login Failed", err);
      if (err.code === 'auth/popup-closed-by-user') return;
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      setError(isTimeout
        ? 'সার্ভার সাড়া দিচ্ছে না — ইন্টারনেট সংযোগ চেক করুন এবং আবার চেষ্টা করুন'
        : (err.message || 'সার্ভারে সংযোগ ব্যর্থ হয়েছে'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
            KormoSync
          </h1>
          <p className="text-gray-400">Enterprise Operating System</p>
        </div>

        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
          <div className="flex flex-col space-y-6">
            <h2 className="text-2xl font-semibold text-center">Sign In</h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <LogIn className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200" aria-hidden="true" />
              </span>
              {loading ? "Signing in..." : "Sign in with Google"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
