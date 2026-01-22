import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Shield, ArrowLeft, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

const ForgotPassword = () => {
    const { role } = useParams();
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Success
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok) setStep(2);
            else setError(data.error);
        } catch (err) { setError('Failed to connect to server'); }
        setLoading(false);
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('http://localhost:5000/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, newPassword, role })
            });
            const data = await res.json();
            if (res.ok) setStep(3);
            else setError(data.error);
        } catch (err) { setError('Failed to reset password'); }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-soft border border-slate-100 p-8">
                <div className="flex justify-center mb-6">
                    <div className="p-3 bg-red-500 rounded-2xl shadow-lg shadow-red-500/20 text-white">
                        <Shield size={32} />
                    </div>
                </div>

                {step === 1 && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">Forgot Password?</h2>
                        <p className="text-slate-500 text-center mb-8">Enter your email and we'll send you an OTP to reset your password.</p>

                        <form onSubmit={handleSendOTP} className="space-y-6">
                            {error && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center gap-2"><AlertCircle size={18} />{error}</div>}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field pl-12" placeholder="name@company.com" />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2">
                                {loading ? 'Sending...' : 'Send OTP'} <ArrowRight size={18} />
                            </button>
                        </form>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">Verify OTP</h2>
                        <p className="text-slate-500 text-center mb-8">We've sent a 6-digit code to {email}</p>

                        <form onSubmit={handleResetPassword} className="space-y-6">
                            {error && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center gap-2"><AlertCircle size={18} />{error}</div>}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Enter OTP</label>
                                <input type="text" maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value)} required className="input-field text-center text-2xl tracking-[1em] font-bold" placeholder="000000" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="input-field pl-12" placeholder="••••••••" />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full btn-primary">
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </form>
                    </div>
                )}

                {step === 3 && (
                    <div className="animate-fade-in text-center">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle size={48} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Password Reset!</h2>
                        <p className="text-slate-500 mb-8">Your password has been successfully updated. You can now sign in with your new password.</p>
                        <Link to={`/login/${role}`} className="w-full btn-primary inline-block">Back to Login</Link>
                    </div>
                )}

                <div className="mt-8 text-center">
                    <Link to={`/login/${role}`} className="text-slate-500 hover:text-slate-900 flex items-center justify-center gap-2 text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
