import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import {
    Search, ChevronLeft, ChevronRight, Eye, Filter,
    Activity, Calendar, Inbox
} from 'lucide-react';

const SERVICE_TYPES = ['All', 'inspection', 'refilling', 'installation', 'validation', 'maintenance'];
const STATUS_TYPES  = ['All', 'pending', 'accepted', 'in progress', 'scheduled', 'completed', 'quoted', 'rejected', 'cancelled'];
const PAGE_SIZE = 20;

const getBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (['completed','accepted','closed'].includes(s)) return 'bg-green-100 text-green-700';
    if (['rejected','cancelled'].includes(s)) return 'bg-red-100 text-red-700';
    if (['in progress','scheduled'].includes(s)) return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
};

const normalizeStatus = (raw) => {
    if (!raw || raw.toLowerCase() === 'all') return 'All';
    return raw.toLowerCase();
};

const InquiryList = () => {
    const [searchParams] = useSearchParams();
    const [inquiries, setInquiries]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [statusFilter, setStatus]   = useState(() =>
        normalizeStatus(new URLSearchParams(window.location.search).get('status'))
    );
    const [typeFilter, setType]       = useState('All');
    const [generalOnly, setGeneralOnly] = useState(false);
    const [page, setPage]             = useState(0);
    const [total, setTotal]           = useState(0);

    // Sync filter when the URL changes while this component is already mounted
    // (e.g. navigating here from Analytics with ?status=... when InquiryList was already in the tree)
    useEffect(() => {
        const normalized = normalizeStatus(searchParams.get('status'));
        setStatus(normalized);
    }, [searchParams]);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch all records (type + search filtered server-side).
            // Status is filtered client-side because server-side ilike on the status
            // column returns incorrect results in this Supabase/PostgREST setup.
            let q = supabase
                .from('inquiries')
                .select(
                    'id,inquiry_no,type,status,priority,created_at,follow_up_date,customer_id,agent_id,partner_id,is_general_inquiry,customers(business_name),agents(name)'
                )
                .order('created_at', { ascending: false });

            if (typeFilter !== 'All') q = q.ilike('type', typeFilter);
            if (search.trim())        q = q.ilike('inquiry_no', `%${search.trim()}%`);
            if (generalOnly)          q = q.eq('is_general_inquiry', true);

            const { data, error } = await q;
            if (error) throw error;

            // Client-side status filter (case-insensitive)
            const all = data || [];
            const filtered = statusFilter === 'All'
                ? all
                : all.filter(row => (row.status || '').toLowerCase() === statusFilter.toLowerCase());

            setTotal(filtered.length);
            setInquiries(filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE));
        } catch (err) {
            console.error('InquiryList fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter, typeFilter, generalOnly, page]);

    useEffect(() => { fetch(); }, [fetch]);

    // Reset to page 0 when filters change
    useEffect(() => { setPage(0); }, [search, statusFilter, typeFilter, generalOnly]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin Panel</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Inquiry Details</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {total} total inquiries
                    </p>
                </div>
                <Link to="/admin/dashboard" className="btn-outline text-sm py-2 px-4 flex items-center gap-2 w-fit">
                    ← Dashboard
                </Link>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by inquiry number…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-400 flex-shrink-0" />
                    <select
                        value={statusFilter}
                        onChange={e => setStatus(e.target.value)}
                        className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    >
                        {STATUS_TYPES.map(s => (
                            <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                    </select>
                </div>

                {/* Type filter */}
                <div>
                    <select
                        value={typeFilter}
                        onChange={e => setType(e.target.value)}
                        className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    >
                        {SERVICE_TYPES.map(t => (
                            <option key={t} value={t}>{t === 'All' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                    </select>
                </div>

                {/* General Inquiry filter — no Partner offered the product/service the Agent picked */}
                <button
                    type="button"
                    onClick={() => setGeneralOnly((v) => !v)}
                    className={`flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl border transition-colors ${
                        generalOnly
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                >
                    <Inbox size={14} /> General Only
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/70 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                                        <th className="px-6 py-4">Inquiry No</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Agent</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Priority</th>
                                        <th className="px-6 py-4">Created</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {inquiries.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-14 text-center">
                                                <Activity size={32} className="mx-auto text-slate-200 mb-3" />
                                                <p className="text-slate-400 text-sm">No inquiries found.</p>
                                            </td>
                                        </tr>
                                    )}
                                    {inquiries.map(inq => (
                                        <tr key={inq.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-6 py-4">
                                                <Link
                                                    to={`/admin/inquiries/${inq.id}`}
                                                    className="font-bold text-slate-900 hover:text-primary-600 text-sm"
                                                >
                                                    {inq.inquiry_no || `#${inq.id?.toString().slice(-6)}`}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4">
                                                {inq.customer_id ? (
                                                    <Link
                                                        to={`/admin/customers/${inq.customer_id}`}
                                                        className="text-sm text-slate-700 hover:text-sky-600 hover:underline font-medium"
                                                    >
                                                        {inq.customers?.business_name || '—'}
                                                    </Link>
                                                ) : (
                                                    <span className="text-sm text-slate-500">{inq.customers?.business_name || '—'}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {inq.agent_id ? (
                                                    <Link
                                                        to={`/admin/agents/${inq.agent_id}`}
                                                        className="text-sm text-slate-700 hover:text-violet-600 hover:underline font-medium"
                                                    >
                                                        {inq.agents?.name || 'Unassigned'}
                                                    </Link>
                                                ) : (
                                                    <span className="text-sm text-slate-400">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-slate-600 capitalize">{inq.type || '—'}</span>
                                                {inq.is_general_inquiry && (
                                                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
                                                        <Inbox size={10} /> General
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getBadgeClass(inq.status)}`}>
                                                    {inq.status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {inq.priority ? (
                                                    <span className={`text-xs font-semibold ${
                                                        inq.priority === 'High'   ? 'text-red-600' :
                                                        inq.priority === 'Medium' ? 'text-amber-600' :
                                                        'text-slate-400'
                                                    }`}>{inq.priority}</span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                    <Calendar size={11} />
                                                    {new Date(inq.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    to={`/admin/inquiries/${inq.id}`}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-800"
                                                >
                                                    <Eye size={13} /> View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50">
                            <p className="text-xs text-slate-400">
                                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronLeft size={15} />
                                </button>
                                <span className="text-xs font-bold text-slate-600 px-2">
                                    {page + 1} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default InquiryList;
