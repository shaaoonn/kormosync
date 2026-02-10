import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    // Import useAppStore
    const { isAuthenticated } = useAppStore();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard');
        }
    }, [isAuthenticated, navigate]);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message.includes('invalid') ? 'Invalid email or password' : 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            const provider = new GoogleAuthProvider();
            // Add prompt to always show account picker
            provider.setCustomParameters({ prompt: 'select_account' });
            await signInWithPopup(auth, provider);
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Google Sign-In Error:', err);
            if (err.code === 'auth/popup-closed-by-user') {
                setError('লগইন বাতিল করা হয়েছে।');
            } else if (err.code === 'auth/network-request-failed' || err.message?.includes('network')) {
                setError('নেটওয়ার্ক সমস্যা। Email দিয়ে login করুন।');
            } else {
                setError('Google login ব্যর্থ। Email দিয়ে চেষ্টা করুন।');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-bg-deep) 0%, var(--color-bg-primary) 50%, var(--color-bg-secondary) 100%)' }}>
            {/* Login Card */}
            <div className="glass" style={{
                width: '420px',
                borderRadius: '24px',
                padding: '48px 40px',
                boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 60px rgba(234, 179, 8, 0.1)'
            }}>
                {/* Logo & Branding */}
                <div className="text-center" style={{ marginBottom: '32px' }}>
                    <div style={{
                        width: '70px',
                        height: '70px',
                        margin: '0 auto 20px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        boxShadow: '0 10px 30px rgba(234, 179, 8, 0.3)'
                    }}>
                        ⏱️
                    </div>
                    <h1 className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        KormoSync
                    </h1>
                    <p className="text-muted" style={{ fontSize: '14px', marginTop: '8px' }}>
                        Employee Time Tracker
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        marginBottom: '20px',
                        color: 'var(--color-danger)',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <span>⚠️</span>
                        {error}
                    </div>
                )}

                {/* Google Sign-In Button (Primary) */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    style={{
                        width: '100%',
                        height: '52px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        background: '#fff',
                        color: '#333',
                        border: 'none',
                        borderRadius: '14px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        opacity: isLoading ? 0.7 : 1,
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                </button>

                {/* Divider */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    margin: '24px 0',
                    gap: '16px'
                }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }}></div>
                    <span className="text-muted" style={{ fontSize: '12px' }}>or login with email</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }}></div>
                </div>

                {/* Email/Password Form (Alternative) */}
                <form onSubmit={handleEmailLogin}>
                    <div style={{ marginBottom: '16px' }}>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="Email address"
                            style={{ fontSize: '14px', padding: '12px 16px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Password"
                            style={{ fontSize: '14px', padding: '12px 16px' }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            height: '48px',
                            background: 'var(--color-bg-tertiary)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            opacity: isLoading ? 0.7 : 1
                        }}
                    >
                        Sign In with Email
                    </button>
                </form>

                {/* Footer */}
                <div className="text-center text-muted" style={{ marginTop: '28px', fontSize: '12px' }}>
                    <p>Secure login powered by Firebase</p>
                    <p style={{ marginTop: '4px', opacity: 0.6 }}>© 2026 KormoSync</p>
                </div>
            </div>

            {/* Decorative Elements */}
            <div style={{
                position: 'absolute',
                top: '15%',
                left: '10%',
                width: '300px',
                height: '300px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(234, 179, 8, 0.08) 0%, transparent 70%)',
                pointerEvents: 'none'
            }}></div>
            <div style={{
                position: 'absolute',
                bottom: '10%',
                right: '15%',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(34, 197, 94, 0.06) 0%, transparent 70%)',
                pointerEvents: 'none'
            }}></div>
        </div>
    );
};

export default Login;
