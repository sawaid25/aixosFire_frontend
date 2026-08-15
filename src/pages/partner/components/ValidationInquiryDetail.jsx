import React, { useState } from 'react';
import { FileText, Calendar, MapPin, Tag, User, MessageCircle, ChevronDown, ChevronUp, Mic } from 'lucide-react';
import CustomerContactSection from './CustomerContactSection';

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString() : null);
const fmtDateTime = (value) => (value ? new Date(value).toLocaleString() : null);

const getStatusBadgeClass = (status) => {
    const v = (status || '').toLowerCase();
    if (v === 'mixed') return 'bg-amber-100 text-amber-700';
    if (['valid', 'new'].includes(v)) return 'bg-emerald-100 text-emerald-700';
    if (['refilled', 'maintained'].includes(v)) return 'bg-blue-100 text-blue-700';
    if (v === 'expired') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-600';
};

// Builds the expanded row's field list from whatever the underlying inquiry_items
// row actually has — most of these (catalog no., condition, expiry/install/refill
// dates, accepted quantity, price, who logged it) exist in the schema but weren't
// being shown at all.
const buildItemDetailFields = (detail) => {
    if (!detail) return [];
    return [
        { label: 'Serial No.', value: detail.serial_no },
        detail.catalog_no && { label: 'Catalog No.', value: detail.catalog_no },
        detail.capacity && { label: 'Capacity', value: detail.capacity },
        detail.system_type && { label: 'System Type', value: detail.system_type },
        detail.system && { label: 'System', value: detail.system },
        detail.brand && { label: 'Brand', value: detail.brand },
        detail.seller && { label: 'Seller', value: detail.seller },
        { label: 'Status', value: detail.status },
        detail.condition && { label: 'Condition', value: detail.condition },
        { label: 'Validation Mode', value: detail.validation_mode },
        detail.performed_by && { label: 'Logged By', value: detail.performed_by },
        detail.quantity != null && { label: 'Quantity', value: `${detail.quantity}${detail.unit ? ` ${detail.unit}` : ''}` },
        detail.accepted_quantity != null && { label: 'Accepted Quantity', value: `${detail.accepted_quantity}${detail.unit ? ` ${detail.unit}` : ''}` },
        detail.price != null && { label: 'Unit Price', value: `SAR ${detail.price}` },
        fmtDate(detail.expiry_date) && { label: 'Expiry Date', value: fmtDate(detail.expiry_date) },
        fmtDate(detail.install_date) && { label: 'Install Date', value: fmtDate(detail.install_date) },
        fmtDate(detail.last_refill_date) && { label: 'Last Refill Date', value: fmtDate(detail.last_refill_date) },
        fmtDate(detail.follow_up_date) && { label: 'Follow-up Date', value: fmtDate(detail.follow_up_date) },
        fmtDate(detail.follow_up_date_validation) && { label: 'Validation Follow-up', value: fmtDate(detail.follow_up_date_validation) },
        fmtDateTime(detail.created_at) && { label: 'Logged On', value: fmtDateTime(detail.created_at) },
    ].filter(Boolean);
};

