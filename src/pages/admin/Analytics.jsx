import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import { Link, useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
    DollarSign, Activity, Users, TrendingUp, TrendingDown,
    CheckCircle, Clock, XCircle, ArrowRight, ArrowUpRight,
    Award, AlertTriangle, Handshake, UserPlus, Filter
} from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import ChartCard from '../../components/admin/ChartCard';
import PerformanceBadge from '../../components/admin/PerformanceBadge';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PIE_COLORS = ['#ef4444','#f97316','#3b82f6','#10b981','#8b5cf6','#ec4899'];
const SERVICE_PRICE = { inspection: 50, refilling: 65, installation: 150, validation: 45, maintenance: 80 };

const StatusDot = ({ status }) => {
    const map = {
        completed: 'bg-green-500', accepted: 'bg-green-500', closed: 'bg-green-500',
        rejected: 'bg-red-500', cancelled: 'bg-red-500',
        pending: 'bg-amber-400', 'in progress': 'bg-blue-500', scheduled: 'bg-blue-400',
    };
    return <span className={`inline-block w-2 h-2 rounded-full ${map[(status||'').toLowerCase()] || 'bg-slate-300'}`}/>;
};

const Analytics = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('6m');
    const [raw, setRaw] = useState({ inquiries: [], customers: [], agents: [], partners: [] });
    const [allTimeInq, setAllTimeInq] = useState([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const cutoff = period === '1m'
                    ? new Date(Date.now() - 30 * 86400000).toISOString()
                    : period === '3m'
                    ? new Date(Date.now() - 90 * 86400000).toISOString()
                    : new Date(Date.now() - 180 * 86400000).toISOString();

                const [
                    { data: inquiries },
                    { data: customers },
                    { data: agents },
                    { data: partners },
                ] = await Promise.all([
                    supabase.from('inquiries')
                        .select('id,inquiry_no,type,status,created_at,agent_id,partner_id,agents(id,name,territory)')
                        .gte('created_at', cutoff)
                        .order('created_at', { ascending: true }),
                    supabase.from('customers').select('id,created_at,status').order('created_at', { ascending: true }),
                    supabase.from('agents').select('id,name,territory,status').order('name'),
                    supabase.from('partners').select('id,business_name,status').order('business_name'),
                ]);

                setRaw({
                    inquiries: inquiries || [],
                    customers: customers || [],
                    agents: agents || [],
                    partners: partners || [],
                });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [period]);

    // Fetch ALL-TIME inquiries once — no date filter — to match Dashboard card values
    useEffect(() => {
        supabase
            .from('inquiries')
            .select('id,type,status')
            .then(({ data }) => setAllTimeInq(data || []));
    }, []);

    // All-time card values — same logic as Dashboard
    const allTimeMetrics = useMemo(() => {
        const total     = allTimeInq.length;
        const completed = allTimeInq.filter(i => ['completed','accepted','closed'].includes((i.status||'').toLowerCase())).length;
        const totalRevenue = allTimeInq
            .filter(i => ['completed','accepted','closed'].includes((i.status||'').toLowerCase()))
            .reduce((sum, i) => sum + (SERVICE_PRICE[(i.type||'').toLowerCase()] || 50), 0);
        const completionRate = total ? Math.round((completed / total) * 100) : 0;
        return { total, completed, totalRevenue, completionRate };
    }, [allTimeInq]);

    const metrics = useMemo(() => {
        const { inquiries, customers, agents } = raw;

        // --- Revenue by month ---
        const monthMap = {};
        inquiries.forEach(i => {
            const d = new Date(i.created_at);
            const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
            if (!monthMap[key]) monthMap[key] = { name: MONTHS[d.getMonth()], total: 0, completed: 0, revenue: 0, pending: 0, rejected: 0 };
            monthMap[key].total += 1;
            const s = (i.status||'').toLowerCase();
            const price = SERVICE_PRICE[(i.type||'').toLowerCase()] || 50;
            if (['completed','accepted','closed'].includes(s)) { monthMap[key].completed += 1; monthMap[key].revenue += price; }
            else if (['rejected','cancelled'].includes(s)) monthMap[key].rejected += 1;
            else monthMap[key].pending += 1;
        });
        const trendData = Object.values(monthMap);

        // --- Customer growth ---
        const custMap = {};
        customers.forEach(c => {
            const d = new Date(c.created_at);
            const key = MONTHS[d.getMonth()];
            custMap[key] = (custMap[key] || 0) + 1;
        });
        const custGrowth = MONTHS.filter(m => custMap[m]).map(m => ({ name: m, customers: custMap[m] }));

        // --- Inquiry type breakdown ---
        const typeMap = {};
        inquiries.forEach(i => { const t = i.type || 'Unknown'; typeMap[t] = (typeMap[t]||0)+1; });
        const typeBreakdown = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

        // --- Agent performance ---
        const agentStats = {};
        inquiries.forEach(i => {
            if (!i.agent_id) return;
            if (!agentStats[i.agent_id]) agentStats[i.agent_id] = { id: i.agent_id, name: i.agents?.name || 'Unknown', total: 0, completed: 0, rejected: 0, pending: 0 };
            agentStats[i.agent_id].total += 1;
            const s = (i.status||'').toLowerCase();
            if (['completed','accepted','closed'].includes(s)) agentStats[i.agent_id].completed += 1;
            else if (['rejected','cancelled'].includes(s)) agentStats[i.agent_id].rejected += 1;
            else agentStats[i.agent_id].pending += 1;
        });
        const agentPerf = Object.values(agentStats).map(a => ({
            ...a,
            score: a.total ? Math.round((a.completed / a.total) * 100) : 0,
        })).sort((a, b) => b.score - a.score);

        // --- Status breakdown ---
        const statusMap = {};
        inquiries.forEach(i => { const s = i.status||'Unknown'; statusMap[s] = (statusMap[s]||0)+1; });
        const statusBreakdown = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

        // --- Overall numbers ---
        const total = inquiries.length;
        const completed = inquiries.filter(i => ['completed','accepted','closed'].includes((i.status||'').toLowerCase())).length;
        const pending = inquiries.filter(i => !['completed','accepted','closed','rejected','cancelled'].includes((i.status||'').toLowerCase())).length;
        const rejected = inquiries.filter(i => ['rejected','cancelled'].includes((i.status||'').toLowerCase())).length;
        const totalRevenue = inquiries.filter(i => ['completed','accepted','closed'].includes((i.status||'').toLowerCase()))
            .reduce((s, i) => s + (SERVICE_PRICE[(i.type||'').toLowerCase()]||50), 0);
        const completionRate = total ? Math.round((completed / total) * 100) : 0;

        return { trendData, custGrowth, typeBreakdown, agentPerf, statusBreakdown, total, completed, pending, rejected, totalRevenue, completionRate };
    }, [raw]);

    if (loading) return <PageLoader message="Loading analytics..." />;

    const topAgents = metrics.agentPerf.slice(0, 5);
    const lowAgents = [...metrics.agentPerf].reverse().slice(0, 5);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin · Analytics</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Analytics Dashboard</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Deep-dive into revenue, inquiries, agents & partners.</p>
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                    {[{v:'1m',l:'1 Month'},{v:'3m',l:'3 Months'},{v:'6m',l:'6 Months'}].map(({ v, l }) => (
                        <button key={v} onClick={() => setPeriod(v)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${period === v ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={DollarSign}   title="Sales & Revenue"          value={`SAR ${allTimeMetrics.totalRevenue.toLocaleString()}`} color="bg-emerald-500" trend={8}  subtext={`${allTimeMetrics.completed} closed · all time`} />
                <StatCard icon={Activity}     title="Total Inquiries"          value={allTimeMetrics.total}           color="bg-blue-500"    trend={5}  subtext={`${allTimeMetrics.total - allTimeMetrics.completed} active · all time`} />
                <StatCard icon={CheckCircle}  title="All-Time Completions"     value={`${allTimeMetrics.completed} / ${allTimeMetrics.total}`} color="bg-teal-500"    subtext={`${allTimeMetrics.completionRate}% completion rate`} />
                <StatCard icon={Clock}        title="Pending"           value={metrics.pending}         color="bg-amber-500"   subtext={`${metrics.rejected} rejected`} />
            </div>

            {/* Trend + Customer Growth */}
            <div className="grid lg:grid-cols-2 gap-6">
                <ChartCard title="Inquiry & Revenue Trends" subtitle={`Grouped by month — ${period} view`}>
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                                <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                                <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                                <Legend formatter={(value) => <span className="text-slate-600">{value}</span>} />
                                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4,4,0,0]} stackId="a"/>
                                <Bar dataKey="pending"   name="Pending"   fill="#f59e0b" radius={[4,4,0,0]} stackId="a"/>
                                <Bar dataKey="rejected"  name="Rejected"  fill="#ef4444" radius={[4,4,0,0]} stackId="a"/>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                <ChartCard title="Customer Growth" subtitle="New customers registered by month">
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.custGrowth}>
                                <defs>
                                    <linearGradient id="gCust" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                                <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                                <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                                <Area type="monotone" dataKey="customers" name="New Customers" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gCust)"/>
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* Refill/Validation/Maintenance breakdown */}
            <div className="grid lg:grid-cols-3 gap-6">
                <ChartCard title="Service Type Distribution" subtitle="Breakdown by inquiry type">
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={metrics.typeBreakdown} cx="50%" cy="50%" outerRadius={80} paddingAngle={3} dataKey="value">
                                    {metrics.typeBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius:'10px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-2">
                        {metrics.typeBreakdown.map((item, i) => (
                            <div key={item.name} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}/>
                                    <span className="text-xs text-slate-600 capitalize">{item.name}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-900">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </ChartCard>

                {/* Completion Funnel */}
                <ChartCard title="Inquiry Status Breakdown" subtitle="Distribution by current status">
                    <div className="space-y-3 pt-2">
                        {/* Total Inquiries row */}
                        <button
                            onClick={() => navigate('/admin/inquiries')}
                            className="w-full text-left group cursor-pointer rounded-xl px-2 py-1.5 -mx-2 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex justify-between text-xs mb-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-block w-2 h-2 rounded-full bg-slate-400"/>
                                    <span className="text-slate-600 font-semibold group-hover:text-primary-600 transition-colors">Total Inquiries</span>
                                </div>
                                <span className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors">{metrics.total}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full transition-all bg-slate-400" style={{ width: '100%' }}/>
                            </div>
                        </button>

                        {metrics.statusBreakdown.map((item, i) => {
                            const pct = metrics.total ? Math.round((item.value / metrics.total) * 100) : 0;
                            return (
                                <button
                                    key={item.name}
                                    onClick={() => navigate(`/admin/inquiries?status=${encodeURIComponent(item.name)}`)}
                                    className="w-full text-left group cursor-pointer rounded-xl px-2 py-1.5 -mx-2 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex justify-between text-xs mb-1">
                                        <div className="flex items-center gap-1.5">
                                            <StatusDot status={item.name}/>
                                            <span className="text-slate-600 capitalize group-hover:text-primary-600 transition-colors">{item.name}</span>
                                        </div>
                                        <span className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors">{item.value} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}/>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </ChartCard>

                {/* Completion Rate KPI */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl"/>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Platform Health</p>
                    <div className="space-y-5">
                        {[
                            { label: 'Completion Rate', value: `${metrics.completionRate}%`, color: 'text-emerald-400' },
                            { label: 'Rejection Rate', value: metrics.total ? `${Math.round((metrics.rejected/metrics.total)*100)}%` : '0%', color: 'text-red-400' },
                            { label: 'Active Agents', value: raw.agents.filter(a => ['accepted','active'].includes((a.status||'').toLowerCase())).length, color: 'text-blue-400' },
                            { label: 'Total Partners', value: raw.partners.length, color: 'text-orange-400' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="flex items-center justify-between border-b border-slate-700/50 pb-4 last:border-0 last:pb-0">
                                <span className="text-sm text-slate-400">{label}</span>
                                <span className={`text-xl font-bold ${color}`}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Agent Performance Tables */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Top Performing Agents */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Award size={18} className="text-amber-700"/>
                            <h3 className="font-bold text-slate-900">Top Performing Agents</h3>
                        </div>
                        <Link to="/admin/agents" className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                            Manage all <ArrowRight size={12}/>
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {topAgents.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No data for this period.</p>}
                        {topAgents.map((a, i) => (
                            <Link key={a.id} to={`/admin/agents/${a.id}`} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors group">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-700'
                                }`}>{i+1}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{a.name}</p>
                                    <p className="text-xs text-slate-400">{a.total} inquiries · {a.completed} completed</p>
                                </div>
                                <PerformanceBadge score={a.score}/>
                                <ArrowRight size={13} className="text-slate-300 group-hover:text-slate-600 ml-1"/>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Low Performing Agents */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-500"/>
                            <h3 className="font-bold text-slate-900">Needs Attention</h3>
                        </div>
                        <Link to="/admin/agents" className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                            Review <ArrowRight size={12}/>
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {lowAgents.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No data for this period.</p>}
                        {lowAgents.map((a, i) => (
                            <Link key={a.id} to={`/admin/agents/${a.id}`} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors group">
                                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                                    <TrendingDown size={14} className="text-red-500"/>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{a.name}</p>
                                    <p className="text-xs text-slate-400">{a.total} assigned · {a.rejected} rejected</p>
                                </div>
                                <PerformanceBadge score={a.score}/>
                                <ArrowRight size={13} className="text-slate-300 group-hover:text-slate-600 ml-1"/>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Daily Activity Tracking */}
            <ChartCard title="Daily Inquiry Activity" subtitle="All agents — inquiries handled per month">
                <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metrics.trendData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                            <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                            <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                            <Legend formatter={(value) => <span className="text-slate-600">{value}</span>} />
                            <Line type="monotone" dataKey="total"     name="Total"     stroke="#3b82f6" strokeWidth={2.5} dot={false}/>
                            <Line type="monotone" dataKey="completed" name="Completed"  stroke="#10b981" strokeWidth={2.5} dot={false}/>
                            <Line type="monotone" dataKey="pending"   name="Pending"    stroke="#f59e0b" strokeWidth={2}   dot={false} strokeDasharray="4 2"/>
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        </div>
    );
};

export default Analytics;
