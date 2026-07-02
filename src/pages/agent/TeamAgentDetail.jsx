import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import {
    ArrowLeft, User, Activity, Eye, Clock, Calendar,
    CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';

/* ─── Helpers ────────────────────────────────── */
const startOfDay   = (d = new Date()) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const startOfWeek  = (d = new Date()) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

const fmtFull = (d) => d ? new Date(d).toLocaleString() : '—';

const getBadgeClass = (s) => {
    const v = (s || '').toLowerCase();
    if (['completed','accepted','closed'].includes(v)) return 'bg-green-100 text-green-700';
    if (['rejected','cancelled'].includes(v))          return 'bg-red-100 text-red-700';
    if (['in progress','scheduled'].includes(v))       return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
};

const getPriorityClass = (p) => {
    const v = (p || '').toLowerCase();
    if (v === 'high')   return 'text-red-600 font-bold';
    if (v === 'low')    return 'text-slate-400';
    return 'text-amber-600 font-semibold';
};

const FILTERS = [
    { key: 'all',       label: 'All Time' },
    { key: 'today',     label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week',      label: 'This Week' },
    { key: 'month',     label: 'This Month' },
    { key: 'custom',    label: 'Custom Range' },
];

const getRange = (key, customStart, customEnd) => {
    const now = new Date();
    if (key === 'today')     return { start: startOfDay(now), end: now };
    if (key === 'yesterday') {
        const s = startOfDay(now); s.setDate(s.getDate() - 1);
        const e = new Date(s); e.setHours(23, 59, 59, 999);
        return { start: s, end: e };
    }
    if (key === 'week')      return { start: startOfWeek(now), end: now };
    if (key === 'month')     return { start: startOfMonth(now), end: now };
    if (key === 'custom' && customStart && customEnd) {
        return { start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59') };
    }
    return null;
};

const PAGE_SIZE = 20;

/* ══════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════ */
const TeamAgentDetail = () => {
    const { memberId }      = useParams();
    const navigate          = useNavigate();
    const [agent, setAgent] = useState(null);
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [filter, setFilter]       = useState('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd]     = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage]           = useState(1);

    useEffect(() => {
        // Guard: PIN must be verified this session
        if (sessionStorage.getItem('sa_pin_verified') !== 'true') {
            navigate('/agent/team', { replace: true });
            return;
        }
        load();
    }, [memberId]);

    const load = async () => {
        setLoading(true);
        try {
            const [{ data: agentData }, { data: inqData }] = await Promise.all([
                supabase.from('agents').select('id, name, email, status, profile_photo, territory').eq('id', memberId).maybeSingle(),
                supabase.from('inquiries')
                    .select('id, inquiry_no, type, status, priority, created_at, updated_at, follow_up_date, customers(business_name)')
                    .eq('agent_id', memberId)
                    .order('created_at', { ascending: false }),
            ]);
            setAgent(agentData);
            setInquiries(inqData || []);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        let result = inquiries;

        const range = getRange(filter, customStart, customEnd);
        if (range) {
            result = result.filter(i => {
                const d = new Date(i.created_at);
                return d >= range.start && d <= range.end;
            });
        }

        if (statusFilter !== 'All') {
            result = result.filter(i => {
                const s = (i.status || '').toLowerCase();
                if (statusFilter === 'Completed') return ['completed','accepted','closed'].includes(s);
                if (statusFilter === 'Rejected')  return ['rejected','cancelled'].includes(s);
                if (statusFilter === 'Pending')   return !['completed','accepted','closed','rejected','cancelled'].includes(s);
                return true;
            });
        }

        return result;
    }, [inquiries, filter, customStart, customEnd, statusFilter]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated  = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, page]);

    // Summary stats
    const stats = useMemo(() => {
        const now        = new Date();
        const todayStart = startOfDay(now);
        const weekStart  = startOfWeek(now);
        const monthStart = startOfMonth(now);
        return {
            total:   inquiries.length,
            today:   inquiries.filter(i => new Date(i.created_at) >= todayStart).length,
            week:    inquiries.filter(i => new Date(i.created_at) >= weekStart).length,
            month:   inquiries.filter(i => new Date(i.created_at) >= monthStart).length,
        };
    }, [inquiries]);

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!agent) return (
        <div className="text-center py-20">
            <User size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500">Agent not found.</p>
            <Link to="/agent/team" className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm hover:underline">
                <ArrowLeft size={14} /> Back to Team
            </Link>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Back */}
            <Link to="/agent/team" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
                <ArrowLeft size={16} /> Back to Team Activity
            </Link>

            {/* Agent profile card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                        {agent.profile_photo
                            ? <img src={agent.profile_photo} alt={agent.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={26} /></div>
                        }
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-slate-900">{agent.name}</h2>
                        <p className="text-sm text-slate-500">{agent.email}</p>
                        {agent.territory && <p className="text-xs text-slate-400 mt-0.5">{agent.territory}</p>}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getBadgeClass(agent.status)}`}>
                        {agent.status || 'Active'}
                    </span>
                </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'All Time',   value: stats.total, accent: 'text-slate-900',   bg: 'bg-slate-50' },
                    { label: 'Today',      value: stats.today, accent: 'text-blue-700',    bg: 'bg-blue-50'  },
                    { label: 'This Week',  value: stats.week,  accent: 'text-violet-700',  bg: 'bg-violet-50'},
                    { label: 'This Month', value: stats.month, accent: 'text-emerald-700', bg: 'bg-emerald-50'},
                ].map(({ label, value, accent, bg }) => (
                    <div key={label} className={`rounded-2xl ${bg} p-4`}>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                        <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Inquiries</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
                    {/* Date tabs */}
                    <div className="flex flex-wrap gap-1">
                        {FILTERS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => { setFilter(f.key); setPage(1); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === f.key ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                            >{f.label}</button>
                        ))}
                    </div>
                    {/* Status filter */}
                    <div className="flex gap-1">
                        {['All', 'Pending', 'Completed', 'Rejected'].map(s => (
                            <button
                                key={s}
                                onClick={() => { setStatusFilter(s); setPage(1); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-primary-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                            >{s}</button>
                        ))}
                    </div>
                </div>

                {/* Custom date range */}
                {filter === 'custom' && (
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50 flex-wrap">
                        <label className="text-xs font-semibold text-slate-500">From</label>
                        <input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setPage(1); }}
                            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-primary-400" />
                        <label className="text-xs font-semibold text-slate-500">To</label>
                        <input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setPage(1); }}
                            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-primary-400" />
                    </div>
                )}

                {/* Result count */}
                <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-100">
                    <p className="text-xs text-slate-400">
                        {filtered.length} {filtered.length === 1 ? 'inquiry' : 'inquiries'} found
                    </p>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-5 py-3">Inquiry No</th>
                                <th className="px-5 py-3">Customer</th>
                                <th className="px-5 py-3">Type</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3">Priority</th>
                                <th className="px-5 py-3">Created</th>
                                <th className="px-5 py-3">Last Updated</th>
                                <th className="px-5 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center">
                                        <Activity size={28} className="mx-auto text-slate-200 mb-2" />
                                        <p className="text-slate-400 text-sm">No inquiries match the selected filters.</p>
                                    </td>
                                </tr>
                            )}
                            {paginated.map(inq => (
                                <tr key={inq.id} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="px-5 py-3.5 font-bold text-slate-900 text-sm">
                                        {inq.inquiry_no || `#${String(inq.id).slice(-6)}`}
                                    </td>
                                    <td className="px-5 py-3.5 text-sm text-slate-700">{inq.customers?.business_name || '—'}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-500 capitalize">{inq.type || '—'}</td>
                                    <td className="px-5 py-3.5">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getBadgeClass(inq.status)}`}>
                                            {inq.status || 'Pending'}
                                        </span>
                                    </td>
                                    <td className={`px-5 py-3.5 text-xs capitalize ${getPriorityClass(inq.priority)}`}>
                                        {inq.priority || '—'}
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-slate-500">{fmtFull(inq.created_at)}</td>
                                    <td className="px-5 py-3.5 text-xs text-slate-400">{fmtFull(inq.updated_at)}</td>
                                    <td className="px-5 py-3.5">
                                        <Link
                                            to={`/agent/query/${inq.id}`}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-700 text-white px-3 py-1.5 rounded-xl transition-colors"
                                        >
                                            <Eye size={11} /> View Details
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
                        <p className="text-xs text-slate-400">
                            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                        </p>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                ← Prev
                            </button>
                            <span className="text-xs text-slate-500 font-medium px-1">{page} / {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamAgentDetail;
