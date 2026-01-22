import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Calendar, FileText, User, ShoppingBag, Map, Shield, Bookmark, FireExtinguisher, Clock } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useLocationTracker from '../hooks/useLocationTracker';

const SidebarItem = ({ icon: Icon, label, to, active }) => (
    <Link to={to} className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${active ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
        <Icon size={20} className={`transition-colors ${active ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
        <span className="font-medium tracking-wide text-sm">{label}</span>
    </Link>
);

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Active Location Tracking
    useLocationTracker();

    // Define navigation items based on role
    const getNavItems = () => {
        const role = user?.role || localStorage.getItem('role');
        if (role === 'agent') {
            return [
                { icon: LayoutDashboard, label: 'Dashboard', to: '/agent/dashboard' },
                { icon: User, label: 'My Customers', to: '/agent/customers' },
                { icon: FileText, label: 'Log Visit', to: '/agent/visit' },
                { icon: Calendar, label: 'Performance', to: '/agent/performance' },
            ];
        } else if (role === 'customer') {
            return [
                { icon: LayoutDashboard, label: 'Safety Overview', to: '/customer/dashboard' },
                { icon: FireExtinguisher, label: 'My Inventory', to: '/customer/inventory' },
                { icon: ShoppingBag, label: 'Book Service', to: '/customer/booking' },
                { icon: Clock, label: 'Service History', to: '/customer/history' },
                { icon: Shield, label: 'Certificates', to: '/customer/certificates' },
            ];
        } else if (role === 'admin') {
            return [
                { icon: LayoutDashboard, label: 'Admin Panel', to: '/admin/dashboard' },
                { icon: User, label: 'Manage Agents', to: '/admin/agents' },
                { icon: ShoppingBag, label: 'Total Customers', to: '/admin/customers' },
                { icon: Bookmark, label: 'Service Queue', to: '/admin/services' },
                { icon: Map, label: 'Global Map', to: '/admin/map' },
            ];
        }
        return [];
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            {/* Sidebar */}
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

                <nav className="flex-1 px-4 space-y-2 pt-4">
                    <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Menu</p>
                    {getNavItems().map((item, idx) => (
                        <SidebarItem
                            key={idx}
                            {...item}
                            active={location.pathname === item.to}
                        />
                    ))}
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

                <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 md:hidden p-4 flex justify-between items-center z-20 sticky top-0">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary-500 rounded">
                            <Shield size={18} className="text-white" />
                        </div>
                        <h1 className="text-lg font-bold text-slate-900">AiXOS Red</h1>
                    </div>
                    <button onClick={handleLogout} className="text-slate-500"><LogOut size={20} /></button>
                </header>

                <main className="flex-1 overflow-auto p-4 md:p-8 z-10">
                    <div className="max-w-6xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
