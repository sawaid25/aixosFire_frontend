import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { approveQuotation, rejectQuotation } from '../../../api/customerPortal';

// Same set the backend accepts a customer decision on (maintenanceService.updateQuotationStatus).
const ACTIONABLE_STATUSES = ['pending', 'submitted', 'sent'];

/**
 * One partner quotation with the customer's actions (Approve / Reject while it awaits
 * their decision). `onUpdated(updatedQuotation)` receives the quotation after a
 * successful action.
 */
const QuotationCard = ({ quotation: q, onUpdated }) => {
    const [busy, setBusy] = useState(null); // 'approve' | 'reject' | null
    const pending = ACTIONABLE_STATUSES.includes((q.status || '').toLowerCase());

    const decide = async (action) => {
        if (!q.id || busy) return;
        if (action === 'reject' && !window.confirm('Reject this quotation? The partner will be notified.')) return;
        setBusy(action);
        try {
            if (action === 'approve') await approveQuotation(q.id);
            else await rejectQuotation(q.id);
            const status = action === 'approve' ? 'approved' : 'rejected';
            toast.success(`Quotation ${status}`);
            if (onUpdated) onUpdated({ ...q, status });
        } catch (e) {
            toast.error(e?.response?.data?.error || `Could not ${action} quotation`);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
                <p className="font-bold text-slate-900">
                    {q.quote_reference || q.reference || 'Quotation'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                    Inquiry: {q.inquiry_no || q.inquiries?.inquiry_no || '—'} · Amount:{' '}
                    {(q.estimated_cost ?? q.amount) != null
                        ? `SAR ${Number(q.estimated_cost ?? q.amount).toLocaleString()}`
                        : '—'}
                </p>
                <p className="text-xs text-slate-400 mt-1 capitalize">Status: {q.status || '—'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {q.pdf_url && (
                    <a
                        href={q.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50"
                    >
                        View PDF
                    </a>
                )}
                {pending && (
                    <>
                        <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => decide('reject')}
                            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                        >
                            {busy === 'reject' ? <Loader2 className="animate-spin inline" size={16} /> : 'Reject'}
                        </button>
                        <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => decide('approve')}
                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {busy === 'approve' ? <Loader2 className="animate-spin inline" size={16} /> : 'Approve'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default QuotationCard;
