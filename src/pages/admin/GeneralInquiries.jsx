import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import PageLoader from '../../components/PageLoader';
import { Inbox, Eye, Calendar, RefreshCw } from 'lucide-react';

/**
 * Admin's queue of General Inquiries — created by an Agent when no Partner qualified
 * for the selected product/service (see src/pages/agent/VisitForm.jsx and
 * src/utils/productPartnerEligibility.js). Reuses the same `inquiries` table/columns
 * as the rest of the app (is_general_inquiry, partner_id) and the existing
 * InquiryDetail page for viewing/assigning — no separate inquiry system.
 *
 * Scope: only inquiries that still need a Partner (partner_id IS NULL). Once Admin
 * assigns one (from InquiryDetail), the row disappears from here — it's now a normal
 * Partner-assigned inquiry and shows up in the regular Inquiry List instead.
 */
const GeneralInquiries = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inquiries')
                .select(
                    'id,inquiry_no,type,status,created_at,customer_id,agent_id,customers(business_name),agents(name),inquiry_items(product_id,products(name,model_number,categories(name)))'
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

    /** First product/category referenced by this inquiry's items, if any — just for a quick glance in the list. */
    const productSummary = (inq) => {
        const item = (inq.inquiry_items || []).find((it) => it.products);
        if (!item?.products) return '—';
        const p = item.products;
        return p.model_number ? `${p.model_number} — ${p.name}` : p.name;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin Panel</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
                        <Inbox size={24} className="text-amber-600" /> General Inquiries
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Inquiries no Partner was eligible for at creation — assign one to route them into the normal workflow.
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

            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <Inbox size={32} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-slate-400 text-sm">No General Inquiries need a Partner right now.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/70 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                                    <th className="px-6 py-4">Inquiry No</th>
                                    <th className="px-6 py-4">Agent</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Product</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Created</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {rows.map((inq) => (
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
                                            <span className="text-sm text-slate-700 font-medium">{inq.agents?.name || 'Unassigned'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-700">{inq.customers?.business_name || '—'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-600 capitalize">{inq.type || '—'}</span>
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
