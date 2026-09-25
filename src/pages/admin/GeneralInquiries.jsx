import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { subtypeOnlyLabel } from '../../utils/productPartnerEligibility';
import { Inbox, Eye, Calendar, RefreshCw, Search, Filter } from 'lucide-react';

const TYPE_OPTIONS = ['All', 'Validation', 'Refill', 'New Unit', 'Maintenance'];
const SUBTYPE_OPTIONS = ['All', 'new', 'followup', 'license-renewal'];
const SUBTYPE_FILTER_LABELS = { new: 'New', followup: 'Follow-up', 'license-renewal': 'License Renewal' };
const STATUS_OPTIONS = ['All', 'pending', 'accepted', 'in progress', 'scheduled', 'completed', 'rejected', 'cancelled'];

/**
 * Admin's queue of General Inquiries — created by an Agent for ANY inquiry type/subtype
 * (Validation new/follow-up/license-renewal, Refill new/follow-up/license-renewal, New
 * Unit, Maintenance) when they chose not to (or couldn't) assign a Partner. Reuses the
 * same `inquiries` table/columns as the rest of the app (is_general_inquiry, partner_id,
 * type, and inquiry_items.validation_mode for the sub-type) and the existing
 * InquiryDetail page for viewing/assigning — no separate inquiry system.
 *
 * Scope: only inquiries that still need a Partner (partner_id IS NULL). Once Admin
 * assigns one (from InquiryDetail), the row disappears from here — it's now a normal
 * Partner-assigned inquiry and shows up in the regular Inquiry List instead. The
 * inquiry's own type/subtype is never changed by any of this — General Inquiry is an
 * assignment state, not a replacement type.
 */
const GeneralInquiries = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [subtypeFilter, setSubtypeFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inquiries')
                .select(
                    'id,inquiry_no,type,status,created_at,customer_id,agent_id,customers(business_name),agents(name),inquiry_items(validation_mode,product_id,products(name,model_number))'
                )
                .eq('is_general_inquiry', true)
                .is('partner_id', null)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setRows(data || []);
        } catch (err) {
            console.error('[GeneralInquiries] load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    /** Validation/Refill sub-type ('new'/'followup'/'license-renewal') from the first item; New Unit/Maintenance have none. */
    const subtypeOf = (inq) => (['Validation', 'Refill'].includes(inq.type) ? (inq.inquiry_items?.[0]?.validation_mode || 'new') : null);

    /** First product referenced by this inquiry's items, if any — just for a quick glance in the list. */
    const productSummary = (inq) => {
        const item = (inq.inquiry_items || []).find((it) => it.products);
        if (!item?.products) return '—';
        const p = item.products;
        return p.model_number ? `${p.model_number} — ${p.name}` : p.name;
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((inq) => {
            const matchesSearch = !q ||
                (inq.inquiry_no || '').toLowerCase().includes(q) ||
                (inq.customers?.business_name || '').toLowerCase().includes(q) ||
                (inq.agents?.name || '').toLowerCase().includes(q);
            const matchesType = typeFilter === 'All' || inq.type === typeFilter;
            const matchesSubtype = subtypeFilter === 'All' || subtypeOf(inq) === subtypeFilter;
            const matchesStatus = statusFilter === 'All' || (inq.status || '').toLowerCase() === statusFilter;
            const created = inq.created_at ? new Date(inq.created_at) : null;
            const matchesFrom = !dateFrom || (created && created >= new Date(dateFrom));
            const matchesTo = !dateTo || (created && created <= new Date(`${dateTo}T23:59:59`));
            return matchesSearch && matchesType && matchesSubtype && matchesStatus && matchesFrom && matchesTo;
        });
    }, [rows, search, typeFilter, subtypeFilter, statusFilter, dateFrom, dateTo]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin Panel</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
                        <Inbox size={24} className="text-amber-600" /> General Inquiries
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {rows.length} inquir{rows.length === 1 ? 'y' : 'ies'} awaiting Partner assignment.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={load}
                    className="btn-outline text-sm py-2 px-4 flex items-center gap-2 w-fit"
                >
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 flex flex-col lg:flex-row flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search inquiry no, customer, or agent…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-400 shrink-0" />
                    <select
                        value={typeFilter}
                        onChange={(e) => { setTypeFilter(e.target.value); setSubtypeFilter('All'); }}
                        className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    >
                        {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
                    </select>
                </div>
                {['Validation', 'Refill'].includes(typeFilter) && (
                    <select
                        value={subtypeFilter}
                        onChange={(e) => setSubtypeFilter(e.target.value)}
                        className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    >
                        {SUBTYPE_OPTIONS.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Sub-types' : SUBTYPE_FILTER_LABELS[s]}</option>)}
                    </select>
                )}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                    <span className="text-xs text-slate-400">to</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <Inbox size={32} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-slate-400 text-sm">
                            {rows.length === 0 ? 'No General Inquiries need a Partner right now.' : 'No General Inquiries match these filters.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/70 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                                    <th className="px-6 py-4">Inquiry No</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Sub-type</th>
                                    <th className="px-6 py-4">Agent</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Product</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Created</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map((inq) => (
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
                                            <span className="text-sm text-slate-600">{inq.type || '—'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-500">{subtypeOnlyLabel(inq.type, subtypeOf(inq)) || '—'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-700 font-medium">{inq.agents?.name || 'Unassigned'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-700">{inq.customers?.business_name || '—'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-500">{productSummary(inq)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">
                                                {inq.status || 'Pending'}
                                            </span>
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
                                                <Eye size={13} /> Assign Partner
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeneralInquiries;
