import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    ArrowLeft, Handshake, Tag, Activity, CheckCircle,
    XCircle, Clock, Calendar, Package, TrendingUp
} from 'lucide-react';
import PerformanceBadge from '../../components/admin/PerformanceBadge';
import StatCard from '../../components/admin/StatCard';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PIE_COLORS = ['#10b981','#ef4444','#f59e0b','#3b82f6'];

const getBadgeClass = (s) => {
    const v = (s||'').toLowerCase();
    if (['completed','accepted','closed'].includes(v)) return 'bg-green-100 text-green-700';
    if (['rejected','cancelled'].includes(v)) return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
};

const PartnerProfile = () => {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [partner, setPartner] = useState(null);
    const [inquiries, setInquiries] = useState([]);
    const [stickers, setStickers] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [
                    { data: pData, error: pErr },
                    { data: iData },
                    { data: sData },
                ] = await Promise.all([
                    supabase.from('partners').select('*').eq('id', id).maybeSingle(),
                    supabase.from('inquiries')
                        .select('id,inquiry_no,type,status,created_at,customers(business_name)')
                        .eq('partner_id', id)
                        .order('created_at', { ascending: false }),
                    supabase.from('sticker_usage_history')
                        .select('id,quantity,used_for,created_at,inquiries(inquiry_no,customers(business_name))')
                        .eq('partner_id', id)
                        .order('created_at', { ascending: false }),
                ]);
                if (pErr) console.error('Failed to load partner:', pErr);
                setPartner(pData);
                setInquiries(iData || []);
                setStickers(sData || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const metrics = useMemo(() => {
        const total = inquiries.length;
        const accepted = inquiries.filter(i => ['completed','accepted','closed'].includes((i.status||'').toLowerCase())).length;
        const rejected = inquiries.filter(i => ['rejected','cancelled'].includes((i.status||'').toLowerCase())).length;
        const pending = total - accepted - rejected;
        const score = total ? Math.round((accepted / total) * 100) : 0;

        // Sticker totals
        const stickersUsed = stickers.reduce((s, r) => s + (r.quantity||0), 0);
        const stickersRemaining = Number(partner?.stickers_total||0);
        const stickersAllocated = stickersUsed + stickersRemaining;

        // Type breakdown
        const typeMap = {};
        inquiries.forEach(i => { const t = i.type||'Unknown'; typeMap[t] = (typeMap[t]||0)+1; });
        const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

        // Status breakdown for pie
        const statusData = [
            { name: 'Accepted', value: accepted },
            { name: 'Rejected', value: rejected },
            { name: 'Pending', value: pending },
        ].filter(d => d.value > 0);

        // Monthly volume
        const monthMap = {};
        inquiries.forEach(i => {
            const d = new Date(i.created_at);
            const key = MONTHS[d.getMonth()];
            if (!monthMap[key]) monthMap[key] = { name: key, total: 0, accepted: 0, rejected: 0 };
            monthMap[key].total += 1;
            const s = (i.status||'').toLowerCase();
            if (['completed','accepted','closed'].includes(s)) monthMap[key].accepted += 1;
            else if (['rejected','cancelled'].includes(s)) monthMap[key].rejected += 1;
        });
        const monthlyData = MONTHS.filter(m => monthMap[m]).map(m => monthMap[m]);

        // Sticker usage by type
        const stickerTypeMap = {};
        stickers.forEach(s => { const t = s.used_for||'Unknown'; stickerTypeMap[t] = (stickerTypeMap[t]||0)+(s.quantity||0); });
        const stickerTypeData = Object.entries(stickerTypeMap).map(([name, value]) => ({ name, value }));

        return { total, accepted, rejected, pending, score, stickersUsed, stickersRemaining, stickersAllocated, typeData, statusData, monthlyData, stickerTypeData };
    }, [inquiries, stickers, partner]);

    if (loading) return <PageLoader message="Loading partner profile..." />;
    if (!partner) return (
        <div className="text-center py-20">
            <Handshake size={48} className="mx-auto text-slate-200 mb-4"/>
            <p className="text-slate-500">Partner not found.</p>
            <Link to="/admin/partners" className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:underline">
                <ArrowLeft size={14}/> Back to Partners
            </Link>
        </div>
    );

    const TABS = [
        { id: 'overview', label: 'Overview' },
        { id: 'inquiries', label: `Inquiries (${metrics.total})` },
        { id: 'stickers', label: `Sticker Usage (${stickers.length})` },
    ];

    return (
        <div className="space-y-6">
            <Link to="/admin/partners" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
                <ArrowLeft size={16}/> Back to Partner Management
            </Link>

            {/* Profile Card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                        <Handshake size={28} className="text-orange-500"/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-display font-bold text-slate-900">{partner.business_name || `Partner #${id?.slice(-6)}`}</h2>
                                {partner.owner_name && <p className="text-sm text-slate-600 mt-0.5">{partner.owner_name}</p>}
                                {partner.email && <p className="text-sm text-slate-500 mt-0.5">{partner.email}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <PerformanceBadge score={metrics.score}/>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    ['active','accepted'].includes((partner.status||'').toLowerCase()) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                }`}>{partner.status || 'Unknown'}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
                            {partner.phone && <span className="flex items-center gap-1.5">📞 {partner.phone}</span>}
                            {partner.address && <span className="flex items-center gap-1.5">📍 {partner.address}</span>}
                            <span className="flex items-center gap-1.5"><Calendar size={14}/>Joined {new Date(partner.created_at).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1.5"><Tag size={14}/>{metrics.stickersRemaining} stickers remaining</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Activity}    title="Total Assigned"   value={metrics.total}               color="bg-blue-500"/>
                <StatCard icon={CheckCircle} title="Accepted"         value={metrics.accepted}            color="bg-emerald-500" subtext={`${metrics.score}% rate`}/>
                <StatCard icon={XCircle}     title="Rejected"         value={metrics.rejected}            color="bg-red-500"/>
                <StatCard icon={Tag}         title="Stickers Used"    value={metrics.stickersUsed}        color="bg-violet-500" subtext={`${metrics.stickersAllocated} allocated`}/>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1 w-fit shadow-sm">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === t.id ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <h3 className="font-bold text-slate-900 mb-5">Monthly Inquiry Volume</h3>
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={metrics.monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }}/>
                                    <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                                    <Bar dataKey="accepted" name="Accepted" fill="#10b981" radius={[4,4,0,0]} stackId="a"/>
                                    <Bar dataKey="rejected" name="Rejected" fill="#ef4444" radius={[4,4,0,0]} stackId="a"/>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <h3 className="font-bold text-slate-900 mb-5">Acceptance / Rejection Ratio</h3>
                        <div className="h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={metrics.statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                                        {metrics.statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius:'10px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-6 mt-2">
                            {metrics.statusData.map((d, i) => (
                                <div key={d.name} className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}/>
                                    <span className="text-xs text-slate-600">{d.name}: <b>{d.value}</b></span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sticker summary */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <h3 className="font-bold text-slate-900 mb-4">Sticker Inventory</h3>
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: 'Allocated', value: metrics.stickersAllocated, color: 'text-slate-900' },
                                { label: 'Used', value: metrics.stickersUsed, color: 'text-red-600' },
                                { label: 'Remaining', value: metrics.stickersRemaining, color: 'text-emerald-600' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="bg-slate-50 rounded-2xl p-4 text-center">
                                    <p className="text-xs text-slate-400 mb-1">{label}</p>
                                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>Usage</span>
                                <span>{metrics.stickersAllocated ? Math.round((metrics.stickersUsed / metrics.stickersAllocated) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-violet-500 h-2 rounded-full" style={{ width: `${metrics.stickersAllocated ? Math.round((metrics.stickersUsed / metrics.stickersAllocated) * 100) : 0}%` }}/>
                            </div>
                        </div>
                    </div>

                    {/* Service type breakdown */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                        <h3 className="font-bold text-slate-900 mb-4">Service Type Breakdown</h3>
                        <div className="space-y-3">
                            {metrics.typeData.map((d, i) => {
                                const pct = metrics.total ? Math.round((d.value / metrics.total) * 100) : 0;
                                return (
                                    <div key={d.name}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-600 capitalize">{d.name}</span>
                                            <span className="font-bold text-slate-900">{d.value}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                                            <div className="h-1.5 rounded-full" style={{ width:`${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}/>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Inquiries Tab */}
            {activeTab === 'inquiries' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="font-bold text-slate-900">All Assigned Inquiries</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="px-6 py-3">Inquiry No</th>
                                    <th className="px-6 py-3">Customer</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {inquiries.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">No inquiries found.</td></tr>}
                                {inquiries.map(inq => (
                                    <tr key={inq.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-900">{inq.inquiry_no || `#${inq.id?.toString().slice(-6)}`}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{inq.customers?.business_name || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500 capitalize">{inq.type || '—'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getBadgeClass(inq.status)}`}>{inq.status||'Pending'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{new Date(inq.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Stickers Tab */}
            {activeTab === 'stickers' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="font-bold text-slate-900">Sticker Usage History</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="px-6 py-3">Inquiry</th>
                                    <th className="px-6 py-3">Customer</th>
                                    <th className="px-6 py-3">Service Type</th>
                                    <th className="px-6 py-3">Qty Used</th>
                                    <th className="px-6 py-3">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {stickers.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">No sticker usage recorded.</td></tr>}
                                {stickers.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-900">{s.inquiries?.inquiry_no || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{s.inquiries?.customers?.business_name || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500 capitalize">{s.used_for || '—'}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold">{s.quantity}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{new Date(s.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PartnerProfile;
