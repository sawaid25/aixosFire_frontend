import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileCheck, FileText, MessageSquare, History, Package, RefreshCw, SearchX, CheckCircle } from 'lucide-react';
import PageLoader from '../../components/PageLoader';
import ProductDetailsModal from '../../components/products/ProductDetailsModal';
import { normalizeInquiryStatus } from '../../constants/inquiryStatus';
import InquiryStatusBadge from '../../components/InquiryStatusBadge';
import InquiryTimeline from '../../components/InquiryTimeline';
import { getInquiryById } from '../../api/partners';
import { fetchCustomerQuotations } from '../../api/customerPortal';
import { buildInquiryTimeline, formatDateSafe, inquiryTypeDisplay } from './dashboardUtils';
import {
    PartnerInfoLine,
    RejectionReasonNote,
    VisitScheduleRow,
    InquiryItemsList,
    InquiryMessages
} from './components/InquiryParts';
import QuotationCard from './components/QuotationCard';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Section = ({ icon, title, children }) => (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-50">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="text-primary-500">{icon}</span> {title}
            </h2>
        </div>
        <div className="p-6">{children}</div>
    </div>
);

const Field = ({ label, value }) => (
    <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{value || '—'}</p>
    </div>
);

/**
 * Progress of a Validation the customer requested: Pending -> Accepted -> Completed
 * (the backend's customer-request transition map). A rejected request shows as such.
 */