const ValidationInquiryDetail = ({ viewModel }) => {
    const {
        badgeLabel,
        clientName,
        location,
        createdDate,
        agentName,
        stickersUsed,
        agentNotes,
        status,
        utilizationRows,
        customerEmail,
        customerPhone,
        customerOwnerName,
        customerId,
        customerAddress,
        customerLocationLat,
        customerLocationLng,
    } = viewModel;

    const [expandedRow, setExpandedRow] = useState(null);

    const mailHref = customerEmail ? `mailto:${customerEmail}` : null;

    const formatDetailValue = (val) => (val == null || val === '') ? '—' : String(val);

    const DetailCell = ({ label, value }) => (
        <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm font-semibold text-slate-800">{formatDetailValue(value)}</p>
        </div>
    );

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft-xl overflow-hidden">

            {/* Header */}
            <div className="p-6 md:p-8 border-b border-slate-50 bg-slate-50/30">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                    <div className="flex-1 min-w-0">
                        <span className="px-4 py-2 bg-primary-100 text-primary-700 rounded-2xl text-xs font-black uppercase tracking-widest inline-block mb-4">
                            {badgeLabel}
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
                            ) : (
                                <button
                                    disabled
                                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-200 text-slate-500 rounded-2xl text-sm font-medium w-full sm:w-auto cursor-not-allowed"
                                >
                                    <MessageCircle size={18} />
                                    Message Customer
                                </button>
                            )}
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

            {/* Main Content */}
            <div className="p-6 md:p-8 lg:p-10 space-y-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left / Main Column */}
                    <div className="lg:col-span-8">

                        {/* Agent Inquiry Details */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-3">
                                <FileText size={22} className="text-primary-500" />
                                Agent Inquiry Details
                            </h3>
                            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Assigned Agent</p>
                                        <p className="text-slate-900 font-bold flex items-center gap-2">
                                            <User size={18} className="text-primary-500" /> {agentName}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Stickers Used</p>
                                        <p className="text-3xl font-black text-primary-600">{stickersUsed}</p>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Agent Notes</p>
                                    <p className="text-slate-600 leading-relaxed italic">
                                        {agentNotes ? `"${agentNotes}"` : 'No notes provided.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="lg:col-span-4">
                        <div className="bg-emerald-50 border border-emerald-100 p-7 rounded-3xl sticky top-6">
                            <h4 className="font-bold text-emerald-900 text-lg mb-3">Status: {status}</h4>
                            <p className="text-sm text-emerald-700 leading-relaxed">
                                This inquiry has been verified by the agent and assigned to your dashboard for validation.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sticker Utilization Breakdown — full width, not sharing the row with the sidebar */}
                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-3">
                        <Tag size={22} className="text-primary-500" />
                        Sticker Utilization Breakdown
                    </h3>
                    <div className="overflow-x-auto border border-slate-100 rounded-3xl">
                        <table className="w-full text-left border-collapse min-w-[640px]">
                            <thead>
                                <tr className="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <th className="px-6 py-5">Extinguisher Type</th>
                                    <th className="px-6 py-5">Quantity</th>
                                    <th className="px-6 py-5">Serial Range</th>
                                    <th className="px-6 py-5">Status</th>
                                    <th className="px-6 py-5 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {utilizationRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-medium">
                                            No utilization data available
                                        </td>
                                    </tr>
                                ) : (
                                    utilizationRows.map((row, idx) => {
                                        const rowItems = row.items || [];
                                        const isExpanded = expandedRow === idx;

                                        return (
                                            <React.Fragment key={idx}>
                                                <tr className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-5 font-semibold text-slate-900">{row.type}</td>
                                                    <td className="px-6 py-5 text-slate-700 font-medium">
                                                        {row.count}{row.unit ? ` ${row.unit}` : ''}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className="px-4 py-1 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium">
                                                            {row.serialRange}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {row.status && (
                                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusBadgeClass(row.status)}`}>
                                                                {row.status}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        {rowItems.length > 0 && (
                                                            <button
                                                                onClick={() => setExpandedRow(isExpanded ? null : idx)}
                                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider transition-colors"
                                                            >
                                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                {isExpanded ? 'Hide' : 'View Details'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>

                                                {isExpanded && rowItems.length > 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 pb-6 pt-0 bg-primary-50/20 border-b border-slate-100">
                                                            {/* Every physical unit behind this row gets its own card — a group of
                                                                3 units used to silently collapse down to just the first one. */}
                                                            <div className="space-y-4 mt-2">
                                                                {rowItems.map((detail, unitIdx) => (
                                                                    <div key={detail.id ?? unitIdx} className="bg-white rounded-2xl border border-slate-100 p-5">
                                                                        {rowItems.length > 1 && (
                                                                            <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-3">
                                                                                Unit {unitIdx + 1} of {rowItems.length}
                                                                            </p>
                                                                        )}
                                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                                                                            {buildItemDetailFields(detail).map((field) => (
                                                                                <DetailCell key={field.label} label={field.label} value={field.value} />
                                                                            ))}
                                                                        </div>

                                                                        {(detail.maintenance_notes || detail.maintenance_voice_url || detail.extinguisher_photo || detail.certificate_photo) && (
                                                                            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-6">
                                                                                {detail.maintenance_notes && (
                                                                                    <div className="min-w-[200px] flex-1">
                                                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Notes</p>
                                                                                        <p className="text-sm text-slate-600 italic leading-relaxed">"{detail.maintenance_notes}"</p>
                                                                                    </div>
                                                                                )}
                                                                                {detail.maintenance_voice_url && (
                                                                                    <div className="min-w-[200px]">
                                                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                                                            <Mic size={12} className="text-primary-500" /> Voice Note
                                                                                        </p>
                                                                                        <audio controls src={detail.maintenance_voice_url} className="h-9 w-full max-w-[220px]">
                                                                                            Your browser does not support the audio element.
                                                                                        </audio>
                                                                                    </div>
                                                                                )}
                                                                                {(detail.extinguisher_photo || detail.certificate_photo) && (
                                                                                    <div>
                                                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Photo Reference</p>
                                                                                        <div className="flex gap-3">
                                                                                            {detail.extinguisher_photo && (
                                                                                                <a href={detail.extinguisher_photo} target="_blank" rel="noopener noreferrer" title="Extinguisher photo">
                                                                                                    <img
                                                                                                        src={detail.extinguisher_photo}
                                                                                                        alt="Extinguisher"
                                                                                                        className="h-20 w-20 object-cover rounded-xl border border-slate-200 shadow-sm hover:opacity-90 transition-opacity"
                                                                                                    />
                                                                                                </a>
                                                                                            )}
                                                                                            {detail.certificate_photo && (
                                                                                                <a href={detail.certificate_photo} target="_blank" rel="noopener noreferrer" title="Certificate photo">
                                                                                                    <img
                                                                                                        src={detail.certificate_photo}
                                                                                                        alt="Certificate"
                                                                                                        className="h-20 w-20 object-cover rounded-xl border border-slate-200 shadow-sm hover:opacity-90 transition-opacity"
                                                                                                    />
                                                                                                </a>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValidationInquiryDetail;
