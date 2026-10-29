import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import client from '../api/client';

const SetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // 'success' | 'error'
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 6) {
            setStatus('error');
            setMessage('Password must be at least 6 characters.');
            return;
        }
        if (password !== confirm) {
            setStatus('error');
            setMessage('Passwords do not match.');
            return;
        }

        setLoading(true);
        setStatus(null);
        try {
            const res = await client.post('/auth/set-password', { token, password });
            setStatus('success');
            setMessage(res.data.message || 'Password set successfully.');
            setTimeout(() => navigate('/login/customer'), 3000);
        } catch (err) {
            setStatus('error');
            setMessage(err.response?.data?.error || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md text-center">
                    <XCircle size={48} className="mx-auto mb-4 text-red-500" />
                    <h2 className="text-lg font-bold text-slate-800">Invalid Link</h2>
                    <p className="mt-2 text-sm text-slate-500">This setup link is invalid or missing. Please contact support.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-slate-900">Set Your Password</h1>
                    <p className="mt-1 text-sm text-slate-500">Create a password to activate your AIXOS account.</p>
                </div>

                {status === 'success' ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <CheckCircle2 size={48} className="text-green-600" />
                        <p className="font-semibold text-slate-800">{message}</p>
                        <p className="text-sm text-slate-500">Redirecting to login...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                    required
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-10 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
                            <input
                                type="password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Repeat your password"
                                required
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
                            />
                        </div>

                        {status === 'error' && (
                            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                                <XCircle size={16} className="mt-0.5 shrink-0" />
                                <span>{message}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:bg-slate-300"
                        >
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            {loading ? 'Setting Password...' : 'Set Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default SetPassword;
