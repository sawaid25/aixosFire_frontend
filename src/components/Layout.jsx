import React, { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { LogOut, LayoutDashboard, Calendar, FileText, User, ShoppingBag, Map, Shield, Bookmark, FireExtinguisher, Clock, Menu, X, Tag, Bot, MessageSquare, BarChart2, Handshake, Wrench, FileBarChart, Users, Star, UserCog, Package } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useLocationTracker from '../hooks/useLocationTracker';
import NotificationBell from './NotificationBell';
import ChatModal from './Chat/ChatModal';

const SidebarItem = ({ icon: Icon, label, to, active }) => (
    <Link to={to} className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${active ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
        <Icon size={20} className={`transition-colors ${active ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
        <span className="font-medium tracking-wide text-sm">{label}</span>
    </Link>
);

const ImpersonationBanner = ({ impersonation, onReturnToAdmin }) => {
    const [remaining, setRemaining] = useState('');

    useEffect(() => {
        if (!impersonation?.expiresAt) return;
        const tick = () => {
            const diffMs = new Date(impersonation.expiresAt) - new Date();
            if (diffMs <= 0) { setRemaining('0:00'); return; }
            const mins = Math.floor(diffMs / 60000);
            const secs = Math.floor((diffMs % 60000) / 1000);
            setRemaining(`${mins}:${String(secs).padStart(2, '0')}`);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [impersonation?.expiresAt]);

    return (
        <div className="bg-amber-500 text-amber-950 px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-bold text-center z-40 relative">
            <UserCog size={16} className="flex-shrink-0" />
            <span>
                Viewing as <strong>{impersonation.agentName}</strong> — impersonated by <strong>{impersonation.adminName}</strong>
                {remaining && <span className="font-normal opacity-80"> · {remaining} remaining</span>}
            </span>
            <button
                onClick={onReturnToAdmin}
                className="bg-amber-950 text-amber-50 px-3 py-1 rounded-lg text-xs font-black hover:bg-amber-900 transition-colors"
            >
                Return to Admin
            </button>
        </div>
    );
};

const Layout = ({ children }) => {
    const { user, logout, impersonation, endImpersonation } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const [selectedQueryId, setSelectedQueryId] = React.useState(null);
    const [selectedChatContext, setSelectedChatContext] = React.useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [isSeniorAgent, setIsSeniorAgent] = useState(user?.is_senior_agent || false);

    const handleReturnToAdmin = async () => {
        const result = await endImpersonation();
        if (result?.success) navigate('/admin/agents');
    };

    // Live-check senior agent status so sidebar updates without needing re-login
    useEffect(() => {
        if (user?.role !== 'agent' || !user?.id) return;
        supabase
            .from('senior_agents')
            .select('id')
            .eq('agent_id', user.id)
            .eq('is_activated', true)
            .maybeSingle()
            .then(({ data }) => setIsSeniorAgent(!!data));
    }, [user?.id]);

    // Active Location Tracking
    useLocationTracker();

    const handleOpenChat = (queryId, context = null) => {
        setSelectedQueryId(queryId);
        setSelectedChatContext(context);
        setIsChatOpen(true);
    };

    // Define navigation items based on role
    const getNavItems = () => {
        const role = user?.role || localStorage.getItem('role');
        if (role === 'agent') {
            const base = [
                { icon: LayoutDashboard, label: 'Dashboard',    to: '/agent/dashboard' },
                { icon: User,            label: 'My Customers', to: '/agent/customers' },
                { icon: FileText,        label: 'Log Visit',    to: '/agent/visit' },
                { icon: Calendar,        label: 'Performance',  to: '/agent/performance' },
                { icon: MessageSquare,   label: 'Complaint',    to: '/agent/complaint' },
            ];
            if (isSeniorAgent) {
                base.push({ icon: Star, label: 'Team Activity', to: '/agent/team' });
            }
            return base;
        } else if (role === 'customer') {
            return [
                { icon: LayoutDashboard, label: 'Dashboard', to: '/customer/dashboard' },
                { icon: FireExtinguisher, label: 'My Inventory', to: '/customer/inventory' },
                { icon: ShoppingBag, label: 'New inquiry', to: '/customer/booking' },
                { icon: Clock, label: 'Service History', to: '/customer/history' },
                { icon: Shield, label: 'Certificates', to: '/customer/certificates' },
                { icon: MessageSquare, label: 'Complaint', to: '/customer/complaint' },
            ];
        } else if (role === 'admin') {
            return [
                { icon: LayoutDashboard, label: 'Dashboard',       to: '/admin/dashboard',   group: 'Overview' },
                { icon: BarChart2,       label: 'Analytics',        to: '/admin/analytics',   group: 'Overview' },
                { icon: User,            label: 'Agents',           to: '/admin/agents',      group: 'Management' },
                { icon: Handshake,       label: 'Partners',         to: '/admin/partners',    group: 'Management' },
                { icon: Package,         label: 'Products',         to: '/admin/products',    group: 'Management' },
                { icon: Users,           label: 'Customers',        to: '/admin/customers',   group: 'Management' },
                { icon: Bookmark,        label: 'Service Queue',    to: '/admin/services',    group: 'Operations' },
                { icon: Wrench,          label: 'Operations',       to: '/admin/operations',  group: 'Operations' },
                { icon: Map,             label: 'Global Map',       to: '/admin/map',         group: 'Operations' },
                { icon: MessageSquare,   label: 'Complaints',       to: '/admin/complaints',  group: 'Support' },
                { icon: FileBarChart,    label: 'Reports',          to: '/admin/reports',     group: 'Support' },
            ];
        } else if (role === 'partner') {
            return [
                { icon: LayoutDashboard, label: 'Partner Dashboard', to: '/partner/dashboard' },
                { icon: Tag, label: 'Stickers usage', to: '/partner/stickers' },
                { icon: Bot, label: 'AI Agent', to: '/partner/ai-agent' },
                { icon: MessageSquare, label: 'Complaint', to: '/partner/complaint' },
            ];
        }
        return [];
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans">
            {impersonation && <ImpersonationBanner impersonation={impersonation} onReturnToAdmin={handleReturnToAdmin} />}
            <div className="flex flex-1 min-h-0">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar Drawer */}
            <div className={`fixed inset-y-0 left-0 w-72 bg-slate-900 z-50 md:hidden transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl"></div>
                
                <div className="p-6 relative z-10 flex justify-between items-center border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary-500 rounded-lg shadow-lg shadow-primary-500/20">
                            <Shield size={20} className="text-white" />
                        </div>
                        <h1 className="text-xl font-display font-extrabold text-white tracking-tight">
                            AiXOS Red<span className="text-primary-500">.</span>
                        </h1>
                    </div>
                    <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 px-4 pt-6 overflow-y-auto custom-scrollbar">
                    {(() => {
                        const items = getNavItems();
                        const groups = [...new Set(items.map(i => i.group).filter(Boolean))];
                        if (!groups.length) {
                            return (
                                <div className="space-y-1.5">
                                    <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Main Menu</p>
                                    {items.map((item, idx) => (
                                        <div key={idx} onClick={() => setIsMobileMenuOpen(false)}>
                                            <SidebarItem {...item} active={location.pathname === item.to || location.pathname.startsWith(item.to + '/')} />
                                        </div>
                                    ))}
                                </div>
                            );
                        }
                        return groups.map(group => (
                            <div key={group} className="mb-4">
                                <p className="px-4 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">{group}</p>
                                <div className="space-y-1">
                                    {items.filter(i => i.group === group).map((item, idx) => (
                                        <div key={idx} onClick={() => setIsMobileMenuOpen(false)}>
                                            <SidebarItem {...item} active={location.pathname === item.to || location.pathname.startsWith(item.to + '/')} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ));
                    })()}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3 mb-4 px-3 p-2 bg-slate-800 rounded-xl border border-slate-700/50">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-red-600 flex items-center justify-center text-white text-xs font-bold">
                            {user?.name?.[0] || 'U'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                            <p className="text-[10px] text-slate-400 capitalize">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            handleLogout();
                            setIsMobileMenuOpen(false);
                        }}
                        className="flex items-center justify-center space-x-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-4 py-2.5 rounded-xl w-full transition-all duration-200 text-xs font-medium"
                    >
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Desktop Sidebar (unchanged visually but kept separate from drawer for cleaner structure) */}
            <div className="w-72 bg-slate-900 border-r border-slate-800 shadow-xl hidden md:flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl"></div>

                <div className="p-8 relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-primary-500 rounded-lg shadow-lg shadow-primary-500/20">
                            <Shield size={24} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-display font-extrabold text-white tracking-tight">
                            AiXOS Red<span className="text-primary-500">.</span>
                        </h1>
                    </div>
                </div>

                <nav className="flex-1 px-4 pt-4 overflow-y-auto custom-scrollbar">
                    {(() => {
                        const items = getNavItems();
                        const groups = [...new Set(items.map(i => i.group).filter(Boolean))];
                        if (!groups.length) {
                            return (
                                <div className="space-y-1.5">
                                    <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Menu</p>
                                    {items.map((item, idx) => (
                                        <SidebarItem key={idx} {...item} active={location.pathname === item.to || location.pathname.startsWith(item.to + '/')} />
                                    ))}
                                </div>
                            );
                        }
                        return groups.map(group => (
                            <div key={group} className="mb-5">
                                <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2">{group}</p>
                                <div className="space-y-1">
                                    {items.filter(i => i.group === group).map((item, idx) => (
                                        <SidebarItem key={idx} {...item} active={location.pathname === item.to || location.pathname.startsWith(item.to + '/')} />
                                    ))}
                                </div>
                            </div>
                        ));
                    })()}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3 mb-4 px-4 p-3 bg-slate-800 rounded-2xl border border-slate-700/50">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-red-600 flex items-center justify-center text-white font-bold shadow-md">
                            {user?.name?.[0] || 'U'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center space-x-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-4 py-3 rounded-xl w-full transition-all duration-200 text-sm font-medium"
                    >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
                <div className="absolute top-0 left-0 w-full h-64 bg-slate-100 z-0"></div>

                <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 md:px-8 flex justify-between items-center z-30 sticky top-0">
                    <div className="flex items-center gap-3 md:hidden">
                        <button 
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <Menu size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-primary-500 rounded-md">
                                <Shield size={16} className="text-white" />
                            </div>
                            <h1 className="text-base font-bold text-slate-900">AiXOS Red</h1>
                        </div>
                    </div>
                    <div className="hidden md:block">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{location.pathname.split('/').pop().replace('-', ' ')}</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <NotificationBell onOpenChat={handleOpenChat} />
                        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 md:p-8 z-10">
                    <div className="max-w-6xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
            </div>

            <ChatModal
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                queryId={selectedQueryId}
                recipientId={selectedChatContext?.senderId}
                recipientRole={selectedChatContext?.senderRole}
            />

            <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </div>
    );
};

export default Layout;
