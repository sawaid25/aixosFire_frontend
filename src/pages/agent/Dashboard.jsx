import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Users, CheckCircle, DollarSign, Clock, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon not finding images in webpack/vite environments
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const StatCard = ({ icon: Icon, title, value, subtext, color }) => (
    <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 hover:shadow-lg transition-all duration-300 group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${color} bg-opacity-10 transition-transform group-hover:scale-110`}>
                <Icon size={24} className={color.replace('bg-', 'text-')} />
            </div>
            {subtext && <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1"><TrendingUp size={12} /> {subtext}</span>}
        </div>
        <div>
            <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
            <h3 className="text-3xl font-display font-bold text-slate-900 tracking-tight">{value}</h3>
        </div>
    </div>
);

const AgentDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ totalVisits: 0, conversions: 0, earnings: 0, chartData: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // 1. Get Total Visits
                const { count: totalVisits, error: vError } = await supabase
                    .from('visits')
                    .select('*', { count: 'exact', head: true })
                    .eq('agent_id', user.id);

                if (vError) throw vError;

                // 2. Get Conversions
                const { count: conversions, error: cError } = await supabase
                    .from('visits')
                    .select('*', { count: 'exact', head: true })
                    .eq('agent_id', user.id)
                    .eq('status', 'Completed');

                if (cError) throw cError;

                // Mock historical data (usually this would be a proper grouping query)
                const monthlyData = [
                    { name: 'Jan', visits: 12, earnings: 400 },
                    { name: 'Feb', visits: 19, earnings: 750 },
                    { name: 'Mar', visits: 15, earnings: 600 },
                    { name: 'Apr', visits: 22, earnings: 1200 },
                    { name: 'May', visits: 30, earnings: 1500 },
                    { name: 'Jun', visits: 35, earnings: 1800 },
                ];

                const earnings = (conversions || 0) * 50;

                setStats({
                    totalVisits: totalVisits || 0,
                    conversions: conversions || 0,
                    earnings: earnings,
                    chartData: monthlyData
                });
            } catch (err) {
                console.error("Failed to fetch stats", err);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchStats();
    }, [user]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
                        Welcome back, <span className="text-primary-500">{user?.name}</span>
                    </h1>
                    <p className="text-slate-500">Here's what's happening in your territory today.</p>
                </div>
                <Link to="/agent/visit" className="btn-primary flex items-center gap-2 group">
                    <span>Log New Visit</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    icon={Users}
                    title="Total Visits"
                    value={stats.totalVisits}
                    color="bg-blue-500"
                    subtext="+12% this week"
                />
                <StatCard
                    icon={CheckCircle}
                    title="Conversions"
                    value={stats.conversions}
                    color="bg-green-500"
                    subtext="42% conversion rate"
                />
                <StatCard
                    icon={DollarSign}
                    title="Total Earnings"
                    value={`$${stats.earnings}`}
                    color="bg-orange-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Charts Section */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-soft border border-slate-100 p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp size={22} className="text-primary-500" /> Performance Analytics
                        </h3>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.chartData}>
                                <defs>
                                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                />
                                <Area type="monotone" dataKey="visits" stroke="#f97316" fillOpacity={1} fill="url(#colorVisits)" strokeWidth={3} />
                                <Area type="monotone" dataKey="earnings" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEarnings)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Territory Map */}
                <div className="bg-white rounded-3xl shadow-soft border border-slate-100 p-8 flex flex-col">
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <MapPin size={22} className="text-green-500" /> My Territory
                    </h3>
                    <div className="flex-1 rounded-2xl overflow-hidden relative h-64 lg:h-auto min-h-[300px] bg-slate-100 z-0">
                        {/* Use a fixed height or flex-1 */}
                        <MapContainer center={[24.8607, 67.0011]} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {/* Example Marker */}
                            <Marker position={[24.8607, 67.0011]}>
                                <Popup>
                                    Main Market <br /> High Density Area.
                                </Popup>
                            </Marker>
                        </MapContainer>
                    </div>
                    <button className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors">
                        Expand Map
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AgentDashboard;
