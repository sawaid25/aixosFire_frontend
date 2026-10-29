import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts';
import {
    FileText, Download, Calendar, TrendingUp, Users, Activity,
    CheckCircle, Handshake, DollarSign, ArrowUpRight, Filter,
    BarChart2, RefreshCw, UserCheck
} from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SERVICE_PRICE = { inspection: 50, refilling: 65, installation: 150, validation: 45, maintenance: 80 };

const Reports = () => {
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('6m');
    const [data, setData] = useState({ inquiries: [], agents: [], customers: [], partners: [] });
    const printRef = useRef();

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
                    { data: agents },
                    { data: customers },
                    { data: partners },
                ] = await Promise.all([
                    supabase.from('inquiries')
                        .select('id,inquiry_no,type,status,created_at,agent_id,partner_id,agents(name),partners(business_name),customers(business_name)')
                        .gte('created_at', cutoff)
                        .order('created_at', { ascending: false }),
                    supabase.from('agents').select('id,name,territory,status'),
                    supabase.from('customers').select('id,business_name,created_at,status'),
                    supabase.from('partners').select('id,business_name,status'),
                ]);
                setData({ inquiries: inquiries||[], agents: agents||[], customers: customers||[], partners: partners||[] });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [period]);

    const report = useMemo(() => {
        const { inquiries, agents, customers, partners } = data;

        const total = inquiries.length;
        const completed = inquiries.filter(i => ['completed','accepted','closed'].includes((i.status||'').toLowerCase())).length;
        const pending = inquiries.filter(i => !['completed','accepted','closed','rejected','cancelled'].includes((i.status||'').toLowerCase())).length;
        const rejected = inquiries.filter(i => ['rejected','cancelled'].includes((i.status||'').toLowerCase())).length;
        const totalRevenue = inquiries.filter(i => ['completed','accepted','closed'].includes((i.status||'').toLowerCase()))
            .reduce((s, i) => s + (SERVICE_PRICE[(i.type||'').toLowerCase()]||50), 0);
        const completionRate = total ? Math.round((completed / total) * 100) : 0;

        // Monthly breakdown
        const monthMap = {};
        inquiries.forEach(i => {
            const d = new Date(i.created_at);
            const key = MONTHS[d.getMonth()];
            if (!monthMap[key]) monthMap[key] = { name: key, total: 0, completed: 0, revenue: 0 };
            monthMap[key].total += 1;
            if (['completed','accepted','closed'].includes((i.status||'').toLowerCase())) {
                monthMap[key].completed += 1;
                monthMap[key].revenue += SERVICE_PRICE[(i.type||'').toLowerCase()]||50;
            }
        });
        const monthlyData = MONTHS.filter(m => monthMap[m]).map(m => monthMap[m]);

        // Agent performance
        const agentMap = {};
        inquiries.forEach(i => {
            if (!i.agent_id) return;
            if (!agentMap[i.agent_id]) agentMap[i.agent_id] = { id: i.agent_id, name: i.agents?.name||'Unknown', total: 0, completed: 0, rejected: 0 };
            agentMap[i.agent_id].total += 1;
            const s = (i.status||'').toLowerCase();
            if (['completed','accepted','closed'].includes(s)) agentMap[i.agent_id].completed += 1;
            else if (['rejected','cancelled'].includes(s)) agentMap[i.agent_id].rejected += 1;
        });
        const agentPerf = Object.values(agentMap)
            .map(a => ({ ...a, rate: a.total ? Math.round((a.completed/a.total)*100) : 0 }))
            .sort((a,b) => b.completed - a.completed);

        // Partner performance
        const partnerMap = {};
        inquiries.forEach(i => {
            if (!i.partner_id) return;
            if (!partnerMap[i.partner_id]) partnerMap[i.partner_id] = { id: i.partner_id, name: i.partners?.business_name||'Unknown', total: 0, accepted: 0, rejected: 0 };
            partnerMap[i.partner_id].total += 1;
            const s = (i.status||'').toLowerCase();
            if (['completed','accepted','closed'].includes(s)) partnerMap[i.partner_id].accepted += 1;
            else if (['rejected','cancelled'].includes(s)) partnerMap[i.partner_id].rejected += 1;
        });
        const partnerPerf = Object.values(partnerMap)
            .map(p => ({ ...p, rate: p.total ? Math.round((p.accepted/p.total)*100) : 0 }))
            .sort((a,b) => b.accepted - a.accepted);

        // Service type breakdown
        const typeMap = {};
        inquiries.forEach(i => { const t = i.type||'Unknown'; typeMap[t] = (typeMap[t]||0)+1; });
        const typeBreakdown = Object.entries(typeMap).map(([name, count]) => ({ name, count }));

        // Customer growth
        const custMap = {};
        customers.forEach(c => {
            const d = new Date(c.created_at);
            const key = MONTHS[d.getMonth()];
            custMap[key] = (custMap[key]||0) + 1;
        });
        const custGrowth = MONTHS.filter(m => custMap[m]).map(m => ({ name: m, count: custMap[m] }));

        return { total, completed, pending, rejected, totalRevenue, completionRate, monthlyData, agentPerf, partnerPerf, typeBreakdown, custGrowth, agentCount: agents.length, customerCount: customers.length, partnerCount: partners.length };
    }, [data]);

    const handlePrint = () => window.print();

    if (loading) return <PageLoader message="Generating reports..." />;

    return (
        <div className="space-y-8" ref={printRef}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin · Reports</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Reports & Insights</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Comprehensive platform analytics and performance summaries.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm">
                        {[{v:'1m',l:'1M'},{v:'3m',l:'3M'},{v:'6m',l:'6M'}].map(({ v, l }) => (
                            <button key={v} onClick={() => setPeriod(v)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${period === v ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                    <button onClick={handlePrint}
                        className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
                        <Download size={14}/> Export
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: DollarSign,  label: 'Total Revenue',    value: `SAR ${report.totalRevenue.toLocaleString()}`, color: 'bg-emerald-50 text-emerald-600' },
                    { icon: Activity,    label: 'Total Inquiries',  value: report.total,             color: 'bg-blue-50 text-blue-600' },
                    { icon: CheckCircle, label: 'Completion Rate',  value: `${report.completionRate}%`, color: 'bg-teal-50 text-teal-600' },
                    { icon: Users,       label: 'Total Customers',  value: report.customerCount,     color: 'bg-sky-50 text-sky-600' },
                ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="bg-white rounded-3xl border border-slate-100 shadow-soft p-5 flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${color.split(' ')[0]}`}>
                            <Icon size={20} className={color.split(' ')[1]}/>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-semibold">{label}</p>
                            <p className="text-xl font-bold text-slate-900">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Platform Summary Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
                    <BarChart2 size={16} className="text-slate-400"/> Platform Summary Report
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Inquiries',   value: report.total,              sub: `${period} period`, color: 'border-l-blue-400' },
                        { label: 'Completed',         value: report.completed,           sub: `${report.completionRate}% rate`, color: 'border-l-emerald-400' },
                        { label: 'Pending',           value: report.pending,             sub: 'Awaiting action', color: 'border-l-amber-400' },
                        { label: 'Rejected',          value: report.rejected,            sub: 'Cancelled/rejected', color: 'border-l-red-400' },
                        { label: 'Active Agents',     value: report.agentCount,          sub: 'Registered agents', color: 'border-l-violet-400' },
                        { label: 'Partners',          value: report.partnerCount,        sub: 'Service partners', color: 'border-l-orange-400' },
                        { label: 'Customers',         value: report.customerCount,       sub: 'Registered customers', color: 'border-l-sky-400' },
                        { label: 'Est. Revenue',      value: `SAR ${report.totalRevenue.toLocaleString()}`, sub: 'From completions', color: 'border-l-teal-400' },
                    ].map(({ label, value, sub, color }) => (
                        <div key={label} className={`bg-slate-50 rounded-2xl p-4 border-l-4 ${color}`}>
                            <p className="text-xs text-slate-400 mb-1">{label}</p>
                            <p className="text-xl font-bold text-slate-900">{value}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Monthly Trend Chart */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <h3 className="font-bold text-slate-900 mb-5">Monthly Inquiry & Revenue Trend</h3>
                <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={report.monthlyData}>
                            <defs>
                                <linearGradient id="rRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="rInq" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                            <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                            <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                            <Legend formatter={(value) => <span className="text-slate-600">{value}</span>} />
                            <Area type="monotone" dataKey="revenue" name="Revenue (SAR)" stroke="#10b981" strokeWidth={2.5} fill="url(#rRev)"/>
                            <Area type="monotone" dataKey="completed" name="Completed" stroke="#3b82f6" strokeWidth={2} fill="url(#rInq)"/>
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Agent + Partner Reports Side by Side */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Agent Performance Report */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <UserCheck size={15} className="text-violet-500"/> Agent Performance Report
                        </h3>
                        <span className="text-xs text-slate-400">{report.agentPerf.length} agents</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="px-5 py-3">Agent</th>
                                    <th className="px-5 py-3 text-center">Total</th>
                                    <th className="px-5 py-3 text-center">Done</th>
                                    <th className="px-5 py-3 text-center">Rejected</th>
                                    <th className="px-5 py-3 text-right">Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {report.agentPerf.length === 0 && (
                                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No agent data.</td></tr>
                                )}
                                {report.agentPerf.map(a => (
                                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 font-semibold text-slate-900">{a.name}</td>
                                        <td className="px-5 py-3 text-center text-slate-600">{a.total}</td>
                                        <td className="px-5 py-3 text-center"><span className="text-emerald-600 font-bold">{a.completed}</span></td>
                                        <td className="px-5 py-3 text-center"><span className="text-red-500 font-bold">{a.rejected}</span></td>
                                        <td className="px-5 py-3 text-right">
                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${a.rate >= 70 ? 'bg-green-100 text-green-700' : a.rate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                {a.rate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Partner Performance Report */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Handshake size={15} className="text-orange-700"/> Partner Performance Report
                        </h3>
                        <span className="text-xs text-slate-400">{report.partnerPerf.length} partners</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="px-5 py-3">Partner</th>
                                    <th className="px-5 py-3 text-center">Total</th>
                                    <th className="px-5 py-3 text-center">Accepted</th>
                                    <th className="px-5 py-3 text-center">Rejected</th>
                                    <th className="px-5 py-3 text-right">Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {report.partnerPerf.length === 0 && (
                                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No partner data.</td></tr>
                                )}
                                {report.partnerPerf.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 font-semibold text-slate-900">{p.name}</td>
                                        <td className="px-5 py-3 text-center text-slate-600">{p.total}</td>
                                        <td className="px-5 py-3 text-center"><span className="text-emerald-600 font-bold">{p.accepted}</span></td>
                                        <td className="px-5 py-3 text-center"><span className="text-red-500 font-bold">{p.rejected}</span></td>
                                        <td className="px-5 py-3 text-right">
                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${p.rate >= 70 ? 'bg-green-100 text-green-700' : p.rate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                {p.rate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Service Type + Customer Growth Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <h3 className="font-bold text-slate-900 mb-5">Service Type Report</h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={report.typeBreakdown} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#64748b', fontSize:11 }} width={90}/>
                                <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                                <Bar dataKey="count" name="Inquiries" fill="#3b82f6" radius={[0,4,4,0]}/>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                    <h3 className="font-bold text-slate-900 mb-5">Customer Growth Report</h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={report.custGrowth}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                                <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                                <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                                <Bar dataKey="count" name="New Customers" fill="#10b981" radius={[4,4,0,0]}/>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Insights Panel */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white">
                <h3 className="font-bold mb-5 flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-400"/> Key Insights
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Best Completion Rate', value: report.agentPerf.length ? `${report.agentPerf[0]?.rate}% — ${report.agentPerf[0]?.name}` : 'N/A', icon: '🏆' },
                        { label: 'Most Active Type', value: report.typeBreakdown.sort((a,b) => b.count - a.count)[0]?.name || 'N/A', icon: '📋' },
                        { label: 'Completion Rate', value: `${report.completionRate}%`, icon: '✅' },
                        { label: 'Est. Revenue', value: `SAR ${report.totalRevenue.toLocaleString()}`, icon: '💰' },
                    ].map(({ label, value, icon }) => (
                        <div key={label} className="bg-white/10 rounded-2xl p-4">
                            <p className="text-2xl mb-2">{icon}</p>
                            <p className="text-xs text-slate-400 mb-1">{label}</p>
                            <p className="text-sm font-bold text-white">{value}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Reports;
