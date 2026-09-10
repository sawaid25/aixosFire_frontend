import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText, Calendar, MapPin, User, MessageCircle, CheckCircle2, XCircle,
    Loader2, ShieldCheck, Clock,
} from 'lucide-react';
import CustomerContactSection from './CustomerContactSection';
import InquiryChatBox from '../../../components/Chat/InquiryChatBox';
import PartnerQuotationModal from './PartnerQuotationModal';
import { fetchQuotationByInquiryId } from '../../../api/maintenanceApi';
import { useAuth } from '../../../context/AuthContext';

const STATUS_CARD_STYLE = {
    pending: 'bg-amber-50 border-amber-100',
    accepted: 'bg-blue-50 border-blue-100',
    quoted: 'bg-blue-50 border-blue-100',
    completed: 'bg-emerald-50 border-emerald-100',
    rejected: 'bg-red-50 border-red-100',
};

const STATUS_TEXT_STYLE = {
    pending: 'text-amber-900',
    accepted: 'text-blue-900',
    quoted: 'text-blue-900',
    completed: 'text-emerald-900',
    rejected: 'text-red-900',
};

const STATUS_LABEL = {
    pending: 'Pending Review',
    accepted: 'Accepted',
    quoted: 'Quotation Sent',
    completed: 'Completed',
    rejected: 'Rejected',
};

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const fmtDateTime = (value) => (value ? new Date(value).toLocaleString() : '—');

const DetailCell = ({ label, value }) => (
    <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm font-semibold text-slate-800">{value == null || value === '' ? '—' : value}</p>
    </div>
);

