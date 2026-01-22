import React from 'react';
import { Link } from 'react-router-dom';
import { User, Shield, Briefcase, CheckCircle, ArrowRight, Star } from 'lucide-react';

const RoleCard = ({ to, icon: Icon, title, description, color, badges }) => (
    <Link to={to} className="group relative bg-white p-8 rounded-3xl shadow-soft hover:shadow-2xl transition-all duration-300 border border-slate-100/50 hover:-translate-y-1 overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-150`}></div>

        <div className={`w-16 h-16 rounded-2xl ${color} bg-opacity-10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
            <Icon size={32} className={color.replace('bg-', 'text-')} />
        </div>

        <h3 className="text-2xl font-bold text-slate-900 mb-3">{title}</h3>
        <p className="text-slate-500 mb-6 leading-relaxed">{description}</p>

        <div className="flex flex-wrap gap-2 mb-8">
            {badges.map((badge, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-semibold border border-slate-100">
                    {badge}
                </span>
            ))}
        </div>

        <div className="flex items-center text-primary-600 font-bold group-hover:translate-x-2 transition-transform">
            <span>Get Started</span>
            <ArrowRight size={18} className="ml-2" />
        </div>
    </Link>
);

const Feature = ({ title, desc }) => (
    <div className="flex items-start space-x-4">
        <div className="mt-1 bg-green-100 p-1 rounded-full">
            <CheckCircle size={16} className="text-green-600" />
        </div>
        <div>
            <h4 className="font-bold text-slate-900">{title}</h4>
            <p className="text-sm text-slate-500">{desc}</p>
        </div>
    </div>
);

const LandingPage = () => {
    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-primary-100 selection:text-primary-900">
            {/* Navbar */}
            <nav className="glass fixed w-full z-50 px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary-500 rounded-lg">
                            <Shield className="text-white" size={24} />
                        </div>
                        <span className="text-xl font-display font-bold text-slate-900">AiXOS Red<span className="text-primary-500">.</span></span>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Features</a>
                        <a href="#about" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">About</a>
                        <Link to="/login/agent" className="text-slate-900 font-medium hover:text-primary-600">Agent Login</Link>
                        <Link to="/login/customer" className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-shadow shadow-lg shadow-slate-900/20">
                            Book Service
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-hero-pattern">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-primary-200/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-3xl"></div>

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-8 animate-fade-in-up">
                            <Star size={16} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-semibold text-slate-700">Bit1 Labs Hackathon Project</span>
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-display font-bold text-slate-900 mb-6 leading-tight tracking-tight">
                            Modern <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-red-600">Fire Safety</span> <br />
                            Management
                        </h1>

                        <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                            The complete marketplace platform connecting businesses with certified fire safety experts.
                            Automate compliance, track inventory, and ensure safety instantly.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/register/customer" className="btn-primary flex items-center justify-center gap-2 group">
                                Get Started <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link to="/login/agent" className="btn-outline">
                                Join as Agent
                            </Link>
                        </div>
                    </div>

                    {/* Role Cards */}
                    <div className="grid md:grid-cols-3 gap-8">
                        <RoleCard
                            to="/login/customer"
                            icon={User}
                            title="Business Owners"
                            description="Keep your premises safe and compliant. Track extinguisher expiry and book instant refills."
                            color="bg-slate-900 text-white"
                            badges={['Inventory Tracking', 'Instant Booking', 'Compliance Certs']}
                        />
                        <RoleCard
                            to="/login/agent"
                            icon={Briefcase}
                            title="Field Agents"
                            description="Expand your territory. Manage visits, track commissions, and optimize your daily route."
                            color="bg-primary-500 text-white"
                            badges={['Route Planning', 'Commission Tracking', 'Digital Reports']}
                        />
                        <RoleCard
                            to="/login/admin"
                            icon={Shield}
                            title="Administrators"
                            description="Full oversight of the marketplace. Monitor agency performance and service quality."
                            color="bg-slate-700 text-white"
                            badges={['Analytics', 'User Management', 'Quality Control']}
                        />
                    </div>
                </div>
            </div>

            {/* Trust Section */}
            <div className="bg-white py-20 border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl font-display font-bold text-slate-900 mb-6">Why choose AiXOS?</h2>
                            <p className="text-slate-600 mb-8 text-lg">We streamline the chaotic process of manual safety checks into a seamless digital experience.</p>

                            <div className="space-y-6">
                                <Feature title="Real-time Compliance Tracking" desc="Never miss an expiry date again with automated alerts." />
                                <Feature title="Verified Professionals" desc="All agents are vetted and certified for your safety." />
                                <Feature title="Instant Digital Certificates" desc="Download compliance documents immediately after service." />
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 relative">
                            {/* Abstract UI Mockup */}
                            <div className="bg-white rounded-xl shadow-lg p-6 mb-4 transform -rotate-2 border border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600"><CheckCircle size={20} /></div>
                                        <div>
                                            <div className="h-2 w-24 bg-slate-200 rounded mb-1"></div>
                                            <div className="h-2 w-16 bg-slate-100 rounded"></div>
                                        </div>
                                    </div>
                                    <div className="h-6 w-16 bg-green-50 rounded text-xs text-green-600 flex items-center justify-center font-bold">Valid</div>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded mb-2"></div>
                                <div className="h-2 w-3/4 bg-slate-100 rounded"></div>
                            </div>

                            <div className="bg-white rounded-xl shadow-lg p-6 transform rotate-2 translate-x-4 border border-slate-100">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600">
                                        <Shield size={24} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">Safety Certificate</p>
                                        <p className="text-xs text-slate-500">Issued just now</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="h-8 flex-1 bg-slate-900 rounded-lg"></div>
                                    <div className="h-8 w-8 bg-slate-100 rounded-lg"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12">
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8">
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-primary-500 rounded-lg">
                                <Shield className="text-white" size={20} />
                            </div>
                            <span className="text-xl font-display font-bold text-white">AiXOS Red</span>
                        </div>
                        <p className="max-w-xs">Protecting lives and properties with intelligent fire safety management solutions.</p>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4">Platform</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#" className="hover:text-white transition-colors">For Business</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">For Agents</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4">Legal</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                        </ul>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
