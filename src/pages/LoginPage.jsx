import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';

const LoginPage = () => {
    const { role } = useParams();
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, password, role);

        if (result.success) {
            navigate(`/${role}/dashboard`);
        } else {
            setError(result.error);
            setLoading(false);
        }
    };

    const getRoleData = () => {
        if (role === 'agent') return { title: 'Agent Portal', sub: 'Log visits and track earnings', bg: 'bg-red-600' };
        if (role === 'customer') return { title: 'Client Portal', sub: 'Manage your safety compliance', bg: 'bg-slate-900' };
        return { title: 'Admin Console', sub: 'Platform management', bg: 'bg-slate-800' };
    };

    const { title, sub, bg } = getRoleData();

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Side - Visual */}
            <div className={`hidden lg:flex lg:w-1/2 relative overflow-hidden ${bg}`}>
                <div className="absolute inset-0 bg-hero-pattern opacity-10"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/60"></div>
                <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full">
                    <div>
                        <Link to="/" className="flex items-center text-white/80 hover:text-white transition-colors">
                            <ArrowLeft size={20} className="mr-2" /> Back to Home
                        </Link>
                    </div>
                    <div>
                        <h1 className="text-5xl font-display font-bold mb-6">{title}</h1>
                        <p className="text-xl text-white/80 max-w-md">{sub}</p>
                    </div>
                    <div className="text-sm text-white/40">
                        &copy; 2026 AiXOS Red. all rights reserved.
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-slate-50">
                <div className="mx-auto w-full max-w-sm lg:w-96">
                    <div className="lg:hidden mb-10">
                        <Link to="/" className="flex items-center text-slate-500 hover:text-slate-900 transition-colors mb-8">
                            <ArrowLeft size={16} className="mr-2" /> Back
                        </Link>
                        <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
                        <p className="mt-2 text-slate-600">{sub}</p>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
                        <h3 className="text-xl font-bold text-slate-900 mb-6">Sign in to your account</h3>

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                                    <div className="flex">
                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                        <p className="ml-3 text-sm text-red-700 font-medium">{error}</p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        className="input-field pl-11"
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        className="input-field pl-11"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end">
                                <Link to={`/forgot-password/${role}`} className="text-sm font-medium text-primary-600 hover:text-primary-500">
                                    Forgot password?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full btn-primary flex justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? 'Signing in...' : 'Sign in'}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                            <p className="text-sm text-slate-500">
                                Don't have an account?{' '}
                                <Link to={`/register/${role}`} className="font-semibold text-primary-600 hover:text-primary-700">
                                    Create one now
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