const RenewalInquiryDetail = ({ viewModel, onAccept, onReject, actionLoading = false, onQuotationCreated }) => {
    const { user } = useAuth();
    const partnerId = user?.id;

    const {
        inquiryId, badgeLabel, clientName, location, createdDate, agentName, agentId,
        agentNotes, status, rejectionReason, renewalItems, timeline,
        customerEmail, customerPhone, customerOwnerName, customerId,
        customerAddress, customerLocationLat, customerLocationLng,
    } = viewModel;

    const [openChat, setOpenChat] = useState(null); // null | 'customer' | 'agent'
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [quotation, setQuotation] = useState(null);
    const [quotationLoading, setQuotationLoading] = useState(false);
    const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);

    const statusKey = (status || 'pending').toLowerCase();
    const hasQuotation = Boolean(quotation);
    // A Validation-typed renewal used to be auto-completed at creation (the same
    // shortcut normal validations get) — that left it at 'completed' but never
    // actually accepted and with no quotation. Treat that state as still
    // undecided so the partner can Accept/Reject it. A renewal that completed the
    // real way (accepted -> quoted -> customer approved) always has a quotation.
    const isStuckAutoCompleted = statusKey === 'completed' && !hasQuotation && !quotationLoading;
    const isUndecided = statusKey === 'pending' || isStuckAutoCompleted;
    const isAccepted = ['accepted', 'quoted'].includes(statusKey) || (statusKey === 'completed' && hasQuotation);
    // Fetch the quotation for any post-pending status so we can tell a real
    // 'completed' apart from the stuck auto-completed one above.
    const shouldHaveQuotation = ['accepted', 'quoted', 'completed'].includes(statusKey);
    const cardClass = STATUS_CARD_STYLE[statusKey] || 'bg-slate-50 border-slate-100';
    const textClass = STATUS_TEXT_STYLE[statusKey] || 'text-slate-900';
    const statusLabel = isStuckAutoCompleted ? 'Pending Review' : (STATUS_LABEL[statusKey] || status);

    const loadQuotation = useCallback(async () => {
        if (!inquiryId || !shouldHaveQuotation) return;
        setQuotationLoading(true);
        try {
            const q = await fetchQuotationByInquiryId(inquiryId);
            setQuotation(q || null);
        } catch (err) {
            console.error('[RenewalInquiryDetail] fetchQuotationByInquiryId error:', err);
        } finally {
            setQuotationLoading(false);
        }
    }, [inquiryId, shouldHaveQuotation]);

    useEffect(() => {
        loadQuotation();
    }, [loadQuotation]);

    const handleRejectClick = () => {
        if (!showRejectForm) {
            setShowRejectForm(true);
            return;
        }
        onReject(rejectReason.trim() || null);
        setShowRejectForm(false);
        setRejectReason('');
    };

    const handleQuotationSuccess = () => {
        setIsQuotationModalOpen(false);
        loadQuotation();
        if (onQuotationCreated) onQuotationCreated();
    };

    const mailHref = customerEmail ? `mailto:${customerEmail}` : null;

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft-xl overflow-hidden">
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-slate-50 bg-slate-50/30">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                    <div className="flex-1 min-w-0">
                        <span className="px-4 py-2 bg-primary-100 text-primary-700 rounded-2xl text-xs font-black uppercase tracking-widest inline-flex items-center gap-2 mb-4">
                            <ShieldCheck size={14} /> Renewal · {badgeLabel}
                        </span>
                        <h1 className="text-3xl md:text-4xl font-display font-black text-slate-900 tracking-tight break-words">
                            {clientName}
                        </h1>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-4">
                            <p className="text-slate-600 flex items-center gap-2">
                                <MapPin size={18} className="text-slate-400 shrink-0" />
                                {location}
                            </p>
                            {mailHref ? (
                                <a
                                    href={mailHref}
                                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-primary-600 text-white rounded-2xl text-sm font-medium transition-all w-full sm:w-auto"
                                >
                                    <MessageCircle size={18} />
                                    Message Customer
                                </a>
                            ) : null}
                        </div>
                    </div>
                    <div className="text-left md:text-right shrink-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Created Date</p>
                        <p className="text-slate-900 font-bold flex items-center md:justify-end gap-2">
                            <Calendar size={18} className="text-primary-500" /> {createdDate}
                        </p>
                    </div>
                </div>
            </div>

            {/* Customer Contact */}
            <div className="px-6 md:px-8 lg:px-10 pt-6 md:pt-8">
                <CustomerContactSection
                    ownerName={customerOwnerName}
                    email={customerEmail}
                    phone={customerPhone}
                    customerId={customerId}
                    address={customerAddress}
                    locationLat={customerLocationLat}
                    locationLng={customerLocationLng}
                />
            </div>

            {/* Chat triggers */}
            <div className="px-6 md:px-8 lg:px-10 pt-6 flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={() => setOpenChat((prev) => (prev === 'customer' ? null : 'customer'))}
                    disabled={!customerId || !inquiryId}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-200 ${openChat === 'customer' ? 'bg-primary-600 text-white' : 'bg-slate-900 text-white hover:bg-primary-600'
                        } disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none`}
                >
                    <MessageCircle size={14} /> Chat with Customer
                </button>
                <button
                    type="button"
                    onClick={() => setOpenChat((prev) => (prev === 'agent' ? null : 'agent'))}
                    disabled={!agentId || !inquiryId}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-200 ${openChat === 'agent' ? 'bg-primary-600 text-white' : 'bg-slate-700 text-white hover:bg-primary-600'
                        } disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none`}
                >
                    <User size={14} /> Chat with Agent
                </button>
            </div>

            {openChat === 'customer' && customerId && inquiryId && (
                <div className="px-6 md:px-8 lg:px-10 pt-4 animate-in slide-in-from-top-2 duration-300">
                    <InquiryChatBox
                        inquiryId={inquiryId}
                        recipientId={customerId}
                        recipientRole="Customer"
                        title="Chat with Customer"
                    />
                </div>
            )}
            {openChat === 'agent' && agentId && inquiryId && (
                <div className="px-6 md:px-8 lg:px-10 pt-4 animate-in slide-in-from-top-2 duration-300">
                    <InquiryChatBox
                        inquiryId={inquiryId}
                        recipientId={agentId}
                        recipientRole="Agent"
                        title="Chat with Agent"
                    />
                </div>
            )}

            {/* Main content */}
            <div className="p-6 md:p-8 lg:p-10 space-y-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left column */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Renewal details + documents */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-3">
                                <ShieldCheck size={22} className="text-primary-500" />
                                Renewal Details
                            </h3>
                            <div className="space-y-4">
                                {renewalItems.map((item) => (
                                    <div key={item.itemId} className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                                            <DetailCell label="License Number" value={item.licenseNumber} />
                                            <DetailCell label="Issuing Authority" value={item.licenseAuthority} />
                                            <DetailCell label="Renewal Date" value={fmtDate(item.renewalDate)} />
                                        </div>
                                        {item.notes && (
                                            <p className="text-sm text-slate-600 italic leading-relaxed mt-4 pt-4 border-t border-slate-200">"{item.notes}"</p>
                                        )}
                                        <div className="mt-4 pt-4 border-t border-slate-200">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Document</p>
                                            {item.documentUrl ? (
                                                <a href={item.documentUrl} target="_blank" rel="noopener noreferrer" title="License document">
                                                    <img
                                                        src={item.documentUrl}
                                                        alt="License document"
                                                        className="h-24 w-24 object-cover rounded-xl border border-slate-200 shadow-sm hover:opacity-90 transition-opacity"
                                                    />
                                                </a>
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">No document uploaded.</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Agent notes */}
                        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Agent Notes</p>
                            <p className="text-slate-600 leading-relaxed italic">
                                {agentNotes ? `"${agentNotes}"` : 'No notes provided.'}
                            </p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 mb-1">Assigned Agent</p>
                            <p className="text-slate-900 font-bold flex items-center gap-2">
                                <User size={16} className="text-primary-500" /> {agentName}
                            </p>
                        </div>

                        {/* Quotation */}
                        {isAccepted && (
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-3">
                                    <FileText size={22} className="text-primary-500" />
                                    Quotation
                                </h3>
                                {quotationLoading ? (
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-2 text-slate-400 text-sm">
                                        <Loader2 size={16} className="animate-spin" /> Loading…
                                    </div>
                                ) : quotation ? (
                                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <DetailCell
                                                label="Quotation Cost"
                                                value={quotation.estimated_cost ? `SAR ${quotation.estimated_cost}` : '—'}
                                            />
                                            <DetailCell label="Status" value={quotation.status === 'approved' ? 'Approved by Customer' : 'Sent — awaiting customer'} />
                                        </div>
                                        {quotation.pdf_url && (
                                            <a
                                                href={quotation.pdf_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-all"
                                            >
                                                <FileText size={14} /> View Quotation PDF
                                            </a>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-3xl p-6 border border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <p className="text-sm text-slate-500 italic">No quotation has been created for this renewal yet.</p>
                                        <button
                                            type="button"
                                            onClick={() => setIsQuotationModalOpen(true)}
                                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-primary-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shrink-0"
                                        >
                                            <FileText size={16} /> Create Quotation
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Timeline */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-3">
                                <Clock size={22} className="text-primary-500" />
                                Timeline
                            </h3>
                            <div className="space-y-3">
                                {timeline.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic">No timeline events yet.</p>
                                ) : (
                                    timeline.map((event, idx) => (
                                        <div key={idx} className="flex items-center gap-3 text-sm">
                                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                            <span className="font-semibold text-slate-800">{event.label}</span>
                                            <span className="text-slate-400 text-xs ml-auto shrink-0">{fmtDateTime(event.date)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right sidebar — status + actions */}
                    <div className="lg:col-span-4">
                        <div className={`border p-7 rounded-3xl sticky top-6 ${cardClass}`}>
                            <h4 className={`font-bold text-lg mb-3 ${textClass}`}>Status: {statusLabel}</h4>
                            <p className={`text-sm leading-relaxed opacity-80 ${textClass}`}>
                                {isUndecided
                                    ? 'This renewal request is awaiting your review. Chat with the customer first if you need more information.'
                                    : statusKey === 'rejected'
                                        ? 'This renewal request was rejected.'
                                        : 'This renewal has been accepted and is being processed.'}
                            </p>

                            {statusKey === 'rejected' && rejectionReason && (
                                <div className="mt-4 p-3 bg-white/60 rounded-xl border border-red-200">
                                    <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1">Reason</p>
                                    <p className="text-sm text-red-800">{rejectionReason}</p>
                                </div>
                            )}

                            {isUndecided && (
                                <div className="flex flex-col gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={onAccept}
                                        disabled={actionLoading}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-emerald-200/80 text-white font-black py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                                    >
                                        {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                        Accept Renewal
                                    </button>

                                    {!showRejectForm ? (
                                        <button
                                            type="button"
                                            onClick={handleRejectClick}
                                            disabled={actionLoading}
                                            className="w-full bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:pointer-events-none font-black py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                                        >
                                            <XCircle size={18} />
                                            Reject Renewal
                                        </button>
                                    ) : (
                                        <div className="bg-white/70 rounded-2xl p-4 border border-red-200 space-y-3 animate-fade-in">
                                            <label className="text-[10px] font-black text-red-700 uppercase tracking-widest">
                                                Reason (optional)
                                            </label>
                                            <textarea
                                                value={rejectReason}
                                                onChange={(e) => setRejectReason(e.target.value)}
                                                rows={2}
                                                placeholder="Why is this renewal being rejected?"
                                                className="w-full text-sm rounded-xl border border-slate-200 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleRejectClick}
                                                    disabled={actionLoading}
                                                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all"
                                                >
                                                    Confirm Reject
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                                                    className="px-4 py-2.5 bg-white border border-slate-200 text-slate-500 font-black rounded-xl text-xs uppercase tracking-widest transition-all"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isQuotationModalOpen && (
                <PartnerQuotationModal
                    isOpen={isQuotationModalOpen}
                    onClose={() => setIsQuotationModalOpen(false)}
                    inquiryId={inquiryId}
                    customerId={customerId}
                    partnerId={partnerId}
                    onSuccess={handleQuotationSuccess}
                />
            )}
        </div>
    );
};

export default RenewalInquiryDetail;
