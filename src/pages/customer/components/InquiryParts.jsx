import React, { useState } from 'react';
import { Calendar, Handshake, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { approveMaintenanceSchedule } from '../../../api/maintenanceApi';
import InquiryChatBox from '../../../components/Chat/InquiryChatBox';
import { normalizeInquiryStatus } from '../../../constants/inquiryStatus';
import { assignedPartnerInfo } from '../dashboardUtils';

/**
 * Pieces of a customer inquiry shared by the Dashboard cards and the
 * Inquiry Detail page, so both render (and act) identically.
 */

export const PartnerInfoLine = ({ inquiry }) => {
    const partnerInfo = assignedPartnerInfo(inquiry);
    return (
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <Handshake size={14} className="text-slate-400 shrink-0" />
            {partnerInfo.pendingLabel ? (
                <span className="italic">{partnerInfo.pendingLabel}</span>
            ) : (
                <>
                    <span className="font-semibold text-slate-700">{partnerInfo.name}</span>
                    {partnerInfo.phone && <span>· {partnerInfo.phone}</span>}
                    {partnerInfo.email && <span>· {partnerInfo.email}</span>}
                </>
            )}
        </p>
    );
};

export const RejectionReasonNote = ({ inquiry }) => {
    if (normalizeInquiryStatus(inquiry?.status) !== 'rejected' || !inquiry?.rejection_reason) return null;
    return (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 mt-2">
            <span className="font-bold">Rejection reason:</span> {inquiry.rejection_reason}
        </p>
    );
};

/**
 * Scheduled site visit + customer approve/reject. Only renders when a visit is
 * actually scheduled — `approval_status` alone defaults to 'pending' on every
 * inquiry (a Maintenance-only concept), so gating on it showed a meaningless
 * "Visit: Not set · PENDING" on Validation/Refill/Renewal inquiries.
 * `onDone(status)` runs after a successful approve/reject.
 */
export const VisitScheduleRow = ({ inquiry, onDone }) => {
    const [busy, setBusy] = useState(false);
    if (!inquiry?.scheduled_date) return null;

    const handleAction = async (e, status) => {
        e.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
            await approveMaintenanceSchedule(inquiry.id, status);
            toast.success(`Schedule ${status} successfully`);
            if (onDone) await onDone(status);
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Could not update schedule');
        } finally {
            setBusy(false);
        }
    };

    const approval = inquiry.approval_status;
    return (
        <div className="mt-2 text-xs flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
                <Calendar size={14} className="text-primary-500" />
                <span className="font-bold text-primary-700">
                    Visit: {new Date(inquiry.scheduled_date).toLocaleString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    })}
                </span>
                {approval && (
                    <span className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] ${approval === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            approval === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                        }`}>
                        {approval}
                    </span>
                )}
            </div>
            {approval === 'pending' && (
                <div className="flex gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => handleAction(e, 'approved')}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                        Approve
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => handleAction(e, 'rejected')}
                        className="px-3 py-1.5 bg-red-500 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-red-600 transition disabled:opacity-50"
                    >
                        Reject
                    </button>
                    {busy && <Loader2 size={14} className="animate-spin text-slate-400 self-center" />}
                </div>
            )}
        </div>
    );
};

const itemLabel = (it) =>
    it.validation_mode === 'license-renewal'
        ? `License ${it.license_number || ''}`.trim()
        : it.system_type || it.type || 'Item';

/**
 * Inquiry line items; `limit` caps the list with a "+N more" note (omit for all).
 * `onViewProduct(product)` adds a "View product" action on items linked to a catalog product.
 */
export const InquiryItemsList = ({ items, limit, onViewProduct }) => {
    const list = Array.isArray(items) ? items : [];
    const shown = limit ? list.slice(0, limit) : list;
    return (
        <div className="space-y-2">
            {shown.map((it) => (
                <div key={it.id || `${it.type}-${it.serial_no}`} className="flex justify-between gap-4 text-sm">
                    <span className="min-w-0">
                        <span className="font-semibold text-slate-800">{itemLabel(it)}</span>
                        {(it.products || it.catalog_no) && (
                            <span className="block text-xs text-slate-500">
                                {[
                                    it.products?.name && it.products.name !== itemLabel(it) ? it.products.name : null,
                                    it.products?.model_number ? `Product# ${it.products.model_number}` : null,
                                    it.catalog_no ? `CAT# ${it.catalog_no}` : null
                                ].filter(Boolean).join(' · ')}
                            </span>
                        )}
                        {onViewProduct && it.products && (
                            <button
                                type="button"
                                onClick={() => onViewProduct({ ...it.products, category: it.products.categories?.name || it.products.category })}
                                className="mt-0.5 text-xs font-bold text-primary-600 hover:underline"
                            >
                                View product
                            </button>
                        )}
                        {it.license_document_url && (
                            <a
                                href={it.license_document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-0.5 ml-3 text-xs font-bold text-primary-600 hover:underline"
                            >
                                License document
                            </a>
                        )}
                    </span>
                    <span className="text-slate-500 shrink-0">
                        Qty: {it.quantity ?? '—'} {it.unit || ''}
                    </span>
                </div>
            ))}
            {limit && list.length > limit && (
                <p className="text-xs text-slate-500">+{list.length - limit} more</p>
            )}
        </div>
    );
};

/**
 * Customer ↔ Partner chat for one inquiry. Until Admin assigns a Partner there is
 * nobody to message, so a note is shown instead of an empty, non-working chat box.
 */
export const InquiryMessages = ({ inquiry }) => {
    if (!inquiry?.partner_id) {
        return (
            <p className="text-sm text-slate-500 italic">
                Messaging opens once a service partner has been assigned to this inquiry.
            </p>
        );
    }
    return (
        <InquiryChatBox
            inquiryId={inquiry.id}
            recipientId={inquiry.partner_id}
            recipientRole="Partner"
            title={`Chat with Partner regarding ${inquiry.inquiry_no || 'Inquiry'}`}
        />
    );
};