const VALIDATION_STEPS = [
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'completed', label: 'Completed' }
];
const ValidationProgress = ({ status }) => {
    const key = normalizeInquiryStatus(status);
    if (key === 'rejected') return null;
    const current = Math.max(0, VALIDATION_STEPS.findIndex((s) => s.key === key));
    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Progress</p>
            <div className="flex items-center">
                {VALIDATION_STEPS.map((step, i) => (
                    <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${i <= current ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-300'}`}>
                                <CheckCircle size={14} />
                            </span>
                            <span className={`text-xs font-semibold ${i === current ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</span>
                        </div>
                        {i < VALIDATION_STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-2 mb-5 ${i < current ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

const BackLink = () => (
    <Link to="/customer/history" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> All inquiries
    </Link>
);

/**
 * Customer view of a single inquiry. GET /inquiries/:id is scoped to the logged-in
 * customer server-side, so another customer's id comes back 404 ("not found").
 */
const InquiryDetail = () => {
    const { id } = useParams();
    const [inquiry, setInquiry] = useState(null);
    const [quotations, setQuotations] = useState([]);
    const [state, setState] = useState('loading'); // loading | ready | notfound | error
    // Bumped to re-fetch after an action (approve quotation / visit) or a retry.
    const [reloadKey, setReloadKey] = useState(0);
    const [productModal, setProductModal] = useState(null);
    // Inquiry ids are UUIDs; anything else can't exist (the API would 500 on it).
    const validId = UUID_RE.test(id || '');

    useEffect(() => {
        if (!validId) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const [inq, quotes] = await Promise.all([
                    getInquiryById(id),
                    // Customer-scoped list, filtered to this inquiry (not the unscoped per-inquiry route).
                    fetchCustomerQuotations().catch(() => [])
                ]);
                if (cancelled) return;
                if (!inq) {
                    setState('notfound');
                    return;
                }
                setInquiry(inq);
                setQuotations((Array.isArray(quotes) ? quotes : []).filter((q) => q.inquiry_id === inq.id));
                setState('ready');
            } catch (e) {
                if (cancelled) return;
                const status = e?.response?.status;
                setState(status === 404 || status === 403 ? 'notfound' : 'error');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, reloadKey, validId]);

    const reload = useCallback(() => setReloadKey((k) => k + 1), []);

    const retry = () => {
        setState('loading');
        reload();
    };

    const view = validId ? state : 'notfound';

    if (view === 'loading') {
        return (
            <div className="relative min-h-[400px]">
                <PageLoader message="Loading inquiry..." />
            </div>
        );
    }

    if (view === 'notfound' || view === 'error') {
        const notFound = view === 'notfound';
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <BackLink />
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <SearchX size={32} />
                    </div>
                    <h1 className="text-lg font-bold text-slate-900">
                        {notFound ? 'Inquiry not found' : 'Could not load this inquiry'}
                    </h1>
                    <p className="text-slate-500 text-sm mt-2">
                        {notFound
                            ? 'It may have been removed, or it belongs to a different account.'
                            : 'Something went wrong while loading. Please try again.'}
                    </p>
                    {!notFound && (
                        <button type="button" onClick={retry} className="btn-primary mt-6 inline-flex items-center gap-2">
                            <RefreshCw size={16} /> Try again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const items = Array.isArray(inquiry.inquiry_items) ? inquiry.inquiry_items : [];
    const reports = Array.isArray(inquiry.inspection_reports) ? inquiry.inspection_reports : [];
    const isCustomerValidation =
        String(inquiry.type || '').toLowerCase() === 'validation' &&
        String(inquiry.performed_by || '').toLowerCase() === 'customer' &&
        !items.every((it) => it.validation_mode === 'license-renewal');
    // Partners can only quote Maintenance, New Unit and License Renewal inquiries
    // (Validation / Refill made up only of License Renewal items). An inquiry that
    // already has a quotation always shows it.
    const typeKey = String(inquiry.type || '').trim().toLowerCase();
    const isRenewalOnly = items.length > 0 && items.every((it) => it.validation_mode === 'license-renewal');
    const showQuotation = quotations.length > 0
        || typeKey === 'maintenance'
        || typeKey === 'new unit'
        || isRenewalOnly;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <ProductDetailsModal
                isOpen={Boolean(productModal)}
                product={productModal}
                onClose={() => setProductModal(null)}
            />
            <BackLink />

            {/* Header */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-display font-bold text-slate-900">{inquiry.inquiry_no || 'Inquiry'}</h1>
                        <p className="text-slate-500 font-medium">{inquiryTypeDisplay(inquiry)}</p>
                        <PartnerInfoLine inquiry={inquiry} />
                        <RejectionReasonNote inquiry={inquiry} />
                        <VisitScheduleRow inquiry={inquiry} onDone={reload} />
                    </div>
                    <InquiryStatusBadge status={inquiry.status} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5 pt-5 border-t border-slate-100">
                    <Field label="Created" value={formatDateSafe(inquiry.created_at)} />
                    <Field label="Internal reference" value={inquiry.internal_reference_number || inquiry.internal_ref} />
                    <Field label="Preferred date" value={inquiry.preferred_date ? formatDateSafe(inquiry.preferred_date) : null} />
                    {inquiry.customer_document_url && (
                        <Field label="Inquiry document" value={<a href={inquiry.customer_document_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline break-all">{inquiry.customer_document_name || 'View PDF'}</a>} />
                    )}
                    <div className="col-span-2 md:col-span-3">
                        <Field label="Notes" value={inquiry.notes} />
                    </div>
                </div>
            </div>

            {isCustomerValidation && <ValidationProgress status={inquiry.status} />}

            <Section icon={<Package size={20} />} title={`Items (${items.length})`}>
                {items.length > 0 ? (
                    <InquiryItemsList items={items} onViewProduct={(p) => setProductModal(p)} />
                ) : (
                    <p className="text-sm text-slate-500 italic">No items on this inquiry.</p>
                )}
            </Section>

            {reports.length > 0 && (
                <Section icon={<FileText size={20} />} title="Reports & documents">
                    <div className="space-y-3">
                        {reports.map((r) => (
                            <div key={r.id} className="flex items-center justify-between gap-4 text-sm">
                                <span>
                                    <span className="font-semibold text-slate-800">{r.report_title || r.file_name || 'Inspection report'}</span>
                                    <span className="block text-xs text-slate-500">{formatDateSafe(r.inspection_date || r.created_at)}</span>
                                </span>
                                {r.file_url && (
                                    <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary-600 hover:underline shrink-0">
                                        Open
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {showQuotation && (
                <Section icon={<FileCheck size={20} />} title="Quotation">
                    {quotations.length > 0 ? (
                        <div className="space-y-4">
                            {quotations.map((q) => (
                                <QuotationCard
                                    key={q.id}
                                    quotation={{ ...q, inquiry_no: inquiry.inquiry_no }}
                                    onUpdated={reload}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 italic">No quotation for this inquiry yet.</p>
                    )}
                </Section>
            )}

            <Section icon={<History size={20} />} title="Activity timeline">
                <InquiryTimeline
                    inquiryId={inquiry.id}
                    createdAt={inquiry.created_at}
                    fallbackEvents={buildInquiryTimeline({ inquiry, quotations })}
                />
            </Section>

            <Section icon={<MessageSquare size={20} />} title="Messages">
                <InquiryMessages inquiry={inquiry} />
            </Section>

            <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                <ClipboardList size={12} /> Looking for another inquiry?{' '}
                <Link to="/customer/history" className="text-primary-600 font-semibold hover:underline">View all inquiries</Link>
            </p>
        </div>
    );
};

export default InquiryDetail;
