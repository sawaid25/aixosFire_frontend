import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, UserPlus, DollarSign, Activity, TrendingUp, AlertCircle, FileText } from 'lucide-react';

const StatCard = ({ icon: Icon, title, value, subtext, color }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-soft animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-2xl ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
            {subtext && (
                <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded-lg flex items-center gap-1">
                    <TrendingUp size={12} /> {subtext}
                </span>
            )}
        </div>
        <div>
            <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
        </div>
    </div>
);

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch stats from Supabase
                const { count: totalAgents } = await supabase.from('agents').select('*', { count: 'exact', head: true });
                const { count: pendingAgents } = await supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
                const { count: totalCustomers } = await supabase.from('customers').select('*', { count: 'exact', head: true });
                const { data: servicesData, error: sError } = await supabase
                    .from('services')
                    .select('id, service_type, scheduled_date, status')
                    .eq('status', 'Completed');

                if (sError) throw sError;

                const pricing = {
                    'inspection': 50,
                    'refilling': 65,
                    'installation': 150
                };

                let totalRevenue = 0;
                const monthlyData = {};

                (servicesData || []).forEach(s => {
                    const price = pricing[s.service_type] || 50;
                    totalRevenue += price;

                    const date = new Date(s.scheduled_date || Date.now());
                    const month = date.toLocaleString('default', { month: 'short' });

                    if (!monthlyData[month]) {
                        monthlyData[month] = { name: month, revenue: 0, services: 0 };
                    }
                    monthlyData[month].revenue += price;
                    monthlyData[month].services += 1;
                });

                // Sort and ensure 6 months
                const monthsInOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const revenueChart = monthsInOrder
                    .filter(m => monthlyData[m])
                    .map(m => monthlyData[m])
                    .slice(-6);

                // If empty, show some zeros
                if (revenueChart.length === 0) {
                    revenueChart.push({ name: 'current', revenue: 0, services: 0 });
                }

                setStats({
                    totalAgents: totalAgents || 0,
                    pendingAgents: pendingAgents || 0,
                    totalCustomers: totalCustomers || 0,
                    totalServices: servicesData?.length || 0,
                    totalRevenue,
                    revenueChart
                });
            } catch (err) {
                console.error("Failed to load admin dashboard", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) return <div className="p-10 text-center text-slate-500 font-medium">Loading Dashboard...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">Admin Overview</h1>
                    <p className="text-slate-500">Platform performance and operational metrics.</p>
                </div>
                <button className="btn-primary">Generate Report</button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={DollarSign}
                    title="Total Revenue"
                    value={`$${stats?.totalRevenue?.toLocaleString() || 0}`}
                    subtext="Real-time data"
                    color="bg-emerald-500"
                />
                <StatCard
                    icon={Users}
                    title="Active Agents"
                    value={stats?.totalAgents || 0}
                    color="bg-blue-500"
                />
                <StatCard
                    icon={UserPlus}
                    title="Pending Approvals"
                    value={stats?.pendingAgents || 0}
                    subtext={stats?.pendingAgents > 0 ? "Action Required" : "All Clear"}
                    color="bg-orange-500"
                />
                <StatCard
                    icon={Activity}
                    title="Total Services"
                    value={stats?.totalServices || 0}
                    color="bg-purple-500"
                />
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Revenue Trends (6 Months)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats?.revenueChart || []}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} prefix="$" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <h3 className="text-lg font-bold mb-4 relative z-10">Activities</h3>
                    <div className="flex flex-col items-center justify-center h-[200px] text-slate-400">
                        <Activity size={32} className="mb-2" />
                        <p>No recent alerts</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
